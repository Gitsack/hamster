import type { HttpContext } from '@adonisjs/core/http'
import Movie from '#models/movie'
import MovieFile from '#models/movie_file'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { tmdbService } from '#services/metadata/tmdb_service'
import { justwatchService } from '#services/metadata/justwatch_service'
import AppSetting from '#models/app_setting'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const movieValidator = vine.compile(
  vine.object({
    tmdbId: vine.string().optional(),
    title: vine.string().minLength(1),
    year: vine.number().optional(),
    qualityProfileId: vine.string().optional(),
    rootFolderId: vine.string(),
    requested: vine.boolean().optional(),
    monitored: vine.boolean().optional(),
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
        requested: movie.requested,
        monitored: movie.monitored,
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
      const results = await tmdbService.searchMovies(
        query,
        year ? Number.parseInt(year) : undefined
      )

      // Check which movies are already in library with their status
      const tmdbIds = results.map((r) => String(r.id))
      const existing = await Movie.query().whereIn('tmdbId', tmdbIds)
      const existingMap = new Map(existing.map((m) => [m.tmdbId, m]))

      return response.json(
        results.map((movie) => {
          const libraryMovie = existingMap.get(String(movie.id))
          return {
            tmdbId: String(movie.id),
            title: movie.title,
            year: movie.year,
            overview: movie.overview,
            posterUrl: movie.posterPath,
            releaseDate: movie.releaseDate,
            rating: movie.voteAverage,
            inLibrary: !!libraryMovie,
            libraryId: libraryMovie?.id,
            requested: libraryMovie?.requested ?? false,
            hasFile: libraryMovie?.hasFile ?? false,
          }
        })
      )
    } catch (error) {
      console.error('TMDB search error:', error)
      return response.badRequest({ error: 'Failed to search movies' })
    }
  }

  /**
   * Preview movie details from TMDB (before adding to library)
   */
  async preview({ request, response }: HttpContext) {
    const tmdbId = request.input('tmdbId')

    if (!tmdbId) {
      return response.badRequest({ error: 'tmdbId is required' })
    }

    try {
      const tmdbIdNum = Number.parseInt(tmdbId)
      const [movie, cast, trailerUrl, backdropImages] = await Promise.all([
        tmdbService.getMovie(tmdbIdNum),
        tmdbService.getMovieCredits(tmdbIdNum, 6),
        tmdbService.getMovieTrailerUrl(tmdbIdNum),
        tmdbService.getMovieImages(tmdbIdNum),
      ])

      // Fetch JustWatch streaming availability using TMDB data (non-blocking)
      let offers: any[] = []
      const justwatchEnabled = await AppSetting.get<boolean>('justwatchEnabled', false)
      if (justwatchEnabled && movie.title && movie.year) {
        offers = await justwatchService
          .getStreamingAvailability(movie.title, movie.year, 'movie')
          .catch(() => [])
      }

      // Check if already in library
      const existing = await Movie.query().where('tmdbId', String(movie.id)).first()

      return response.json({
        tmdbId: String(movie.id),
        imdbId: movie.imdbId,
        title: movie.title,
        originalTitle: movie.originalTitle,
        year: movie.year,
        overview: movie.overview,
        posterUrl: movie.posterPath,
        backdropUrl: movie.backdropPath,
        releaseDate: movie.releaseDate,
        runtime: movie.runtime,
        status: movie.status,
        rating: movie.voteAverage,
        votes: movie.voteCount,
        genres: movie.genres,
        cast: cast.map((c) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profileUrl: c.profilePath,
        })),
        trailerUrl,
        backdropImages,
        streamingOffers: offers,
        inLibrary: !!existing,
        libraryId: existing?.id,
        requested: existing?.requested ?? false,
        hasFile: existing?.hasFile ?? false,
      })
    } catch (error) {
      console.error('TMDB preview error:', error)
      return response.badRequest({ error: 'Failed to fetch movie details' })
    }
  }

  /**
   * Get discover/popular movies (for browsing when no search query)
   */
  async discover({ request, response }: HttpContext) {
    const category = request.input('category', 'popular')
    const page = Number.parseInt(request.input('page', '1')) || 1
    const genreId = request.input('genreId')
    const sortBy = request.input('sortBy', 'popularity.desc')

    try {
      let data: { results: any[]; totalPages: number }

      if (category === 'genre' && genreId) {
        data = await tmdbService.discoverMoviesByGenre(Number.parseInt(genreId), sortBy, page)
      } else {
        switch (category) {
          case 'now_playing':
            data = await tmdbService.getNowPlayingMovies(page)
            break
          case 'trending':
            data = await tmdbService.getTrendingMovies('week', page)
            break
          case 'popular':
          default:
            data = await tmdbService.getPopularMovies(page)
        }
      }

      // Check which movies are already in library with their status
      const tmdbIds = data.results.map((r) => String(r.id))
      const existing = await Movie.query().whereIn('tmdbId', tmdbIds)
      const existingMap = new Map(existing.map((m) => [m.tmdbId, m]))

      return response.json({
        category,
        page,
        totalPages: data.totalPages,
        results: data.results.map((movie) => {
          const libraryMovie = existingMap.get(String(movie.id))
          return {
            tmdbId: String(movie.id),
            title: movie.title,
            year: movie.year,
            overview: movie.overview,
            posterUrl: movie.posterPath,
            releaseDate: movie.releaseDate,
            rating: movie.voteAverage,
            genres: movie.genres,
            inLibrary: !!libraryMovie,
            libraryId: libraryMovie?.id,
            requested: libraryMovie?.requested ?? false,
            hasFile: libraryMovie?.hasFile ?? false,
          }
        }),
      })
    } catch (error) {
      console.error('TMDB discover error:', error)
      return response.badRequest({ error: 'Failed to fetch movies' })
    }
  }

  async store({ request, response }: HttpContext) {
    let data
    try {
      data = await request.validateUsing(movieValidator)
    } catch (validationError: any) {
      console.error(
        'Movie validation failed:',
        JSON.stringify(validationError.messages ?? validationError.message)
      )
      console.error('Request body:', JSON.stringify(request.body()))
      return response.unprocessableEntity({
        error: 'Validation failure',
        details: validationError.messages,
      })
    }

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
      requested: data.requested ?? true,
      monitored: data.monitored ?? false,
      hasFile: false,
      qualityProfileId: data.qualityProfileId,
      rootFolderId: data.rootFolderId,
      addedAt: DateTime.now(),
    }

    if (data.tmdbId) {
      try {
        const tmdbData = await tmdbService.getMovie(Number.parseInt(data.tmdbId))
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

    let movie: Movie
    try {
      movie = await Movie.create(movieData)
    } catch (error) {
      console.error('Failed to create movie in database:', error)
      return response.internalServerError({ error: 'Failed to add movie' })
    }

    // Trigger immediate search if requested and searchOnAdd is enabled
    if ((data.requested ?? true) && data.searchOnAdd !== false) {
      import('#services/tasks/requested_search_task').then(({ requestedSearchTask }) => {
        requestedSearchTask.searchSingleMovie(movie.id).catch((error) => {
          console.error('Failed to trigger search for movie:', error)
        })
      })
    }

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

    let trailerUrl: string | null = null
    let backdropImages: string[] = []
    if (movie.tmdbId) {
      const tmdbIdNum = Number.parseInt(movie.tmdbId)
      ;[trailerUrl, backdropImages] = await Promise.all([
        tmdbService.getMovieTrailerUrl(tmdbIdNum).catch(() => null),
        tmdbService.getMovieImages(tmdbIdNum).catch(() => [] as string[]),
      ])
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
      trailerUrl,
      backdropImages,
      requested: movie.requested,
      monitored: movie.monitored,
      hasFile: movie.hasFile,
      qualityProfile: movie.qualityProfile,
      rootFolder: movie.rootFolder,
      movieFile: movie.movieFile
        ? {
            id: movie.movieFile.id,
            path: movie.movieFile.relativePath,
            size: movie.movieFile.sizeBytes,
            quality: movie.movieFile.quality,
            downloadUrl: `/api/v1/files/movies/${movie.movieFile.id}/download`,
          }
        : null,
      addedAt: movie.addedAt?.toISO(),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    const { requested, monitored, qualityProfileId, rootFolderId } = request.only([
      'requested',
      'monitored',
      'qualityProfileId',
      'rootFolderId',
    ])

    if (requested !== undefined) movie.requested = requested
    if (monitored !== undefined) movie.monitored = monitored
    if (qualityProfileId !== undefined) movie.qualityProfileId = qualityProfileId
    if (rootFolderId !== undefined) movie.rootFolderId = rootFolderId

    await movie.save()

    return response.json({
      id: movie.id,
      title: movie.title,
      requested: movie.requested,
      monitored: movie.monitored,
    })
  }

  async destroy({ params, request, response }: HttpContext) {
    const movie = await Movie.query()
      .where('id', params.id)
      .preload('rootFolder')
      .preload('movieFile')
      .first()

    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    const deleteFile = request.input('deleteFile') === 'true'
    let fileDeleted = false

    // If movie has a file and deleteFile is requested, delete the file first
    if (deleteFile && movie.movieFile && movie.rootFolder) {
      const absolutePath = path.join(movie.rootFolder.path, movie.movieFile.relativePath)
      const folderPath = path.dirname(absolutePath)

      try {
        await fs.unlink(absolutePath)
        console.log(`[MoviesController] Deleted movie file: ${absolutePath}`)
        fileDeleted = true

        // Try to remove the folder if empty
        try {
          const remainingFiles = await fs.readdir(folderPath)
          if (remainingFiles.length === 0) {
            await fs.rmdir(folderPath)
            console.log(`[MoviesController] Removed empty folder: ${folderPath}`)
          }
        } catch {
          // Folder might not be empty or other error, ignore
        }
      } catch (error) {
        console.error(`[MoviesController] Failed to delete file: ${absolutePath}`, error)
        // Continue with record deletion even if file deletion fails
      }

      // Delete the MovieFile record
      await MovieFile.query().where('id', movie.movieFile.id).delete()
    }

    await movie.delete()
    return response.json({ id: movie.id, deleted: true, fileDeleted })
  }

  async setWanted({ params, request, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    const { requested } = request.only(['requested'])
    const newStatus = requested ?? true

    // If unrequesting (setting to false)
    if (!newStatus) {
      // If movie has a file, return error - frontend should show confirmation dialog
      if (movie.hasFile) {
        return response.badRequest({
          error: 'Item has downloaded files',
          hasFile: true,
          message: 'Use DELETE endpoint with deleteFile=true to remove files and record',
        })
      }

      // Movie has no file - delete it from library
      console.log(`[MoviesController] Unrequesting movie without file, deleting: ${movie.title}`)
      await movie.delete()
      return response.json({
        id: movie.id,
        deleted: true,
        message: 'Removed from library',
      })
    }

    // Requesting (setting to true)
    movie.requested = true
    await movie.save()

    // Trigger immediate search if marking as requested
    if (!movie.hasFile) {
      import('#services/tasks/requested_search_task').then(({ requestedSearchTask }) => {
        requestedSearchTask.searchSingleMovie(movie.id).catch((error) => {
          console.error('Failed to trigger search for movie:', error)
        })
      })
    }

    return response.json({ id: movie.id, requested: movie.requested })
  }

  /**
   * Get requested (missing) movies
   */
  async requested({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 50)

    const movies = await Movie.query()
      .where('requested', true)
      .where('hasFile', false)
      .orderBy('addedAt', 'desc')
      .paginate(page, limit)

    return response.json({
      data: movies.all().map((movie) => ({
        id: movie.id,
        tmdbId: movie.tmdbId,
        title: movie.title,
        year: movie.year,
        posterUrl: movie.posterUrl,
        releaseDate: movie.releaseDate?.toISODate(),
      })),
      meta: {
        total: movies.total,
        perPage: movies.perPage,
        currentPage: movies.currentPage,
        lastPage: movies.lastPage,
      },
    })
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

  /**
   * Trigger immediate search for a movie
   */
  async searchNow({ params, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    try {
      const { requestedSearchTask } = await import('#services/tasks/requested_search_task')
      const result = await requestedSearchTask.searchSingleMovie(movie.id)
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
   * Enrich a movie that doesn't have a TMDB ID by searching and linking
   */
  async enrich({ params, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    if (movie.tmdbId) {
      return response.badRequest({
        error: 'Movie already has a TMDB ID. Use refresh instead.',
      })
    }

    // Search TMDB for this movie
    const results = await tmdbService.searchMovies(movie.title, movie.year ?? undefined)
    if (results.length === 0) {
      return response.json({
        id: movie.id,
        title: movie.title,
        enriched: false,
        message: 'No matching movie found on TMDB',
      })
    }

    // Find best match (exact title match preferred, then year match)
    const exactMatch = results.find(
      (r) =>
        r.title.toLowerCase() === movie.title.toLowerCase() &&
        (!movie.year || r.year === movie.year)
    )
    const best = exactMatch || results[0]

    // Fetch full details from TMDB
    try {
      const tmdbData = await tmdbService.getMovie(best.id)

      movie.merge({
        tmdbId: String(tmdbData.id),
        imdbId: tmdbData.imdbId || null,
        originalTitle: tmdbData.originalTitle || null,
        sortTitle: tmdbData.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
        overview: tmdbData.overview || null,
        releaseDate: tmdbData.releaseDate ? DateTime.fromISO(tmdbData.releaseDate) : null,
        year: tmdbData.year || movie.year,
        runtime: tmdbData.runtime || null,
        status: tmdbData.status || null,
        posterUrl: tmdbData.posterPath || null,
        backdropUrl: tmdbData.backdropPath || null,
        rating: tmdbData.voteAverage || null,
        votes: tmdbData.voteCount || null,
        genres: tmdbData.genres || null,
      })
      await movie.save()

      return response.json({
        id: movie.id,
        title: movie.title,
        tmdbId: movie.tmdbId,
        enriched: true,
      })
    } catch (error) {
      console.error(`Failed to enrich movie ${movie.id}:`, error)
      return response.internalServerError({
        error: 'Failed to fetch movie details from TMDB',
      })
    }
  }

  async similar({ params, request, response }: HttpContext) {
    let tmdbIdStr: string | null = request.input('tmdbId') || null

    if (!tmdbIdStr) {
      const movie = await Movie.find(params.id)
      if (!movie) {
        return response.notFound({ error: 'Movie not found' })
      }
      tmdbIdStr = movie.tmdbId
    }

    if (!tmdbIdStr) {
      return response.json({ results: [] })
    }

    try {
      const results = await tmdbService.getSimilarMovies(Number.parseInt(tmdbIdStr))

      const sliced = results.slice(0, 20)

      // Check library status
      const tmdbIds = sliced.map((r) => String(r.id))
      const existing = await Movie.query().whereIn('tmdbId', tmdbIds)
      const existingMap = new Map(existing.map((m) => [m.tmdbId, m]))

      return response.json({
        results: sliced.map((m) => {
          const libraryMovie = existingMap.get(String(m.id))
          return {
            tmdbId: String(m.id),
            title: m.title,
            year: m.year,
            posterUrl: m.posterPath,
            rating: m.voteAverage,
            genres: m.genres,
            inLibrary: !!libraryMovie,
            libraryId: libraryMovie?.id,
            requested: libraryMovie?.requested ?? false,
            hasFile: libraryMovie?.hasFile ?? false,
          }
        }),
      })
    } catch (error) {
      console.error('Failed to fetch similar movies:', error)
      return response.json({ results: [] })
    }
  }

  /**
   * Delete the movie file from disk and database
   */
  async deleteFile({ params, response }: HttpContext) {
    const movie = await Movie.query()
      .where('id', params.id)
      .preload('rootFolder')
      .preload('movieFile')
      .first()

    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    if (!movie.movieFile) {
      return response.notFound({ error: 'Movie has no file' })
    }

    if (!movie.rootFolder) {
      return response.badRequest({ error: 'Movie has no root folder configured' })
    }

    const absolutePath = path.join(movie.rootFolder.path, movie.movieFile.relativePath)
    const folderPath = path.dirname(absolutePath)

    try {
      // Delete the file from disk
      await fs.unlink(absolutePath)
      console.log(`[MoviesController] Deleted movie file: ${absolutePath}`)

      // Try to remove the folder if empty
      try {
        const remainingFiles = await fs.readdir(folderPath)
        if (remainingFiles.length === 0) {
          await fs.rmdir(folderPath)
          console.log(`[MoviesController] Removed empty folder: ${folderPath}`)
        }
      } catch {
        // Folder might not be empty or other error, ignore
      }
    } catch (error) {
      console.error(`[MoviesController] Failed to delete file: ${absolutePath}`, error)
      // Continue with database cleanup even if file deletion fails
    }

    // Delete the MovieFile record
    await MovieFile.query().where('id', movie.movieFile.id).delete()

    // Update movie hasFile flag
    movie.hasFile = false
    await movie.save()

    return response.json({
      message: 'File deleted successfully',
      movieId: movie.id,
    })
  }
}
