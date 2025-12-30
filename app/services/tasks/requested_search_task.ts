import Album from '#models/album'
import Movie from '#models/movie'
import Book from '#models/book'
import Episode from '#models/episode'
import Download from '#models/download'
import { indexerManager, type UnifiedSearchResult } from '#services/indexers/indexer_manager'
import { downloadManager } from '#services/download_clients/download_manager'

/**
 * Normalize a title for comparison by:
 * - Converting to lowercase
 * - Replacing dots, underscores, hyphens with spaces
 * - Removing extra whitespace
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
function doesTvReleaseTitleMatch(releaseTitle: string, expectedTitle: string): boolean {
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

  // Now verify that what comes AFTER the title is a season/episode pattern
  // This prevents "friends with benefits" from matching "friends"
  const afterTitle = releaseWords.slice(expectedWords.length).join(' ')

  // The next part should start with a season pattern like "s01" or "s01e01" or "season 1"
  const seasonPattern = /^s\d+|^season\s*\d+/i
  if (!seasonPattern.test(afterTitle)) {
    return false
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
    if (afterTitle === '' || /^\d{4}|^\d{3,4}p|^bluray|^webrip|^web dl|^hdtv|^dvdrip|^brrip|^remux|^uhd/i.test(afterTitle)) {
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
      if (/^\d{4}$|^\d{3,4}p$|^bluray$|^webrip$|^web$|^hdtv$|^dvdrip$|^brrip$|^remux$|^uhd$/i.test(nextWord)) {
        return true
      }
    }
  }

  return false
}

/**
 * Filter TV show search results to only include those matching the expected title
 */
function filterTvResultsByTitle(
  results: UnifiedSearchResult[],
  expectedTitle: string
): UnifiedSearchResult[] {
  return results.filter((result) => doesTvReleaseTitleMatch(result.title, expectedTitle))
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
    console.log(`[RequestedSearch] Starting periodic search every ${intervalMinutes} minutes`)

    // Run immediately on start
    this.run().catch(console.error)

    // Then run periodically
    this.intervalId = setInterval(
      () => this.run().catch(console.error),
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
      console.log('[RequestedSearch] Stopped periodic search')
    }
  }

  /**
   * Run a search for all requested items (albums, movies, books)
   */
  async run(): Promise<RequestedSearchResult> {
    if (this.isRunning) {
      console.log('[RequestedSearch] Already running, skipping')
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
      console.log('[RequestedSearch] Starting search for requested items...')

      // Search for albums
      await this.searchAlbums(result)

      // Search for movies
      await this.searchMovies(result)

      // Search for books
      await this.searchBooks(result)

      // Search for TV episodes
      await this.searchEpisodes(result)

      console.log(
        `[RequestedSearch] Complete: albums=${result.albums.grabbed}, movies=${result.movies.grabbed}, books=${result.books.grabbed}, episodes=${result.episodes.grabbed}`
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
    console.log('[RequestedSearch] Searching for requested albums...')

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

    console.log(`[RequestedSearch] Found ${albumsToSearch.length} requested albums`)

    // Get albums that already have active downloads
    const activeDownloads = await Download.query()
      .whereNotNull('albumId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const albumsWithActiveDownloads = new Set(activeDownloads.map((d) => d.albumId))

    for (const album of albumsToSearch) {
      if (albumsWithActiveDownloads.has(album.id)) {
        console.log(`[RequestedSearch] Skipping album ${album.title} - already has active download`)
        continue
      }

      // Re-check if album is still requested
      const currentAlbum = await Album.find(album.id)
      if (!currentAlbum || !currentAlbum.requested) {
        console.log(`[RequestedSearch] Skipping album ${album.title} - no longer requested`)
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

        if (searchResults.length === 0) {
          console.log(`[RequestedSearch] No results for album: ${album.artist?.name} - ${album.title}`)
          continue
        }

        result.albums.found++

        const sorted = searchResults.sort((a, b) => b.size - a.size)
        const bestResult = sorted[0]

        // Final check before grabbing
        const stillRequested = await Album.query().where('id', album.id).where('requested', true).first()
        if (!stillRequested) {
          console.log(`[RequestedSearch] Skipping grab for album ${album.title} - unrequested during search`)
          continue
        }

        console.log(`[RequestedSearch] Grabbing album: ${bestResult.title}`)

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
        console.error(`[RequestedSearch] ${errorMsg}`)
        result.errors.push(errorMsg)
      }
    }
  }

  /**
   * Search for requested movies
   */
  private async searchMovies(result: RequestedSearchResult) {
    console.log('[RequestedSearch] Searching for requested movies...')

    const requestedMovies = await Movie.query()
      .where('requested', true)
      .where('hasFile', false)

    console.log(`[RequestedSearch] Found ${requestedMovies.length} requested movies`)

    // Get movies that already have active downloads
    const activeDownloads = await Download.query()
      .whereNotNull('movieId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const moviesWithActiveDownloads = new Set(activeDownloads.map((d) => d.movieId))

    for (const movie of requestedMovies) {
      if (moviesWithActiveDownloads.has(movie.id)) {
        console.log(`[RequestedSearch] Skipping movie ${movie.title} - already has active download`)
        continue
      }

      // Re-check if movie is still requested
      const currentMovie = await Movie.find(movie.id)
      if (!currentMovie || !currentMovie.requested) {
        console.log(`[RequestedSearch] Skipping movie ${movie.title} - no longer requested`)
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

        if (matchingResults.length === 0) {
          console.log(`[RequestedSearch] No matching results for movie: ${movie.title} (${movie.year}) (${searchResults.length} results didn't match title)`)
          continue
        }

        result.movies.found++

        // Prefer higher quality and larger size
        const bestResult = matchingResults[0] // Already sorted by size

        // Final check before grabbing
        const stillRequested = await Movie.query().where('id', movie.id).where('requested', true).first()
        if (!stillRequested) {
          console.log(`[RequestedSearch] Skipping grab for movie ${movie.title} - unrequested during search`)
          continue
        }

        console.log(`[RequestedSearch] Grabbing movie: ${bestResult.title}`)

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
        console.error(`[RequestedSearch] ${errorMsg}`)
        result.errors.push(errorMsg)
      }
    }
  }

  /**
   * Search for requested books
   */
  private async searchBooks(result: RequestedSearchResult) {
    console.log('[RequestedSearch] Searching for requested books...')

    const requestedBooks = await Book.query()
      .where('requested', true)
      .where('hasFile', false)
      .preload('author')

    console.log(`[RequestedSearch] Found ${requestedBooks.length} requested books`)

    // Get books that already have active downloads
    const activeDownloads = await Download.query()
      .whereNotNull('bookId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const booksWithActiveDownloads = new Set(activeDownloads.map((d) => d.bookId))

    for (const book of requestedBooks) {
      if (booksWithActiveDownloads.has(book.id)) {
        console.log(`[RequestedSearch] Skipping book ${book.title} - already has active download`)
        continue
      }

      // Re-check if book is still requested
      const currentBook = await Book.find(book.id)
      if (!currentBook || !currentBook.requested) {
        console.log(`[RequestedSearch] Skipping book ${book.title} - no longer requested`)
        continue
      }

      result.books.searched++

      try {
        const searchResults = await indexerManager.searchBooks({
          title: book.title,
          author: book.author?.name,
          limit: 10,
        })

        if (searchResults.length === 0) {
          console.log(`[RequestedSearch] No results for book: ${book.title} by ${book.author?.name}`)
          continue
        }

        result.books.found++

        // Prefer larger files (more likely to be complete/better quality)
        const sorted = searchResults.sort((a, b) => b.size - a.size)
        const bestResult = sorted[0]

        // Final check before grabbing
        const stillRequested = await Book.query().where('id', book.id).where('requested', true).first()
        if (!stillRequested) {
          console.log(`[RequestedSearch] Skipping grab for book ${book.title} - unrequested during search`)
          continue
        }

        console.log(`[RequestedSearch] Grabbing book: ${bestResult.title}`)

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
        console.error(`[RequestedSearch] ${errorMsg}`)
        result.errors.push(errorMsg)
      }
    }
  }

  /**
   * Search for requested TV episodes
   */
  private async searchEpisodes(result: RequestedSearchResult) {
    console.log('[RequestedSearch] Searching for requested episodes...')

    const requestedEpisodes = await Episode.query()
      .where('requested', true)
      .where('hasFile', false)
      .preload('tvShow')

    console.log(`[RequestedSearch] Found ${requestedEpisodes.length} requested episodes`)

    // Get episodes that already have active downloads
    const activeDownloads = await Download.query()
      .whereNotNull('episodeId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const episodesWithActiveDownloads = new Set(activeDownloads.map((d) => d.episodeId))

    for (const episode of requestedEpisodes) {
      if (episodesWithActiveDownloads.has(episode.id)) {
        console.log(
          `[RequestedSearch] Skipping episode ${episode.tvShow?.title} S${episode.seasonNumber}E${episode.episodeNumber} - already has active download`
        )
        continue
      }

      if (!episode.tvShow) {
        console.log(`[RequestedSearch] Skipping episode ${episode.id} - no TV show loaded`)
        continue
      }

      // Re-check if episode is still requested (user may have unrequested during search)
      const currentEpisode = await Episode.find(episode.id)
      if (!currentEpisode || !currentEpisode.requested) {
        console.log(`[RequestedSearch] Skipping episode ${episode.tvShow.title} S${episode.seasonNumber}E${episode.episodeNumber} - no longer requested`)
        continue
      }

      result.episodes.searched++

      try {
        const searchResults = await indexerManager.searchTvShows({
          title: episode.tvShow.title,
          season: episode.seasonNumber,
          episode: episode.episodeNumber,
          tvdbId: episode.tvShow.tvdbId || undefined,
          imdbId: episode.tvShow.imdbId || undefined,
          limit: 25,
        })

        // Filter results to only include those that actually match the show title
        const matchingResults = filterTvResultsByTitle(searchResults, episode.tvShow.title)

        if (matchingResults.length === 0) {
          console.log(
            `[RequestedSearch] No matching results for episode: ${episode.tvShow.title} S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')} (${searchResults.length} results didn't match title)`
          )
          continue
        }

        result.episodes.found++

        // Best result is already sorted by size (larger = better quality)
        const bestResult = matchingResults[0]

        // Final check before grabbing - episode might have been unrequested while searching
        const stillRequested = await Episode.query()
          .where('id', episode.id)
          .where('requested', true)
          .first()

        if (!stillRequested) {
          console.log(`[RequestedSearch] Skipping grab for ${episode.tvShow.title} S${episode.seasonNumber}E${episode.episodeNumber} - unrequested during search`)
          continue
        }

        console.log(
          `[RequestedSearch] Grabbing episode: ${bestResult.title}`
        )

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
        console.error(`[RequestedSearch] ${errorMsg}`)
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
      const album = await Album.query().where('id', albumId).preload('artist').preload('tracks').first()

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

      if (searchResults.length === 0) {
        return { found: false, grabbed: false }
      }

      const sorted = searchResults.sort((a, b) => b.size - a.size)
      const bestResult = sorted[0]

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

      if (matchingResults.length === 0) {
        return { found: false, grabbed: false }
      }

      const bestResult = matchingResults[0] // Already sorted by size

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

      // Check for active downloads
      const activeDownload = await Download.query()
        .where('episodeId', episodeId)
        .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
        .first()

      if (activeDownload) {
        return { found: false, grabbed: false, error: 'Already has active download' }
      }

      const searchResults = await indexerManager.searchTvShows({
        title: episode.tvShow.title,
        season: episode.seasonNumber,
        episode: episode.episodeNumber,
        tvdbId: episode.tvShow.tvdbId || undefined,
        imdbId: episode.tvShow.imdbId || undefined,
        limit: 25,
      })

      // Filter results to only include those that actually match the show title
      const matchingResults = filterTvResultsByTitle(searchResults, episode.tvShow.title)

      if (matchingResults.length === 0) {
        return { found: false, grabbed: false }
      }

      const bestResult = matchingResults[0] // Already sorted by size

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

      if (searchResults.length === 0) {
        return { found: false, grabbed: false }
      }

      const sorted = searchResults.sort((a, b) => b.size - a.size)
      const bestResult = sorted[0]

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
          console.log(`[RequestedSearch] Skipping episode ${episode.tvShow.title} S${episode.seasonNumber}E${episode.episodeNumber} - no longer requested`)
          continue
        }

        result.searched++

        try {
          const searchResults = await indexerManager.searchTvShows({
            title: episode.tvShow.title,
            season: episode.seasonNumber,
            episode: episode.episodeNumber,
            tvdbId: episode.tvShow.tvdbId || undefined,
            imdbId: episode.tvShow.imdbId || undefined,
            limit: 25,
          })

          // Filter results to only include those that actually match the show title
          const matchingResults = filterTvResultsByTitle(searchResults, episode.tvShow.title)

          if (matchingResults.length === 0) {
            continue
          }

          result.found++

          const bestResult = matchingResults[0]

          // Final check before grabbing - episode might have been unrequested while searching
          const stillRequested = await Episode.query()
            .where('id', episode.id)
            .where('requested', true)
            .first()

          if (!stillRequested) {
            console.log(`[RequestedSearch] Skipping grab for ${episode.tvShow.title} S${episode.seasonNumber}E${episode.episodeNumber} - unrequested during search`)
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
