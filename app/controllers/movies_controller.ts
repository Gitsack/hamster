import type { HttpContext } from '@adonisjs/core/http'
import Movie from '#models/movie'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { tmdbService } from '#services/metadata/tmdb_service'

const movieValidator = vine.compile(
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

export default class MoviesController {
  async index({ response }: HttpContext) {
    const movies = await Movie.query()
      .preload('qualityProfile')
      .preload('rootFolder')
      .preload('movieFile')
      .orderBy('sortTitle', 'asc')

    return response.json(
      movies.map((movie) => ({
        id: movie.id,
        tmdbId: movie.tmdbId,
        title: movie.title,
        year: movie.year,
        overview: movie.overview,
        posterUrl: movie.posterUrl,
        status: movie.status,
        wanted: movie.wanted,
        hasFile: movie.hasFile,
        qualityProfile: movie.qualityProfile?.name,
        rootFolder: movie.rootFolder?.path,
        addedAt: movie.addedAt?.toISO(),
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
      const results = await tmdbService.searchMovies(query, year ? parseInt(year) : undefined)

      // Check which movies are already in library
      const tmdbIds = results.map((r) => String(r.id))
      const existing = await Movie.query().whereIn('tmdbId', tmdbIds)
      const existingIds = new Set(existing.map((m) => m.tmdbId))

      return response.json(
        results.map((movie) => ({
          tmdbId: String(movie.id),
          title: movie.title,
          year: movie.year,
          overview: movie.overview,
          posterUrl: movie.posterPath,
          releaseDate: movie.releaseDate,
          rating: movie.voteAverage,
          inLibrary: existingIds.has(String(movie.id)),
        }))
      )
    } catch (error) {
      console.error('TMDB search error:', error)
      return response.badRequest({ error: 'Failed to search movies' })
    }
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(movieValidator)

    // Check if already exists
    if (data.tmdbId) {
      const existing = await Movie.query().where('tmdbId', data.tmdbId).first()
      if (existing) {
        return response.conflict({ error: 'Movie already in library' })
      }
    }

    // Fetch full details from TMDB
    let movieData: any = {
      title: data.title,
      sortTitle: data.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
      year: data.year,
      wanted: data.wanted ?? true,
      hasFile: false,
      qualityProfileId: data.qualityProfileId,
      rootFolderId: data.rootFolderId,
      addedAt: DateTime.now(),
    }

    if (data.tmdbId) {
      try {
        const tmdbData = await tmdbService.getMovie(parseInt(data.tmdbId))
        movieData = {
          ...movieData,
          tmdbId: String(tmdbData.id),
          imdbId: tmdbData.imdbId,
          title: tmdbData.title,
          originalTitle: tmdbData.originalTitle,
          sortTitle: tmdbData.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
          overview: tmdbData.overview,
          releaseDate: tmdbData.releaseDate ? DateTime.fromISO(tmdbData.releaseDate) : null,
          year: tmdbData.year,
          runtime: tmdbData.runtime,
          status: tmdbData.status,
          posterUrl: tmdbData.posterPath,
          backdropUrl: tmdbData.backdropPath,
          rating: tmdbData.voteAverage,
          votes: tmdbData.voteCount,
          genres: tmdbData.genres,
        }
      } catch (error) {
        console.error('Failed to fetch TMDB data:', error)
      }
    }

    const movie = await Movie.create(movieData)

    // TODO: If searchOnAdd, trigger search

    return response.created({
      id: movie.id,
      title: movie.title,
      year: movie.year,
    })
  }

  async show({ params, response }: HttpContext) {
    const movie = await Movie.query()
      .where('id', params.id)
      .preload('qualityProfile')
      .preload('rootFolder')
      .preload('movieFile')
      .first()

    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    return response.json({
      id: movie.id,
      tmdbId: movie.tmdbId,
      imdbId: movie.imdbId,
      title: movie.title,
      originalTitle: movie.originalTitle,
      year: movie.year,
      overview: movie.overview,
      releaseDate: movie.releaseDate?.toISODate(),
      runtime: movie.runtime,
      status: movie.status,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      rating: movie.rating,
      genres: movie.genres,
      wanted: movie.wanted,
      hasFile: movie.hasFile,
      qualityProfile: movie.qualityProfile,
      rootFolder: movie.rootFolder,
      movieFile: movie.movieFile,
      addedAt: movie.addedAt?.toISO(),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    const { wanted, qualityProfileId, rootFolderId } = request.only([
      'wanted',
      'qualityProfileId',
      'rootFolderId',
    ])

    if (wanted !== undefined) movie.wanted = wanted
    if (qualityProfileId !== undefined) movie.qualityProfileId = qualityProfileId
    if (rootFolderId !== undefined) movie.rootFolderId = rootFolderId

    await movie.save()

    return response.json({ id: movie.id, title: movie.title, wanted: movie.wanted })
  }

  async destroy({ params, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    // TODO: Delete files if requested

    await movie.delete()
    return response.noContent()
  }

  async setWanted({ params, request, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    const { wanted } = request.only(['wanted'])
    movie.wanted = wanted ?? true
    await movie.save()

    // TODO: If wanted is true, trigger immediate search

    return response.json({ id: movie.id, wanted: movie.wanted })
  }

  async download({ params, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    // Check if there's already an active download for this movie
    const { default: Download } = await import('#models/download')
    const existingDownload = await Download.query()
      .where('movieId', movie.id)
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
      .first()

    if (existingDownload) {
      return response.conflict({
        error: 'Movie already has an active download',
        downloadId: existingDownload.id,
        status: existingDownload.status,
      })
    }

    try {
      const { indexerManager } = await import('#services/indexers/indexer_manager')
      const { downloadManager } = await import('#services/download_clients/download_manager')

      const results = await indexerManager.searchMovies({
        title: movie.title,
        year: movie.year ?? undefined,
        imdbId: movie.imdbId ?? undefined,
        tmdbId: movie.tmdbId ?? undefined,
        limit: 25,
      })

      if (results.length === 0) {
        return response.notFound({ error: 'No releases found for this movie' })
      }

      // Best result is already sorted by size (larger = better quality)
      const bestResult = results[0]

      const download = await downloadManager.grab({
        title: bestResult.title,
        downloadUrl: bestResult.downloadUrl,
        size: bestResult.size,
        movieId: movie.id,
        indexerId: bestResult.indexerId,
        indexerName: bestResult.indexer,
        guid: bestResult.id,
      })

      return response.created({
        id: download.id,
        title: download.title,
        status: download.status,
        release: {
          title: bestResult.title,
          indexer: bestResult.indexer,
          size: bestResult.size,
          quality: bestResult.quality,
        },
      })
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to search and download',
      })
    }
  }
}
