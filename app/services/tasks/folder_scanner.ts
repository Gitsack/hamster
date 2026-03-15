import fs from 'node:fs/promises'
import path from 'node:path'
import DownloadClient from '#models/download_client'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Season from '#models/season'
import Album from '#models/album'
import Artist from '#models/artist'
import Book from '#models/book'
import Author from '#models/author'
import Download from '#models/download'
import RootFolder from '#models/root_folder'
import { movieImportService } from '#services/media/movie_import_service'
import { episodeImportService } from '#services/media/episode_import_service'
import { downloadImportService } from '#services/media/download_import_service'
import { bookImportService } from '#services/media/book_import_service'
import { fileNamingService } from '#services/media/file_naming_service'
import { tmdbService, type TmdbMovie, type TmdbTvShow } from '#services/metadata/tmdb_service'
import { openLibraryService } from '#services/metadata/openlibrary_service'
import { mediaInfoService } from '#services/media/media_info_service'
import { probeFile, checkFfmpegAvailable } from '#utils/ffmpeg_utils'
import { DateTime } from 'luxon'
import UnmatchedFile from '#models/unmatched_file'
import type { ParsedInfo } from '#models/unmatched_file'
import { isUpgrade } from '#services/quality/quality_scorer'
import type { QualityItem } from '#models/quality_profile'

type MediaType = 'music' | 'movies' | 'tv' | 'books'

interface MatchResult {
  type: 'movie' | 'episode' | 'album' | 'book'
  id: string
  title: string
  tvShowId?: string
}

interface ScanResults {
  processed: number
  imported: number
  created: number
  skipped: number
  errors: string[]
}

export type ProgressCallback = (action: string, message: string) => void

/**
 * Service that directly scans download folders on the filesystem
 * for completed downloads, independent of download client APIs.
 *
 * This is more resilient than API-based scanning because:
 * - Works even if download client is offline
 * - Catches manually added files
 * - Works if download client history was cleared
 * - Can create new library entries for unrecognized media
 */
class FolderScanner {
  private isRunning = false

  /**
   * Folder names that should be skipped during scanning.
   * Includes NAS system folders, recycle bins, metadata dirs, and OS junk.
   */
  private static readonly EXCLUDED_FOLDERS = new Set([
    // NAS recycle bins
    '#recycle',
    '@recycle',
    '#recyclbin',
    '$recycle.bin',
    '.recycle',
    // Synology
    '@eadir',
    '@tmp',
    '@sharebin',
    '#snapshot',
    // QNAP
    '.@__thumb',
    '.@__qini',
    '@recently-snapshot',
    // General system/metadata
    '.ds_store',
    '.thumbs',
    '@thumb',
    'thumbs.db',
    '.syncthing',
    '.stversions',
    // OS/filesystem
    'system volume information',
    'lost+found',
    '$recycle.bin',
    // Torrent/Usenet client internals
    '.nzb',
    '_unpack',
    '_failed',
    'unmatched',
  ])

  /**
   * File name patterns that should be excluded from media detection and import.
   * Matched case-insensitively against the full filename.
   */
  private static readonly EXCLUDED_FILE_PATTERNS = [
    // Sample/proof files
    /^sample[.\-_]/i,
    /[\-_.]sample\./i,
    /^proof[.\-_]/i,
    // NAS/OS metadata files
    /^thumbs\.db$/i,
    /^desktop\.ini$/i,
    /^\.ds_store$/i,
    /^ehthumbs\.db$/i,
    /^ehthumbs_vista\.db$/i,
    // Synology metadata
    /^@eadir$/i,
    /^synofile_thumb/i,
    // Usenet/torrent artifacts
    /\.par2$/i,
    /\.nzb$/i,
    /\.srr$/i,
    /\.srs$/i,
    /\.sfv$/i,
    /\.nfo$/i,
    // Incomplete/temp files
    /\.part$/i,
    /\.!ut$/i,
    /\.downloading$/i,
    /^_padding_file/i,
    // Rarbg/release junk
    /^rarbg\b/i,
    /^www\./i,
  ]

  private static isExcludedFolder(name: string): boolean {
    return FolderScanner.EXCLUDED_FOLDERS.has(name.toLowerCase())
  }

  /**
   * Delete a download folder after it has been processed or is no longer needed.
   */
  private async cleanupFolder(folderPath: string, reason: string): Promise<void> {
    try {
      await fs.rm(folderPath, { recursive: true, force: true })
      console.log(`[FolderScanner] Cleaned up "${path.basename(folderPath)}" - ${reason}`)
    } catch (error) {
      console.error(
        `[FolderScanner] Failed to clean up "${path.basename(folderPath)}":`,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  private static isExcludedFile(name: string): boolean {
    return FolderScanner.EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(name))
  }

  /**
   * Validate that a folder contains playable/valid media files.
   * Uses ffprobe for video, music-metadata for audio, and file size for books.
   * Returns an error message if validation fails, or null if valid.
   */
  private async validateMediaFiles(folderPath: string): Promise<string | null> {
    const files = await this.listFilesRecursive(folderPath)
    if (files.length === 0) {
      return 'No files found in folder'
    }

    const videoFiles = files.filter((f) => fileNamingService.isVideoFile(path.basename(f)))
    const audioFiles = files.filter((f) => fileNamingService.isAudioFile(path.basename(f)))
    const bookFiles = files.filter((f) => fileNamingService.isBookFile(path.basename(f)))

    const mediaFiles = [...videoFiles, ...audioFiles, ...bookFiles]
    if (mediaFiles.length === 0) {
      return 'No media files found in folder'
    }

    // Validate video files with ffprobe
    if (videoFiles.length > 0) {
      const { ffprobe } = await checkFfmpegAvailable()
      if (ffprobe) {
        // Check the largest video file (most likely the main content)
        const mainVideo = await this.getLargestFile(videoFiles)
        if (mainVideo) {
          try {
            const analysis = await probeFile(mainVideo)
            if (!analysis.videoCodec && !analysis.audioCodec) {
              return `Video file "${path.basename(mainVideo)}" has no valid streams`
            }
            if (analysis.duration <= 0) {
              return `Video file "${path.basename(mainVideo)}" has no valid duration`
            }
          } catch {
            return `Video file "${path.basename(mainVideo)}" could not be read by ffprobe (corrupted or incomplete)`
          }
        }
      }
    }

    // Validate audio files with music-metadata
    if (audioFiles.length > 0 && videoFiles.length === 0) {
      let validCount = 0
      // Check a sample of audio files (up to 3)
      const sampled = audioFiles.slice(0, 3)
      for (const audioFile of sampled) {
        const info = await mediaInfoService.getMediaInfo(audioFile)
        if (info && info.duration > 0) {
          validCount++
        }
      }
      if (validCount === 0) {
        return `Audio files could not be parsed (corrupted or incomplete)`
      }
    }

    // Validate book files by checking they are not empty/truncated
    if (bookFiles.length > 0 && videoFiles.length === 0 && audioFiles.length === 0) {
      const MIN_BOOK_SIZE = 1024 // 1KB minimum
      for (const bookFile of bookFiles) {
        try {
          const stat = await fs.stat(bookFile)
          if (stat.size < MIN_BOOK_SIZE) {
            return `Book file "${path.basename(bookFile)}" is too small (${stat.size} bytes), likely corrupted`
          }
        } catch {
          return `Book file "${path.basename(bookFile)}" could not be read`
        }
      }
    }

    return null
  }

  /**
   * Find the largest file from a list (most likely the main content, not extras)
   */
  private async getLargestFile(files: string[]): Promise<string | null> {
    let largest: string | null = null
    let largestSize = 0

    for (const file of files) {
      try {
        const stat = await fs.stat(file)
        if (stat.size > largestSize) {
          largestSize = stat.size
          largest = file
        }
      } catch {
        // skip unreadable files
      }
    }

    return largest
  }

  /**
   * Scan all configured download client folders for importable media
   */
  async scan(onProgress?: ProgressCallback): Promise<ScanResults> {
    if (this.isRunning) {
      console.log('[FolderScanner] Already running, skipping...')
      return { processed: 0, imported: 0, created: 0, skipped: 0, errors: [] }
    }

    this.isRunning = true
    const results: ScanResults = { processed: 0, imported: 0, created: 0, skipped: 0, errors: [] }

    try {
      console.log('[FolderScanner] Scanning download folders...')
      onProgress?.('info', 'Scanning download folders...')

      // Get all download clients to find their complete directories
      const clients = await DownloadClient.query().where('enabled', true)

      for (const client of clients) {
        try {
          const clientResults = await this.scanClientFolder(client, onProgress)
          results.processed += clientResults.processed
          results.imported += clientResults.imported
          results.created += clientResults.created
          results.skipped += clientResults.skipped
          results.errors.push(...clientResults.errors)
        } catch (error) {
          const msg = `Failed to scan folder for ${client.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`[FolderScanner] ${msg}`)
          results.errors.push(msg)
        }
      }

      const summary = `Folder scan: ${results.imported} imported, ${results.created} created, ${results.skipped} skipped`
      console.log(
        `[FolderScanner] Scan complete: ${results.processed} folders processed, ${results.created} created, ${results.imported} imported, ${results.skipped} skipped (invalid media)`
      )
      onProgress?.('info', summary)
    } finally {
      this.isRunning = false
    }

    return results
  }

  /**
   * Scan a specific download client's complete folder
   */
  private async scanClientFolder(
    client: DownloadClient,
    onProgress?: ProgressCallback
  ): Promise<ScanResults> {
    const results: ScanResults = { processed: 0, imported: 0, created: 0, skipped: 0, errors: [] }

    // Get the local path for the complete folder
    const localPath = client.settings?.localPath
    if (!localPath) {
      console.log(`[FolderScanner] No local path configured for ${client.name}, skipping`)
      return results
    }

    // Check if folder exists
    try {
      await fs.access(localPath)
    } catch {
      console.log(`[FolderScanner] Local path not accessible: ${localPath}`)
      return results
    }

    // List all entries in the complete directory
    const entries = await fs.readdir(localPath, { withFileTypes: true })
    const folders = entries.filter((e) => e.isDirectory())
    const looseFiles = entries.filter((e) => e.isFile())

    console.log(
      `[FolderScanner] Found ${folders.length} folders and ${looseFiles.length} files in ${localPath}`
    )

    // Clean up loose non-media files (e.g. .DS_Store, .nfo) in the download root
    for (const file of looseFiles) {
      if (FolderScanner.isExcludedFile(file.name)) {
        try {
          await fs.unlink(path.join(localPath, file.name))
        } catch {
          // ignore
        }
      }
    }

    // Also scan subdirectories (SABnzbd may use category subfolders)
    const allFolders: Array<{ name: string; path: string }> = []

    for (const folder of folders) {
      if (FolderScanner.isExcludedFolder(folder.name)) {
        console.log(`[FolderScanner] Skipping excluded folder: "${folder.name}"`)
        continue
      }

      const subPath = path.join(localPath, folder.name)

      // Check if this looks like a category folder (contains subfolders with media)
      try {
        const subEntries = await fs.readdir(subPath, { withFileTypes: true })
        const subFolders = subEntries.filter((e) => e.isDirectory())
        const subFiles = subEntries.filter(
          (e) => e.isFile() && !FolderScanner.isExcludedFile(e.name)
        )

        // If folder has subfolders and few/no media files, treat it as a category folder
        const hasMediaFiles = subFiles.some(
          (f) =>
            fileNamingService.isVideoFile(f.name) ||
            fileNamingService.isAudioFile(f.name) ||
            fileNamingService.isBookFile(f.name)
        )

        if (subFolders.length > 0 && !hasMediaFiles) {
          console.log(
            `[FolderScanner] "${folder.name}" looks like a category folder, scanning ${subFolders.length} subfolders`
          )
          // Clean loose junk files inside category folders (e.g. .DS_Store)
          for (const f of subEntries) {
            if (f.isFile() && FolderScanner.isExcludedFile(f.name)) {
              try {
                await fs.unlink(path.join(subPath, f.name))
              } catch {
                // ignore
              }
            }
          }
          for (const sub of subFolders) {
            if (FolderScanner.isExcludedFolder(sub.name)) {
              console.log(`[FolderScanner] Skipping excluded subfolder: "${sub.name}"`)
              continue
            }
            allFolders.push({ name: sub.name, path: path.join(subPath, sub.name) })
          }
        } else {
          // Regular download folder
          allFolders.push({ name: folder.name, path: subPath })
        }
      } catch {
        allFolders.push({ name: folder.name, path: subPath })
      }
    }

    console.log(`[FolderScanner] Total folders to process: ${allFolders.length}`)

    for (const folder of allFolders) {
      results.processed++
      const folderPath = folder.path

      try {
        // Check if this folder was already imported or is being processed
        // Check by path (local and remote equivalent) or by title
        const possiblePaths = [folderPath]
        if (client.settings?.remotePath && client.settings?.localPath) {
          const remotePath = folderPath.replace(
            client.settings.localPath,
            client.settings.remotePath
          )
          if (remotePath !== folderPath) {
            possiblePaths.push(remotePath)
          }
        }
        const existingDownload = await Download.query()
          .where((q) => {
            q.whereIn('outputPath', possiblePaths).orWhere('title', folder.name)
          })
          .whereIn('status', ['completed', 'importing'])
          .first()

        if (existingDownload) {
          if (existingDownload.status === 'completed') {
            await this.cleanupFolder(folderPath, 'already completed')
            onProgress?.('cleaned', `Cleaned up "${folder.name}" (already completed)`)
          } else {
            console.log(`[FolderScanner] Skipping "${folder.name}" - currently importing`)
          }
          continue
        }

        // Try to match to an existing library item
        let match = await this.matchToLibrary(folder.name)
        let isNewEntry = false

        if (!match) {
          // Before trying to create, check if folder has any media files at all
          // If empty/only junk files, clean it up
          const noMediaError = await this.validateMediaFiles(folderPath)
          if (noMediaError) {
            await this.cleanupFolder(folderPath, 'no library match and no valid media files')
            onProgress?.('cleaned', `Cleaned up "${folder.name}" (no media files)`)
            continue
          }

          // No existing library match - try to detect media type and create entry
          const createResult = await this.createEntryForFolder(folderPath, folder.name)

          if (createResult.error) {
            results.errors.push(`${folder.name}: ${createResult.error}`)
            // Still create an unmatched file record for errors
            await this.createUnmatchedFileRecord(folderPath, folder.name, localPath)
            onProgress?.('moved', `Moved "${folder.name}" to unmatched`)
            continue
          }

          if (!createResult.match) {
            console.log(`[FolderScanner] Skipping "${folder.name}" - could not identify media`)
            await this.createUnmatchedFileRecord(folderPath, folder.name, localPath)
            onProgress?.('moved', `Moved "${folder.name}" to unmatched`)
            continue
          }

          match = createResult.match
          isNewEntry = true
          results.created++
          console.log(
            `[FolderScanner] Created new library entry: ${match.type} "${match.title}" for folder: ${folder.name}`
          )
        }

        // Check if library item already has files (skip for newly created entries)
        if (!isNewEntry) {
          const hasFile = await this.checkIfAlreadyHasFile(match)
          if (hasFile) {
            const upgradeResult = await this.checkForUpgrade(match, folder.name)
            if (upgradeResult) {
              console.log(
                `[FolderScanner] "${folder.name}" is a quality upgrade for ${match.type} "${match.title}" - proceeding with import`
              )
              onProgress?.('upgrade', `Upgrading "${match.title}" from "${folder.name}"`)
            } else {
              await this.cleanupFolder(folderPath, 'library item already has files, not an upgrade')
              onProgress?.('cleaned', `Cleaned up "${folder.name}" (not an upgrade)`)
              continue
            }
          }
        }

        console.log(
          `[FolderScanner] Found importable folder: ${folder.name} -> ${match.type} (${match.title})`
        )

        // Validate that media files are playable before importing
        const validationError = await this.validateMediaFiles(folderPath)
        if (validationError) {
          // If the folder matched a library item but has no valid media files,
          // the files were likely already imported — clean up the leftover folder
          if (match) {
            await this.cleanupFolder(
              folderPath,
              `matched "${match.title}" but no valid media files remain`
            )
            onProgress?.('cleaned', `Cleaned up "${folder.name}" (no media files)`)
          } else {
            console.log(
              `[FolderScanner] Skipping "${folder.name}" - invalid media: ${validationError}`
            )
            results.skipped++
          }
          continue
        }

        // Create a download record and import
        const importResult = await this.importFolder(folderPath, match, client)

        if (importResult.success) {
          results.imported++
          console.log(`[FolderScanner] Successfully imported: ${folder.name}`)
          onProgress?.('imported', `Imported "${match.title}"`)
        } else if (importResult.error) {
          results.errors.push(`${folder.name}: ${importResult.error}`)
          onProgress?.('error', `Failed to import "${folder.name}"`)
        }
      } catch (error) {
        results.errors.push(
          `${folder.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return results
  }

  /**
   * Detect media type and create a new library entry for an unmatched folder
   */
  private async createEntryForFolder(
    folderPath: string,
    folderName: string
  ): Promise<{ match: MatchResult | null; error?: string }> {
    const mediaType = await this.detectMediaType(folderPath, folderName)
    if (!mediaType) {
      console.log(`[FolderScanner] Could not detect media type for: ${folderName}`)
      return { match: null }
    }

    const rootFolder = await this.getRootFolderForType(mediaType)
    if (!rootFolder) {
      return {
        match: null,
        error: `No root folder configured for ${mediaType}. Add a ${mediaType} root folder in settings.`,
      }
    }

    try {
      switch (mediaType) {
        case 'movies':
          return { match: await this.createMovieEntry(folderName, rootFolder) }
        case 'tv':
          return { match: await this.createTvShowEntry(folderName, rootFolder) }
        case 'music':
          return { match: await this.createMusicEntry(folderPath, folderName, rootFolder) }
        case 'books':
          return { match: await this.createBookEntry(folderName, rootFolder) }
        default:
          return { match: null }
      }
    } catch (error) {
      return {
        match: null,
        error: `Failed to create library entry: ${error instanceof Error ? error.message : 'Unknown'}`,
      }
    }
  }

  /**
   * Detect media type based on file contents and folder name heuristics
   */
  private async detectMediaType(folderPath: string, folderName: string): Promise<MediaType | null> {
    const files = await this.listFilesRecursive(folderPath)

    let videoCount = 0
    let audioCount = 0
    let bookCount = 0

    for (const file of files) {
      const name = path.basename(file)
      if (fileNamingService.isVideoFile(name)) videoCount++
      if (fileNamingService.isAudioFile(name)) audioCount++
      if (fileNamingService.isBookFile(name)) bookCount++
    }

    // Determine dominant media type
    if (videoCount > 0 && videoCount >= audioCount && videoCount >= bookCount) {
      // Check folder name for TV patterns
      const tvPattern = /S\d{1,2}E\d{1,2}|\d{1,2}x\d{1,2}/i
      if (tvPattern.test(folderName)) {
        return 'tv'
      }
      return 'movies'
    }

    if (audioCount > 0 && audioCount >= videoCount && audioCount >= bookCount) {
      return 'music'
    }

    if (bookCount > 0) {
      return 'books'
    }

    return null
  }

  /**
   * List all files recursively in a directory
   */
  private async listFilesRecursive(dir: string, maxDepth = 3, depth = 0): Promise<string[]> {
    if (depth >= maxDepth) return []

    const results: string[] = []
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (FolderScanner.isExcludedFolder(entry.name)) continue
          const subFiles = await this.listFilesRecursive(fullPath, maxDepth, depth + 1)
          results.push(...subFiles)
        } else if (entry.isFile()) {
          if (FolderScanner.isExcludedFile(entry.name)) continue
          results.push(fullPath)
        }
      }
    } catch {
      // Ignore permission errors
    }
    return results
  }

  /**
   * Get the first root folder for a given media type
   */
  private async getRootFolderForType(mediaType: MediaType): Promise<RootFolder | null> {
    return RootFolder.query().where('mediaType', mediaType).first()
  }

  /**
   * Create a new movie entry by looking up metadata
   */
  private async createMovieEntry(
    folderName: string,
    rootFolder: RootFolder
  ): Promise<MatchResult | null> {
    const parsed = this.parseTitleAndYear(folderName)
    if (!parsed.title) return null

    // Check if movie already exists by title/year
    const existing = await this.findExistingMovieByTitle(parsed.title, parsed.year)
    if (existing) {
      return { type: 'movie', id: existing.id, title: existing.title }
    }

    // Look up on TMDB
    const tmdbResult = await this.lookupMovieTmdb(parsed.title, parsed.year)

    let movie: Movie
    if (tmdbResult) {
      // Check if movie with this TMDB ID already exists
      const existingByTmdb = await Movie.query().where('tmdbId', String(tmdbResult.id)).first()
      if (existingByTmdb) {
        return { type: 'movie', id: existingByTmdb.id, title: existingByTmdb.title }
      }

      movie = await Movie.create({
        tmdbId: String(tmdbResult.id),
        imdbId: tmdbResult.imdbId,
        title: tmdbResult.title,
        originalTitle: tmdbResult.originalTitle,
        sortTitle: this.generateSortTitle(tmdbResult.title),
        overview: tmdbResult.overview,
        releaseDate: tmdbResult.releaseDate ? DateTime.fromISO(tmdbResult.releaseDate) : null,
        year: tmdbResult.year,
        runtime: tmdbResult.runtime,
        status: tmdbResult.status,
        posterUrl: tmdbResult.posterPath,
        backdropUrl: tmdbResult.backdropPath,
        rating: tmdbResult.voteAverage,
        votes: tmdbResult.voteCount,
        genres: tmdbResult.genres,
        requested: false,
        hasFile: false,
        needsReview: false,
        rootFolderId: rootFolder.id,
        addedAt: DateTime.now(),
      })
    } else {
      movie = await Movie.create({
        title: parsed.title,
        sortTitle: this.generateSortTitle(parsed.title),
        year: parsed.year,
        requested: false,
        hasFile: false,
        needsReview: true,
        rootFolderId: rootFolder.id,
        addedAt: DateTime.now(),
        genres: [],
      })
    }

    return { type: 'movie', id: movie.id, title: movie.title }
  }

  /**
   * Create a new TV show entry by looking up metadata
   */
  private async createTvShowEntry(
    folderName: string,
    rootFolder: RootFolder
  ): Promise<MatchResult | null> {
    // Parse TV pattern from folder name
    const tvMatch = folderName.match(
      /(.+?)[\s._-]*(?:S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2}))/i
    )
    if (!tvMatch) return null

    const showTitle = tvMatch[1]
      .replace(/\./g, ' ')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .trim()
    const seasonNum = Number.parseInt(tvMatch[2] || tvMatch[4])
    const episodeNum = Number.parseInt(tvMatch[3] || tvMatch[5])
    const yearMatch = showTitle.match(/\b(19\d{2}|20\d{2})\b/)
    const year = yearMatch ? Number.parseInt(yearMatch[1]) : undefined

    // Strip year from title for cleaner matching (e.g. "Scrubs 2026" -> "Scrubs")
    const titleWithoutYear = year
      ? showTitle.replace(/\b(19\d{2}|20\d{2})\b/, '').trim()
      : showTitle

    // Check if show already exists
    const existingShow = await this.findExistingTvShowByTitle(titleWithoutYear, year)
    if (existingShow) {
      // Find or create season and episode
      const episode = await this.findOrCreateEpisode(existingShow, seasonNum, episodeNum)
      if (episode) {
        return {
          type: 'episode',
          id: episode.id,
          title: `${existingShow.title} S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`,
          tvShowId: existingShow.id,
        }
      }
    }

    // Look up on TMDB
    let tvShow: TvShow
    const tmdbResult = await this.lookupTvShowTmdb(titleWithoutYear, year)

    if (tmdbResult) {
      const existingByTmdb = await TvShow.query().where('tmdbId', String(tmdbResult.id)).first()
      if (existingByTmdb) {
        const episode = await this.findOrCreateEpisode(existingByTmdb, seasonNum, episodeNum)
        if (episode) {
          return {
            type: 'episode',
            id: episode.id,
            title: `${existingByTmdb.title} S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`,
            tvShowId: existingByTmdb.id,
          }
        }
      }

      const alternateTitles = await tmdbService
        .getTvShowAlternateTitles(tmdbResult.id)
        .catch(() => [] as string[])
      const seriesType = tmdbService.detectSeriesType(tmdbResult)

      tvShow = await TvShow.create({
        tmdbId: String(tmdbResult.id),
        title: tmdbResult.name,
        originalTitle: tmdbResult.originalName,
        sortTitle: this.generateSortTitle(tmdbResult.name),
        overview: tmdbResult.overview,
        firstAired: tmdbResult.firstAirDate ? DateTime.fromISO(tmdbResult.firstAirDate) : null,
        year: tmdbResult.year,
        status: this.mapTmdbStatus(tmdbResult.status),
        network: tmdbResult.networks[0] || null,
        posterUrl: tmdbResult.posterPath,
        backdropUrl: tmdbResult.backdropPath,
        rating: tmdbResult.voteAverage,
        votes: tmdbResult.voteCount,
        genres: tmdbResult.genres,
        seasonCount: tmdbResult.numberOfSeasons,
        episodeCount: tmdbResult.numberOfEpisodes,
        imdbId: tmdbResult.imdbId,
        tvdbId: tmdbResult.tvdbId,
        requested: false,
        needsReview: false,
        rootFolderId: rootFolder.id,
        addedAt: DateTime.now(),
        alternateTitles,
        seriesType,
      })
    } else {
      tvShow = await TvShow.create({
        title: showTitle,
        sortTitle: this.generateSortTitle(showTitle),
        year,
        status: 'unknown',
        seasonCount: 0,
        episodeCount: 0,
        requested: false,
        needsReview: true,
        rootFolderId: rootFolder.id,
        addedAt: DateTime.now(),
        genres: [],
      })
    }

    // Create season and episode
    const episode = await this.findOrCreateEpisode(tvShow, seasonNum, episodeNum)
    if (!episode) return null

    return {
      type: 'episode',
      id: episode.id,
      title: `${tvShow.title} S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`,
      tvShowId: tvShow.id,
    }
  }

  /**
   * Create a new music entry by reading metadata or parsing folder name
   */
  private async createMusicEntry(
    folderPath: string,
    folderName: string,
    rootFolder: RootFolder
  ): Promise<MatchResult | null> {
    let artistName: string | undefined
    let albumTitle: string | undefined

    // Try to read metadata from first audio file
    const files = await this.listFilesRecursive(folderPath)
    const audioFile = files.find((f) => fileNamingService.isAudioFile(path.basename(f)))

    if (audioFile) {
      const info = await mediaInfoService.getMediaInfo(audioFile)
      if (info?.artist) artistName = info.artist
      if (info?.album) albumTitle = info.album
    }

    // Fall back to folder name parsing ("Artist - Album" pattern)
    if (!artistName || !albumTitle) {
      const musicMatch = folderName.match(/^(.+?)\s*-\s*(.+?)(?:\s+(?:CD|LP|EP|FLAC|MP3|WEB|Vinyl|\d{4}).*)?$/i)
      if (musicMatch) {
        if (!artistName) artistName = musicMatch[1].replace(/\./g, ' ').trim()
        if (!albumTitle) albumTitle = musicMatch[2].replace(/\./g, ' ').trim()
      }
    }

    if (!artistName || !albumTitle) {
      console.log(`[FolderScanner] Could not determine artist/album for: ${folderName}`)
      return null
    }

    // Find or create artist
    let artist = await Artist.query()
      .whereILike('name', artistName)
      .first()

    if (!artist) {
      artist = await Artist.create({
        rootFolderId: rootFolder.id,
        name: artistName,
        status: 'continuing',
        monitored: true,
      })
    }

    // Find or create album
    let album = await Album.query()
      .where('artistId', artist.id)
      .whereILike('title', albumTitle)
      .first()

    if (!album) {
      const yearMatch = folderName.match(/\b(19\d{2}|20\d{2})\b/)
      const year = yearMatch ? Number.parseInt(yearMatch[1]) : undefined

      album = await Album.create({
        artistId: artist.id,
        title: albumTitle,
        releaseDate: year ? DateTime.fromObject({ year }) : null,
        monitored: true,
      })
    }

    return {
      type: 'album',
      id: album.id,
      title: `${artist.name} - ${album.title}`,
    }
  }

  /**
   * Create a new book entry by looking up metadata
   */
  private async createBookEntry(
    folderName: string,
    rootFolder: RootFolder
  ): Promise<MatchResult | null> {
    // Parse "Author - Title" or "Title by Author" from folder name
    let authorName: string | undefined
    let bookTitle: string | undefined

    const byMatch = folderName.match(/^(.+?)\s+by\s+(.+?)(?:\s+(?:epub|mobi|pdf).*)?$/i)
    const dashMatch = folderName.match(/^(.+?)\s*-\s*(.+?)(?:\s+(?:epub|mobi|pdf).*)?$/i)

    if (byMatch) {
      bookTitle = byMatch[1].replace(/\./g, ' ').trim()
      authorName = byMatch[2].replace(/\./g, ' ').trim()
    } else if (dashMatch) {
      authorName = dashMatch[1].replace(/\./g, ' ').trim()
      bookTitle = dashMatch[2].replace(/\./g, ' ').trim()
    }

    if (!authorName || !bookTitle) {
      console.log(`[FolderScanner] Could not determine author/title for: ${folderName}`)
      return null
    }

    // Try OpenLibrary search
    let author: Author | null = null
    let book: Book | null = null

    try {
      const searchResults = await openLibraryService.searchBooks(`${bookTitle} ${authorName}`, 5)
      const olBook = searchResults[0]

      if (olBook) {
        // Find or create author
        const olAuthorName = olBook.authorName?.[0] || authorName
        author = await Author.query().whereILike('name', olAuthorName).first()

        if (!author) {
          const olAuthorKey = olBook.authorKey?.[0]
          if (olAuthorKey) {
            const olAuthor = await openLibraryService.getAuthor(olAuthorKey).catch(() => null)
            if (olAuthor) {
              author = await Author.create({
                name: olAuthor.name,
                sortName: this.generateSortName(olAuthor.name),
                openlibraryId: olAuthor.key,
                imageUrl: openLibraryService.getAuthorPhotoUrl(olAuthor.photoId, 'L'),
                requested: false,
                needsReview: false,
                rootFolderId: rootFolder.id,
                addedAt: DateTime.now(),
              })
            }
          }
        }

        if (!author) {
          author = await Author.create({
            name: olAuthorName,
            sortName: this.generateSortName(olAuthorName),
            requested: false,
            needsReview: true,
            rootFolderId: rootFolder.id,
            addedAt: DateTime.now(),
          })
        }

        book = await Book.create({
          authorId: author.id,
          title: olBook.title,
          sortTitle: this.generateSortTitle(olBook.title),
          openlibraryId: olBook.key,
          isbn: olBook.isbn?.[0] || null,
          releaseDate: olBook.firstPublishYear
            ? DateTime.fromObject({ year: olBook.firstPublishYear })
            : null,
          coverUrl: openLibraryService.getCoverUrl(olBook.coverId, 'L'),
          genres: olBook.subject?.slice(0, 5) || [],
          requested: false,
          hasFile: false,
          addedAt: DateTime.now(),
        })
      }
    } catch (error) {
      console.log(
        `[FolderScanner] OpenLibrary lookup failed for "${bookTitle}": ${error instanceof Error ? error.message : 'Unknown'}`
      )
    }

    // Fall back to creating from parsed info
    if (!author) {
      author = await Author.create({
        name: authorName,
        sortName: this.generateSortName(authorName),
        requested: false,
        needsReview: true,
        rootFolderId: rootFolder.id,
        addedAt: DateTime.now(),
      })
    }

    if (!book) {
      book = await Book.create({
        authorId: author.id,
        title: bookTitle,
        sortTitle: this.generateSortTitle(bookTitle),
        requested: false,
        hasFile: false,
        addedAt: DateTime.now(),
        genres: [],
      })
    }

    return {
      type: 'book',
      id: book.id,
      title: `${author.name} - ${book.title}`,
    }
  }

  // --- Helper methods for entry creation ---

  private parseTitleAndYear(folderName: string): { title: string; year?: number } {
    let cleaned = folderName
      .replace(/-xpost$/i, '')
      .replace(/\./g, ' ')
      .replace(/_/g, ' ')
      .trim()

    const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/)
    const year = yearMatch ? Number.parseInt(yearMatch[1]) : undefined

    // Extract title before quality/codec info
    const titleMatch = cleaned.match(
      /^(.+?)(?:\s+(?:REMASTERED|COMPLETE|EXTENDED|DIRECTORS|UNCUT|THEATRICAL|PROPER|RERIP|BLURAY|BLU-RAY|BDRIP|HDRIP|DVDRIP|WEBRIP|WEB-DL|HDTV|720p|1080p|2160p|4K|UHD|x264|x265|HEVC|H\.?264|H\.?265|AAC|DTS|AC3|ATMOS|REMUX|NF|AMZN|DSNP|ATVP))/i
    )

    let title: string
    if (titleMatch) {
      title = titleMatch[1].replace(/\b\d{4}\b/, '').trim()
    } else {
      title = cleaned.split(/\s+\d{4}\s+|\s+-\s+/)[0].trim()
    }

    return { title, year }
  }

  private async findExistingMovieByTitle(title: string, year?: number): Promise<Movie | null> {
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '')
    const movies = await Movie.query()

    for (const movie of movies) {
      const movieNorm = movie.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (this.isSimilar(normalizedTitle, movieNorm)) {
        if (year && movie.year && Math.abs(year - movie.year) > 1) continue
        return movie
      }
    }
    return null
  }

  private async findExistingTvShowByTitle(
    title: string,
    year?: number
  ): Promise<TvShow | null> {
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '')
    const shows = await TvShow.query()

    for (const show of shows) {
      const showNorm = show.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (this.isSimilar(normalizedTitle, showNorm)) {
        // If we have a year from the filename, skip shows with a different year
        // (e.g. "Scrubs 2026" should not match original "Scrubs" from 2001)
        if (year && show.year && Math.abs(year - show.year) > 1) continue
        return show
      }
    }
    return null
  }

  private async findOrCreateEpisode(
    tvShow: TvShow,
    seasonNum: number,
    episodeNum: number
  ): Promise<Episode | null> {
    // Find existing episode
    const existing = await Episode.query()
      .where('tvShowId', tvShow.id)
      .where('seasonNumber', seasonNum)
      .where('episodeNumber', episodeNum)
      .first()

    if (existing) return existing

    // Find or create season
    let season = await Season.query()
      .where('tvShowId', tvShow.id)
      .where('seasonNumber', seasonNum)
      .first()

    if (!season) {
      season = await Season.create({
        tvShowId: tvShow.id,
        seasonNumber: seasonNum,
      })
    }

    // Create episode
    return Episode.create({
      tvShowId: tvShow.id,
      seasonId: season.id,
      seasonNumber: seasonNum,
      episodeNumber: episodeNum,
      title: `Episode ${episodeNum}`,
      hasFile: false,
    })
  }

  private async lookupMovieTmdb(title: string, year?: number): Promise<TmdbMovie | null> {
    try {
      let results = await tmdbService.searchMovies(title, year)
      if (results.length === 0 && year) {
        results = await tmdbService.searchMovies(title)
      }
      return results[0] || null
    } catch {
      return null
    }
  }

  private async lookupTvShowTmdb(title: string, year?: number): Promise<TmdbTvShow | null> {
    try {
      let results = await tmdbService.searchTvShows(title, year)
      if (results.length === 0 && year) {
        results = await tmdbService.searchTvShows(title)
      }
      return results[0] || null
    } catch {
      return null
    }
  }

  private mapTmdbStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'Returning Series': 'continuing',
      'In Production': 'continuing',
      'Planned': 'upcoming',
      'Ended': 'ended',
      'Canceled': 'ended',
      'Pilot': 'upcoming',
    }
    return statusMap[status] || 'unknown'
  }

  private generateSortTitle(title: string): string {
    const articles = ['the ', 'a ', 'an ']
    const lowerTitle = title.toLowerCase()
    for (const article of articles) {
      if (lowerTitle.startsWith(article)) {
        return title.substring(article.length)
      }
    }
    return title
  }

  private generateSortName(name: string): string {
    const parts = name.trim().split(/\s+/)
    if (parts.length <= 1) return name
    const last = parts.pop()!
    return `${last}, ${parts.join(' ')}`
  }

  /**
   * Create an UnmatchedFile record for a folder that couldn't be matched to any library item
   */
  private async createUnmatchedFileRecord(
    folderPath: string,
    folderName: string,
    scanRoot: string
  ): Promise<void> {
    try {
      const relativePath = path.relative(scanRoot, folderPath)

      // Detect media type from file extensions
      const mediaType = await this.detectMediaTypeForUnmatched(folderPath, folderName)

      // Calculate total size of files in folder
      const fileSizeBytes = await this.calculateFolderSize(folderPath)

      // Extract parsed metadata from folder name
      const parsedInfo = this.extractParsedInfo(folderName)

      // Find appropriate root folder for this media type
      const rootFolder = await this.getRootFolderForType(mediaType)
      if (!rootFolder) {
        console.log(
          `[FolderScanner] No root folder for type "${mediaType}", cannot create unmatched file record for "${folderName}"`
        )
        return
      }

      // Move folder to unmatched/ subdirectory to keep the main folder clean
      const unmatchedDir = path.join(scanRoot, 'unmatched')
      const destPath = path.join(unmatchedDir, folderName)
      let newRelativePath = path.join('unmatched', folderName)

      try {
        await fs.mkdir(unmatchedDir, { recursive: true })
        try {
          await fs.access(destPath)
          // Destination already exists (from a previous run), just delete the source
          await fs.rm(folderPath, { recursive: true, force: true })
          console.log(
            `[FolderScanner] Removed duplicate "${folderName}" - already exists in unmatched/`
          )
        } catch {
          // Destination doesn't exist, move the folder
          await fs.rename(folderPath, destPath)
          console.log(`[FolderScanner] Moved "${folderName}" to unmatched/`)
        }
      } catch (error) {
        console.error(
          `[FolderScanner] Failed to move "${folderName}" to unmatched/:`,
          error instanceof Error ? error.message : 'Unknown error'
        )
        // Keep original path if move fails
        newRelativePath = relativePath
      }

      await UnmatchedFile.updateOrCreate(
        { fileName: folderName },
        {
          rootFolderId: rootFolder.id,
          relativePath: newRelativePath,
          fileName: folderName,
          mediaType,
          fileSizeBytes,
          parsedInfo,
          status: 'pending',
        }
      )

      console.log(
        `[FolderScanner] Created unmatched file record for "${folderName}" (type: ${mediaType})`
      )
    } catch (error) {
      console.error(
        `[FolderScanner] Failed to create unmatched file record for "${folderName}":`,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Detect media type for an unmatched folder based on file extensions
   */
  private async detectMediaTypeForUnmatched(
    folderPath: string,
    folderName: string
  ): Promise<MediaType> {
    const detected = await this.detectMediaType(folderPath, folderName)
    return detected || 'movies'
  }

  /**
   * Calculate the total size of all files in a folder recursively
   */
  private async calculateFolderSize(folderPath: string): Promise<number> {
    let totalSize = 0
    try {
      const files = await this.listFilesRecursive(folderPath)
      for (const file of files) {
        try {
          const stat = await fs.stat(file)
          totalSize += stat.size
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Return 0 if folder can't be read
    }
    return totalSize
  }

  /**
   * Extract parsed metadata from a folder name for unmatched file records
   */
  private extractParsedInfo(folderName: string): ParsedInfo {
    const info: ParsedInfo = {}

    const cleaned = folderName
      .replace(/-xpost$/i, '')
      .replace(/\./g, ' ')
      .replace(/_/g, ' ')
      .trim()

    // Extract year
    const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/)
    if (yearMatch) {
      info.year = Number.parseInt(yearMatch[1])
    }

    // Try TV pattern
    const tvMatch = cleaned.match(/(.+?)\s*(?:S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2}))/i)
    if (tvMatch) {
      info.showTitle = tvMatch[1].trim()
      info.seasonNumber = Number.parseInt(tvMatch[2] || tvMatch[4])
      info.episodeNumber = Number.parseInt(tvMatch[3] || tvMatch[5])
      info.title = info.showTitle
      return info
    }

    // Try music pattern (Artist - Album)
    const musicMatch = cleaned.match(
      /^(.+?)\s*-\s*(.+?)(?:\s+(?:CD|LP|EP|FLAC|MP3|WEB|Vinyl|\d{4}))/i
    )
    if (musicMatch) {
      info.artistName = musicMatch[1].trim()
      info.albumTitle = musicMatch[2].trim()
      info.title = info.albumTitle
      return info
    }

    // Try book pattern
    const bookByMatch = cleaned.match(/^(.+?)\s+by\s+(.+?)(?:\s+epub|\s+mobi|\s+pdf)?$/i)
    const bookDashMatch = cleaned.match(/^(.+?)\s*-\s*(.+?)(?:\s+epub|\s+mobi|\s+pdf)?$/i)
    if ((bookByMatch || bookDashMatch) && /epub|mobi|pdf|audiobook|ebook/i.test(cleaned)) {
      const match = bookByMatch || bookDashMatch
      if (match) {
        info.bookTitle = (bookByMatch ? match[1] : match[2])?.trim()
        info.authorName = (bookByMatch ? match[2] : match[1])?.trim()
        info.title = info.bookTitle
        return info
      }
    }

    // Extract quality info
    const qualityMatch = cleaned.match(
      /\b(720p|1080p|2160p|4K|UHD|BLURAY|BLU-RAY|BDRIP|WEBRIP|WEB-DL|HDTV|DVDRIP|REMUX)\b/i
    )
    if (qualityMatch) {
      info.quality = qualityMatch[1]
    }

    // Extract release group
    const groupMatch = folderName.match(/-([A-Za-z0-9]+)$/)
    if (groupMatch && !/xpost/i.test(groupMatch[1])) {
      info.releaseGroup = groupMatch[1]
    }

    // Extract title (movie-style, before quality/codec info)
    const titleMatch = cleaned.match(
      /^(.+?)(?:\s+(?:REMASTERED|COMPLETE|EXTENDED|DIRECTORS|UNCUT|THEATRICAL|PROPER|RERIP|BLURAY|BLU-RAY|BDRIP|HDRIP|DVDRIP|WEBRIP|WEB-DL|HDTV|720p|1080p|2160p|4K|UHD|x264|x265|HEVC|H\.?264|H\.?265|AAC|DTS|AC3|ATMOS|REMUX|NF|AMZN|DSNP|ATVP))/i
    )
    if (titleMatch) {
      info.title = titleMatch[1].replace(/\b\d{4}\b/, '').trim()
    } else {
      info.title = cleaned.split(/\s+\d{4}\s+|\s+-\s+/)[0].trim()
    }

    return info
  }

  // --- Existing methods below ---

  /**
   * Check if a library item already has files
   */
  private async checkIfAlreadyHasFile(match: { type: string; id: string }): Promise<boolean> {
    switch (match.type) {
      case 'movie': {
        const movie = await Movie.find(match.id)
        return movie?.hasFile ?? false
      }
      case 'episode': {
        const episode = await Episode.find(match.id)
        return episode?.hasFile ?? false
      }
      case 'album': {
        const album = await Album.query().where('id', match.id).preload('trackFiles').first()
        return (album?.trackFiles?.length ?? 0) > 0
      }
      case 'book': {
        const book = await Book.find(match.id)
        return book?.hasFile ?? false
      }
      default:
        return false
    }
  }

  /**
   * Check if a folder represents a quality upgrade over the existing file.
   * Returns true if it's an upgrade and should be imported, false otherwise.
   */
  private async checkForUpgrade(
    match: { type: string; id: string },
    folderName: string
  ): Promise<boolean> {
    let qualityName: string | null = null
    let profile: { items: QualityItem[]; cutoff: number; upgradeAllowed: boolean } | null = null
    let mediaType: 'movies' | 'tv' | 'music' | 'books' = 'movies'

    switch (match.type) {
      case 'movie': {
        const movie = await Movie.query()
          .where('id', match.id)
          .preload('qualityProfile')
          .preload('movieFile')
          .first()
        if (movie) {
          qualityName = movie.movieFile?.quality ?? null
          profile = movie.qualityProfile ?? null
          mediaType = 'movies'
        }
        break
      }
      case 'episode': {
        const episode = await Episode.query()
          .where('id', match.id)
          .preload('tvShow', (q) => q.preload('qualityProfile'))
          .preload('episodeFile')
          .first()
        if (episode) {
          qualityName = episode.episodeFile?.quality ?? null
          profile = episode.tvShow?.qualityProfile ?? null
          mediaType = 'tv'
        }
        break
      }
      case 'album': {
        const album = await Album.query()
          .where('id', match.id)
          .preload('artist', (q) => q.preload('qualityProfile'))
          .preload('trackFiles')
          .first()
        if (album) {
          qualityName = album.trackFiles?.[0]?.quality ?? null
          profile = album.artist?.qualityProfile ?? null
          mediaType = 'music'
        }
        break
      }
      case 'book': {
        const book = await Book.query()
          .where('id', match.id)
          .preload('author', (q) => q.preload('qualityProfile'))
          .preload('bookFile')
          .first()
        if (book) {
          qualityName = book.bookFile?.quality ?? null
          profile = book.author?.qualityProfile ?? null
          mediaType = 'books'
        }
        break
      }
    }

    if (!profile) {
      return false
    }

    return isUpgrade(
      qualityName,
      folderName,
      mediaType,
      profile.items,
      profile.cutoff,
      profile.upgradeAllowed
    )
  }

  /**
   * Import a folder
   */
  private async importFolder(
    folderPath: string,
    match: { type: string; id: string; title: string; tvShowId?: string },
    client: DownloadClient
  ): Promise<{ success: boolean; error?: string }> {
    // Create a download record
    const download = await Download.create({
      downloadClientId: client.id,
      title: path.basename(folderPath),
      status: 'importing',
      progress: 100,
      outputPath: folderPath,
      completedAt: DateTime.now(),
      startedAt: DateTime.now(),
      movieId: match.type === 'movie' ? match.id : null,
      tvShowId: match.type === 'episode' ? match.tvShowId : null,
      episodeId: match.type === 'episode' ? match.id : null,
      albumId: match.type === 'album' ? match.id : null,
      bookId: match.type === 'book' ? match.id : null,
    })

    try {
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
        return { success: false, error: 'Unknown media type' }
      }

      if (result.success) {
        download.status = 'completed'
        await download.save()
        return { success: true }
      } else {
        download.status = 'failed'
        download.errorMessage = result.errors.join('; ')
        await download.save()
        return { success: false, error: result.errors.join('; ') }
      }
    } catch (error) {
      download.status = 'failed'
      download.errorMessage = error instanceof Error ? error.message : 'Import failed'
      await download.save()
      return { success: false, error: download.errorMessage }
    }
  }

  /**
   * Try to match a folder name to a library item
   * Uses a smarter approach: try ALL library types and pick the best match
   */
  private async matchToLibrary(folderName: string): Promise<{
    type: 'movie' | 'episode' | 'album' | 'book'
    id: string
    title: string
    tvShowId?: string
  } | null> {
    // Normalize folder name for matching
    const normalized = this.normalizeFolderName(folderName)
    console.log(`[FolderScanner] Matching folder: "${folderName}" -> normalized: "${normalized}"`)

    // Try all media types and collect matches with confidence scores
    const matches: Array<{
      type: 'movie' | 'episode' | 'album' | 'book'
      id: string
      title: string
      tvShowId?: string
      confidence: number
    }> = []

    // Try matching albums (music) - check this first since "Artist - Album" pattern is distinctive
    const albumMatch = await this.matchAlbumFuzzy(folderName, normalized)
    if (albumMatch) {
      matches.push({ ...albumMatch, type: 'album' })
    }

    // Try matching movies
    const movieMatch = await this.matchMovieFuzzy(folderName, normalized)
    if (movieMatch) {
      matches.push({ ...movieMatch, type: 'movie' })
    }

    // Try matching TV episodes
    const episodeMatch = await this.matchEpisodeFuzzy(folderName, normalized)
    if (episodeMatch) {
      matches.push({ ...episodeMatch, type: 'episode' })
    }

    // Try matching books
    const bookMatch = await this.matchBookFuzzy(folderName, normalized)
    if (bookMatch) {
      matches.push({ ...bookMatch, type: 'book' })
    }

    // Pick the match with highest confidence
    if (matches.length === 0) {
      console.log(`[FolderScanner] No match found for: "${folderName}"`)
      return null
    }

    matches.sort((a, b) => b.confidence - a.confidence)
    const best = matches[0]
    console.log(
      `[FolderScanner] Best match: ${best.type} "${best.title}" (confidence: ${best.confidence.toFixed(2)})`
    )

    return {
      type: best.type,
      id: best.id,
      title: best.title,
      tvShowId: best.tvShowId,
    }
  }

  /**
   * Normalize folder name for matching
   */
  private normalizeFolderName(folderName: string): string {
    return folderName
      .toLowerCase()
      .replace(/-xpost$/i, '')
      .replace(/\./g, ' ')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Match against albums with fuzzy matching
   */
  private async matchAlbumFuzzy(
    original: string,
    normalized: string
  ): Promise<{ id: string; title: string; confidence: number } | null> {
    // Music indicators in folder name
    const musicIndicators =
      /\b(flac|mp3|aac|ogg|wav|alac|dsd|cd|lp|ep|vinyl|320|v0|v2|web|album|discography|\dcd)\b/i
    const hasMusicIndicator = musicIndicators.test(original)

    // Check for "Artist - Album" pattern (with hyphen)
    const hasArtistAlbumPattern = /^[^-]+-[^-]+/.test(original.replace(/\./g, '-'))

    // Albums don't have hasFile - check requested or monitored
    const albums = await Album.query()
      .where((q) => q.where('requested', true).orWhere('monitored', true))
      .preload('artist')

    let bestMatch: { id: string; title: string; confidence: number } | null = null

    for (const album of albums) {
      const artistName = album.artist?.name || ''
      const albumTitle = album.title

      // Normalize for comparison
      const artistNorm = artistName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const albumNorm = albumTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
      const folderNorm = normalized.replace(/[^a-z0-9]/g, '')

      // Check if folder contains both artist and album
      const hasArtist = folderNorm.includes(artistNorm) || this.isSimilar(folderNorm, artistNorm)
      const hasAlbum = folderNorm.includes(albumNorm) || this.isSimilar(folderNorm, albumNorm)

      if (hasArtist && hasAlbum) {
        // Calculate confidence
        let confidence = 0.5 // Base confidence for matching both

        // Boost if has music indicators
        if (hasMusicIndicator) confidence += 0.3

        // Boost if has "Artist - Album" pattern
        if (hasArtistAlbumPattern) confidence += 0.15

        // Boost based on how much of the folder name is covered
        const coverage = (artistNorm.length + albumNorm.length) / folderNorm.length
        confidence += Math.min(coverage * 0.2, 0.2)

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            id: album.id,
            title: `${artistName} - ${albumTitle}`,
            confidence,
          }
        }
      }
    }

    return bestMatch
  }

  /**
   * Match against movies with fuzzy matching
   */
  private async matchMovieFuzzy(
    original: string,
    normalized: string
  ): Promise<{ id: string; title: string; confidence: number } | null> {
    // Extract year from folder name
    const yearMatch = original.match(/\b(19\d{2}|20\d{2})\b/)
    const folderYear = yearMatch ? Number.parseInt(yearMatch[1]) : null

    // Movie indicators
    const movieIndicators =
      /\b(bluray|bdrip|dvdrip|webrip|web-dl|hdtv|remux|2160p|1080p|720p|480p|4k|uhd|hdrip|x264|x265|hevc|remastered|extended|directors|theatrical|uncut)\b/i
    const hasMovieIndicator = movieIndicators.test(original)

    // Check it's NOT music (no "Artist - Album" with music indicators)
    const musicIndicators = /\b(flac|mp3|cd|lp|vinyl|320|v0|album|\dcd)\b/i
    const hasMusicIndicator = musicIndicators.test(original)

    const movies = await Movie.query().where((q) => q.where('requested', true))

    let bestMatch: { id: string; title: string; confidence: number } | null = null

    for (const movie of movies) {
      const movieNorm = movie.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      const folderNorm = normalized.replace(/[^a-z0-9]/g, '')

      if (this.isSimilar(folderNorm, movieNorm) || folderNorm.includes(movieNorm)) {
        let confidence = 0.4 // Base confidence

        // Boost if year matches
        if (folderYear && movie.year) {
          if (folderYear === movie.year) {
            confidence += 0.3
          } else if (Math.abs(folderYear - movie.year) <= 1) {
            confidence += 0.15
          }
        }

        // Boost if has movie indicators
        if (hasMovieIndicator) confidence += 0.2

        // Penalize if has music indicators
        if (hasMusicIndicator) confidence -= 0.3

        // Boost based on title coverage
        const coverage = movieNorm.length / folderNorm.length
        confidence += Math.min(coverage * 0.15, 0.15)

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            id: movie.id,
            title: movie.title,
            confidence,
          }
        }
      }
    }

    return bestMatch
  }

  /**
   * Match against TV episodes with fuzzy matching
   */
  private async matchEpisodeFuzzy(
    original: string,
    normalized: string
  ): Promise<{ id: string; title: string; tvShowId: string; confidence: number } | null> {
    // TV pattern (S01E01 or 1x01)
    const tvPattern = /S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2})/i
    const tvMatch = original.match(tvPattern)

    if (!tvMatch) {
      return null // Must have episode pattern for TV
    }

    const season = Number.parseInt(tvMatch[1] || tvMatch[3])
    const episode = Number.parseInt(tvMatch[2] || tvMatch[4])

    // Extract year from folder name if present (e.g. "Scrubs 2026 S01E01")
    const folderYearMatch = original.match(/\b(19\d{2}|20\d{2})\b/)
    const folderYear = folderYearMatch ? Number.parseInt(folderYearMatch[1]) : undefined

    // TvShow doesn't have hasFile - it's at episode level
    const shows = await TvShow.query().where('requested', true)

    for (const show of shows) {
      const showNorm = show.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      const folderNorm = normalized.replace(/[^a-z0-9]/g, '')

      if (this.isSimilar(folderNorm, showNorm) || folderNorm.includes(showNorm)) {
        // Skip shows with a different year to avoid matching reboots to originals
        if (folderYear && show.year && Math.abs(folderYear - show.year) > 1) continue

        // Found show, now find episode
        const ep = await Episode.query()
          .where('tvShowId', show.id)
          .where('seasonNumber', season)
          .where('episodeNumber', episode)
          .first()

        if (ep) {
          return {
            id: ep.id,
            title: `${show.title} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`,
            tvShowId: show.id,
            confidence: 0.9, // High confidence when episode pattern matches
          }
        }
      }
    }

    return null
  }

  /**
   * Match against books with fuzzy matching
   */
  private async matchBookFuzzy(
    original: string,
    normalized: string
  ): Promise<{ id: string; title: string; confidence: number } | null> {
    // Book indicators
    const bookIndicators = /\b(epub|mobi|azw3?|pdf|ebook|audiobook|retail|scan)\b/i
    const hasBookIndicator = bookIndicators.test(original)

    if (!hasBookIndicator) {
      return null // Require book indicator for book matching
    }

    const books = await Book.query()
      .where((q) => q.where('requested', true))
      .preload('author')

    let bestMatch: { id: string; title: string; confidence: number } | null = null

    for (const book of books) {
      const authorName = book.author?.name || ''
      const bookTitle = book.title

      const authorNorm = authorName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const titleNorm = bookTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
      const folderNorm = normalized.replace(/[^a-z0-9]/g, '')

      const hasAuthor = folderNorm.includes(authorNorm) || this.isSimilar(folderNorm, authorNorm)
      const hasTitle = folderNorm.includes(titleNorm) || this.isSimilar(folderNorm, titleNorm)

      if (hasTitle && (hasAuthor || authorNorm.length < 3)) {
        let confidence = 0.5

        if (hasAuthor) confidence += 0.2
        if (hasBookIndicator) confidence += 0.2

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            id: book.id,
            title: `${authorName} - ${bookTitle}`,
            confidence,
          }
        }
      }
    }

    return bestMatch
  }

  private isSimilar(a: string, b: string): boolean {
    if (a.includes(b) || b.includes(a)) {
      return true
    }

    if (a.length < 20 && b.length < 20) {
      const distance = this.levenshteinDistance(a, b)
      const maxLength = Math.max(a.length, b.length)
      return distance / maxLength < 0.3
    }

    return false
  }

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

export const folderScanner = new FolderScanner()
