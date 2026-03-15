import fs from 'node:fs/promises'
import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { fileNamingService } from './file_naming_service.js'
import { eventEmitter } from '#services/events/event_emitter'
import { probeFile, checkFfmpegAvailable } from '#utils/ffmpeg_utils'
import Download from '#models/download'
import Movie from '#models/movie'
import MovieFile from '#models/movie_file'
import RootFolder from '#models/root_folder'
import { DateTime } from 'luxon'

export interface MovieImportProgress {
  phase: 'scanning' | 'importing' | 'cleaning' | 'complete'
  total: number
  current: number
  currentFile?: string
}

export interface MovieImportResult {
  success: boolean
  downloadId: string
  movieId: string | null
  filesImported: number
  filesSkipped: number
  errors: string[]
  importedPath?: string
}

/**
 * Service for importing completed movie downloads into the library.
 */
export class MovieImportService {
  /**
   * Import a completed movie download
   */
  async importDownload(
    download: Download,
    onProgress?: (progress: MovieImportProgress) => void
  ): Promise<MovieImportResult> {
    const result: MovieImportResult = {
      success: false,
      downloadId: download.id,
      movieId: download.movieId,
      filesImported: 0,
      filesSkipped: 0,
      errors: [],
    }

    try {
      // Verify download has output path
      if (!download.outputPath) {
        result.errors.push('Download has no output path')
        return result
      }

      // Apply remote path mapping if configured
      let outputPath = download.outputPath
      if (download.downloadClientId) {
        const downloadClientModule = await import('#models/download_client')
        const DownloadClient = downloadClientModule.default
        const client = await DownloadClient.find(download.downloadClientId)
        if (client?.settings?.remotePath && client?.settings?.localPath) {
          outputPath = outputPath.replace(client.settings.remotePath, client.settings.localPath)
        }
      }

      // Check if path exists (with timeout to prevent blocking on unmounted network storage)
      try {
        await Promise.race([
          fs.access(outputPath),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Path check timeout')), 3000)
          ),
        ])
      } catch (error) {
        const isTimeout = error instanceof Error && error.message === 'Path check timeout'
        if (isTimeout) {
          result.errors.push(
            `Path not responding: ${outputPath}. Network storage may not be mounted or is unresponsive.`
          )
        } else {
          result.errors.push(
            `Path not accessible: ${outputPath}. If SABnzbd runs in Docker, configure Remote Path Mapping in Download Client settings.`
          )
        }
        return result
      }

      // Get the movie this download is for
      const movie = download.movieId ? await Movie.find(download.movieId) : null
      if (!movie) {
        result.errors.push('Movie not found for download')
        return result
      }

      const rootFolder = await RootFolder.find(movie.rootFolderId)
      if (!rootFolder) {
        result.errors.push('Root folder not found')
        return result
      }

      // Scan for video files in download folder
      onProgress?.({ phase: 'scanning', total: 0, current: 0 })
      const videoFiles = await this.findVideoFiles(outputPath)

      if (videoFiles.length === 0) {
        result.errors.push('No video files found in download')
        return result
      }

      onProgress?.({ phase: 'importing', total: 1, current: 0 })

      // Find the largest video file (main movie file)
      const mainFile = await this.findMainVideoFile(videoFiles)

      if (!mainFile) {
        result.errors.push('Could not determine main video file')
        return result
      }

      onProgress?.({
        phase: 'importing',
        total: 1,
        current: 1,
        currentFile: path.basename(mainFile.path),
      })

      try {
        const importResult = await this.importVideoFile(
          mainFile.path,
          movie,
          rootFolder,
          mainFile.quality
        )

        if (importResult.success) {
          result.filesImported++
          result.importedPath = importResult.destinationPath
        } else {
          result.filesSkipped++
          if (importResult.error) {
            result.errors.push(importResult.error)
          }
        }
      } catch (error) {
        result.filesSkipped++
        result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      }

      // Only clean up download folder if files were actually imported
      if (result.filesImported > 0) {
        result.success = true
        onProgress?.({ phase: 'cleaning', total: 1, current: 0 })
        await this.cleanupDownloadFolder(outputPath)

        // Emit import completed event
        eventEmitter
          .emitImportCompleted({
            media: {
              id: movie.id,
              title: movie.title,
              year: movie.year ?? undefined,
              mediaType: 'movies',
              posterUrl: movie.posterUrl ?? undefined,
              overview: movie.overview ?? undefined,
            },
            files: result.importedPath
              ? [
                  {
                    path: result.importedPath,
                    relativePath: path.basename(result.importedPath),
                    size: 0,
                    quality: mainFile.quality,
                  },
                ]
              : [],
            isUpgrade: false,
          })
          .catch((err) =>
            logger.error({ err }, 'MovieImportService: Failed to emit import completed event')
          )
      } else {
        // Emit import failed event
        eventEmitter
          .emitImportFailed({
            media: {
              id: movie.id,
              title: movie.title,
              year: movie.year ?? undefined,
              mediaType: 'movies',
              posterUrl: movie.posterUrl ?? undefined,
            },
            errorMessage: result.errors.join('; ') || 'No files imported',
            downloadId: download.id,
          })
          .catch((err) =>
            logger.error({ err }, 'MovieImportService: Failed to emit import failed event')
          )
      }

      onProgress?.({ phase: 'complete', total: 1, current: 1 })
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Import failed')

      // Emit import failed event for unexpected errors
      if (download.movieId) {
        eventEmitter
          .emitImportFailed({
            media: {
              id: download.movieId,
              title: download.title,
              mediaType: 'movies',
            },
            errorMessage: error instanceof Error ? error.message : 'Import failed',
            downloadId: download.id,
          })
          .catch((err) =>
            logger.error({ err }, 'MovieImportService: Failed to emit import failed event')
          )
      }
    }

    return result
  }

  /**
   * Import a single video file into the library
   */
  /**
   * Minimum size for a valid movie file (100 MB).
   * Anything smaller is almost certainly corrupt, incomplete, or a sample.
   */
  private static readonly MIN_MOVIE_FILE_SIZE = 100 * 1024 * 1024

  private async importVideoFile(
    sourcePath: string,
    movie: Movie,
    rootFolder: RootFolder,
    quality?: string
  ): Promise<{ success: boolean; error?: string; destinationPath?: string }> {
    // --- Integrity check 1: minimum file size ---
    const sourceStats = await fs.stat(sourcePath)
    if (sourceStats.size < MovieImportService.MIN_MOVIE_FILE_SIZE) {
      return {
        success: false,
        error: `Source file is too small (${Math.round(sourceStats.size / 1024 / 1024)} MB) — likely corrupt or incomplete`,
      }
    }

    // --- Integrity check 2: ffprobe validation ---
    const { ffprobe } = await checkFfmpegAvailable()
    if (ffprobe) {
      try {
        const analysis = await probeFile(sourcePath)
        if (!analysis.videoCodec) {
          return {
            success: false,
            error: `Source file has no valid video stream — likely corrupt`,
          }
        }
        if (analysis.duration <= 0) {
          return {
            success: false,
            error: `Source file has no valid duration — likely corrupt or incomplete`,
          }
        }
      } catch {
        return {
          success: false,
          error: `Source file could not be read by ffprobe — likely corrupt`,
        }
      }
    }

    // --- Integrity check 3: don't overwrite a larger existing file ---
    const existingFile = await MovieFile.query().where('movieId', movie.id).first()
    if (existingFile) {
      const existingAbsPath = path.join(rootFolder.path, existingFile.relativePath)
      try {
        const existingStats = await fs.stat(existingAbsPath)
        if (existingStats.size > sourceStats.size) {
          return {
            success: false,
            error: `Existing file is larger (${Math.round(existingStats.size / 1024 / 1024)} MB) than source (${Math.round(sourceStats.size / 1024 / 1024)} MB) — refusing to overwrite with smaller file`,
          }
        }
      } catch {
        // Existing file not accessible on disk, safe to replace the record
      }
    }

    // Generate destination path
    const extension = path.extname(sourcePath)
    const relativePath = await fileNamingService.getMoviePath({ movie, quality }, extension)
    const absolutePath = path.join(rootFolder.path, relativePath)

    // If the existing file is at a different path, remove it before importing
    if (existingFile && existingFile.relativePath !== relativePath) {
      const oldPath = path.join(rootFolder.path, existingFile.relativePath)
      try {
        await fs.unlink(oldPath)
        logger.info(`Removed old movie file: ${oldPath}`)
      } catch {
        // Old file may already be gone
      }
    }

    // Create directories
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })

    // Move file to destination
    try {
      await fs.rename(sourcePath, absolutePath)
    } catch (error) {
      // If rename fails (cross-device), try copy + delete
      await fs.copyFile(sourcePath, absolutePath)
      await fs.unlink(sourcePath)
    }

    // Get file stats
    const stats = await fs.stat(absolutePath)

    // Create or update movie file record and update movie in a transaction
    await db.transaction(async (trx) => {
      let movieFile = await MovieFile.query({ client: trx }).where('movieId', movie.id).first()

      if (movieFile) {
        movieFile.useTransaction(trx)
        movieFile.merge({
          relativePath,
          sizeBytes: stats.size,
          quality: quality || null,
          dateAdded: DateTime.now(),
        })
        await movieFile.save()
      } else {
        await MovieFile.create(
          {
            movieId: movie.id,
            relativePath,
            sizeBytes: stats.size,
            quality: quality || null,
            dateAdded: DateTime.now(),
          },
          { client: trx }
        )
      }

      // Update movie to indicate it has a file
      movie.useTransaction(trx)
      movie.hasFile = true
      await movie.save()
    })

    return { success: true, destinationPath: absolutePath }
  }

  /**
   * Find all video files in a directory recursively
   */
  private async findVideoFiles(dir: string): Promise<string[]> {
    const results: string[] = []

    try {
      const stats = await fs.stat(dir)

      // If it's a file, check if it's video
      if (stats.isFile()) {
        if (fileNamingService.isVideoFile(dir)) {
          return [dir]
        }
        return []
      }

      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          // Skip sample/extras directories
          const skipDirs = [
            'sample',
            'samples',
            'subs',
            'subtitles',
            'extras',
            'featurettes',
            'behind the scenes',
          ]
          if (!skipDirs.includes(entry.name.toLowerCase())) {
            const subFiles = await this.findVideoFiles(fullPath)
            results.push(...subFiles)
          }
        } else if (entry.isFile() && fileNamingService.isVideoFile(entry.name)) {
          // Skip sample files
          if (!entry.name.toLowerCase().includes('sample')) {
            results.push(fullPath)
          }
        }
      }
    } catch (error) {
      logger.error({ dir, err: error }, 'Error scanning directory')
    }

    return results
  }

  /**
   * Find the main video file (largest, non-sample)
   */
  private async findMainVideoFile(
    files: string[]
  ): Promise<{ path: string; size: number; quality?: string } | null> {
    if (files.length === 0) return null

    let mainFile: { path: string; size: number; quality?: string } | null = null

    for (const filePath of files) {
      try {
        const stats = await fs.stat(filePath)
        const fileName = path.basename(filePath).toLowerCase()

        // Skip sample files
        if (fileName.includes('sample')) continue

        // Determine quality from filename
        const quality = this.detectQuality(fileName)

        if (!mainFile || stats.size > mainFile.size) {
          mainFile = { path: filePath, size: stats.size, quality }
        }
      } catch {
        // Skip files we can't stat
      }
    }

    return mainFile
  }

  /**
   * Detect video quality from filename
   */
  private detectQuality(fileName: string): string | undefined {
    const lowerName = fileName.toLowerCase()

    // Resolution
    if (lowerName.includes('2160p') || lowerName.includes('4k') || lowerName.includes('uhd')) {
      return '2160p'
    }
    if (lowerName.includes('1080p') || lowerName.includes('fullhd')) {
      return '1080p'
    }
    if (lowerName.includes('720p')) {
      return '720p'
    }
    if (lowerName.includes('480p') || lowerName.includes('sd')) {
      return '480p'
    }

    // Source
    if (lowerName.includes('bluray') || lowerName.includes('blu-ray')) {
      return 'Bluray'
    }
    if (lowerName.includes('webdl') || lowerName.includes('web-dl')) {
      return 'WEBDL'
    }
    if (lowerName.includes('webrip')) {
      return 'WEBRip'
    }
    if (lowerName.includes('hdtv')) {
      return 'HDTV'
    }

    return undefined
  }

  /**
   * Clean up download folder after import
   */
  private async cleanupDownloadFolder(downloadPath: string): Promise<void> {
    try {
      const stats = await fs.stat(downloadPath)

      if (stats.isFile()) {
        // Single file download – delete it directly
        await fs.unlink(downloadPath).catch(() => {})
        return
      }

      // All media files have been moved out – remove the entire folder
      await fs.rm(downloadPath, { recursive: true, force: true })
    } catch (error) {
      logger.error({ err: error }, 'Error cleaning up download folder')
    }
  }
}

export const movieImportService = new MovieImportService()
