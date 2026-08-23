import fs from 'node:fs/promises'
import DownloadClient from '#models/download_client'
import Download from '#models/download'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Album from '#models/album'
import Book from '#models/book'
import {
  sabnzbdService,
  type SabnzbdConfig,
  type SabnzbdHistoryItem,
} from '#services/download_clients/sabnzbd_service'
import { movieImportService } from '#services/media/movie_import_service'
import { episodeImportService } from '#services/media/episode_import_service'
import { downloadImportService } from '#services/media/download_import_service'
import { bookImportService } from '#services/media/book_import_service'
import { parseFolderName, isSimilar, type LibraryMatch } from '#services/media/library_matcher'
import { DateTime } from 'luxon'
import UnmatchedFile from '#models/unmatched_file'
import type { ParsedInfo } from '#models/unmatched_file'
import RootFolder from '#models/root_folder'
import type { ProgressCallback } from '#services/tasks/folder_scanner'
import { deriveMediaType } from '#utils/media_type'
import { downloadManager } from '#services/download_clients/download_manager'
import { historyService } from '#services/history/history_service'

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

    console.log(
      `[CompletedScanner] Starting completed downloads scanner (every ${intervalMinutes} minutes)`
    )

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
    // Match against ALL library items (not only requested). A completed download
    // on disk for any known library entry should be importable.
    const [movies, shows, albums, books] = await Promise.all([
      Movie.query(),
      TvShow.query(),
      Album.query().preload('artist'),
      Book.query().preload('author'),
    ])
    this.cachedMovies = movies
    this.cachedShows = shows
    this.cachedAlbums = albums as any
    this.cachedBooks = books as any
    console.log(
      `[CompletedScanner] Cache loaded: ${movies.length} movies, ${shows.length} shows, ${albums.length} albums, ${books.length} books`
    )
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
  async scan(
    onProgress?: ProgressCallback
  ): Promise<{ processed: number; imported: number; errors: string[] }> {
    if (this.isRunning) {
      console.log('[CompletedScanner] Already running, skipping...')
      return { processed: 0, imported: 0, errors: [] }
    }

    this.isRunning = true
    const results = { processed: 0, imported: 0, errors: [] as string[] }

    try {
      console.log('[CompletedScanner] Scanning for orphaned completed downloads...')
      onProgress?.('info', 'Checking download client history...')

      // Load library items once at the start
      await this.loadCache()

      const clients = await DownloadClient.query().where('enabled', true)

      for (const client of clients) {
        try {
          const clientResults = await this.scanClient(client, onProgress)
          results.processed += clientResults.processed
          results.imported += clientResults.imported
          results.errors.push(...clientResults.errors)
        } catch (error) {
          const msg = `Failed to scan client ${client.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`[CompletedScanner] ${msg}`)
          results.errors.push(msg)
        }
      }

      const summary = `API scan: ${results.processed} processed, ${results.imported} imported`
      console.log(`[CompletedScanner] Scan complete: ${summary}`)
      onProgress?.('info', summary)
    } finally {
      this.clearCache()
      this.isRunning = false
    }

    return results
  }

  /**
   * Scan a specific download client
   */
  private async scanClient(
    client: DownloadClient,
    onProgress?: ProgressCallback
  ): Promise<{ processed: number; imported: number; errors: string[] }> {
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
              onProgress?.('imported', `Imported "${slot.name}"`)
            }
            if (importResult.error) {
              results.errors.push(importResult.error)
              onProgress?.('error', `Failed: "${slot.name}"`)
            }
          } catch (error) {
            results.errors.push(
              `Error processing ${slot.name}: ${error instanceof Error ? error.message : 'Unknown'}`
            )
            onProgress?.('error', `Error processing "${slot.name}"`)
          }
        }
        break
      }
      default: {
        // NZBGet/qBittorrent/Transmission/Deluge: orphan recovery is handled by
        // folder_scanner which walks the client's completed folder on disk.
        // That path is more reliable than per-client API history APIs (works
        // when the client is offline, when history was cleared, when files were
        // placed manually). See app/services/tasks/folder_scanner.ts.
        console.log(
          `[CompletedScanner] Skipping API scan for ${client.name} (${client.type}); orphan recovery is handled by folder_scanner.`
        )
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
          console.log(
            `[CompletedScanner] Found stuck import: ${existingDownload.title} (importing since ${completedAt.toISO()})`
          )
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
      // Can't match - create an unmatched file record so user can review
      await this.createUnmatchedFileRecord(client, slot)
      return { imported: false }
    }

    console.log(
      `[CompletedScanner] Found orphaned download: ${slot.name} -> ${match.type} (${match.title})`
    )

    // Apply remote path mapping if configured
    let outputPath = slot.storage
    if (client.settings?.remotePath && client.settings?.localPath) {
      outputPath = outputPath.replace(client.settings.remotePath, client.settings.localPath)
    }

    // Create a download record
    const links = {
      movieId: match.type === 'movie' ? match.id : null,
      tvShowId: match.type === 'episode' ? match.tvShowId : null,
      episodeId: match.type === 'episode' ? match.id : null,
      albumId: match.type === 'album' ? match.id : null,
      bookId: match.type === 'book' ? match.id : null,
    }
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
      mediaType: deriveMediaType(links),
      ...links,
    })

    return await this.importDownload(download, client)
  }

  /**
   * Check if a path is accessible with a timeout to avoid blocking on unmounted network paths
   */
  private async isPathAccessible(
    path: string,
    timeoutMs = 3000
  ): Promise<{ accessible: boolean; error?: string }> {
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
        console.log(
          `[CompletedScanner] Path not accessible for ${download.title}: ${pathCheck.error}`
        )
        // An unreachable path is environmental, so this must not count as a bad
        // release: markFailed's blacklist opt-out list covers it, and retrying
        // the same download later is the right behaviour.
        await downloadManager.markFailed(download, pathCheck.error || 'Path not accessible', {
          searchAlternative: false,
        })
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
        await downloadManager.markFailed(download, 'Unknown media type', {
          searchAlternative: false,
        })
        return { imported: false, error: 'Unknown media type' }
      }

      if (result.success) {
        download.status = 'completed'
        await download.save()
        await historyService.recordForDownload(download, 'import_completed', {
          data: { filesImported: result.filesImported, outputPath: download.outputPath },
        })
        console.log(
          `[CompletedScanner] Imported: ${download.title} (${result.filesImported} files)`
        )
        return { imported: true }
      } else {
        const errorMsg = result.errors.join('; ')
        await downloadManager.markFailed(download, errorMsg)
        console.log(`[CompletedScanner] Import failed: ${download.title} - ${errorMsg}`)
        return { imported: false, error: errorMsg }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Import failed'
      console.error(`[CompletedScanner] Import error for ${download.title}:`, error)
      await downloadManager.markFailed(download, errorMsg)
      return { imported: false, error: errorMsg }
    }
  }

  /**
   * Create an UnmatchedFile record for a completed download that couldn't be matched
   */
  private async createUnmatchedFileRecord(
    _client: DownloadClient,
    slot: SabnzbdHistoryItem
  ): Promise<void> {
    try {
      const parsed = parseFolderName(slot.name)
      const mediaType = this.guessMediaTypeFromParsed(parsed, slot.name)

      // Find a root folder for this media type
      const rootFolder = await RootFolder.query().where('mediaType', mediaType).first()
      if (!rootFolder) {
        console.log(
          `[CompletedScanner] No root folder for type "${mediaType}", cannot create unmatched file record for "${slot.name}"`
        )
        return
      }

      // Build parsed info from the folder name parsing
      const parsedInfo: ParsedInfo = {}
      if (parsed.title) parsedInfo.title = parsed.title
      if (parsed.year) parsedInfo.year = parsed.year
      if (parsed.season !== undefined) parsedInfo.seasonNumber = parsed.season
      if (parsed.episode !== undefined) parsedInfo.episodeNumber = parsed.episode
      if (parsed.artist) parsedInfo.artistName = parsed.artist
      if (parsed.album) parsedInfo.albumTitle = parsed.album
      if (parsed.author) parsedInfo.authorName = parsed.author
      if (parsed.bookTitle) parsedInfo.bookTitle = parsed.bookTitle

      // Use the storage path as relative path, or fall back to slot name
      const relativePath = slot.storage || slot.name

      await UnmatchedFile.updateOrCreate(
        { relativePath, fileName: slot.name },
        {
          rootFolderId: rootFolder.id,
          relativePath,
          fileName: slot.name,
          mediaType,
          fileSizeBytes: slot.bytes || null,
          parsedInfo,
          status: 'pending',
        }
      )

      console.log(
        `[CompletedScanner] Created unmatched file record for "${slot.name}" (type: ${mediaType})`
      )
    } catch (error) {
      console.error(
        `[CompletedScanner] Failed to create unmatched file record for "${slot.name}":`,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Guess media type from parsed folder name info
   */
  private guessMediaTypeFromParsed(
    parsed: ReturnType<typeof parseFolderName>,
    folderName: string
  ): 'movies' | 'music' | 'tv' | 'books' {
    // If it has season/episode info, it's TV
    if (parsed.season !== undefined || parsed.episode !== undefined) {
      return 'tv'
    }

    // If it has artist/album, it's music
    if (parsed.artist && parsed.album) {
      return 'music'
    }

    // If it has author/bookTitle or book-related extensions, it's books
    if (parsed.author && parsed.bookTitle) {
      return 'books'
    }
    if (/\b(epub|mobi|azw3?|pdf|ebook|audiobook)\b/i.test(folderName)) {
      return 'books'
    }

    // Check for music indicators
    if (/\b(flac|mp3|aac|ogg|wav|alac|vinyl|cd|lp)\b/i.test(folderName)) {
      return 'music'
    }

    // Default to movies (video content)
    return 'movies'
  }

  /**
   * Try to match a download folder name to a library item.
   * Uses preloaded cache for batch efficiency.
   */
  private async matchToLibrary(folderName: string): Promise<LibraryMatch | null> {
    const parsed = parseFolderName(folderName)

    if (parsed.title) {
      const movieMatch = this.matchMovie(parsed.title, parsed.year)
      if (movieMatch) return movieMatch
    }

    if (parsed.title && (parsed.season !== undefined || parsed.episode !== undefined)) {
      const episodeMatch = await this.matchEpisode(parsed.title, parsed.season, parsed.episode)
      if (episodeMatch) return episodeMatch
    }

    if (parsed.artist && parsed.album) {
      const albumMatch = this.matchAlbum(parsed.artist, parsed.album)
      if (albumMatch) return albumMatch
    }

    if (parsed.author && parsed.bookTitle) {
      const bookMatch = this.matchBook(parsed.author, parsed.bookTitle)
      if (bookMatch) return bookMatch
    }

    if (parsed.title && !parsed.season && !parsed.episode) {
      const movieMatch = this.matchMovie(parsed.title, undefined)
      if (movieMatch) return movieMatch
    }

    return null
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  private matchMovie(
    title: string,
    year?: number
  ): { type: 'movie'; id: string; title: string } | null {
    const wanted = this.normalize(title)
    for (const movie of this.cachedMovies) {
      if (!isSimilar(wanted, this.normalize(movie.title))) continue
      if (year && movie.year && Math.abs(year - movie.year) > 1) continue
      return { type: 'movie', id: movie.id, title: movie.title }
    }
    return null
  }

  private async matchEpisode(
    title: string,
    season?: number,
    episode?: number
  ): Promise<{ type: 'episode'; id: string; title: string; tvShowId: string } | null> {
    if (season === undefined || episode === undefined) return null
    const wanted = this.normalize(title)
    for (const show of this.cachedShows) {
      if (!isSimilar(wanted, this.normalize(show.title))) continue
      const ep = await Episode.query()
        .where('tvShowId', show.id)
        .where('seasonNumber', season)
        .where('episodeNumber', episode)
        .first()
      if (ep) {
        return {
          type: 'episode',
          id: ep.id,
          title: `${show.title} S${season}E${episode}`,
          tvShowId: show.id,
        }
      }
    }
    return null
  }

  private matchAlbum(
    artist: string,
    albumTitle: string
  ): { type: 'album'; id: string; title: string } | null {
    const wantedArtist = this.normalize(artist)
    const wantedAlbum = this.normalize(albumTitle)
    for (const album of this.cachedAlbums) {
      const artistName = (album as any).artist?.name || ''
      if (!isSimilar(wantedAlbum, this.normalize(album.title))) continue
      if (!isSimilar(wantedArtist, this.normalize(artistName))) continue
      return { type: 'album', id: album.id, title: `${artistName} - ${album.title}` }
    }
    return null
  }

  private matchBook(
    author: string,
    bookTitle: string
  ): { type: 'book'; id: string; title: string } | null {
    const wantedAuthor = this.normalize(author)
    const wantedTitle = this.normalize(bookTitle)
    for (const book of this.cachedBooks) {
      const authorName = (book as any).author?.name || ''
      if (!isSimilar(wantedTitle, this.normalize(book.title))) continue
      if (!isSimilar(wantedAuthor, this.normalize(authorName))) continue
      return { type: 'book', id: book.id, title: `${authorName} - ${book.title}` }
    }
    return null
  }
}

export const completedDownloadsScanner = new CompletedDownloadsScanner()
