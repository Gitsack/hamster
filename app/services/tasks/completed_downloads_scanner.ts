import fs from 'node:fs/promises'
import DownloadClient from '#models/download_client'
import Download from '#models/download'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Album from '#models/album'
import Book from '#models/book'
import { sabnzbdService, type SabnzbdConfig, type SabnzbdHistoryItem } from '#services/download_clients/sabnzbd_service'
import { movieImportService } from '#services/media/movie_import_service'
import { episodeImportService } from '#services/media/episode_import_service'
import { downloadImportService } from '#services/media/download_import_service'
import { bookImportService } from '#services/media/book_import_service'
import { DateTime } from 'luxon'

/**
 * Service that scans download client completed folders for orphaned downloads
 * that weren't imported (e.g., if the app was down when the download completed).
 */
class CompletedDownloadsScanner {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  // Cached library data to avoid repeated queries
  private cachedMovies: Movie[] = []
  private cachedShows: TvShow[] = []
  private cachedAlbums: Array<Album & { artist?: { name: string } }> = []
  private cachedBooks: Array<Book & { author?: { name: string } }> = []

  /**
   * Start periodic scanning
   */
  start(intervalMinutes = 5) {
    if (this.intervalId) {
      this.stop()
    }

    console.log(`[CompletedScanner] Starting completed downloads scanner (every ${intervalMinutes} minutes)`)

    // Run immediately on start
    this.scan().catch(console.error)

    // Then run periodically
    this.intervalId = setInterval(
      () => this.scan().catch(console.error),
      intervalMinutes * 60 * 1000
    )
  }

  /**
   * Stop periodic scanning
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[CompletedScanner] Stopped completed downloads scanner')
    }
  }

  /**
   * Yield to event loop to prevent blocking
   */
  private yield(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve))
  }

  /**
   * Load library items into cache for efficient matching
   */
  private async loadCache(): Promise<void> {
    console.log('[CompletedScanner] Loading library cache...')
    const [movies, shows, albums, books] = await Promise.all([
      Movie.query().where('requested', true),
      TvShow.query().where('requested', true),
      Album.query().where('requested', true).preload('artist'),
      Book.query().where('requested', true).preload('author'),
    ])
    this.cachedMovies = movies
    this.cachedShows = shows
    this.cachedAlbums = albums as any
    this.cachedBooks = books as any
    console.log(`[CompletedScanner] Cache loaded: ${movies.length} movies, ${shows.length} shows, ${albums.length} albums, ${books.length} books`)
  }

  /**
   * Clear the cache after scan
   */
  private clearCache(): void {
    this.cachedMovies = []
    this.cachedShows = []
    this.cachedAlbums = []
    this.cachedBooks = []
  }

  /**
   * Run a single scan
   */
  async scan(): Promise<{ processed: number; imported: number; errors: string[] }> {
    if (this.isRunning) {
      console.log('[CompletedScanner] Already running, skipping...')
      return { processed: 0, imported: 0, errors: [] }
    }

    this.isRunning = true
    const results = { processed: 0, imported: 0, errors: [] as string[] }

    try {
      console.log('[CompletedScanner] Scanning for orphaned completed downloads...')

      // Load library items once at the start
      await this.loadCache()

      const clients = await DownloadClient.query().where('enabled', true)

      for (const client of clients) {
        try {
          const clientResults = await this.scanClient(client)
          results.processed += clientResults.processed
          results.imported += clientResults.imported
          results.errors.push(...clientResults.errors)
        } catch (error) {
          const msg = `Failed to scan client ${client.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`[CompletedScanner] ${msg}`)
          results.errors.push(msg)
        }
      }

      console.log(`[CompletedScanner] Scan complete: ${results.processed} processed, ${results.imported} imported`)
    } finally {
      this.clearCache()
      this.isRunning = false
    }

    return results
  }

  /**
   * Scan a specific download client
   */
  private async scanClient(client: DownloadClient): Promise<{ processed: number; imported: number; errors: string[] }> {
    const results = { processed: 0, imported: 0, errors: [] as string[] }

    switch (client.type) {
      case 'sabnzbd': {
        const config: SabnzbdConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8080,
          apiKey: client.settings.apiKey || '',
          useSsl: client.settings.useSsl || false,
        }

        // Get history with a smaller limit to reduce processing time
        const history = await sabnzbdService.getHistory(config, 50)

        for (const slot of history.slots) {
          if (slot.status !== 'Completed') continue
          results.processed++

          // Yield to event loop every item to prevent blocking HTTP requests
          await this.yield()

          try {
            const importResult = await this.processCompletedDownload(client, slot)
            if (importResult.imported) {
              results.imported++
            }
            if (importResult.error) {
              results.errors.push(importResult.error)
            }
          } catch (error) {
            results.errors.push(`Error processing ${slot.name}: ${error instanceof Error ? error.message : 'Unknown'}`)
          }
        }
        break
      }
    }

    return results
  }

  /**
   * Process a completed download from SABnzbd history
   */
  private async processCompletedDownload(
    client: DownloadClient,
    slot: SabnzbdHistoryItem
  ): Promise<{ imported: boolean; error?: string }> {
    // Check if we already have a completed download record for this
    const existingDownload = await Download.query()
      .where('downloadClientId', client.id)
      .where('externalId', slot.nzo_id)
      .first()

    if (existingDownload) {
      // If already completed, skip
      if (existingDownload.status === 'completed') {
        return { imported: false }
      }

      // If failed, skip - DownloadManager handles retries and the user can manually retry
      // Don't keep retrying failed imports as they usually fail for a reason (unmounted storage, etc.)
      if (existingDownload.status === 'failed') {
        return { imported: false }
      }

      // If importing, check if it's stuck (been importing for more than 5 minutes)
      // Use 5 minutes instead of 2 to avoid interfering with DownloadManager
      if (existingDownload.status === 'importing') {
        const completedAt = existingDownload.completedAt
        const fiveMinutesAgo = DateTime.now().minus({ minutes: 5 })

        if (completedAt && completedAt < fiveMinutesAgo) {
          console.log(`[CompletedScanner] Found stuck import: ${existingDownload.title} (importing since ${completedAt.toISO()})`)
          // Re-trigger import for stuck downloads
          existingDownload.outputPath = slot.storage
          await existingDownload.save()
          return await this.importDownload(existingDownload, client)
        }

        // Otherwise, skip (recently started importing or being handled by DownloadManager)
        return { imported: false }
      }

      // For queued/downloading/paused, trigger import
      console.log(`[CompletedScanner] Triggering import for: ${existingDownload.title}`)
      existingDownload.status = 'importing'
      existingDownload.progress = 100
      existingDownload.completedAt = DateTime.now()
      existingDownload.outputPath = slot.storage
      await existingDownload.save()

      return await this.importDownload(existingDownload, client)
    }

    // No existing download record - try to match to a library item
    const match = await this.matchToLibrary(slot.name)

    if (!match) {
      // Can't match - skip silently (user might have removed it from library)
      return { imported: false }
    }

    console.log(`[CompletedScanner] Found orphaned download: ${slot.name} -> ${match.type} (${match.title})`)

    // Apply remote path mapping if configured
    let outputPath = slot.storage
    if (client.settings?.remotePath && client.settings?.localPath) {
      outputPath = outputPath.replace(client.settings.remotePath, client.settings.localPath)
    }

    // Create a download record
    const download = await Download.create({
      downloadClientId: client.id,
      externalId: slot.nzo_id,
      title: slot.name,
      status: 'importing',
      progress: 100,
      sizeBytes: slot.bytes,
      outputPath: outputPath,
      completedAt: DateTime.now(),
      startedAt: DateTime.fromSeconds(slot.completed - slot.download_time),
      movieId: match.type === 'movie' ? match.id : null,
      tvShowId: match.type === 'episode' ? match.tvShowId : null,
      episodeId: match.type === 'episode' ? match.id : null,
      albumId: match.type === 'album' ? match.id : null,
      bookId: match.type === 'book' ? match.id : null,
    })

    return await this.importDownload(download, client)
  }

  /**
   * Check if a path is accessible with a timeout to avoid blocking on unmounted network paths
   */
  private async isPathAccessible(path: string, timeoutMs = 3000): Promise<{ accessible: boolean; error?: string }> {
    try {
      await Promise.race([
        fs.access(path),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Path check timeout')), timeoutMs)
        ),
      ])
      return { accessible: true }
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'Path check timeout'
      if (isTimeout) {
        return {
          accessible: false,
          error: `Download path not responding: "${path}". The network storage may not be mounted or is unresponsive.`,
        }
      }
      return {
        accessible: false,
        error: `Download path not accessible: "${path}". ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Import a download using the appropriate service
   */
  private async importDownload(
    download: Download,
    client: DownloadClient
  ): Promise<{ imported: boolean; error?: string }> {
    console.log(`[CompletedScanner] Starting import for: ${download.title}`)

    try {
      // Apply remote path mapping if not already applied
      let outputPath = download.outputPath || ''
      if (client.settings?.remotePath && client.settings?.localPath) {
        if (outputPath.startsWith(client.settings.remotePath)) {
          outputPath = outputPath.replace(client.settings.remotePath, client.settings.localPath)
          download.outputPath = outputPath
          await download.save()
        }
      }

      // Check if path is accessible before attempting import (with timeout to avoid blocking)
      const pathCheck = await this.isPathAccessible(outputPath)
      if (!pathCheck.accessible) {
        console.log(`[CompletedScanner] Path not accessible for ${download.title}: ${pathCheck.error}`)
        download.status = 'failed'
        download.errorMessage = pathCheck.error || 'Path not accessible'
        await download.save()
        return { imported: false, error: pathCheck.error }
      }

      let result: { success: boolean; filesImported: number; errors: string[] }

      if (download.movieId) {
        result = await movieImportService.importDownload(download)
      } else if (download.tvShowId || download.episodeId) {
        result = await episodeImportService.importDownload(download)
      } else if (download.albumId) {
        result = await downloadImportService.importDownload(download)
      } else if (download.bookId) {
        result = await bookImportService.importDownload(download)
      } else {
        download.status = 'failed'
        download.errorMessage = 'Unknown media type'
        await download.save()
        return { imported: false, error: 'Unknown media type' }
      }

      if (result.success) {
        download.status = 'completed'
        await download.save()
        console.log(`[CompletedScanner] Imported: ${download.title} (${result.filesImported} files)`)
        return { imported: true }
      } else {
        download.status = 'failed'
        download.errorMessage = result.errors.join('; ')
        await download.save()
        console.log(`[CompletedScanner] Import failed: ${download.title} - ${result.errors.join('; ')}`)
        return { imported: false, error: result.errors.join('; ') }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Import failed'
      console.error(`[CompletedScanner] Import error for ${download.title}:`, error)
      download.status = 'failed'
      download.errorMessage = errorMsg
      await download.save()
      return { imported: false, error: errorMsg }
    }
  }

  /**
   * Try to match a download folder name to a library item
   */
  private async matchToLibrary(
    folderName: string
  ): Promise<{ type: 'movie' | 'episode' | 'album' | 'book'; id: string; title: string; tvShowId?: string } | null> {
    // Parse the folder name to extract title and year
    const parsed = this.parseFolderName(folderName)

    // Try matching movie (synchronous, uses cache)
    if (parsed.title) {
      const movieMatch = this.matchMovie(parsed.title, parsed.year)
      if (movieMatch) {
        return { type: 'movie', id: movieMatch.id, title: movieMatch.title }
      }
    }

    // Try matching TV episode (async due to episode query)
    if (parsed.title && (parsed.season !== undefined || parsed.episode !== undefined)) {
      const episodeMatch = await this.matchEpisode(parsed.title, parsed.season, parsed.episode)
      if (episodeMatch) {
        return { type: 'episode', id: episodeMatch.id, title: episodeMatch.title, tvShowId: episodeMatch.tvShowId }
      }
    }

    // Try matching album (synchronous, uses cache)
    if (parsed.artist && parsed.album) {
      const albumMatch = this.matchAlbum(parsed.artist, parsed.album)
      if (albumMatch) {
        return { type: 'album', id: albumMatch.id, title: albumMatch.title }
      }
    }

    // Try matching book (synchronous, uses cache)
    if (parsed.author && parsed.bookTitle) {
      const bookMatch = this.matchBook(parsed.author, parsed.bookTitle)
      if (bookMatch) {
        return { type: 'book', id: bookMatch.id, title: bookMatch.title }
      }
    }

    // If we have a title but no year/season info, try movie as fallback
    if (parsed.title && !parsed.season && !parsed.episode) {
      const movieMatch = this.matchMovie(parsed.title, undefined)
      if (movieMatch) {
        return { type: 'movie', id: movieMatch.id, title: movieMatch.title }
      }
    }

    return null
  }

  /**
   * Parse folder name into components
   */
  private parseFolderName(folderName: string): {
    title?: string
    year?: number
    season?: number
    episode?: number
    artist?: string
    album?: string
    author?: string
    bookTitle?: string
  } {
    const result: ReturnType<typeof this.parseFolderName> = {}

    // Clean up the folder name
    let cleaned = folderName
      .replace(/-xpost$/i, '')
      .replace(/\./g, ' ')
      .replace(/_/g, ' ')
      .trim()

    // Try to extract year (4 digits, usually 1900-2099)
    const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/)
    if (yearMatch) {
      result.year = parseInt(yearMatch[1])
    }

    // Try to match TV show pattern (S01E01 or 1x01)
    const tvMatch = cleaned.match(/(.+?)\s*(?:S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2}))/i)
    if (tvMatch) {
      result.title = tvMatch[1].trim()
      result.season = parseInt(tvMatch[2] || tvMatch[4])
      result.episode = parseInt(tvMatch[3] || tvMatch[5])
      return result
    }

    // Try to match music pattern (Artist - Album)
    const musicMatch = cleaned.match(/^(.+?)\s*-\s*(.+?)(?:\s+(?:CD|LP|EP|FLAC|MP3|WEB|Vinyl|\d{4}))/i)
    if (musicMatch) {
      result.artist = musicMatch[1].trim()
      result.album = musicMatch[2].trim()
      return result
    }

    // Try to match book pattern (Author - Title or Title by Author)
    const bookMatch = cleaned.match(/^(.+?)\s+by\s+(.+?)(?:\s+epub|\s+mobi|\s+pdf)?$/i) ||
                     cleaned.match(/^(.+?)\s*-\s*(.+?)(?:\s+epub|\s+mobi|\s+pdf)?$/i)
    if (bookMatch && cleaned.match(/epub|mobi|pdf|audiobook|ebook/i)) {
      result.author = bookMatch[2]?.trim() || bookMatch[1]?.trim()
      result.bookTitle = bookMatch[1]?.trim() || bookMatch[2]?.trim()
      return result
    }

    // Extract title for movie (everything before quality/codec info)
    const titleMatch = cleaned.match(/^(.+?)(?:\s+(?:REMASTERED|COMPLETE|EXTENDED|DIRECTORS|UNCUT|THEATRICAL|PROPER|RERIP|BLURAY|BLU-RAY|BDRIP|HDRIP|DVDRIP|WEBRIP|WEB-DL|HDTV|720p|1080p|2160p|4K|UHD|x264|x265|HEVC|H\.?264|H\.?265|AAC|DTS|AC3|ATMOS|REMUX|NF|AMZN|DSNP|ATVP))/i)
    if (titleMatch) {
      result.title = titleMatch[1].replace(/\b\d{4}\b/, '').trim()
    } else {
      // Fallback: use first part before any numbers/special chars
      result.title = cleaned.split(/\s+\d{4}\s+|\s+-\s+/)[0].trim()
    }

    return result
  }

  /**
   * Match a parsed title to a movie in the library (uses cache)
   */
  private matchMovie(title: string, year?: number): { id: string; title: string } | null {
    // Normalize title for matching
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '')

    for (const movie of this.cachedMovies) {
      const movieNormalized = movie.title.toLowerCase().replace(/[^a-z0-9]/g, '')

      // Check if titles are similar enough
      if (this.isSimilar(normalizedTitle, movieNormalized)) {
        // If we have a year, verify it matches (allow 1 year difference for release date variations)
        if (year && movie.year && Math.abs(year - movie.year) > 1) {
          continue
        }
        return { id: movie.id, title: movie.title }
      }
    }

    return null
  }

  /**
   * Match a parsed title to a TV episode in the library (uses cache for shows)
   */
  private async matchEpisode(
    title: string,
    season?: number,
    episode?: number
  ): Promise<{ id: string; title: string; tvShowId: string } | null> {
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '')

    for (const show of this.cachedShows) {
      const showNormalized = show.title.toLowerCase().replace(/[^a-z0-9]/g, '')

      if (this.isSimilar(normalizedTitle, showNormalized)) {
        // Found the show, now find the episode (this query is necessary)
        if (season !== undefined && episode !== undefined) {
          const ep = await Episode.query()
            .where('tvShowId', show.id)
            .where('seasonNumber', season)
            .where('episodeNumber', episode)
            .first()

          if (ep) {
            return { id: ep.id, title: `${show.title} S${season}E${episode}`, tvShowId: show.id }
          }
        }
      }
    }

    return null
  }

  /**
   * Match to an album in the library (uses cache)
   */
  private matchAlbum(artist: string, albumTitle: string): { id: string; title: string } | null {
    const normalizedArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, '')
    const normalizedAlbum = albumTitle.toLowerCase().replace(/[^a-z0-9]/g, '')

    for (const album of this.cachedAlbums) {
      const albumNormalized = album.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      const artistNormalized = (album as any).artist?.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

      if (this.isSimilar(normalizedAlbum, albumNormalized) && this.isSimilar(normalizedArtist, artistNormalized)) {
        return { id: album.id, title: `${(album as any).artist?.name} - ${album.title}` }
      }
    }

    return null
  }

  /**
   * Match to a book in the library (uses cache)
   */
  private matchBook(author: string, bookTitle: string): { id: string; title: string } | null {
    const normalizedAuthor = author.toLowerCase().replace(/[^a-z0-9]/g, '')
    const normalizedTitle = bookTitle.toLowerCase().replace(/[^a-z0-9]/g, '')

    for (const book of this.cachedBooks) {
      const titleNormalized = book.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      const authorNormalized = (book as any).author?.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

      if (this.isSimilar(normalizedTitle, titleNormalized) && this.isSimilar(normalizedAuthor, authorNormalized)) {
        return { id: book.id, title: `${(book as any).author?.name} - ${book.title}` }
      }
    }

    return null
  }

  /**
   * Check if two strings are similar enough to be considered a match
   */
  private isSimilar(a: string, b: string): boolean {
    // If one contains the other, it's a match
    if (a.includes(b) || b.includes(a)) {
      return true
    }

    // Calculate Levenshtein distance for short strings
    if (a.length < 20 && b.length < 20) {
      const distance = this.levenshteinDistance(a, b)
      const maxLength = Math.max(a.length, b.length)
      return distance / maxLength < 0.3 // 30% difference threshold
    }

    return false
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[b.length][a.length]
  }
}

export const completedDownloadsScanner = new CompletedDownloadsScanner()
