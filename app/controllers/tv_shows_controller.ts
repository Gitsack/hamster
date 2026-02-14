import type { HttpContext } from '@adonisjs/core/http'
import TvShow from '#models/tv_show'
import Season from '#models/season'
import Episode from '#models/episode'
import EpisodeFile from '#models/episode_file'
import Download from '#models/download'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { tmdbService } from '#services/metadata/tmdb_service'
import { justwatchService } from '#services/metadata/justwatch_service'
import { requestedSearchTask } from '#services/tasks/requested_search_task'
import AppSetting from '#models/app_setting'
import { downloadManager } from '#services/download_clients/download_manager'
import { libraryCleanupService } from '#services/library/library_cleanup_service'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const tvShowValidator = vine.compile(
  vine.object({
    tmdbId: vine.string().optional(),
    title: vine.string().minLength(1),
    year: vine.number().optional(),
    qualityProfileId: vine.string().optional(),
    rootFolderId: vine.string(),
    requested: vine.boolean().optional(),
    monitored: vine.boolean().optional(),
    searchOnAdd: vine.boolean().optional(),
    selectedSeasons: vine.array(vine.number()).optional(),
    // Episode-level selection: { seasonNumber: [episodeNumbers] }
    selectedEpisodes: vine.record(vine.array(vine.number())).optional(),
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
      const results = await tmdbService.searchTvShows(
        query,
        year ? Number.parseInt(year) : undefined
      )

      // Check which shows are already in library with their status
      const tmdbIds = results.map((r) => String(r.id))
      const existing = await TvShow.query().whereIn('tmdbId', tmdbIds)
      const existingMap = new Map(existing.map((s) => [s.tmdbId, s]))

      return response.json(
        results.map((show) => {
          const libraryShow = existingMap.get(String(show.id))
          return {
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
            inLibrary: !!libraryShow,
            libraryId: libraryShow?.id,
            requested: libraryShow?.requested ?? false,
          }
        })
      )
    } catch (error) {
      console.error('TMDB search error:', error)
      return response.badRequest({ error: 'Failed to search TV shows' })
    }
  }

  /**
   * Preview TV show details from TMDB (before adding to library)
   */
  async preview({ request, response }: HttpContext) {
    const tmdbId = request.input('tmdbId')

    if (!tmdbId) {
      return response.badRequest({ error: 'tmdbId is required' })
    }

    try {
      const [show, cast] = await Promise.all([
        tmdbService.getTvShow(Number.parseInt(tmdbId)),
        tmdbService.getTvShowCredits(Number.parseInt(tmdbId), 6),
      ])

      // Fetch JustWatch streaming availability using TMDB data (non-blocking)
      let offers: any[] = []
      const justwatchEnabled = await AppSetting.get<boolean>('justwatchEnabled', false)
      if (justwatchEnabled && show.name && show.year) {
        offers = await justwatchService
          .getStreamingAvailability(show.name, show.year, 'show')
          .catch(() => [])
      }

      // Check if already in library
      const existing = await TvShow.query().where('tmdbId', String(show.id)).first()

      return response.json({
        tmdbId: String(show.id),
        title: show.name,
        originalTitle: show.originalName,
        year: show.year,
        overview: show.overview,
        posterUrl: show.posterPath,
        backdropUrl: show.backdropPath,
        firstAirDate: show.firstAirDate,
        status: show.status,
        rating: show.voteAverage,
        votes: show.voteCount,
        genres: show.genres,
        networks: show.networks,
        seasonCount: show.numberOfSeasons,
        episodeCount: show.numberOfEpisodes,
        cast: cast.map((c) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profileUrl: c.profilePath,
        })),
        streamingOffers: offers,
        inLibrary: !!existing,
        libraryId: existing?.id,
        requested: existing?.requested ?? false,
      })
    } catch (error) {
      console.error('TMDB preview error:', error)
      return response.badRequest({ error: 'Failed to fetch TV show details' })
    }
  }

  /**
   * Get discover/popular TV shows (for browsing when no search query)
   */
  async discover({ request, response }: HttpContext) {
    const category = request.input('category', 'popular') as
      | 'popular'
      | 'on_the_air'
      | 'top_rated'
      | 'trending'

    try {
      let results
      switch (category) {
        case 'on_the_air':
          results = await tmdbService.getOnTheAirTvShows()
          break
        case 'top_rated':
          results = await tmdbService.getTopRatedTvShows()
          break
        case 'trending':
          results = await tmdbService.getTrendingTvShows('week')
          break
        case 'popular':
        default:
          results = await tmdbService.getPopularTvShows()
      }

      // Check which shows are already in library with their status
      const tmdbIds = results.map((r) => String(r.id))
      const existing = await TvShow.query().whereIn('tmdbId', tmdbIds)
      const existingMap = new Map(existing.map((s) => [s.tmdbId, s]))

      return response.json({
        category,
        results: results.map((show) => {
          const libraryShow = existingMap.get(String(show.id))
          return {
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
            genres: show.genres,
            inLibrary: !!libraryShow,
            libraryId: libraryShow?.id,
            requested: libraryShow?.requested ?? false,
          }
        }),
      })
    } catch (error) {
      console.error('TMDB discover error:', error)
      return response.badRequest({ error: 'Failed to fetch TV shows' })
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
      monitored: data.monitored ?? true,
      seasonCount: 0,
      episodeCount: 0,
      qualityProfileId: data.qualityProfileId,
      rootFolderId: data.rootFolderId,
      addedAt: DateTime.now(),
    }

    if (data.tmdbId) {
      try {
        const tmdbData = await tmdbService.getTvShow(Number.parseInt(data.tmdbId))
        showData = {
          ...showData,
          tmdbId: String(tmdbData.id),
          title: tmdbData.name,
          originalTitle: tmdbData.originalName,
          sortTitle: tmdbData.name.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
          overview: tmdbData.overview,
          firstAired: tmdbData.firstAirDate ? DateTime.fromISO(tmdbData.firstAirDate) : null,
          year: tmdbData.year,
          runtime:
            tmdbData.numberOfEpisodes > 0
              ? Math.round(tmdbData.numberOfEpisodes / tmdbData.numberOfSeasons)
              : null,
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

    let show: TvShow
    try {
      show = await TvShow.create(showData)
    } catch (error) {
      console.error('Failed to create TV show in database:', error)
      return response.internalServerError({ error: 'Failed to add TV show' })
    }

    // Fetch and create seasons/episodes
    if (data.tmdbId) {
      try {
        const seasons = await tmdbService.getTvShowSeasons(Number.parseInt(data.tmdbId))

        // Determine which seasons should be requested
        // If selectedSeasons is provided, only those seasons are requested
        // If selectedSeasons is undefined, all seasons are requested (backward compatibility)
        // If selectedSeasons is empty array, no seasons are requested
        const selectedSeasonNumbers = data.selectedSeasons ? new Set(data.selectedSeasons) : null // null means all seasons

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
          const { episodes } = await tmdbService.getTvShowSeason(
            Number.parseInt(data.tmdbId),
            seasonData.seasonNumber
          )

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
      monitored: show.monitored,
      seasonCount: show.seasonCount,
      episodeCount: show.episodeCount,
      qualityProfile: show.qualityProfile,
      rootFolder: show.rootFolder,
      seasons: await Promise.all(
        show.seasons.map(async (s) => {
          const downloadedCount = s.episodes.filter((e) => e.hasFile).length
          const downloadingCount = s.episodes.filter((e) => downloadingEpisodeIds.has(e.id)).length
          const requestedCount = s.episodes.filter(
            (e) => e.requested && !e.hasFile && !downloadingEpisodeIds.has(e.id)
          ).length

          // Auto-sync season requested status if out of sync with episodes
          // If season is marked requested but no episodes are actually requested, reset it
          if (s.requested && requestedCount === 0 && downloadingCount === 0) {
            s.requested = false
            await s.save()
            console.log(
              `[TvShowsController] Auto-synced season ${s.seasonNumber} requested=false (no requested episodes)`
            )
          }

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
        })
      ),
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

    const { requested, monitored, qualityProfileId, rootFolderId } = request.only([
      'requested',
      'monitored',
      'qualityProfileId',
      'rootFolderId',
    ])

    if (requested !== undefined) show.requested = requested
    if (monitored !== undefined) show.monitored = monitored
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

    return response.json({ id: show.id, title: show.title, requested: show.requested, monitored: show.monitored })
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

    // If unrequesting (setting to false)
    if (!newStatus) {
      // Cancel any active download for this episode
      const activeDownload = await Download.query()
        .where('episodeId', episode.id)
        .whereIn('status', ['queued', 'downloading', 'paused'])
        .first()

      if (activeDownload) {
        try {
          await downloadManager.cancel(activeDownload.id, true)
        } catch (error) {
          console.error(
            `[TvShowsController] Failed to cancel download ${activeDownload.id}:`,
            error
          )
        }
      }

      // If episode has a file, return error - frontend should show confirmation dialog
      if (episode.hasFile) {
        return response.badRequest({
          error: 'Item has downloaded files',
          hasFile: true,
          message: 'Use destroyEpisode endpoint with deleteFile=true to remove files and record',
        })
      }

      // Episode has no file - delete it and trigger cascade removal
      const seasonId = episode.seasonId
      const showId = episode.tvShowId
      console.log(
        `[TvShowsController] Unrequesting episode without file, deleting: S${episode.seasonNumber}E${episode.episodeNumber}`
      )
      await episode.delete()

      // Check if season should be removed
      const seasonRemoved = await libraryCleanupService.removeSeasonIfEmpty(seasonId)

      // Check if show should be removed
      if (!seasonRemoved) {
        await libraryCleanupService.removeTvShowIfEmpty(showId)
      } else {
        // If season was removed, still need to check show
        await libraryCleanupService.removeTvShowIfEmpty(showId)
      }

      return response.json({
        id: episode.id,
        deleted: true,
        message: 'Removed from library',
      })
    }

    // Requesting (setting to true)
    episode.requested = true
    await episode.save()

    // Trigger search if marking as requested and episode doesn't have file
    if (!episode.hasFile) {
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

    // If unrequesting (setting to false)
    if (!newStatus) {
      const episodeIds = season.episodes.map((e) => e.id)

      // Cancel all active downloads for episodes in this season
      let activeDownloads = await Download.query()
        .whereIn('episodeId', episodeIds)
        .whereIn('status', ['queued', 'downloading', 'paused'])

      // Fallback: also search by tvShowId for downloads that might not have episodeId set
      if (activeDownloads.length === 0) {
        const showDownloads = await Download.query()
          .where('tvShowId', params.id)
          .whereIn('status', ['queued', 'downloading', 'paused'])

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

      // Check if any episodes have files
      const episodesWithFiles = season.episodes.filter((e) => e.hasFile)
      if (episodesWithFiles.length > 0) {
        return response.badRequest({
          error: 'Season has episodes with downloaded files',
          hasFile: true,
          episodesWithFiles: episodesWithFiles.length,
          message: 'Delete episode files first before unrequesting the season',
        })
      }

      // No episodes have files - delete all episodes in the season
      const showId = params.id
      console.log(
        `[TvShowsController] Unrequesting season without files, deleting: Season ${season.seasonNumber}`
      )

      // Delete all episodes
      await Episode.query().where('seasonId', season.id).delete()

      // Delete the season
      await season.delete()

      // Check if show should be removed
      await libraryCleanupService.removeTvShowIfEmpty(showId)

      return response.json({
        seasonNumber: params.seasonNumber,
        deleted: true,
        message: 'Season removed from library',
      })
    }

    // Requesting (setting to true)
    season.requested = newStatus
    await season.save()

    // Update all episodes in this season
    await Episode.query().where('seasonId', season.id).update({ requested: newStatus })

    // Trigger search if marking as requested
    const show = await TvShow.find(params.id)
    if (show) {
      requestedSearchTask.searchTvShowEpisodes(show.id).catch((error) => {
        console.error('Failed to trigger search for season:', error)
      })
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
      const seasons = await tmdbService.getTvShowSeasons(Number.parseInt(tmdbId))

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
      const { episodes } = await tmdbService.getTvShowSeason(
        Number.parseInt(tmdbId),
        Number.parseInt(seasonNumber)
      )

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

  /**
   * Enrich a TV show that doesn't have a TMDB ID by searching and linking
   */
  async enrich({ params, response }: HttpContext) {
    const show = await TvShow.query()
      .where('id', params.id)
      .preload('seasons', (query) => query.preload('episodes'))
      .first()

    if (!show) {
      return response.notFound({ error: 'TV show not found' })
    }

    if (show.tmdbId) {
      return response.badRequest({
        error: 'TV show already has a TMDB ID. Use refresh instead.',
      })
    }

    // Search TMDB for this show
    const results = await tmdbService.searchTvShows(show.title, show.year ?? undefined)
    if (results.length === 0) {
      return response.json({
        id: show.id,
        title: show.title,
        enriched: false,
        message: 'No matching TV show found on TMDB',
      })
    }

    // Find best match (exact title match preferred, then year match)
    const exactMatch = results.find(
      (r) =>
        r.name.toLowerCase() === show.title.toLowerCase() && (!show.year || r.year === show.year)
    )
    const best = exactMatch || results[0]

    // Fetch full details from TMDB
    try {
      const tmdbData = await tmdbService.getTvShow(best.id)

      show.merge({
        tmdbId: String(tmdbData.id),
        originalTitle: tmdbData.originalName || null,
        sortTitle: tmdbData.name.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
        overview: tmdbData.overview || null,
        firstAired: tmdbData.firstAirDate ? DateTime.fromISO(tmdbData.firstAirDate) : null,
        year: tmdbData.year || show.year,
        status: tmdbData.status || null,
        network: tmdbData.networks[0] || null,
        posterUrl: tmdbData.posterPath || null,
        backdropUrl: tmdbData.backdropPath || null,
        rating: tmdbData.voteAverage || null,
        votes: tmdbData.voteCount || null,
        genres: tmdbData.genres || null,
        seasonCount: tmdbData.numberOfSeasons || show.seasonCount,
        episodeCount: tmdbData.numberOfEpisodes || show.episodeCount,
      })
      await show.save()

      // Enrich existing seasons with TMDB data
      const tmdbSeasons = await tmdbService.getTvShowSeasons(best.id)

      for (const season of show.seasons) {
        const tmdbSeason = tmdbSeasons.find((s) => s.seasonNumber === season.seasonNumber)
        if (tmdbSeason) {
          season.merge({
            tmdbId: String(tmdbSeason.id),
            title: tmdbSeason.name || season.title,
            overview: tmdbSeason.overview || null,
            airDate: tmdbSeason.airDate ? DateTime.fromISO(tmdbSeason.airDate) : null,
            posterUrl: tmdbSeason.posterPath || null,
            episodeCount: tmdbSeason.episodeCount || season.episodeCount,
          })
          await season.save()

          // Enrich episodes and create missing ones
          const { episodes: tmdbEpisodes } = await tmdbService.getTvShowSeason(
            best.id,
            season.seasonNumber
          )

          // Create a set of existing episode numbers for quick lookup
          const existingEpisodeNumbers = new Set(season.episodes.map((e) => e.episodeNumber))

          // Update existing episodes
          for (const episode of season.episodes) {
            const tmdbEpisode = tmdbEpisodes.find((e) => e.episodeNumber === episode.episodeNumber)
            if (tmdbEpisode) {
              episode.merge({
                tmdbId: String(tmdbEpisode.id),
                title: tmdbEpisode.name || episode.title,
                overview: tmdbEpisode.overview || null,
                airDate: tmdbEpisode.airDate ? DateTime.fromISO(tmdbEpisode.airDate) : null,
                runtime: tmdbEpisode.runtime || null,
                stillUrl: tmdbEpisode.stillPath || null,
                rating: tmdbEpisode.voteAverage || null,
                votes: tmdbEpisode.voteCount || null,
              })
              await episode.save()
            }
          }

          // Create missing episodes from TMDB
          for (const tmdbEpisode of tmdbEpisodes) {
            if (!existingEpisodeNumbers.has(tmdbEpisode.episodeNumber)) {
              await Episode.create({
                tvShowId: show.id,
                seasonId: season.id,
                tmdbId: String(tmdbEpisode.id),
                seasonNumber: tmdbEpisode.seasonNumber,
                episodeNumber: tmdbEpisode.episodeNumber,
                title: tmdbEpisode.name,
                overview: tmdbEpisode.overview || null,
                airDate: tmdbEpisode.airDate ? DateTime.fromISO(tmdbEpisode.airDate) : null,
                runtime: tmdbEpisode.runtime || null,
                stillUrl: tmdbEpisode.stillPath || null,
                rating: tmdbEpisode.voteAverage || null,
                votes: tmdbEpisode.voteCount || null,
                requested: show.monitored,
                hasFile: false,
              })
            }
          }
        }
      }

      return response.json({
        id: show.id,
        title: show.title,
        tmdbId: show.tmdbId,
        enriched: true,
        seasonsEnriched: show.seasons.length,
      })
    } catch (error) {
      console.error(`Failed to enrich TV show ${show.id}:`, error)
      return response.internalServerError({
        error: 'Failed to fetch TV show details from TMDB',
      })
    }
  }

  /**
   * Refresh TV show metadata and sync missing episodes from TMDB
   */
  async refresh({ params, response }: HttpContext) {
    const show = await TvShow.query()
      .where('id', params.id)
      .preload('seasons', (query) => query.preload('episodes'))
      .first()

    if (!show) {
      return response.notFound({ error: 'TV show not found' })
    }

    if (!show.tmdbId) {
      return response.badRequest({
        error: 'TV show has no TMDB ID. Use enrich instead.',
      })
    }

    try {
      const tmdbId = Number.parseInt(show.tmdbId)

      // Fetch updated show data
      const tmdbData = await tmdbService.getTvShow(tmdbId)
      show.merge({
        originalTitle: tmdbData.originalName || show.originalTitle,
        overview: tmdbData.overview || show.overview,
        status: tmdbData.status || show.status,
        posterUrl: tmdbData.posterPath || show.posterUrl,
        backdropUrl: tmdbData.backdropPath || show.backdropUrl,
        rating: tmdbData.voteAverage || show.rating,
        votes: tmdbData.voteCount || show.votes,
        seasonCount: tmdbData.numberOfSeasons || show.seasonCount,
        episodeCount: tmdbData.numberOfEpisodes || show.episodeCount,
      })
      await show.save()

      // Fetch all seasons from TMDB
      const tmdbSeasons = await tmdbService.getTvShowSeasons(tmdbId)
      let episodesCreated = 0
      let seasonsCreated = 0

      // Create a map of existing seasons for quick lookup
      const existingSeasons = new Map(show.seasons.map((s) => [s.seasonNumber, s]))

      for (const tmdbSeason of tmdbSeasons) {
        if (tmdbSeason.seasonNumber === 0) continue // Skip specials

        let season = existingSeasons.get(tmdbSeason.seasonNumber)

        // Create season if it doesn't exist
        if (!season) {
          season = await Season.create({
            tvShowId: show.id,
            tmdbId: String(tmdbSeason.id),
            seasonNumber: tmdbSeason.seasonNumber,
            title: tmdbSeason.name,
            overview: tmdbSeason.overview || null,
            airDate: tmdbSeason.airDate ? DateTime.fromISO(tmdbSeason.airDate) : null,
            posterUrl: tmdbSeason.posterPath || null,
            episodeCount: tmdbSeason.episodeCount,
            requested: show.monitored,
          })
          seasonsCreated++
          existingSeasons.set(tmdbSeason.seasonNumber, season)
        } else {
          // Update existing season
          season.merge({
            tmdbId: String(tmdbSeason.id),
            title: tmdbSeason.name || season.title,
            overview: tmdbSeason.overview || season.overview,
            airDate: tmdbSeason.airDate ? DateTime.fromISO(tmdbSeason.airDate) : season.airDate,
            posterUrl: tmdbSeason.posterPath || season.posterUrl,
            episodeCount: tmdbSeason.episodeCount || season.episodeCount,
          })
          await season.save()
        }

        // Fetch episodes for this season
        const { episodes: tmdbEpisodes } = await tmdbService.getTvShowSeason(
          tmdbId,
          tmdbSeason.seasonNumber
        )

        // Get existing episodes for this season
        const existingEpisodes = season.episodes || []
        const existingEpisodeNumbers = new Set(existingEpisodes.map((e) => e.episodeNumber))

        // Update existing episodes
        for (const episode of existingEpisodes) {
          const tmdbEpisode = tmdbEpisodes.find((e) => e.episodeNumber === episode.episodeNumber)
          if (tmdbEpisode) {
            episode.merge({
              tmdbId: String(tmdbEpisode.id),
              title: tmdbEpisode.name || episode.title,
              overview: tmdbEpisode.overview || episode.overview,
              airDate: tmdbEpisode.airDate
                ? DateTime.fromISO(tmdbEpisode.airDate)
                : episode.airDate,
              runtime: tmdbEpisode.runtime || episode.runtime,
              stillUrl: tmdbEpisode.stillPath || episode.stillUrl,
              rating: tmdbEpisode.voteAverage || episode.rating,
              votes: tmdbEpisode.voteCount || episode.votes,
            })
            await episode.save()
          }
        }

        // Create missing episodes
        for (const tmdbEpisode of tmdbEpisodes) {
          if (!existingEpisodeNumbers.has(tmdbEpisode.episodeNumber)) {
            await Episode.create({
              tvShowId: show.id,
              seasonId: season.id,
              tmdbId: String(tmdbEpisode.id),
              seasonNumber: tmdbEpisode.seasonNumber,
              episodeNumber: tmdbEpisode.episodeNumber,
              title: tmdbEpisode.name,
              overview: tmdbEpisode.overview || null,
              airDate: tmdbEpisode.airDate ? DateTime.fromISO(tmdbEpisode.airDate) : null,
              runtime: tmdbEpisode.runtime || null,
              stillUrl: tmdbEpisode.stillPath || null,
              rating: tmdbEpisode.voteAverage || null,
              votes: tmdbEpisode.voteCount || null,
              requested: show.monitored,
              hasFile: false,
            })
            episodesCreated++
          }
        }
      }

      return response.json({
        id: show.id,
        title: show.title,
        refreshed: true,
        seasonsCreated,
        episodesCreated,
      })
    } catch (error) {
      console.error(`Failed to refresh TV show ${show.id}:`, error)
      return response.internalServerError({
        error: 'Failed to refresh TV show from TMDB',
      })
    }
  }

  /**
   * Delete an episode file from disk and database
   */
  async deleteEpisodeFile({ params, response }: HttpContext) {
    const episode = await Episode.query()
      .where('id', params.episodeId)
      .preload('tvShow', (query) => query.preload('rootFolder'))
      .preload('episodeFile')
      .first()

    if (!episode) {
      return response.notFound({ error: 'Episode not found' })
    }

    // Handle case where hasFile is true but episodeFile record is missing (data inconsistency)
    if (!episode.episodeFile) {
      // Just reset the hasFile flag
      episode.hasFile = false
      episode.episodeFileId = null
      await episode.save()
      console.log(
        `[TvShowsController] Reset hasFile flag for episode without file record: ${episode.id}`
      )
      return response.json({
        message: 'Episode status reset (no file record found)',
        episodeId: episode.id,
      })
    }

    if (!episode.tvShow?.rootFolder) {
      // Still allow deletion of the file record even without root folder
      await EpisodeFile.query().where('id', episode.episodeFile.id).delete()
      episode.hasFile = false
      episode.episodeFileId = null
      await episode.save()
      return response.json({
        message: 'File record deleted (no root folder configured)',
        episodeId: episode.id,
      })
    }

    const absolutePath = path.join(episode.tvShow.rootFolder.path, episode.episodeFile.relativePath)
    const folderPath = path.dirname(absolutePath)

    try {
      // Delete the file from disk
      await fs.unlink(absolutePath)
      console.log(`[TvShowsController] Deleted episode file: ${absolutePath}`)

      // Try to remove the season folder if empty
      try {
        const remainingFiles = await fs.readdir(folderPath)
        if (remainingFiles.length === 0) {
          await fs.rmdir(folderPath)
          console.log(`[TvShowsController] Removed empty folder: ${folderPath}`)

          // Try to remove the show folder if also empty
          const showFolder = path.dirname(folderPath)
          const remainingSeasons = await fs.readdir(showFolder)
          if (remainingSeasons.length === 0) {
            await fs.rmdir(showFolder)
            console.log(`[TvShowsController] Removed empty show folder: ${showFolder}`)
          }
        }
      } catch {
        // Folder might not be empty or other error, ignore
      }
    } catch (error) {
      console.error(`[TvShowsController] Failed to delete file: ${absolutePath}`, error)
      // Continue with database cleanup even if file deletion fails
    }

    // Delete the EpisodeFile record
    await EpisodeFile.query().where('id', episode.episodeFile.id).delete()

    // Update episode hasFile flag
    episode.hasFile = false
    episode.episodeFileId = null
    await episode.save()

    return response.json({
      message: 'File deleted successfully',
      episodeId: episode.id,
    })
  }

  /**
   * Delete an episode completely (optionally with its file)
   * Use this when user confirms deletion of an episode that has a file
   */
  async destroyEpisode({ params, request, response }: HttpContext) {
    const episode = await Episode.query()
      .where('id', params.episodeId)
      .preload('tvShow', (query) => query.preload('rootFolder'))
      .preload('episodeFile')
      .first()

    if (!episode) {
      return response.notFound({ error: 'Episode not found' })
    }

    const deleteFile = request.input('deleteFile') === 'true'
    let fileDeleted = false
    const seasonId = episode.seasonId
    const showId = episode.tvShowId

    // If episode has a file and deleteFile is requested, delete the file first
    if (deleteFile && episode.episodeFile && episode.tvShow?.rootFolder) {
      const absolutePath = path.join(
        episode.tvShow.rootFolder.path,
        episode.episodeFile.relativePath
      )
      const folderPath = path.dirname(absolutePath)

      try {
        await fs.unlink(absolutePath)
        console.log(`[TvShowsController] Deleted episode file: ${absolutePath}`)
        fileDeleted = true

        // Try to remove the season folder if empty
        try {
          const remainingFiles = await fs.readdir(folderPath)
          if (remainingFiles.length === 0) {
            await fs.rmdir(folderPath)
            console.log(`[TvShowsController] Removed empty folder: ${folderPath}`)

            // Try to remove the show folder if also empty
            const showFolder = path.dirname(folderPath)
            const remainingSeasons = await fs.readdir(showFolder)
            if (remainingSeasons.length === 0) {
              await fs.rmdir(showFolder)
              console.log(`[TvShowsController] Removed empty show folder: ${showFolder}`)
            }
          }
        } catch {
          // Folder might not be empty or other error, ignore
        }
      } catch (error) {
        console.error(`[TvShowsController] Failed to delete file: ${absolutePath}`, error)
        // Continue with record deletion even if file deletion fails
      }

      // Delete the EpisodeFile record
      if (episode.episodeFile) {
        await EpisodeFile.query().where('id', episode.episodeFile.id).delete()
      }
    }

    // Delete the episode
    console.log(
      `[TvShowsController] Deleting episode: S${episode.seasonNumber}E${episode.episodeNumber}`
    )
    await episode.delete()

    // Check if season should be removed
    const seasonRemoved = await libraryCleanupService.removeSeasonIfEmpty(seasonId)

    // Check if show should be removed
    if (!seasonRemoved) {
      await libraryCleanupService.removeTvShowIfEmpty(showId)
    } else {
      await libraryCleanupService.removeTvShowIfEmpty(showId)
    }

    return response.json({
      id: params.episodeId,
      deleted: true,
      fileDeleted,
    })
  }
}
