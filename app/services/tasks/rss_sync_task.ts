import Indexer from '#models/indexer'
import Album from '#models/album'
import Movie from '#models/movie'
import Book from '#models/book'
import Episode from '#models/episode'
import Download from '#models/download'
import {
  newznabService,
  type NewznabIndexerConfig,
  type NewznabSearchResult,
} from '#services/indexers/newznab_service'
import { downloadManager } from '#services/download_clients/download_manager'
import { blacklistService } from '#services/blacklist/blacklist_service'

export interface RssSyncResult {
  indexersChecked: number
  releasesFound: number
  grabbed: number
  errors: string[]
}

// Category ranges for different media types
const MUSIC_CATEGORIES = [3000, 3010, 3020, 3030, 3040, 3050, 3060]
const MOVIE_CATEGORIES = [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060]
const TV_CATEGORIES = [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5060, 5070, 5080]
const BOOK_CATEGORIES = [7000, 7010, 7020, 7030, 7040, 7050, 8010]

/**
 * Normalize a title for comparison
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim()
}

class RssSyncTask {
  private isRunning = false

  /**
   * Start the RSS sync (called by TaskScheduler - does nothing, scheduler handles timing)
   */
  start(_intervalMinutes?: number) {
    // No-op: TaskScheduler handles the interval
  }

  /**
   * Stop the RSS sync
   */
  stop() {
    // No-op: TaskScheduler handles stopping
  }

  /**
   * Run a single RSS sync cycle
   */
  async run(): Promise<RssSyncResult> {
    if (this.isRunning) {
      console.log('[RssSync] Already running, skipping')
      return { indexersChecked: 0, releasesFound: 0, grabbed: 0, errors: ['Already running'] }
    }

    this.isRunning = true
    const result: RssSyncResult = {
      indexersChecked: 0,
      releasesFound: 0,
      grabbed: 0,
      errors: [],
    }

    try {
      console.log('[RssSync] Starting RSS sync...')

      // Get all enabled indexers that support RSS
      const indexers = await Indexer.query().where('enabled', true).where('supportsRss', true)

      if (indexers.length === 0) {
        console.log('[RssSync] No RSS-enabled indexers configured')
        return result
      }

      // Load wanted items once
      const wantedAlbums = await this.getWantedAlbums()
      const wantedMovies = await this.getWantedMovies()
      const wantedEpisodes = await this.getWantedEpisodes()
      const wantedBooks = await this.getWantedBooks()

      const totalWanted =
        wantedAlbums.length + wantedMovies.length + wantedEpisodes.length + wantedBooks.length

      if (totalWanted === 0) {
        console.log('[RssSync] No wanted items, skipping RSS sync')
        return result
      }

      console.log(`[RssSync] Checking ${indexers.length} indexers for ${totalWanted} wanted items`)

      // Fetch RSS from each indexer
      for (const indexer of indexers) {
        result.indexersChecked++

        try {
          const releases = await this.fetchRssFromIndexer(indexer)
          result.releasesFound += releases.length

          if (releases.length === 0) continue

          // Filter out blacklisted releases
          const unifiedReleases = releases.map((r) => ({
            id: r.guid,
            title: r.title,
            indexer: indexer.name,
            indexerId: indexer.id,
            size: r.size,
            publishDate: r.pubDate,
            downloadUrl: r.downloadUrl,
            protocol: 'usenet' as const,
            source: 'direct' as const,
          }))
          const available = await blacklistService.filterBlacklisted(unifiedReleases)

          // Match against wanted items
          for (const release of available) {
            // Yield to event loop periodically
            await new Promise((resolve) => setImmediate(resolve))

            const grabbed = await this.tryMatchAndGrab(
              release,
              wantedAlbums,
              wantedMovies,
              wantedEpisodes,
              wantedBooks
            )
            if (grabbed) {
              result.grabbed++
              // Rate limit between grabs
              await new Promise((resolve) => setTimeout(resolve, 2000))
            }
          }
        } catch (error) {
          const msg = `Failed to fetch RSS from ${indexer.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`[RssSync] ${msg}`)
          result.errors.push(msg)
        }
      }

      console.log(
        `[RssSync] Complete: checked ${result.indexersChecked} indexers, found ${result.releasesFound} releases, grabbed ${result.grabbed}`
      )
    } finally {
      this.isRunning = false
    }

    return result
  }

  /**
   * Fetch RSS feed from a single indexer
   */
  private async fetchRssFromIndexer(indexer: Indexer): Promise<NewznabSearchResult[]> {
    const config: NewznabIndexerConfig = {
      id: indexer.id,
      name: indexer.name,
      url: indexer.settings.baseUrl || '',
      apiKey: indexer.settings.apiKey || '',
      categories: indexer.settings.categories || [],
      enabled: indexer.enabled,
    }

    // Fetch RSS with all relevant categories
    const allCategories = [
      ...MUSIC_CATEGORIES,
      ...MOVIE_CATEGORIES,
      ...TV_CATEGORIES,
      ...BOOK_CATEGORIES,
    ]

    const categories = config.categories.length > 0 ? config.categories : allCategories

    return newznabService.search(config, '', {
      categories,
      limit: 100,
    })
  }

  /**
   * Try to match a release against wanted items and grab if matched
   */
  private async tryMatchAndGrab(
    release: {
      id: string
      title: string
      indexer: string
      indexerId: string
      size: number
      downloadUrl: string
    },
    wantedAlbums: WantedAlbum[],
    wantedMovies: WantedMovie[],
    wantedEpisodes: WantedEpisode[],
    wantedBooks: WantedBook[]
  ): Promise<boolean> {
    const normalizedTitle = normalizeTitle(release.title)

    // Try matching movies
    for (const movie of wantedMovies) {
      if (this.matchesMovie(normalizedTitle, movie)) {
        try {
          console.log(`[RssSync] Matched movie: ${release.title} -> ${movie.title}`)
          await downloadManager.grab({
            title: release.title,
            downloadUrl: release.downloadUrl,
            size: release.size,
            movieId: movie.id,
            indexerId: release.indexerId,
            indexerName: release.indexer,
            guid: release.id,
          })
          return true
        } catch (error) {
          // Likely already downloading or has file
          return false
        }
      }
    }

    // Try matching TV episodes
    for (const episode of wantedEpisodes) {
      if (this.matchesEpisode(normalizedTitle, episode)) {
        try {
          console.log(
            `[RssSync] Matched episode: ${release.title} -> ${episode.showTitle} S${episode.season}E${episode.episode}`
          )
          await downloadManager.grab({
            title: release.title,
            downloadUrl: release.downloadUrl,
            size: release.size,
            tvShowId: episode.tvShowId,
            episodeId: episode.id,
            indexerId: release.indexerId,
            indexerName: release.indexer,
            guid: release.id,
          })
          return true
        } catch (error) {
          return false
        }
      }
    }

    // Try matching albums
    for (const album of wantedAlbums) {
      if (this.matchesAlbum(normalizedTitle, album)) {
        try {
          console.log(
            `[RssSync] Matched album: ${release.title} -> ${album.artistName} - ${album.title}`
          )
          await downloadManager.grab({
            title: release.title,
            downloadUrl: release.downloadUrl,
            size: release.size,
            albumId: album.id,
            indexerId: release.indexerId,
            indexerName: release.indexer,
            guid: release.id,
          })
          return true
        } catch (error) {
          return false
        }
      }
    }

    // Try matching books
    for (const book of wantedBooks) {
      if (this.matchesBook(normalizedTitle, book)) {
        try {
          console.log(
            `[RssSync] Matched book: ${release.title} -> ${book.authorName} - ${book.title}`
          )
          await downloadManager.grab({
            title: release.title,
            downloadUrl: release.downloadUrl,
            size: release.size,
            bookId: book.id,
            indexerId: release.indexerId,
            indexerName: release.indexer,
            guid: release.id,
          })
          return true
        } catch (error) {
          return false
        }
      }
    }

    return false
  }

  private matchesMovie(normalizedTitle: string, movie: WantedMovie): boolean {
    const movieNorm = normalizeTitle(movie.title)
    if (!normalizedTitle.includes(movieNorm)) return false

    // Check for year match if available
    if (movie.year) {
      if (!normalizedTitle.includes(String(movie.year))) return false
    }

    // Verify next part after title is not another word (prevent partial matches)
    const afterTitle = normalizedTitle
      .slice(normalizedTitle.indexOf(movieNorm) + movieNorm.length)
      .trim()

    if (
      afterTitle &&
      !/^\d{4}|^\d{3,4}p|^bluray|^webrip|^web dl|^hdtv|^dvdrip|^remux|^uhd/i.test(afterTitle)
    ) {
      // Could be a false positive (e.g., "The Matrix Resurrections" matching "The Matrix")
      // But allow empty (exact match) or year/quality patterns
      const words = afterTitle.split(' ')
      if (words[0] && !/^\d{4}$/.test(words[0])) return false
    }

    return true
  }

  private matchesEpisode(normalizedTitle: string, episode: WantedEpisode): boolean {
    const showNorm = normalizeTitle(episode.showTitle)
    if (!normalizedTitle.includes(showNorm)) return false

    // Check for season/episode pattern
    const seasonStr = String(episode.season).padStart(2, '0')
    const episodeStr = String(episode.episode).padStart(2, '0')
    const pattern = `s${seasonStr}e${episodeStr}`
    return normalizedTitle.includes(pattern)
  }

  private matchesAlbum(normalizedTitle: string, album: WantedAlbum): boolean {
    const artistNorm = normalizeTitle(album.artistName)
    const albumNorm = normalizeTitle(album.title)
    return normalizedTitle.includes(artistNorm) && normalizedTitle.includes(albumNorm)
  }

  private matchesBook(normalizedTitle: string, book: WantedBook): boolean {
    const titleNorm = normalizeTitle(book.title)
    const authorNorm = normalizeTitle(book.authorName)
    return normalizedTitle.includes(titleNorm) && normalizedTitle.includes(authorNorm)
  }

  /**
   * Get wanted albums (requested but missing files)
   */
  private async getWantedAlbums(): Promise<WantedAlbum[]> {
    const albums = await Album.query().where('requested', true).preload('artist').preload('tracks')

    // Get albums with active downloads
    const activeDownloads = await Download.query()
      .whereNotNull('albumId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const withActiveDownloads = new Set(activeDownloads.map((d) => d.albumId))

    return albums
      .filter((album) => {
        if (withActiveDownloads.has(album.id)) return false
        const trackCount = album.tracks.length
        const fileCount = album.tracks.filter((t) => t.trackFileId !== null).length
        return trackCount === 0 || fileCount < trackCount
      })
      .map((album) => ({
        id: album.id,
        title: album.title,
        artistName: album.artist?.name || '',
      }))
  }

  /**
   * Get wanted movies (requested but no file)
   */
  private async getWantedMovies(): Promise<WantedMovie[]> {
    const movies = await Movie.query().where('requested', true).where('hasFile', false)

    const activeDownloads = await Download.query()
      .whereNotNull('movieId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const withActiveDownloads = new Set(activeDownloads.map((d) => d.movieId))

    return movies
      .filter((m) => !withActiveDownloads.has(m.id))
      .map((m) => ({
        id: m.id,
        title: m.title,
        year: m.year,
      }))
  }

  /**
   * Get wanted episodes (requested but no file)
   */
  private async getWantedEpisodes(): Promise<WantedEpisode[]> {
    const episodes = await Episode.query()
      .where('requested', true)
      .where('hasFile', false)
      .preload('tvShow')
      .limit(50) // Limit to prevent excessive matching

    const activeDownloads = await Download.query()
      .whereNotNull('episodeId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const withActiveDownloads = new Set(activeDownloads.map((d) => d.episodeId))

    return episodes
      .filter((e) => !withActiveDownloads.has(e.id) && e.tvShow)
      .map((e) => ({
        id: e.id,
        tvShowId: e.tvShowId,
        showTitle: e.tvShow!.title,
        season: e.seasonNumber,
        episode: e.episodeNumber,
      }))
  }

  /**
   * Get wanted books (requested but no file)
   */
  private async getWantedBooks(): Promise<WantedBook[]> {
    const books = await Book.query()
      .where('requested', true)
      .where('hasFile', false)
      .preload('author')

    const activeDownloads = await Download.query()
      .whereNotNull('bookId')
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])

    const withActiveDownloads = new Set(activeDownloads.map((d) => d.bookId))

    return books
      .filter((b) => !withActiveDownloads.has(b.id))
      .map((b) => ({
        id: b.id,
        title: b.title,
        authorName: b.author?.name || '',
      }))
  }

  get running() {
    return this.isRunning
  }
}

interface WantedAlbum {
  id: string
  title: string
  artistName: string
}

interface WantedMovie {
  id: string
  title: string
  year: number | null
}

interface WantedEpisode {
  id: string
  tvShowId: string
  showTitle: string
  season: number
  episode: number
}

interface WantedBook {
  id: string
  title: string
  authorName: string
}

export const rssSyncTask = new RssSyncTask()
