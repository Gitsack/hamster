import fs from 'node:fs/promises'
import path from 'node:path'
import { fileNamingService } from './file_naming_service.js'
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
        const DownloadClient = (await import('#models/download_client')).default
        const client = await DownloadClient.find(download.downloadClientId)
        if (client?.settings?.remotePath && client?.settings?.localPath) {
          outputPath = outputPath.replace(client.settings.remotePath, client.settings.localPath)
        }
      }

      // Check if path exists
      try {
        await fs.access(outputPath)
      } catch {
        result.errors.push(`Path not accessible: ${outputPath}. If SABnzbd runs in Docker, configure Remote Path Mapping in Download Client settings.`)
        return result
      }

      // Get the TV show
      const tvShow = download.tvShowId ? await TvShow.find(download.tvShowId) : null
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
      }

      onProgress?.({ phase: 'complete', total: videoFiles.length, current: videoFiles.length })
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Import failed')
    }

    return result
  }

  /**
   * Import a single video file into the library
   */
  private async importVideoFile(
    sourcePath: string,
    tvShow: TvShow,
    rootFolder: RootFolder,
    knownEpisodeId?: string | null
  ): Promise<{ success: boolean; error?: string; destinationPath?: string }> {
    const fileName = path.basename(sourcePath)

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

    // Determine quality
    const quality = this.detectQuality(fileName)

    // Generate destination path
    const extension = path.extname(sourcePath)
    const relativePath = fileNamingService.getEpisodePath(
      { episode, tvShow, quality },
      extension
    )
    const absolutePath = path.join(rootFolder.path, relativePath)

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

    // Create or update episode file record
    let episodeFile = await EpisodeFile.query().where('episodeId', episode.id).first()

    if (episodeFile) {
      episodeFile.merge({
        relativePath,
        sizeBytes: stats.size,
        quality: quality || null,
        dateAdded: DateTime.now(),
      })
      await episodeFile.save()
    } else {
      episodeFile = await EpisodeFile.create({
        episodeId: episode.id,
        tvShowId: tvShow.id,
        relativePath,
        sizeBytes: stats.size,
        quality: quality || null,
        dateAdded: DateTime.now(),
      })
    }

    // Update episode to indicate it has a file
    episode.hasFile = true
    episode.episodeFileId = episodeFile.id
    await episode.save()

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
      console.error(`Error scanning directory ${dir}:`, error)
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
        return
      }

      const deletePatterns = [
        /\.nfo$/i,
        /\.sfv$/i,
        /\.txt$/i,
        /\.url$/i,
        /\.srt$/i,
        /\.sub$/i,
        /\.idx$/i,
        /\.nzb$/i,
        /thumbs\.db$/i,
        /\.ds_store$/i,
      ]

      await this.cleanDirectory(downloadPath, deletePatterns)
      await this.removeEmptyDirectories(downloadPath)

      try {
        const remaining = await fs.readdir(downloadPath)
        if (remaining.length === 0) {
          await fs.rmdir(downloadPath)
        }
      } catch {
        // Folder not empty, that's fine
      }
    } catch (error) {
      console.error('Error cleaning up download folder:', error)
    }
  }

  private async cleanDirectory(dir: string, deletePatterns: RegExp[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          await this.cleanDirectory(fullPath, deletePatterns)
        } else if (entry.isFile()) {
          const shouldDelete = deletePatterns.some((pattern) => pattern.test(entry.name))
          if (shouldDelete) {
            try {
              await fs.unlink(fullPath)
            } catch {
              // Ignore errors
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  private async removeEmptyDirectories(dir: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(dir, entry.name)
          await this.removeEmptyDirectories(subPath)
        }
      }

      const remainingEntries = await fs.readdir(dir)
      if (remainingEntries.length === 0) {
        await fs.rmdir(dir)
        return true
      }
    } catch {
      // Ignore errors
    }

    return false
  }
}

export const episodeImportService = new EpisodeImportService()
