import type { HttpContext } from '@adonisjs/core/http'
import TvShow from '#models/tv_show'
import Season from '#models/season'
import Episode from '#models/episode'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { tmdbService } from '#services/metadata/tmdb_service'

const tvShowValidator = vine.compile(
  vine.object({
    tmdbId: vine.string().optional(),
    title: vine.string().minLength(1),
    year: vine.number().optional(),
    qualityProfileId: vine.number().optional(),
    rootFolderId: vine.number(),
    wanted: vine.boolean().optional(),
    searchOnAdd: vine.boolean().optional(),
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
        wanted: show.wanted,
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
      wanted: data.wanted ?? true,
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

        for (const seasonData of seasons) {
          if (seasonData.seasonNumber === 0) continue // Skip specials for now

          const season = await Season.create({
            tvShowId: show.id,
            tmdbId: String(seasonData.id),
            seasonNumber: seasonData.seasonNumber,
            title: seasonData.name,
            overview: seasonData.overview,
            airDate: seasonData.airDate ? DateTime.fromISO(seasonData.airDate) : null,
            posterUrl: seasonData.posterPath,
            episodeCount: seasonData.episodeCount,
            wanted: data.wanted ?? true,
          })

          // Fetch episodes for this season
          const { episodes } = await tmdbService.getTvShowSeason(parseInt(data.tmdbId), seasonData.seasonNumber)

          for (const episodeData of episodes) {
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
              wanted: data.wanted ?? true,
              hasFile: false,
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch seasons/episodes:', error)
      }
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
        query.orderBy('seasonNumber', 'asc')
      })
      .first()

    if (!show) {
      return response.notFound({ error: 'TV show not found' })
    }

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
      wanted: show.wanted,
      seasonCount: show.seasonCount,
      episodeCount: show.episodeCount,
      qualityProfile: show.qualityProfile,
      rootFolder: show.rootFolder,
      seasons: show.seasons.map((s) => ({
        id: s.id,
        seasonNumber: s.seasonNumber,
        title: s.title,
        episodeCount: s.episodeCount,
        wanted: s.wanted,
        posterUrl: s.posterUrl,
      })),
      addedAt: show.addedAt?.toISO(),
    })
  }

  async showSeason({ params, response }: HttpContext) {
    const season = await Season.query()
      .where('tvShowId', params.id)
      .where('seasonNumber', params.seasonNumber)
      .preload('episodes', (query) => {
        query.orderBy('episodeNumber', 'asc')
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
      wanted: season.wanted,
      episodes: season.episodes.map((e) => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        title: e.title,
        overview: e.overview,
        airDate: e.airDate?.toISODate(),
        runtime: e.runtime,
        stillUrl: e.stillUrl,
        wanted: e.wanted,
        hasFile: e.hasFile,
      })),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const show = await TvShow.find(params.id)
    if (!show) {
      return response.notFound({ error: 'TV show not found' })
    }

    const { wanted, qualityProfileId, rootFolderId } = request.only([
      'wanted',
      'qualityProfileId',
      'rootFolderId',
    ])

    if (wanted !== undefined) show.wanted = wanted
    if (qualityProfileId !== undefined) show.qualityProfileId = qualityProfileId
    if (rootFolderId !== undefined) show.rootFolderId = rootFolderId

    await show.save()

    return response.json({ id: show.id, title: show.title, wanted: show.wanted })
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

    const { wanted } = request.only(['wanted'])
    episode.wanted = wanted ?? true
    await episode.save()

    return response.json({ id: episode.id, wanted: episode.wanted })
  }
}
