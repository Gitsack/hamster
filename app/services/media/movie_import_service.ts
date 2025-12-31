import fs from 'node:fs/promises'
import path from 'node:path'
import { fileNamingService } from './file_naming_service.js'
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
        const DownloadClient = (await import('#models/download_client')).default
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
          result.errors.push(`Path not responding: ${outputPath}. Network storage may not be mounted or is unresponsive.`)
        } else {
          result.errors.push(`Path not accessible: ${outputPath}. If SABnzbd runs in Docker, configure Remote Path Mapping in Download Client settings.`)
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
      }

      onProgress?.({ phase: 'complete', total: 1, current: 1 })
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
    movie: Movie,
    rootFolder: RootFolder,
    quality?: string
  ): Promise<{ success: boolean; error?: string; destinationPath?: string }> {
    // Generate destination path
    const extension = path.extname(sourcePath)
    const relativePath = await fileNamingService.getMoviePath(
      { movie, quality },
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

    // Create or update movie file record
    let movieFile = await MovieFile.query().where('movieId', movie.id).first()

    if (movieFile) {
      movieFile.merge({
        relativePath,
        sizeBytes: stats.size,
        quality: quality || null,
        dateAdded: DateTime.now(),
      })
      await movieFile.save()
    } else {
      movieFile = await MovieFile.create({
        movieId: movie.id,
        relativePath,
        sizeBytes: stats.size,
        quality: quality || null,
        dateAdded: DateTime.now(),
      })
    }

    // Update movie to indicate it has a file
    movie.hasFile = true
    await movie.save()

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
          const skipDirs = ['sample', 'samples', 'subs', 'subtitles', 'extras', 'featurettes', 'behind the scenes']
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
        return
      }

      // Remove common non-video files
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

      // Try to remove the root download folder if empty
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

export const movieImportService = new MovieImportService()
