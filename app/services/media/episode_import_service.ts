import fs from 'node:fs/promises'
import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { fileNamingService } from './file_naming_service.js'
import { eventEmitter } from '#services/events/event_emitter'
import { probeFile, checkFfmpegAvailable } from '#utils/ffmpeg_utils'
import Download from '#models/download'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import EpisodeFile from '#models/episode_file'
import RootFolder from '#models/root_folder'
import { DateTime } from 'luxon'

export interface EpisodeImportProgress {
  phase: 'scanning' | 'importing' | 'cleaning' | 'complete'
  total: number
  current: number
  currentFile?: string
}

export interface EpisodeImportResult {
  success: boolean
  downloadId: string
  tvShowId: string | null
  episodeId: string | null
  filesImported: number
  filesSkipped: number
  errors: string[]
  importedPaths: string[]
}

/**
 * Service for importing completed TV episode downloads into the library.
 */
export class EpisodeImportService {
  /**
   * Import a completed episode download
   */
  async importDownload(
    download: Download,
    onProgress?: (progress: EpisodeImportProgress) => void
  ): Promise<EpisodeImportResult> {
    const result: EpisodeImportResult = {
      success: false,
      downloadId: download.id,
      tvShowId: download.tvShowId,
      episodeId: download.episodeId,
      filesImported: 0,
      filesSkipped: 0,
      errors: [],
      importedPaths: [],
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

      // Get the TV show (from tvShowId directly, or via the episode)
      let tvShow = download.tvShowId ? await TvShow.find(download.tvShowId) : null
      if (!tvShow && download.episodeId) {
        const episode = await Episode.find(download.episodeId)
        if (episode) {
          tvShow = await TvShow.find(episode.tvShowId)
        }
      }
      if (!tvShow) {
        result.errors.push('TV show not found for download')
        return result
      }

      const rootFolder = await RootFolder.find(tvShow.rootFolderId)
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

      onProgress?.({ phase: 'importing', total: videoFiles.length, current: 0 })

      // Import each video file
      for (let i = 0; i < videoFiles.length; i++) {
        const filePath = videoFiles[i]
        onProgress?.({
          phase: 'importing',
          total: videoFiles.length,
          current: i + 1,
          currentFile: path.basename(filePath),
        })

        try {
          const importResult = await this.importVideoFile(
            filePath,
            tvShow,
            rootFolder,
            download.episodeId
          )

          if (importResult.success) {
            result.filesImported++
            if (importResult.destinationPath) {
              result.importedPaths.push(importResult.destinationPath)
            }
          } else {
            result.filesSkipped++
            if (importResult.error) {
              result.errors.push(`${path.basename(filePath)}: ${importResult.error}`)
            }
          }
        } catch (error) {
          result.filesSkipped++
          result.errors.push(
            `${path.basename(filePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
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
              id: tvShow.id,
              title: tvShow.title,
              year: tvShow.year ?? undefined,
              mediaType: 'tv',
              posterUrl: tvShow.posterUrl ?? undefined,
              overview: tvShow.overview ?? undefined,
            },
            files: result.importedPaths.map((p) => ({
              path: p,
              relativePath: path.basename(p),
              size: 0,
            })),
            isUpgrade: false,
          })
          .catch((err) =>
            logger.error({ err }, 'EpisodeImportService: Failed to emit import completed event')
          )
      } else {
        // Emit import failed event
        eventEmitter
          .emitImportFailed({
            media: {
              id: tvShow.id,
              title: tvShow.title,
              year: tvShow.year ?? undefined,
              mediaType: 'tv',
              posterUrl: tvShow.posterUrl ?? undefined,
            },
            errorMessage: result.errors.join('; ') || 'No files imported',
            downloadId: download.id,
          })
          .catch((err) =>
            logger.error({ err }, 'EpisodeImportService: Failed to emit import failed event')
          )
      }

      onProgress?.({ phase: 'complete', total: videoFiles.length, current: videoFiles.length })
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Import failed')

      // Emit import failed event for unexpected errors
      if (download.tvShowId) {
        eventEmitter
          .emitImportFailed({
            media: {
              id: download.tvShowId,
              title: download.title,
              mediaType: 'tv',
            },
            errorMessage: error instanceof Error ? error.message : 'Import failed',
            downloadId: download.id,
          })
          .catch((err) =>
            logger.error({ err }, 'EpisodeImportService: Failed to emit import failed event')
          )
      }
    }

    return result
  }

  /**
   * Import a single video file into the library
   */
  /**
   * Minimum size for a valid episode file (50 MB).
   */
  private static readonly MIN_EPISODE_FILE_SIZE = 50 * 1024 * 1024

  private async importVideoFile(
    sourcePath: string,
    tvShow: TvShow,
    rootFolder: RootFolder,
    knownEpisodeId?: string | null
  ): Promise<{ success: boolean; error?: string; destinationPath?: string }> {
    const fileName = path.basename(sourcePath)

    // --- Integrity check 1: minimum file size ---
    const sourceStats = await fs.stat(sourcePath)
    if (sourceStats.size < EpisodeImportService.MIN_EPISODE_FILE_SIZE) {
      return {
        success: false,
        error: `Source file "${fileName}" is too small (${Math.round(sourceStats.size / 1024 / 1024)} MB) — likely corrupt or incomplete`,
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
            error: `Source file "${fileName}" has no valid video stream — likely corrupt`,
          }
        }
        if (analysis.duration <= 0) {
          return {
            success: false,
            error: `Source file "${fileName}" has no valid duration — likely corrupt or incomplete`,
          }
        }
      } catch {
        return {
          success: false,
          error: `Source file "${fileName}" could not be read by ffprobe — likely corrupt`,
        }
      }
    }

    // Try to find matching episode
    let episode: Episode | null = null

    // If we have a known episode ID, use that
    if (knownEpisodeId) {
      episode = await Episode.find(knownEpisodeId)
    }

    // Otherwise try to parse from filename
    if (!episode) {
      const parsed = fileNamingService.parseEpisodeFileName(fileName)
      if (parsed?.seasonNumber !== undefined && parsed?.episodeNumber !== undefined) {
        episode = await Episode.query()
          .where('tvShowId', tvShow.id)
          .where('seasonNumber', parsed.seasonNumber)
          .where('episodeNumber', parsed.episodeNumber)
          .first()
      }
    }

    if (!episode) {
      return { success: false, error: 'Could not match to episode' }
    }

    // --- Integrity check 3: don't overwrite a larger existing file ---
    const existingFile = await EpisodeFile.query().where('episodeId', episode.id).first()
    if (existingFile) {
      const existingAbsPath = path.join(rootFolder.path, existingFile.relativePath)
      try {
        const existingStats = await fs.stat(existingAbsPath)
        if (existingStats.size > sourceStats.size) {
          return {
            success: false,
            error: `Existing file is larger (${Math.round(existingStats.size / 1024 / 1024)} MB) than source (${Math.round(sourceStats.size / 1024 / 1024)} MB) — refusing to overwrite`,
          }
        }
      } catch {
        // Existing file not accessible on disk, safe to replace the record
      }
    }

    // Determine quality
    const quality = this.detectQuality(fileName)

    // Generate destination path
    const extension = path.extname(sourcePath)
    const relativePath = await fileNamingService.getEpisodePath(
      { episode, tvShow, quality },
      extension
    )
    const absolutePath = path.join(rootFolder.path, relativePath)

    // If the existing file is at a different path, remove it before importing
    if (existingFile && existingFile.relativePath !== relativePath) {
      const oldPath = path.join(rootFolder.path, existingFile.relativePath)
      try {
        await fs.unlink(oldPath)
        logger.info(`Removed old episode file: ${oldPath}`)
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

    // Create or update episode file record and update episode in a transaction
    await db.transaction(async (trx) => {
      let episodeFile = await EpisodeFile.query({ client: trx })
        .where('episodeId', episode.id)
        .first()

      if (episodeFile) {
        episodeFile.useTransaction(trx)
        episodeFile.merge({
          relativePath,
          sizeBytes: stats.size,
          quality: quality || null,
          dateAdded: DateTime.now(),
        })
        await episodeFile.save()
      } else {
        episodeFile = await EpisodeFile.create(
          {
            episodeId: episode.id,
            tvShowId: tvShow.id,
            relativePath,
            sizeBytes: stats.size,
            quality: quality || null,
            dateAdded: DateTime.now(),
          },
          { client: trx }
        )
      }

      // Update episode to indicate it has a file
      episode.useTransaction(trx)
      episode.hasFile = true
      episode.episodeFileId = episodeFile.id
      await episode.save()
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
          const skipDirs = ['sample', 'samples', 'subs', 'subtitles', 'extras', 'featurettes']
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
   * Detect video quality from filename
   */
  private detectQuality(fileName: string): string | undefined {
    const lowerName = fileName.toLowerCase()

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

export const episodeImportService = new EpisodeImportService()
