import type { HttpContext } from '@adonisjs/core/http'
import path from 'node:path'
import fs from 'node:fs/promises'
import { accessWithTimeout } from '../utils/fs_utils.js'
import MovieFile from '#models/movie_file'
import EpisodeFile from '#models/episode_file'
import BookFile from '#models/book_file'
import TrackFile from '#models/track_file'
import Movie from '#models/movie'
import Author from '#models/author'
import RootFolder from '#models/root_folder'
import DownloadClient from '#models/download_client'
import { completedDownloadsScanner } from '#services/tasks/completed_downloads_scanner'
import { folderScanner } from '#services/tasks/folder_scanner'

export default class FilesController {
  /**
   * Download a movie file
   */
  async downloadMovie({ params, response }: HttpContext) {
    const movieFile = await MovieFile.query().where('id', params.id).first()

    if (!movieFile) {
      return response.notFound({ error: 'Movie file not found' })
    }

    const movie = await Movie.find(movieFile.movieId)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    const rootFolder = await RootFolder.find(movie.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, movieFile.relativePath)

    try {
      await accessWithTimeout(absolutePath)
    } catch {
      return response.notFound({ error: 'File not found on disk' })
    }

    const fileName = path.basename(absolutePath)
    response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return response.download(absolutePath)
  }

  /**
   * Download an episode file
   */
  async downloadEpisode({ params, response }: HttpContext) {
    const episodeFile = await EpisodeFile.query().where('id', params.id).first()

    if (!episodeFile) {
      return response.notFound({ error: 'Episode file not found' })
    }

    const { default: TvShow } = await import('#models/tv_show')
    const tvShow = await TvShow.find(episodeFile.tvShowId)
    if (!tvShow) {
      return response.notFound({ error: 'TV show not found' })
    }

    const rootFolder = await RootFolder.find(tvShow.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, episodeFile.relativePath)

    try {
      await accessWithTimeout(absolutePath)
    } catch {
      return response.notFound({ error: 'File not found on disk' })
    }

    const fileName = path.basename(absolutePath)
    response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return response.download(absolutePath)
  }

  /**
   * Download a book file
   */
  async downloadBook({ params, response }: HttpContext) {
    const bookFile = await BookFile.query().where('id', params.id).first()

    if (!bookFile) {
      return response.notFound({ error: 'Book file not found' })
    }

    const { default: Book } = await import('#models/book')
    const book = await Book.find(bookFile.bookId)
    if (!book) {
      return response.notFound({ error: 'Book not found' })
    }

    const author = await Author.find(book.authorId)
    if (!author) {
      return response.notFound({ error: 'Author not found' })
    }

    const rootFolder = await RootFolder.find(author.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, bookFile.relativePath)

    try {
      await accessWithTimeout(absolutePath)
    } catch {
      return response.notFound({ error: 'File not found on disk' })
    }

    const fileName = path.basename(absolutePath)
    response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return response.download(absolutePath)
  }

  /**
   * Download a track file
   */
  async downloadTrack({ params, response }: HttpContext) {
    const trackFile = await TrackFile.query()
      .where('id', params.id)
      .preload('track', (query) => {
        query.preload('album', (albumQuery) => {
          albumQuery.preload('artist')
        })
      })
      .first()

    if (!trackFile) {
      return response.notFound({ error: 'Track file not found' })
    }

    const track = trackFile.track
    if (!track?.album?.artist) {
      return response.notFound({ error: 'Track or album not found' })
    }

    const artist = track.album.artist
    const rootFolder = await RootFolder.find(artist.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, trackFile.relativePath)

    try {
      await accessWithTimeout(absolutePath)
    } catch {
      return response.notFound({ error: 'File not found on disk' })
    }

    const fileName = path.basename(absolutePath)
    response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return response.download(absolutePath)
  }

  /**
   * Sync hasFile flags for all media types
   * This scans the database and updates hasFile flags based on file records
   */
  async syncFileStatus({ response }: HttpContext) {
    const results = {
      movies: { updated: 0 },
      episodes: { updated: 0 },
      books: { updated: 0 },
      tracks: { updated: 0 },
    }

    // Sync movies
    const movies = await Movie.query()
    for (const movie of movies) {
      const hasFile = await MovieFile.query().where('movieId', movie.id).first()
      const shouldHaveFile = !!hasFile
      if (movie.hasFile !== shouldHaveFile) {
        movie.hasFile = shouldHaveFile
        await movie.save()
        results.movies.updated++
      }
    }

    // Sync episodes
    const { default: Episode } = await import('#models/episode')
    const episodes = await Episode.query()
    for (const episode of episodes) {
      const hasFile = await EpisodeFile.query().where('episodeId', episode.id).first()
      const shouldHaveFile = !!hasFile
      if (episode.hasFile !== shouldHaveFile) {
        episode.hasFile = shouldHaveFile
        await episode.save()
        results.episodes.updated++
      }
    }

    // Sync books
    const { default: Book } = await import('#models/book')
    const books = await Book.query()
    for (const book of books) {
      const hasFile = await BookFile.query().where('bookId', book.id).first()
      const shouldHaveFile = !!hasFile
      if (book.hasFile !== shouldHaveFile) {
        book.hasFile = shouldHaveFile
        await book.save()
        results.books.updated++
      }
    }

    // Sync tracks
    const { default: Track } = await import('#models/track')
    const tracks = await Track.query()
    for (const track of tracks) {
      const hasFile = await TrackFile.query().where('trackId', track.id).first()
      const shouldHaveFile = !!hasFile
      if (track.hasFile !== shouldHaveFile) {
        track.hasFile = shouldHaveFile
        await track.save()
        results.tracks.updated++
      }
    }

    return response.json({
      success: true,
      message: 'File status synced',
      results,
    })
  }

  /**
   * Scan for completed downloads that weren't imported (API-based)
   * This queries SABnzbd history for completed downloads
   */
  async scanCompletedDownloads({ response }: HttpContext) {
    const results = await completedDownloadsScanner.scan()

    return response.json({
      success: true,
      message: 'Completed downloads scan finished',
      processed: results.processed,
      imported: results.imported,
      errors: results.errors,
    })
  }

  /**
   * Scan download folders directly on the filesystem
   * This is independent of download client APIs - scans actual files
   */
  async scanFolders({ response }: HttpContext) {
    const results = await folderScanner.scan()

    const parts = []
    if (results.created > 0) parts.push(`${results.created} new entries created`)
    if (results.imported > 0) parts.push(`${results.imported} imported`)
    if (results.created === 0 && results.imported === 0) parts.push('no new media found')

    return response.json({
      success: true,
      message: `Folder scan finished: ${parts.join(', ')}`,
      processed: results.processed,
      imported: results.imported,
      created: results.created,
      errors: results.errors,
    })
  }

  /**
   * Run both API-based and filesystem-based scans
   */
  async scanAll({ response }: HttpContext) {
    // Run both scanners
    const apiResults = await completedDownloadsScanner.scan()
    const folderResults = await folderScanner.scan()

    return response.json({
      success: true,
      message: 'Full scan finished',
      apiScan: {
        processed: apiResults.processed,
        imported: apiResults.imported,
        errors: apiResults.errors,
      },
      folderScan: {
        processed: folderResults.processed,
        imported: folderResults.imported,
        errors: folderResults.errors,
      },
      totalImported: apiResults.imported + folderResults.imported,
    })
  }

  /**
   * Run both scans with streaming progress events (NDJSON)
   */
  async scanAllStream({ response }: HttpContext) {
    const res = response.response
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    })

    const emit = (phase: string, action: string, message: string) => {
      res.write(JSON.stringify({ phase, action, message }) + '\n')
    }

    try {
      emit('api', 'start', 'Checking download client history...')
      const apiResults = await completedDownloadsScanner.scan((action, message) => {
        emit('api', action, message)
      })

      emit('folder', 'start', 'Scanning download folders...')
      const folderResults = await folderScanner.scan((action, message) => {
        emit('folder', action, message)
      })

      emit('done', 'complete', JSON.stringify({
        apiImported: apiResults.imported,
        folderImported: folderResults.imported,
        folderCreated: folderResults.created,
        totalImported: apiResults.imported + folderResults.imported,
      }))
    } catch (error) {
      emit('done', 'error', error instanceof Error ? error.message : 'Scan failed')
    }

    res.end()
  }

  /**
   * Browse completed download folders from all enabled download clients
   */
  async browseCompleted({ response }: HttpContext) {
    const clients = await DownloadClient.query().where('enabled', true)

    interface CompletedEntry {
      name: string
      path: string
      baseName: string
      isDuplicate: boolean
      isUnpacking: boolean
      mediaType: 'tv' | 'music' | 'movies' | 'books'
      title: string
      year: string | null
      sizeBytes: number | null
      downloadClientId: string
      downloadClientName: string
      duplicateCount: number
    }

    const allEntries: CompletedEntry[] = []

    for (const client of clients) {
      const localPath = client.settings?.localPath
      if (!localPath) continue

      // Look for a "complete" or "completed" subfolder first, otherwise use localPath directly
      let scanPath = localPath
      for (const sub of ['complete', 'completed']) {
        const candidate = path.join(localPath, sub)
        try {
          const stat = await fs.stat(candidate)
          if (stat.isDirectory()) {
            scanPath = candidate
            break
          }
        } catch {
          // not found, continue
        }
      }

      let dirEntries: import('node:fs').Dirent[]
      try {
        dirEntries = await fs.readdir(scanPath, { withFileTypes: true })
      } catch {
        continue
      }

      for (const entry of dirEntries) {
        const name = entry.name
        const fullPath = path.join(scanPath, name)

        // Validate path is within scanPath (prevent traversal)
        const resolved = path.resolve(fullPath)
        if (!resolved.startsWith(path.resolve(scanPath))) continue

        const isUnpacking = name.startsWith('_UNPACK_')

        // Determine if this is a SABnzbd duplicate suffix (.1, .2, etc.)
        // Must end with .N where N is a small number (1-99), not a year or other meaningful number
        const dupMatch = name.match(/^(.+[^\s])\.(\d{1,2})$/)
        const isDuplicate = dupMatch !== null && !/^\d+$/.test(dupMatch[1])
        const baseName = isDuplicate ? dupMatch![1] : name

        // Guess media type
        const mediaType = this.guessMediaType(name)

        // Parse title and year
        const { title, year } = this.parseTitleAndYear(name)

        // Get size for files, null for directories
        let sizeBytes: number | null = null
        if (entry.isFile()) {
          try {
            const stat = await fs.stat(fullPath)
            sizeBytes = stat.size
          } catch {
            // ignore stat errors
          }
        }

        allEntries.push({
          name,
          path: fullPath,
          baseName,
          isDuplicate,
          isUnpacking,
          mediaType,
          title,
          year,
          sizeBytes,
          downloadClientId: client.id,
          downloadClientName: client.name,
          duplicateCount: 0,
        })
      }
    }

    // Filter out entries that are already tracked as completed downloads or unmatched files
    const { default: Download } = await import('#models/download')
    const { default: UnmatchedFile } = await import('#models/unmatched_file')

    const [completedDownloads, importingDownloads, unmatchedFiles] = await Promise.all([
      Download.query().whereIn('status', ['completed', 'importing']).select('title', 'outputPath'),
      Download.query()
        .where('status', 'importing')
        .preload('downloadClient')
        .orderBy('completedAt', 'desc'),
      UnmatchedFile.query().select('fileName'),
    ])

    const trackedPaths = new Set<string>()
    const trackedTitles = new Set<string>()
    for (const d of completedDownloads) {
      if (d.outputPath) trackedPaths.add(d.outputPath)
      trackedTitles.add(d.title)
    }
    const unmatchedNames = new Set(unmatchedFiles.map((u) => u.fileName))

    // Normalize a string for comparison (lowercase, strip non-alphanumeric)
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Build normalized sets for fuzzy matching
    const normalizedTrackedTitles = new Set(
      [...trackedTitles].map((t) => normalize(t))
    )

    const filteredEntries = allEntries.filter(
      (e) =>
        !trackedPaths.has(e.path) &&
        !normalizedTrackedTitles.has(normalize(e.name)) &&
        !unmatchedNames.has(e.name)
    )

    // Group by baseName and set duplicateCount
    const baseNameCounts = new Map<string, number>()
    for (const entry of filteredEntries) {
      baseNameCounts.set(entry.baseName, (baseNameCounts.get(entry.baseName) || 0) + 1)
    }
    for (const entry of filteredEntries) {
      entry.duplicateCount = baseNameCounts.get(entry.baseName) || 1
    }

    // Sort by baseName then name
    filteredEntries.sort((a, b) => {
      const baseCompare = a.baseName.localeCompare(b.baseName)
      if (baseCompare !== 0) return baseCompare
      return a.name.localeCompare(b.name)
    })

    // Include importing downloads as separate list for the Pending Import tab
    const importing = importingDownloads.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      progress: d.progress,
      outputPath: d.outputPath,
      errorMessage: d.errorMessage,
      completedAt: d.completedAt?.toISO() ?? null,
      downloadClient: d.downloadClient?.name ?? null,
    }))

    return response.json({ entries: filteredEntries, importing })
  }

  /**
   * Clean up completed download folders: remove _UNPACK_ folders and duplicate entries
   */
  async cleanupCompleted({ response }: HttpContext) {
    const clients = await DownloadClient.query().where('enabled', true)

    let deleted = 0
    let freedBytes = 0
    const errors: string[] = []

    for (const client of clients) {
      const localPath = client.settings?.localPath
      if (!localPath) continue

      // Look for a "complete" or "completed" subfolder first
      let scanPath = localPath
      for (const sub of ['complete', 'completed']) {
        const candidate = path.join(localPath, sub)
        try {
          const stat = await fs.stat(candidate)
          if (stat.isDirectory()) {
            scanPath = candidate
            break
          }
        } catch {
          // not found
        }
      }

      let dirEntries: import('node:fs').Dirent[]
      try {
        dirEntries = await fs.readdir(scanPath, { withFileTypes: true })
      } catch {
        continue
      }

      for (const entry of dirEntries) {
        const name = entry.name
        const fullPath = path.join(scanPath, name)

        // Validate path is within scanPath
        const resolved = path.resolve(fullPath)
        if (!resolved.startsWith(path.resolve(scanPath))) continue

        // Delete _UNPACK_ folders
        if (name.startsWith('_UNPACK_')) {
          try {
            const size = await this.getEntrySize(fullPath)
            await fs.rm(fullPath, { recursive: true, force: true })
            deleted++
            freedBytes += size
          } catch (err) {
            errors.push(`Failed to delete ${fullPath}: ${err instanceof Error ? err.message : String(err)}`)
          }
          continue
        }

        // Delete SABnzbd duplicate entries (.1, .2, etc.)
        // These are always safe to remove — SABnzbd appends the suffix when the original already exists
        const dupMatch = name.match(/^(.+[^\s])\.(\d{1,2})$/)
        const isDuplicate = dupMatch !== null && !/^\d+$/.test(dupMatch[1])

        if (isDuplicate) {
          try {
            const size = await this.getEntrySize(fullPath)
            await fs.rm(fullPath, { recursive: true, force: true })
            deleted++
            freedBytes += size
          } catch (err) {
            errors.push(`Failed to delete ${fullPath}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    return response.json({ deleted, freedBytes, errors })
  }

  /**
   * Guess media type from a folder/file name
   */
  private guessMediaType(name: string): 'tv' | 'music' | 'movies' | 'books' {
    // TV: has S01E01 pattern
    if (/S\d+E\d+/i.test(name)) return 'tv'

    // Music: FLAC, WEB-FLAC, CD-FLAC, MP3, OST, or artist-album pattern
    if (/\b(FLAC|WEB-FLAC|CD-FLAC|MP3|OST)\b/i.test(name)) return 'music'

    // Books: epub, mobi, pdf in name, or "Author - Title" pattern
    if (/\b(epub|mobi|pdf)\b/i.test(name)) return 'books'
    if (/^[^-]+ - [^-]+$/.test(name) && !/\b(720p|1080p|2160p|BluRay|WEB-DL|HDRip)\b/i.test(name)) {
      return 'books'
    }

    // Default to movies
    return 'movies'
  }

  /**
   * Parse title and year from a release name
   */
  private parseTitleAndYear(name: string): { title: string; year: string | null } {
    // Remove _UNPACK_ prefix if present
    let cleanName = name.replace(/^_UNPACK_/, '')

    // Remove SABnzbd duplicate suffix
    cleanName = cleanName.replace(/\.\d+$/, '')

    // Try to find a year (19xx or 20xx)
    const yearMatch = cleanName.match(/[\.\s\-_\(]((?:19|20)\d{2})[\.\s\-_\)]/)
    const year = yearMatch ? yearMatch[1] : null

    // Title is everything before the year or quality indicators
    let title = cleanName
    if (yearMatch && yearMatch.index !== undefined) {
      title = cleanName.substring(0, yearMatch.index)
    } else {
      // Try to cut at quality indicators
      const qualityMatch = cleanName.match(
        /[\.\s\-_](720p|1080p|2160p|4K|BluRay|BDRip|WEB-DL|WEBRip|HDRip|DVDRip|HDTV|FLAC|MP3|WEB-FLAC|CD-FLAC)/i
      )
      if (qualityMatch && qualityMatch.index !== undefined) {
        title = cleanName.substring(0, qualityMatch.index)
      }
    }

    // Replace dots, underscores with spaces and trim
    title = title.replace(/[\._]/g, ' ').trim()

    return { title, year }
  }

  /**
   * Get total size of a file or directory
   */
  private async getEntrySize(entryPath: string): Promise<number> {
    try {
      const stat = await fs.stat(entryPath)
      if (stat.isFile()) return stat.size

      // For directories, sum up all files recursively
      let total = 0
      const entries = await fs.readdir(entryPath, { withFileTypes: true })
      for (const entry of entries) {
        const childPath = path.join(entryPath, entry.name)
        total += await this.getEntrySize(childPath)
      }
      return total
    } catch {
      return 0
    }
  }
}
