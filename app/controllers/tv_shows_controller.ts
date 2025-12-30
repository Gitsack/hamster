import type { HttpContext } from '@adonisjs/core/http'
import TvShow from '#models/tv_show'
import Season from '#models/season'
import Episode from '#models/episode'
import Download from '#models/download'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { tmdbService } from '#services/metadata/tmdb_service'
import { requestedSearchTask } from '#services/tasks/requested_search_task'
import { downloadManager } from '#services/download_clients/download_manager'

const tvShowValidator = vine.compile(
  vine.object({
    tmdbId: vine.string().optional(),
    title: vine.string().minLength(1),
    year: vine.number().optional(),
    qualityProfileId: vine.string().optional(),
    rootFolderId: vine.string(),
    requested: vine.boolean().optional(),
    searchOnAdd: vine.boolean().optional(),
    selectedSeasons: vine.array(vine.number()).optional(),
    // Episode-level selection: { seasonNumber: [episodeNumbers] }
    selectedEpisodes: vine
      .record(vine.array(vine.number()))
      .optional(),
  })
)

export default class TvShowsController {
  async index({ response }: HttpContext) {
    const shows = await TvShow.query()
      .preload('qualityProfile')
      .preload('rootFolder')
      .orderBy('sortTitle', 'asc')

    return response.json(
      shows.map((show) => ({
        id: show.id,
        tmdbId: show.tmdbId,
        title: show.title,
        year: show.year,
        overview: show.overview,
        posterUrl: show.posterUrl,
        status: show.status,
        network: show.network,
        requested: show.requested,
        seasonCount: show.seasonCount,
        episodeCount: show.episodeCount,
        qualityProfile: show.qualityProfile?.name,
        rootFolder: show.rootFolder?.path,
        addedAt: show.addedAt?.toISO(),
      }))
    )
  }

  async search({ request, response }: HttpContext) {
    const query = request.input('q', '')
    const year = request.input('year')

    if (!query) {
      return response.badRequest({ error: 'Search query is required' })
    }

    try {
      const results = await tmdbService.searchTvShows(query, year ? parseInt(year) : undefined)

      // Check which shows are already in library
      const tmdbIds = results.map((r) => String(r.id))
      const existing = await TvShow.query().whereIn('tmdbId', tmdbIds)
      const existingIds = new Set(existing.map((s) => s.tmdbId))

      return response.json(
        results.map((show) => ({
          tmdbId: String(show.id),
          title: show.name,
          year: show.year,
          overview: show.overview,
          posterUrl: show.posterPath,
          firstAirDate: show.firstAirDate,
          status: show.status,
          rating: show.voteAverage,
          seasonCount: show.numberOfSeasons,
          episodeCount: show.numberOfEpisodes,
          inLibrary: existingIds.has(String(show.id)),
        }))
      )
    } catch (error) {
      console.error('TMDB search error:', error)
      return response.badRequest({ error: 'Failed to search TV shows' })
    }
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(tvShowValidator)

    // Check if already exists
    if (data.tmdbId) {
      const existing = await TvShow.query().where('tmdbId', data.tmdbId).first()
      if (existing) {
        return response.conflict({ error: 'TV show already in library' })
      }
    }

    let showData: any = {
      title: data.title,
      sortTitle: data.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
      year: data.year,
      requested: data.requested ?? true,
      seasonCount: 0,
      episodeCount: 0,
      qualityProfileId: data.qualityProfileId,
      rootFolderId: data.rootFolderId,
      addedAt: DateTime.now(),
    }

    if (data.tmdbId) {
      try {
        const tmdbData = await tmdbService.getTvShow(parseInt(data.tmdbId))
        showData = {
          ...showData,
          tmdbId: String(tmdbData.id),
          title: tmdbData.name,
          originalTitle: tmdbData.originalName,
          sortTitle: tmdbData.name.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
          overview: tmdbData.overview,
          firstAired: tmdbData.firstAirDate ? DateTime.fromISO(tmdbData.firstAirDate) : null,
          year: tmdbData.year,
          runtime: tmdbData.numberOfEpisodes > 0 ? Math.round(tmdbData.numberOfEpisodes / tmdbData.numberOfSeasons) : null,
          status: tmdbData.status,
          network: tmdbData.networks[0] || null,
          posterUrl: tmdbData.posterPath,
          backdropUrl: tmdbData.backdropPath,
          rating: tmdbData.voteAverage,
          votes: tmdbData.voteCount,
          genres: tmdbData.genres,
          seasonCount: tmdbData.numberOfSeasons,
          episodeCount: tmdbData.numberOfEpisodes,
        }
      } catch (error) {
        console.error('Failed to fetch TMDB data:', error)
      }
    }

    const show = await TvShow.create(showData)

    // Fetch and create seasons/episodes
    if (data.tmdbId) {
      try {
        const seasons = await tmdbService.getTvShowSeasons(parseInt(data.tmdbId))

        // Determine which seasons should be requested
        // If selectedSeasons is provided, only those seasons are requested
        // If selectedSeasons is undefined, all seasons are requested (backward compatibility)
        // If selectedSeasons is empty array, no seasons are requested
        const selectedSeasonNumbers = data.selectedSeasons
          ? new Set(data.selectedSeasons)
          : null // null means all seasons

        // Episode-level selection: { "1": [1, 2, 3], "2": [5, 6] }
        const selectedEpisodeMap = data.selectedEpisodes || null

        for (const seasonData of seasons) {
          if (seasonData.seasonNumber === 0) continue // Skip specials for now

          // Check if we have episode-level selection for this season
          const seasonKey = String(seasonData.seasonNumber)
          const hasEpisodeLevelSelection = selectedEpisodeMap && seasonKey in selectedEpisodeMap
          const selectedEpisodesInSeason = hasEpisodeLevelSelection
            ? new Set(selectedEpisodeMap[seasonKey])
            : null

          // Determine if this season should be marked as requested
          // A season is requested if:
          // 1. It's in selectedSeasons (season-level selection)
          // 2. OR it has any episodes selected (episode-level selection)
          // 3. OR no selection provided at all and default is true
          let seasonRequested: boolean
          if (selectedEpisodeMap && hasEpisodeLevelSelection) {
            // Episode-level selection for this season: requested if any episodes selected
            seasonRequested = selectedEpisodesInSeason!.size > 0
          } else if (selectedEpisodeMap && !hasEpisodeLevelSelection) {
            // Episode-level selection exists but NOT for this season: NOT requested
            seasonRequested = false
          } else if (selectedSeasonNumbers !== null) {
            // Season-level selection: use the selection
            seasonRequested = selectedSeasonNumbers.has(seasonData.seasonNumber)
          } else {
            // No selection provided at all: default to requested
            seasonRequested = data.requested ?? true
          }

          const season = await Season.create({
            tvShowId: show.id,
            tmdbId: String(seasonData.id),
            seasonNumber: seasonData.seasonNumber,
            title: seasonData.name,
            overview: seasonData.overview,
            airDate: seasonData.airDate ? DateTime.fromISO(seasonData.airDate) : null,
            posterUrl: seasonData.posterPath,
            episodeCount: seasonData.episodeCount,
            requested: seasonRequested,
          })

          // Fetch episodes for this season
          const { episodes } = await tmdbService.getTvShowSeason(parseInt(data.tmdbId), seasonData.seasonNumber)

          for (const episodeData of episodes) {
            // Determine if this episode should be requested
            let episodeRequested: boolean
            if (selectedEpisodesInSeason) {
              // Episode-level selection for this season: check if this episode is selected
              episodeRequested = selectedEpisodesInSeason.has(episodeData.episodeNumber)
            } else if (selectedEpisodeMap && !hasEpisodeLevelSelection) {
              // Episode-level selection exists but NOT for this season: NOT requested
              episodeRequested = false
            } else {
              // Inherit from season (no episode-level selection)
              episodeRequested = seasonRequested
            }

            await Episode.create({
              tvShowId: show.id,
              seasonId: season.id,
              tmdbId: String(episodeData.id),
              seasonNumber: episodeData.seasonNumber,
              episodeNumber: episodeData.episodeNumber,
              title: episodeData.name,
              overview: episodeData.overview,
              airDate: episodeData.airDate ? DateTime.fromISO(episodeData.airDate) : null,
              runtime: episodeData.runtime,
              stillUrl: episodeData.stillPath,
              rating: episodeData.voteAverage,
              votes: episodeData.voteCount,
              requested: episodeRequested,
              hasFile: false,
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch seasons/episodes:', error)
      }
    }

    // Trigger immediate search if requested and searchOnAdd is enabled
    if ((data.requested ?? true) && data.searchOnAdd !== false) {
      requestedSearchTask.searchTvShowEpisodes(show.id).catch((error) => {
        console.error('Failed to trigger search for TV show:', error)
      })
    }

    return response.created({
      id: show.id,
      title: show.title,
      year: show.year,
    })
  }

  async show({ params, response }: HttpContext) {
    const show = await TvShow.query()
      .where('id', params.id)
      .preload('qualityProfile')
      .preload('rootFolder')
      .preload('seasons', (query) => {
        query.orderBy('seasonNumber', 'asc').preload('episodes')
      })
      .first()

    if (!show) {
      return response.notFound({ error: 'TV show not found' })
    }

    // Get active downloads for this show
    const activeDownloads = await Download.query()
      .where('tvShowId', show.id)
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const downloadingEpisodeIds = new Set(activeDownloads.map((d) => d.episodeId))

    return response.json({
      id: show.id,
      tmdbId: show.tmdbId,
      title: show.title,
      originalTitle: show.originalTitle,
      year: show.year,
      overview: show.overview,
      firstAired: show.firstAired?.toISODate(),
      status: show.status,
      network: show.network,
      posterUrl: show.posterUrl,
      backdropUrl: show.backdropUrl,
      rating: show.rating,
      genres: show.genres,
      requested: show.requested,
      seasonCount: show.seasonCount,
      episodeCount: show.episodeCount,
      qualityProfile: show.qualityProfile,
      rootFolder: show.rootFolder,
      seasons: show.seasons.map((s) => {
        const downloadedCount = s.episodes.filter((e) => e.hasFile).length
        const downloadingCount = s.episodes.filter((e) => downloadingEpisodeIds.has(e.id)).length
        const requestedCount = s.episodes.filter((e) => e.requested && !e.hasFile && !downloadingEpisodeIds.has(e.id)).length

        return {
          id: s.id,
          seasonNumber: s.seasonNumber,
          title: s.title,
          episodeCount: s.episodeCount,
          requested: s.requested,
          posterUrl: s.posterUrl,
          downloadedCount,
          downloadingCount,
          requestedCount,
        }
      }),
      addedAt: show.addedAt?.toISO(),
    })
  }

  async showSeason({ params, response }: HttpContext) {
    const season = await Season.query()
      .where('tvShowId', params.id)
      .where('seasonNumber', params.seasonNumber)
      .preload('episodes', (query) => {
        query.orderBy('episodeNumber', 'asc').preload('episodeFile')
      })
      .first()

    if (!season) {
      return response.notFound({ error: 'Season not found' })
    }

    return response.json({
      id: season.id,
      seasonNumber: season.seasonNumber,
      title: season.title,
      overview: season.overview,
      airDate: season.airDate?.toISODate(),
      posterUrl: season.posterUrl,
      requested: season.requested,
      episodes: season.episodes.map((e) => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        title: e.title,
        overview: e.overview,
        airDate: e.airDate?.toISODate(),
        runtime: e.runtime,
        stillUrl: e.stillUrl,
        requested: e.requested,
        hasFile: e.hasFile,
        episodeFile: e.episodeFile
          ? {
              id: e.episodeFile.id,
              path: e.episodeFile.relativePath,
              size: e.episodeFile.sizeBytes,
              quality: e.episodeFile.quality,
              downloadUrl: `/api/v1/files/episodes/${e.episodeFile.id}/download`,
            }
          : null,
      })),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const show = await TvShow.find(params.id)
    if (!show) {
      return response.notFound({ error: 'TV show not found' })
    }

    const { requested, qualityProfileId, rootFolderId } = request.only([
      'requested',
      'qualityProfileId',
      'rootFolderId',
    ])

    if (requested !== undefined) show.requested = requested
    if (qualityProfileId !== undefined) show.qualityProfileId = qualityProfileId
    if (rootFolderId !== undefined) show.rootFolderId = rootFolderId

    await show.save()

    // If unrequesting, cancel all active downloads for this show
    if (requested === false) {
      const activeDownloads = await Download.query()
        .where('tvShowId', show.id)
        .whereIn('status', ['queued', 'downloading', 'paused'])

      for (const download of activeDownloads) {
        try {
          await downloadManager.cancel(download.id, true)
        } catch (error) {
          console.error(`[TvShowsController] Failed to cancel download ${download.id}:`, error)
        }
      }
    }

    return response.json({ id: show.id, title: show.title, requested: show.requested })
  }

  async destroy({ params, response }: HttpContext) {
    const show = await TvShow.find(params.id)
    if (!show) {
      return response.notFound({ error: 'TV show not found' })
    }

    await show.delete()
    return response.noContent()
  }

  async setEpisodeWanted({ params, request, response }: HttpContext) {
    const episode = await Episode.find(params.episodeId)
    if (!episode) {
      return response.notFound({ error: 'Episode not found' })
    }

    const { requested } = request.only(['requested'])
    const newStatus = requested ?? true
    episode.requested = newStatus
    await episode.save()

    // If unrequesting, cancel any active download for this episode
    if (!newStatus) {
      const activeDownload = await Download.query()
        .where('episodeId', episode.id)
        .whereIn('status', ['queued', 'downloading', 'paused'])
        .first()

      if (activeDownload) {
        try {
          await downloadManager.cancel(activeDownload.id, true)
        } catch (error) {
          console.error(`[TvShowsController] Failed to cancel download ${activeDownload.id}:`, error)
        }
      }
    }

    // Trigger search if marking as requested and episode doesn't have file
    if (newStatus && !episode.hasFile) {
      requestedSearchTask.searchSingleEpisode(episode.id).catch((error) => {
        console.error('Failed to trigger search for episode:', error)
      })
    }

    return response.json({ id: episode.id, requested: episode.requested })
  }

  /**
   * Set season request status (and propagate to all episodes)
   */
  async setSeasonWanted({ params, request, response }: HttpContext) {
    const season = await Season.query()
      .where('tvShowId', params.id)
      .where('seasonNumber', params.seasonNumber)
      .preload('episodes')
      .first()

    if (!season) {
      return response.notFound({ error: 'Season not found' })
    }

    const { requested } = request.only(['requested'])
    const newStatus = requested ?? true

    // Update season
    season.requested = newStatus
    await season.save()

    // Update all episodes in this season
    await Episode.query()
      .where('seasonId', season.id)
      .update({ requested: newStatus })

    // If unrequesting, cancel all active downloads for episodes in this season
    if (!newStatus) {
      const episodeIds = season.episodes.map((e) => e.id)

      // First try to find downloads by episodeId
      let activeDownloads = await Download.query()
        .whereIn('episodeId', episodeIds)
        .whereIn('status', ['queued', 'downloading', 'paused'])

      // Fallback: also search by tvShowId for downloads that might not have episodeId set
      // but belong to this show (matching title pattern for this season)
      if (activeDownloads.length === 0) {
        const showDownloads = await Download.query()
          .where('tvShowId', params.id)
          .whereIn('status', ['queued', 'downloading', 'paused'])

        // Filter to only include downloads for this season (S0X pattern in title)
        const seasonPattern = new RegExp(`S0?${season.seasonNumber}E`, 'i')
        activeDownloads = showDownloads.filter((d) => seasonPattern.test(d.title))
      }

      for (const download of activeDownloads) {
        try {
          await downloadManager.cancel(download.id, true)
        } catch (error) {
          console.error(`[TvShowsController] Failed to cancel download ${download.id}:`, error)
        }
      }
    }

    // Trigger search if marking as requested
    if (newStatus) {
      const show = await TvShow.find(params.id)
      if (show) {
        requestedSearchTask.searchTvShowEpisodes(show.id).catch((error) => {
          console.error('Failed to trigger search for season:', error)
        })
      }
    }

    return response.json({
      seasonNumber: season.seasonNumber,
      requested: season.requested,
    })
  }

  /**
   * Get requested (missing) episodes
   */
  async requested({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 50)

    const episodes = await Episode.query()
      .where('requested', true)
      .where('hasFile', false)
      .preload('tvShow')
      .orderBy('createdAt', 'desc')
      .paginate(page, limit)

    return response.json({
      data: episodes.all().map((episode) => ({
        id: episode.id,
        title: episode.title,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        tvShowId: episode.tvShowId,
        tvShowTitle: episode.tvShow?.title,
        posterUrl: episode.tvShow?.posterUrl,
        airDate: episode.airDate?.toISODate(),
      })),
      meta: {
        total: episodes.total,
        perPage: episodes.perPage,
        currentPage: episodes.currentPage,
        lastPage: episodes.lastPage,
      },
    })
  }

  /**
   * Preview seasons for a TV show before adding (used for season selection)
   */
  async previewSeasons({ request, response }: HttpContext) {
    const tmdbId = request.input('tmdbId')

    if (!tmdbId) {
      return response.badRequest({ error: 'tmdbId is required' })
    }

    try {
      const seasons = await tmdbService.getTvShowSeasons(parseInt(tmdbId))

      return response.json(
        seasons
          .filter((s) => s.seasonNumber > 0) // Filter out specials
          .map((season) => ({
            seasonNumber: season.seasonNumber,
            title: season.name,
            episodeCount: season.episodeCount,
            airDate: season.airDate,
            posterUrl: season.posterPath,
          }))
      )
    } catch (error) {
      console.error('Failed to fetch seasons:', error)
      return response.badRequest({ error: 'Failed to fetch seasons from TMDB' })
    }
  }

  /**
   * Preview episodes for a season before adding (used for episode selection in dialog)
   */
  async previewEpisodes({ request, response }: HttpContext) {
    const tmdbId = request.input('tmdbId')
    const seasonNumber = request.input('seasonNumber')

    if (!tmdbId || seasonNumber === undefined) {
      return response.badRequest({ error: 'tmdbId and seasonNumber are required' })
    }

    try {
      const { episodes } = await tmdbService.getTvShowSeason(parseInt(tmdbId), parseInt(seasonNumber))

      return response.json(
        episodes.map((episode) => ({
          episodeNumber: episode.episodeNumber,
          title: episode.name,
          overview: episode.overview,
          airDate: episode.airDate,
          runtime: episode.runtime,
          stillUrl: episode.stillPath,
        }))
      )
    } catch (error) {
      console.error('Failed to fetch episodes:', error)
      return response.badRequest({ error: 'Failed to fetch episodes from TMDB' })
    }
  }

  /**
   * Trigger immediate search for all requested episodes of a TV show
   */
  async searchNow({ params, response }: HttpContext) {
    const show = await TvShow.find(params.id)
    if (!show) {
      return response.notFound({ error: 'TV show not found' })
    }

    try {
      const result = await requestedSearchTask.searchTvShowEpisodes(show.id)
      return response.json({
        message: 'Search completed',
        searched: result.searched,
        found: result.found,
        grabbed: result.grabbed,
        errors: result.errors,
      })
    } catch (error) {
      return response.internalServerError({
        error: error instanceof Error ? error.message : 'Search failed',
      })
    }
  }

  /**
   * Trigger immediate search for a specific episode
   */
  async searchEpisodeNow({ params, response }: HttpContext) {
    const episode = await Episode.find(params.episodeId)
    if (!episode) {
      return response.notFound({ error: 'Episode not found' })
    }

    try {
      const result = await requestedSearchTask.searchSingleEpisode(episode.id)
      return response.json({
        found: result.found,
        grabbed: result.grabbed,
        error: result.error,
      })
    } catch (error) {
      return response.internalServerError({
        error: error instanceof Error ? error.message : 'Search failed',
      })
    }
  }
}
