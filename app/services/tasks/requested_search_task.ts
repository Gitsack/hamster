import logger from '@adonisjs/core/services/logger'
import Album from '#models/album'
import Movie from '#models/movie'
import Book from '#models/book'
import Episode from '#models/episode'
import Download from '#models/download'
import QualityProfile from '#models/quality_profile'
import type { QualityItem } from '#models/quality_profile'
import { indexerManager, type UnifiedSearchResult } from '#services/indexers/indexer_manager'
import { downloadManager } from '#services/download_clients/download_manager'
import { blacklistService } from '#services/blacklist/blacklist_service'
import { scoreAndRankReleases } from '#services/quality/quality_scorer'
import type { MediaType } from '#services/quality/quality_parser'

/**
 * Normalize a title for comparison by:
 * - Converting to lowercase
 * - Replacing dots, underscores, hyphens with spaces
 * - Removing extra whitespace
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Check if a release title matches the expected TV show title.
 * For TV shows, after the show name should come the season/episode pattern (S01E01).
 *
 * Valid examples:
 * - "Friends S01E01 The Pilot" for show "Friends"
 * - "Breaking.Bad.S01E01.720p" for show "Breaking Bad"
 *
 * Invalid examples:
 * - "Friends with Benefits S01E01" for show "Friends" (different show!)
 * - "My Friends S01E01" for show "Friends"
 */
function doesTvReleaseTitleMatch(
  releaseTitle: string,
  expectedTitle: string,
  seriesType: 'standard' | 'daily' | 'anime' = 'standard'
): boolean {
  const normalizedRelease = normalizeTitle(releaseTitle)
  const normalizedExpected = normalizeTitle(expectedTitle)
  const expectedWords = normalizedExpected.split(' ')

  // Extract the portion of release title that corresponds to expected title length
  const releaseWords = normalizedRelease.split(' ')

  // Check if release starts with the expected title words
  if (releaseWords.length < expectedWords.length) {
    return false
  }

  const releasePrefix = releaseWords.slice(0, expectedWords.length).join(' ')
  if (releasePrefix !== normalizedExpected) {
    return false
  }

  // Now verify that what comes AFTER the title is a season/episode or date pattern
  // This prevents "friends with benefits" from matching "friends"
  const afterTitle = releaseWords.slice(expectedWords.length).join(' ')

  // The next part should start with a season pattern like "s01" or "s01e01" or "season 1"
  const seasonPattern = /^s\d+|^season\s*\d+/i
  // Date pattern for daily shows: "2024 01 15" or "2024 1 15"
  // Can appear anywhere in the afterTitle (e.g., "starring jimmy fallon 2025 12 18")
  const datePattern = /\d{4}\s+\d{1,2}\s+\d{1,2}/

  if (seriesType === 'daily') {
    // Daily shows can match either season/episode OR date patterns anywhere in title
    if (!seasonPattern.test(afterTitle) && !datePattern.test(afterTitle)) {
      return false
    }
  } else {
    if (!seasonPattern.test(afterTitle)) {
      return false
    }
  }

  return true
}

/**
 * Check if a release title matches the expected movie title.
 * For movies, after the title typically comes the year or quality info.
 */
function doesMovieReleaseTitleMatch(releaseTitle: string, expectedTitle: string): boolean {
  const normalizedRelease = normalizeTitle(releaseTitle)
  const normalizedExpected = normalizeTitle(expectedTitle)

  // Check if release starts with the expected title
  if (normalizedRelease.startsWith(normalizedExpected)) {
    // Verify the character after the title is a space, year, or quality indicator
    const afterTitle = normalizedRelease.slice(normalizedExpected.length).trim()
    // Should start with year (4 digits), quality (720p, 1080p, etc), or be empty/end
    if (
      afterTitle === '' ||
      /^\d{4}|^\d{3,4}p|^bluray|^webrip|^web dl|^hdtv|^dvdrip|^brrip|^remux|^uhd/i.test(afterTitle)
    ) {
      return true
    }
  }

  // Also check exact word match for titles
  const releaseWords = normalizedRelease.split(' ')
  const expectedWords = normalizedExpected.split(' ')

  if (releaseWords.length >= expectedWords.length) {
    const releasePrefix = releaseWords.slice(0, expectedWords.length).join(' ')
    if (releasePrefix === normalizedExpected) {
      const nextWord = releaseWords[expectedWords.length] || ''
      // Next word should be year or quality, not another word from a different title
      if (
        /^\d{4}$|^\d{3,4}p$|^bluray$|^webrip$|^web$|^hdtv$|^dvdrip$|^brrip$|^remux$|^uhd$/i.test(
          nextWord
        )
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Filter TV show search results to only include those matching the expected title(s).
 * For daily shows, also accepts results that match the air date (since ID-based search
 * already confirmed the show identity, and indexers may use a different title).
 */
function filterTvResultsByTitle(
  results: UnifiedSearchResult[],
  expectedTitles: string | string[],
  seriesType: 'standard' | 'daily' | 'anime' = 'standard',
  airDate?: string
): UnifiedSearchResult[] {
  const titles = Array.isArray(expectedTitles) ? expectedTitles : [expectedTitles]
  return results.filter((result) => {
    // Check if any title matches
    if (titles.some((title) => doesTvReleaseTitleMatch(result.title, title, seriesType))) {
      return true
    }

    // For daily shows with an airDate, also accept results that contain the date
    // This handles cases where indexers use a different name (e.g., "Jimmy Fallon"
    // instead of "The Tonight Show Starring Jimmy Fallon")
    if (seriesType === 'daily' && airDate) {
      const normalizedRelease = normalizeTitle(result.title)
      const dateSpaced = airDate.replace(/-/g, ' ')
      const dateDotted = airDate.replace(/-/g, '.')
      return normalizedRelease.includes(dateSpaced) || result.title.includes(dateDotted)
    }

    return false
  })
}

/**
 * Filter movie search results to only include those matching the expected title
 */
function filterMovieResultsByTitle(
  results: UnifiedSearchResult[],
  expectedTitle: string
): UnifiedSearchResult[] {
  return results.filter((result) => doesMovieReleaseTitleMatch(result.title, expectedTitle))
}

/**
 * Select the best release from search results using quality profile scoring.
 * Falls back to size-based sorting when no quality profile is available.
 */
function selectBestRelease(
  results: UnifiedSearchResult[],
  mediaType: MediaType,
  profileItems: QualityItem[] | null,
  cutoff: number | null
): UnifiedSearchResult | null {
  if (results.length === 0) return null

  // If we have a quality profile, use quality-based scoring
  if (profileItems && profileItems.length > 0 && cutoff !== null) {
    const scored = scoreAndRankReleases(results, mediaType, profileItems, cutoff)
    if (scored.length > 0) {
      return scored[0].release
    }
    // All releases were rejected by quality filter -- fall back to size-based
    // so we still grab something rather than nothing
  }

  // Fallback: sort by size descending
  const sorted = [...results].sort((a, b) => b.size - a.size)
  return sorted[0]
}

/**
 * Load a quality profile by ID. Returns null if not found.
 */
async function loadQualityProfile(profileId: string | null): Promise<QualityProfile | null> {
  if (!profileId) return null
  return QualityProfile.find(profileId)
}

export interface RequestedSearchResult {
  albums: { searched: number; found: number; grabbed: number }
  movies: { searched: number; found: number; grabbed: number }
  books: { searched: number; found: number; grabbed: number }
  episodes: { searched: number; found: number; grabbed: number }
  errors: string[]
}

class RequestedSearchTask {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null
  private intervalMinutes = 60 // Search every hour by default

  /**
   * Start the periodic search task
   */
  start(intervalMinutes = 60) {
    if (this.intervalId) {
      this.stop()
    }

    this.intervalMinutes = intervalMinutes
    logger.info({ intervalMinutes }, 'RequestedSearch: Starting periodic search')

    // Run immediately on start
    this.run().catch((err) => logger.error({ err }, 'RequestedSearch: Initial run failed'))

    // Then run periodically
    this.intervalId = setInterval(
      () =>
        this.run().catch((err) => logger.error({ err }, 'RequestedSearch: Periodic run failed')),
      intervalMinutes * 60 * 1000
    )
  }

  /**
   * Stop the periodic search task
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info('RequestedSearch: Stopped periodic search')
    }
  }

  /**
   * Run a search for all requested items (albums, movies, books)
   */
  async run(): Promise<RequestedSearchResult> {
    if (this.isRunning) {
      logger.debug('RequestedSearch: Already running, skipping')
      return {
        albums: { searched: 0, found: 0, grabbed: 0 },
        movies: { searched: 0, found: 0, grabbed: 0 },
        books: { searched: 0, found: 0, grabbed: 0 },
        episodes: { searched: 0, found: 0, grabbed: 0 },
        errors: ['Already running'],
      }
    }

    this.isRunning = true
    const result: RequestedSearchResult = {
      albums: { searched: 0, found: 0, grabbed: 0 },
      movies: { searched: 0, found: 0, grabbed: 0 },
      books: { searched: 0, found: 0, grabbed: 0 },
      episodes: { searched: 0, found: 0, grabbed: 0 },
      errors: [],
    }

    try {
      logger.info('RequestedSearch: Starting search for requested items')

      // Search for albums
      await this.searchAlbums(result)

      // Search for movies
      await this.searchMovies(result)

      // Search for books
      await this.searchBooks(result)

      // Search for TV episodes
      await this.searchEpisodes(result)

      logger.info(
        {
          albums: result.albums.grabbed,
          movies: result.movies.grabbed,
          books: result.books.grabbed,
          episodes: result.episodes.grabbed,
        },
        'RequestedSearch: Complete'
      )
    } finally {
      this.isRunning = false
    }

    return result
  }

  /**
   * Search for requested albums
   */
  private async searchAlbums(result: RequestedSearchResult) {
    logger.info('RequestedSearch: Searching for requested albums')

    // Find all requested albums that don't have files
    const requestedAlbums = await Album.query()
      .where('requested', true)
      .preload('artist')
      .preload('tracks')

    // Filter to only albums with missing tracks
    const albumsToSearch = requestedAlbums.filter((album) => {
      const trackCount = album.tracks.length
      const fileCount = album.tracks.filter((t) => t.trackFileId !== null).length
      return trackCount === 0 || fileCount < trackCount
    })

    logger.info({ count: albumsToSearch.length }, 'RequestedSearch: Found requested albums')

    // Get albums that already have active downloads
    const activeDownloads = await Download.query()
      .whereNotNull('albumId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const albumsWithActiveDownloads = new Set(activeDownloads.map((d) => d.albumId))

    for (const album of albumsToSearch) {
      if (albumsWithActiveDownloads.has(album.id)) {
        logger.debug({ album: album.title }, 'RequestedSearch: Skipping album - active download')
        continue
      }

      // Re-check if album is still requested
      const currentAlbum = await Album.find(album.id)
      if (!currentAlbum || !currentAlbum.requested) {
        logger.debug(
          { album: album.title },
          'RequestedSearch: Skipping album - no longer requested'
        )
        continue
      }

      result.albums.searched++

      try {
        const searchResults = await indexerManager.search({
          artist: album.artist?.name,
          album: album.title,
          year: album.releaseDate?.year,
          limit: 10,
        })

        // Filter out blacklisted releases
        const availableResults = await blacklistService.filterBlacklisted(searchResults)

        if (availableResults.length === 0) {
          logger.debug(
            { artist: album.artist?.name, album: album.title },
            'RequestedSearch: No results for album'
          )
          continue
        }

        result.albums.found++

        // Load quality profile from the artist
        const profile = await loadQualityProfile(album.artist?.qualityProfileId ?? null)
        const bestResult = selectBestRelease(
          availableResults,
          'music',
          profile?.items ?? null,
          profile?.cutoff ?? null
        )

        if (!bestResult) {
          logger.debug(
            { artist: album.artist?.name, album: album.title },
            'RequestedSearch: No acceptable quality results for album'
          )
          continue
        }

        // Final check before grabbing
        const stillRequested = await Album.query()
          .where('id', album.id)
          .where('requested', true)
          .first()
        if (!stillRequested) {
          logger.debug(
            { album: album.title },
            'RequestedSearch: Skipping grab for album - unrequested during search'
          )
          continue
        }

        logger.info({ release: bestResult.title }, 'RequestedSearch: Grabbing album')

        await downloadManager.grab({
          title: bestResult.title,
          downloadUrl: bestResult.downloadUrl,
          size: bestResult.size,
          albumId: album.id,
          indexerId: bestResult.indexerId,
          indexerName: bestResult.indexer,
          guid: bestResult.id,
        })

        result.albums.grabbed++
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        const errorMsg = `Failed to search/grab album ${album.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(
          { album: album.title, err: error },
          'RequestedSearch: Failed to search/grab album'
        )
        result.errors.push(errorMsg)
      }
    }
  }

  /**
   * Search for requested movies
   */
  private async searchMovies(result: RequestedSearchResult) {
    logger.info('RequestedSearch: Searching for requested movies')

    const requestedMovies = await Movie.query().where('requested', true).where('hasFile', false)

    logger.info({ count: requestedMovies.length }, 'RequestedSearch: Found requested movies')

    // Get movies that already have active downloads
    const activeDownloads = await Download.query()
      .whereNotNull('movieId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const moviesWithActiveDownloads = new Set(activeDownloads.map((d) => d.movieId))

    for (const movie of requestedMovies) {
      if (moviesWithActiveDownloads.has(movie.id)) {
        logger.debug({ movie: movie.title }, 'RequestedSearch: Skipping movie - active download')
        continue
      }

      // Re-check if movie is still requested
      const currentMovie = await Movie.find(movie.id)
      if (!currentMovie || !currentMovie.requested) {
        logger.debug(
          { movie: movie.title },
          'RequestedSearch: Skipping movie - no longer requested'
        )
        continue
      }

      result.movies.searched++

      try {
        const searchResults = await indexerManager.searchMovies({
          title: movie.title,
          year: movie.year || undefined,
          imdbId: movie.imdbId || undefined,
          limit: 25,
        })

        // Filter results to only include those that actually match the movie title
        const matchingResults = filterMovieResultsByTitle(searchResults, movie.title)

        // Filter out blacklisted releases
        const availableResults = await blacklistService.filterBlacklisted(matchingResults)

        if (availableResults.length === 0) {
          logger.debug(
            { movie: movie.title, year: movie.year, totalResults: searchResults.length },
            'RequestedSearch: No matching results for movie'
          )
          continue
        }

        result.movies.found++

        // Load quality profile and rank by quality
        const profile = await loadQualityProfile(movie.qualityProfileId)
        const bestResult = selectBestRelease(
          availableResults,
          'movies',
          profile?.items ?? null,
          profile?.cutoff ?? null
        )

        if (!bestResult) {
          logger.debug(
            { movie: movie.title },
            'RequestedSearch: No acceptable quality results for movie'
          )
          continue
        }

        // Final check before grabbing
        const stillRequested = await Movie.query()
          .where('id', movie.id)
          .where('requested', true)
          .first()
        if (!stillRequested) {
          logger.debug(
            { movie: movie.title },
            'RequestedSearch: Skipping grab for movie - unrequested during search'
          )
          continue
        }

        logger.info({ release: bestResult.title }, 'RequestedSearch: Grabbing movie')

        await downloadManager.grab({
          title: bestResult.title,
          downloadUrl: bestResult.downloadUrl,
          size: bestResult.size,
          movieId: movie.id,
          indexerId: bestResult.indexerId,
          indexerName: bestResult.indexer,
          guid: bestResult.id,
        })

        result.movies.grabbed++
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        const errorMsg = `Failed to search/grab movie ${movie.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(
          { movie: movie.title, err: error },
          'RequestedSearch: Failed to search/grab movie'
        )
        result.errors.push(errorMsg)
      }
    }
  }

  /**
   * Search for requested books
   */
  private async searchBooks(result: RequestedSearchResult) {
    logger.info('RequestedSearch: Searching for requested books')

    const requestedBooks = await Book.query()
      .where('requested', true)
      .where('hasFile', false)
      .preload('author')

    logger.info({ count: requestedBooks.length }, 'RequestedSearch: Found requested books')

    // Get books that already have active downloads
    const activeDownloads = await Download.query()
      .whereNotNull('bookId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const booksWithActiveDownloads = new Set(activeDownloads.map((d) => d.bookId))

    for (const book of requestedBooks) {
      if (booksWithActiveDownloads.has(book.id)) {
        logger.debug({ book: book.title }, 'RequestedSearch: Skipping book - active download')
        continue
      }

      // Re-check if book is still requested
      const currentBook = await Book.find(book.id)
      if (!currentBook || !currentBook.requested) {
        logger.debug({ book: book.title }, 'RequestedSearch: Skipping book - no longer requested')
        continue
      }

      result.books.searched++

      try {
        const searchResults = await indexerManager.searchBooks({
          title: book.title,
          author: book.author?.name,
          limit: 10,
        })

        // Filter out blacklisted releases
        const availableResults = await blacklistService.filterBlacklisted(searchResults)

        if (availableResults.length === 0) {
          logger.debug(
            { book: book.title, author: book.author?.name },
            'RequestedSearch: No results for book'
          )
          continue
        }

        result.books.found++

        // Load quality profile from the author and rank by quality
        const profile = await loadQualityProfile(book.author?.qualityProfileId ?? null)
        const bestResult = selectBestRelease(
          availableResults,
          'books',
          profile?.items ?? null,
          profile?.cutoff ?? null
        )

        if (!bestResult) {
          logger.debug(
            { book: book.title },
            'RequestedSearch: No acceptable quality results for book'
          )
          continue
        }

        // Final check before grabbing
        const stillRequested = await Book.query()
          .where('id', book.id)
          .where('requested', true)
          .first()
        if (!stillRequested) {
          logger.debug(
            { book: book.title },
            'RequestedSearch: Skipping grab for book - unrequested during search'
          )
          continue
        }

        logger.info({ release: bestResult.title }, 'RequestedSearch: Grabbing book')

        await downloadManager.grab({
          title: bestResult.title,
          downloadUrl: bestResult.downloadUrl,
          size: bestResult.size,
          bookId: book.id,
          indexerId: bestResult.indexerId,
          indexerName: bestResult.indexer,
          guid: bestResult.id,
        })

        result.books.grabbed++
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        const errorMsg = `Failed to search/grab book ${book.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(
          { book: book.title, err: error },
          'RequestedSearch: Failed to search/grab book'
        )
        result.errors.push(errorMsg)
      }
    }
  }

  /**
   * Search for requested TV episodes
   */
  private async searchEpisodes(result: RequestedSearchResult) {
    logger.info('RequestedSearch: Searching for requested episodes')

    // Limit episodes per run to prevent blocking the server for too long
    const MAX_EPISODES_PER_RUN = 10

    const requestedEpisodes = await Episode.query()
      .where('requested', true)
      .where('hasFile', false)
      .preload('tvShow')
      .limit(MAX_EPISODES_PER_RUN * 3) // Fetch a few more in case some are skipped

    logger.info(
      { count: requestedEpisodes.length, max: MAX_EPISODES_PER_RUN },
      'RequestedSearch: Found requested episodes'
    )

    // Get episodes that already have active downloads
    const activeDownloads = await Download.query()
      .whereNotNull('episodeId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const episodesWithActiveDownloads = new Set(activeDownloads.map((d) => d.episodeId))

    let processedCount = 0

    for (const episode of requestedEpisodes) {
      // Stop after processing max episodes
      if (processedCount >= MAX_EPISODES_PER_RUN) {
        logger.debug({ max: MAX_EPISODES_PER_RUN }, 'RequestedSearch: Reached max episodes per run')
        break
      }

      // Yield to event loop to allow HTTP requests to be processed
      await new Promise((resolve) => setImmediate(resolve))
      if (episodesWithActiveDownloads.has(episode.id)) {
        logger.debug(
          {
            show: episode.tvShow?.title,
            season: episode.seasonNumber,
            episode: episode.episodeNumber,
          },
          'RequestedSearch: Skipping episode - active download'
        )
        continue
      }

      if (!episode.tvShow) {
        logger.debug(
          { episodeId: episode.id },
          'RequestedSearch: Skipping episode - no TV show loaded'
        )
        continue
      }

      // Re-check if episode is still requested (user may have unrequested during search)
      const currentEpisode = await Episode.find(episode.id)
      if (!currentEpisode || !currentEpisode.requested) {
        logger.debug(
          {
            show: episode.tvShow.title,
            season: episode.seasonNumber,
            episode: episode.episodeNumber,
          },
          'RequestedSearch: Skipping episode - no longer requested'
        )
        continue
      }

      processedCount++
      result.episodes.searched++

      try {
        const tvShow = episode.tvShow
        const seriesType = tvShow.seriesType || 'standard'
        const alternateTitles = tvShow.alternateTitles || []
        const airDate =
          seriesType === 'daily' && episode.airDate ? episode.airDate.toISODate() : undefined

        const searchResults = await indexerManager.searchTvShows({
          title: tvShow.title,
          season: episode.seasonNumber,
          episode: episode.episodeNumber,
          tvdbId: tvShow.tvdbId || undefined,
          imdbId: tvShow.imdbId || undefined,
          alternateTitles,
          airDate: airDate ?? undefined,
          seriesType,
          limit: 25,
        })

        // Filter results to only include those that actually match the show title
        const allTitles = [tvShow.title, ...alternateTitles]
        const matchingResults = filterTvResultsByTitle(
          searchResults,
          allTitles,
          seriesType,
          airDate ?? undefined
        )

        // Filter out blacklisted releases
        const availableResults = await blacklistService.filterBlacklisted(matchingResults)

        if (availableResults.length === 0) {
          logger.debug(
            {
              show: tvShow.title,
              season: episode.seasonNumber,
              episode: episode.episodeNumber,
              totalResults: searchResults.length,
            },
            'RequestedSearch: No matching results for episode'
          )
          continue
        }

        result.episodes.found++

        // Load quality profile from the TV show and rank by quality
        const profile = await loadQualityProfile(tvShow.qualityProfileId)
        const bestResult = selectBestRelease(
          availableResults,
          'tv',
          profile?.items ?? null,
          profile?.cutoff ?? null
        )

        if (!bestResult) {
          logger.debug(
            {
              show: tvShow.title,
              season: episode.seasonNumber,
              episode: episode.episodeNumber,
            },
            'RequestedSearch: No acceptable quality results for episode'
          )
          continue
        }

        // Final check before grabbing - episode might have been unrequested while searching
        const stillRequested = await Episode.query()
          .where('id', episode.id)
          .where('requested', true)
          .first()

        if (!stillRequested) {
          logger.debug(
            {
              show: tvShow.title,
              season: episode.seasonNumber,
              episode: episode.episodeNumber,
            },
            'RequestedSearch: Skipping grab for episode - unrequested during search'
          )
          continue
        }

        logger.info({ release: bestResult.title }, 'RequestedSearch: Grabbing episode')

        await downloadManager.grab({
          title: bestResult.title,
          downloadUrl: bestResult.downloadUrl,
          size: bestResult.size,
          tvShowId: episode.tvShowId,
          episodeId: episode.id,
          indexerId: bestResult.indexerId,
          indexerName: bestResult.indexer,
          guid: bestResult.id,
        })

        result.episodes.grabbed++
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        const errorMsg = `Failed to search/grab episode ${episode.tvShow.title} S${episode.seasonNumber}E${episode.episodeNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(
          {
            show: episode.tvShow.title,
            season: episode.seasonNumber,
            episode: episode.episodeNumber,
            err: error,
          },
          'RequestedSearch: Failed to search/grab episode'
        )
        result.errors.push(errorMsg)
      }
    }
  }

  // ==========================================
  // Single-item search methods for immediate search
  // ==========================================

  /**
   * Search and grab a single album immediately
   */
  async searchSingleAlbum(
    albumId: string
  ): Promise<{ found: boolean; grabbed: boolean; error?: string }> {
    try {
      const album = await Album.query()
        .where('id', albumId)
        .preload('artist')
        .preload('tracks')
        .first()

      if (!album) {
        return { found: false, grabbed: false, error: 'Album not found' }
      }

      // Check for active downloads
      const activeDownload = await Download.query()
        .where('albumId', albumId)
        .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
        .first()

      if (activeDownload) {
        return { found: false, grabbed: false, error: 'Already has active download' }
      }

      const searchResults = await indexerManager.search({
        artist: album.artist?.name,
        album: album.title,
        year: album.releaseDate?.year,
        limit: 10,
      })

      // Filter out blacklisted releases
      const availableResults = await blacklistService.filterBlacklisted(searchResults)

      if (availableResults.length === 0) {
        return { found: false, grabbed: false }
      }

      // Load quality profile from the artist and rank by quality
      const profile = await loadQualityProfile(album.artist?.qualityProfileId ?? null)
      const bestResult = selectBestRelease(
        availableResults,
        'music',
        profile?.items ?? null,
        profile?.cutoff ?? null
      )

      if (!bestResult) {
        return { found: true, grabbed: false, error: 'No results matching quality profile' }
      }

      await downloadManager.grab({
        title: bestResult.title,
        downloadUrl: bestResult.downloadUrl,
        size: bestResult.size,
        albumId: album.id,
        indexerId: bestResult.indexerId,
        indexerName: bestResult.indexer,
        guid: bestResult.id,
      })

      return { found: true, grabbed: true }
    } catch (error) {
      return {
        found: false,
        grabbed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Search and grab a single movie immediately
   */
  async searchSingleMovie(
    movieId: string
  ): Promise<{ found: boolean; grabbed: boolean; error?: string }> {
    try {
      const movie = await Movie.find(movieId)

      if (!movie) {
        return { found: false, grabbed: false, error: 'Movie not found' }
      }

      // Check if movie already has a file
      if (movie.hasFile) {
        return { found: false, grabbed: false, error: 'Movie already has a file' }
      }

      // Check for active downloads
      const activeDownload = await Download.query()
        .where('movieId', movieId)
        .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
        .first()

      if (activeDownload) {
        return { found: false, grabbed: false, error: 'Already has active download' }
      }

      const searchResults = await indexerManager.searchMovies({
        title: movie.title,
        year: movie.year || undefined,
        imdbId: movie.imdbId || undefined,
        limit: 25,
      })

      // Filter results to only include those that actually match the movie title
      const matchingResults = filterMovieResultsByTitle(searchResults, movie.title)

      // Filter out blacklisted releases
      const availableResults = await blacklistService.filterBlacklisted(matchingResults)

      if (availableResults.length === 0) {
        return { found: false, grabbed: false }
      }

      // Load quality profile and rank by quality
      const profile = await loadQualityProfile(movie.qualityProfileId)
      const bestResult = selectBestRelease(
        availableResults,
        'movies',
        profile?.items ?? null,
        profile?.cutoff ?? null
      )

      if (!bestResult) {
        return { found: true, grabbed: false, error: 'No results matching quality profile' }
      }

      await downloadManager.grab({
        title: bestResult.title,
        downloadUrl: bestResult.downloadUrl,
        size: bestResult.size,
        movieId: movie.id,
        indexerId: bestResult.indexerId,
        indexerName: bestResult.indexer,
        guid: bestResult.id,
      })

      return { found: true, grabbed: true }
    } catch (error) {
      return {
        found: false,
        grabbed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Search and grab a single episode immediately
   */
  async searchSingleEpisode(
    episodeId: string
  ): Promise<{ found: boolean; grabbed: boolean; error?: string }> {
    try {
      const episode = await Episode.query().where('id', episodeId).preload('tvShow').first()

      if (!episode || !episode.tvShow) {
        return { found: false, grabbed: false, error: 'Episode not found' }
      }

      // Check if episode already has a file
      if (episode.hasFile) {
        return { found: false, grabbed: false, error: 'Episode already has a file' }
      }

      // Check for active downloads
      const activeDownload = await Download.query()
        .where('episodeId', episodeId)
        .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
        .first()

      if (activeDownload) {
        return { found: false, grabbed: false, error: 'Already has active download' }
      }

      const tvShow = episode.tvShow
      const seriesType = tvShow.seriesType || 'standard'
      const alternateTitles = tvShow.alternateTitles || []
      const airDate =
        seriesType === 'daily' && episode.airDate ? episode.airDate.toISODate() : undefined

      console.log('[SearchSingleEpisode] Searching:', {
        showTitle: tvShow.title,
        seriesType,
        alternateTitles,
        airDate,
        season: episode.seasonNumber,
        episode: episode.episodeNumber,
        tvdbId: tvShow.tvdbId,
        imdbId: tvShow.imdbId,
        episodeAirDate: episode.airDate?.toISODate(),
      })

      const searchResults = await indexerManager.searchTvShows({
        title: tvShow.title,
        season: episode.seasonNumber,
        episode: episode.episodeNumber,
        tvdbId: tvShow.tvdbId || undefined,
        imdbId: tvShow.imdbId || undefined,
        alternateTitles,
        airDate: airDate ?? undefined,
        seriesType,
        limit: 25,
      })

      console.log('[SearchSingleEpisode] Raw results:', searchResults.length)
      if (searchResults.length > 0) {
        console.log(
          '[SearchSingleEpisode] Sample result titles:',
          searchResults.slice(0, 5).map((r) => r.title)
        )
      }

      // Filter results to only include those that actually match the show title
      const allTitles = [tvShow.title, ...alternateTitles]
      const matchingResults = filterTvResultsByTitle(
        searchResults,
        allTitles,
        seriesType,
        airDate ?? undefined
      )

      console.log('[SearchSingleEpisode] After title filter:', {
        before: searchResults.length,
        after: matchingResults.length,
        titles: allTitles,
        seriesType,
      })

      // Filter out blacklisted releases
      const availableResults = await blacklistService.filterBlacklisted(matchingResults)

      if (availableResults.length === 0) {
        return { found: false, grabbed: false }
      }

      // Load quality profile from the TV show and rank by quality
      const profile = await loadQualityProfile(tvShow.qualityProfileId)
      const bestResult = selectBestRelease(
        availableResults,
        'tv',
        profile?.items ?? null,
        profile?.cutoff ?? null
      )

      if (!bestResult) {
        return { found: true, grabbed: false, error: 'No results matching quality profile' }
      }

      await downloadManager.grab({
        title: bestResult.title,
        downloadUrl: bestResult.downloadUrl,
        size: bestResult.size,
        tvShowId: episode.tvShowId,
        episodeId: episode.id,
        indexerId: bestResult.indexerId,
        indexerName: bestResult.indexer,
        guid: bestResult.id,
      })

      return { found: true, grabbed: true }
    } catch (error) {
      return {
        found: false,
        grabbed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Search and grab a single book immediately
   */
  async searchSingleBook(
    bookId: string
  ): Promise<{ found: boolean; grabbed: boolean; error?: string }> {
    try {
      const book = await Book.query().where('id', bookId).preload('author').first()

      if (!book) {
        return { found: false, grabbed: false, error: 'Book not found' }
      }

      // Check if book already has a file
      if (book.hasFile) {
        return { found: false, grabbed: false, error: 'Book already has a file' }
      }

      // Check for active downloads
      const activeDownload = await Download.query()
        .where('bookId', bookId)
        .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
        .first()

      if (activeDownload) {
        return { found: false, grabbed: false, error: 'Already has active download' }
      }

      const searchResults = await indexerManager.searchBooks({
        title: book.title,
        author: book.author?.name,
        limit: 10,
      })

      // Filter out blacklisted releases
      const availableResults = await blacklistService.filterBlacklisted(searchResults)

      if (availableResults.length === 0) {
        return { found: false, grabbed: false }
      }

      // Load quality profile from the author and rank by quality
      const profile = await loadQualityProfile(book.author?.qualityProfileId ?? null)
      const bestResult = selectBestRelease(
        availableResults,
        'books',
        profile?.items ?? null,
        profile?.cutoff ?? null
      )

      if (!bestResult) {
        return { found: true, grabbed: false, error: 'No results matching quality profile' }
      }

      await downloadManager.grab({
        title: bestResult.title,
        downloadUrl: bestResult.downloadUrl,
        size: bestResult.size,
        bookId: book.id,
        indexerId: bestResult.indexerId,
        indexerName: bestResult.indexer,
        guid: bestResult.id,
      })

      return { found: true, grabbed: true }
    } catch (error) {
      return {
        found: false,
        grabbed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Search and grab all requested episodes for a TV show
   */
  async searchTvShowEpisodes(
    tvShowId: string
  ): Promise<{ searched: number; found: number; grabbed: number; errors: string[] }> {
    const result = { searched: 0, found: 0, grabbed: 0, errors: [] as string[] }

    try {
      const episodes = await Episode.query()
        .where('tvShowId', tvShowId)
        .where('requested', true)
        .where('hasFile', false)
        .preload('tvShow')

      // Get episodes with active downloads
      const activeDownloads = await Download.query()
        .where('tvShowId', tvShowId)
        .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

      const episodesWithActiveDownloads = new Set(activeDownloads.map((d) => d.episodeId))

      for (const episode of episodes) {
        if (episodesWithActiveDownloads.has(episode.id)) {
          continue
        }

        if (!episode.tvShow) continue

        // Re-check if episode is still requested (user may have unrequested during search)
        const currentEpisode = await Episode.find(episode.id)
        if (!currentEpisode || !currentEpisode.requested) {
          logger.debug(
            { show: episode.tvShow.title, season: episode.seasonNumber, ep: episode.episodeNumber },
            'RequestedSearch: Skipping episode - no longer requested'
          )
          continue
        }

        result.searched++

        try {
          const tvShow = episode.tvShow
          const seriesType = tvShow.seriesType || 'standard'
          const alternateTitles = tvShow.alternateTitles || []
          const airDate =
            seriesType === 'daily' && episode.airDate ? episode.airDate.toISODate() : undefined

          const searchResults = await indexerManager.searchTvShows({
            title: tvShow.title,
            season: episode.seasonNumber,
            episode: episode.episodeNumber,
            tvdbId: tvShow.tvdbId || undefined,
            imdbId: tvShow.imdbId || undefined,
            alternateTitles,
            airDate: airDate ?? undefined,
            seriesType,
            limit: 25,
          })

          // Filter results to only include those that actually match the show title
          const allTitles = [tvShow.title, ...alternateTitles]
          const matchingResults = filterTvResultsByTitle(
            searchResults,
            allTitles,
            seriesType,
            airDate ?? undefined
          )

          if (matchingResults.length === 0) {
            continue
          }

          result.found++

          // Load quality profile from the TV show and rank by quality
          const profile = await loadQualityProfile(tvShow.qualityProfileId)
          const bestResult = selectBestRelease(
            matchingResults,
            'tv',
            profile?.items ?? null,
            profile?.cutoff ?? null
          )

          if (!bestResult) continue

          // Final check before grabbing - episode might have been unrequested while searching
          const stillRequested = await Episode.query()
            .where('id', episode.id)
            .where('requested', true)
            .first()

          if (!stillRequested) {
            logger.debug(
              {
                show: tvShow.title,
                season: episode.seasonNumber,
                ep: episode.episodeNumber,
              },
              'RequestedSearch: Skipping grab - unrequested during search'
            )
            continue
          }

          await downloadManager.grab({
            title: bestResult.title,
            downloadUrl: bestResult.downloadUrl,
            size: bestResult.size,
            tvShowId: episode.tvShowId,
            episodeId: episode.id,
            indexerId: bestResult.indexerId,
            indexerName: bestResult.indexer,
            guid: bestResult.id,
          })

          result.grabbed++
          await new Promise((resolve) => setTimeout(resolve, 2000)) // Rate limit
        } catch (error) {
          result.errors.push(
            `S${episode.seasonNumber}E${episode.episodeNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Check if the task is currently running
   */
  get running() {
    return this.isRunning
  }

  /**
   * Get the current interval in minutes
   */
  get interval() {
    return this.intervalMinutes
  }
}

export const requestedSearchTask = new RequestedSearchTask()
