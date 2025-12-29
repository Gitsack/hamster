import fs from 'node:fs/promises'
import path from 'node:path'
import { fileNamingService } from './file_naming_service.js'
import { mediaInfoService } from './media_info_service.js'
import Download from '#models/download'
import Album from '#models/album'
import Artist from '#models/artist'
import Track from '#models/track'
import TrackFile from '#models/track_file'
import RootFolder from '#models/root_folder'
import { DateTime } from 'luxon'

export interface ImportProgress {
  phase: 'scanning' | 'importing' | 'cleaning' | 'complete'
  total: number
  current: number
  currentFile?: string
}

export interface DownloadImportResult {
  success: boolean
  downloadId: number
  albumId: number | null
  filesImported: number
  filesSkipped: number
  errors: string[]
  importedPaths: string[]
}

export interface PathImportResult {
  success: boolean
  filesImported: number
  filesSkipped: number
  errors: string[]
  matchedAlbum?: string
}

/**
 * Service for importing completed downloads into the library.
 * Handles scanning, matching, moving, renaming, and cleaning up downloads.
 */
export class DownloadImportService {
  /**
   * Import a completed download
   */
  async importDownload(
    download: Download,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<DownloadImportResult> {
    const result: DownloadImportResult = {
      success: false,
      downloadId: download.id,
      albumId: download.albumId,
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

      // Get the album this download is for
      const album = download.albumId ? await Album.find(download.albumId) : null
      if (!album) {
        result.errors.push('Album not found for download')
        return result
      }

      // Get artist and root folder
      const artist = await Artist.find(album.artistId)
      if (!artist) {
        result.errors.push('Artist not found')
        return result
      }

      const rootFolder = await RootFolder.find(artist.rootFolderId)
      if (!rootFolder) {
        result.errors.push('Root folder not found')
        return result
      }

      // Scan for audio files in download folder
      onProgress?.({ phase: 'scanning', total: 0, current: 0 })
      const audioFiles = await this.findAudioFiles(outputPath)

      if (audioFiles.length === 0) {
        result.errors.push('No audio files found in download')
        return result
      }

      onProgress?.({ phase: 'importing', total: audioFiles.length, current: 0 })

      // Ensure album has tracks (fetch from MusicBrainz if needed)
      await this.ensureAlbumHasTracks(album)

      // Import each file
      for (let i = 0; i < audioFiles.length; i++) {
        const filePath = audioFiles[i]
        onProgress?.({
          phase: 'importing',
          total: audioFiles.length,
          current: i + 1,
          currentFile: path.basename(filePath),
        })

        try {
          const importResult = await this.importAudioFile(
            filePath,
            album,
            artist,
            rootFolder
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

      // Clean up download folder
      onProgress?.({ phase: 'cleaning', total: 1, current: 0 })
      await this.cleanupDownloadFolder(outputPath)

      // Update download status
      download.status = 'importing'
      await download.save()

      // Mark download as imported (we'll use 'completed' status)
      if (result.filesImported > 0) {
        download.status = 'completed'
        await download.save()
        result.success = true
      }

      onProgress?.({ phase: 'complete', total: audioFiles.length, current: audioFiles.length })
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Import failed')
    }

    return result
  }

  /**
   * Import from a path without a Download record
   * Tries to match audio files to an album in the library
   */
  async importFromPath(importPath: string): Promise<PathImportResult> {
    const result: PathImportResult = {
      success: false,
      filesImported: 0,
      filesSkipped: 0,
      errors: [],
    }

    try {
      // Scan for audio files
      const audioFiles = await this.findAudioFiles(importPath)

      if (audioFiles.length === 0) {
        result.errors.push('No audio files found')
        return result
      }

      // Try to match based on folder name or file metadata
      const folderName = path.basename(importPath)
      let album: Album | null = null
      let artist: Artist | null = null

      // First, try to get metadata from the first audio file
      const firstFile = audioFiles[0]
      const mediaInfo = await mediaInfoService.getMediaInfo(firstFile)

      if (mediaInfo?.artist) {
        artist = await Artist.query()
          .whereILike('name', `%${mediaInfo.artist}%`)
          .first()
      }

      if (mediaInfo?.album) {
        const albumQuery = Album.query().whereILike('title', `%${mediaInfo.album}%`)
        if (artist) {
          albumQuery.where('artistId', artist.id)
        }
        album = await albumQuery.first()
      }

      // If no match from metadata, try folder name parsing
      if (!album) {
        // Common patterns: "Artist - Album (Year)", "Artist - Album"
        const match = folderName.match(/^(.+?)\s*-\s*(.+?)(?:\s*\((\d{4})\))?$/)
        if (match) {
          const [, artistPart, albumPart] = match

          if (!artist) {
            artist = await Artist.query()
              .whereILike('name', `%${artistPart.trim()}%`)
              .first()
          }

          if (artist) {
            album = await Album.query()
              .where('artistId', artist.id)
              .whereILike('title', `%${albumPart.trim()}%`)
              .first()
          }
        }
      }

      if (!album) {
        result.errors.push(`Could not match to any album in library. Folder: ${folderName}`)
        return result
      }

      result.matchedAlbum = album.title

      // Get artist if not already found
      if (!artist) {
        artist = await Artist.find(album.artistId)
      }

      if (!artist) {
        result.errors.push('Artist not found')
        return result
      }

      const rootFolder = await RootFolder.find(artist.rootFolderId)
      if (!rootFolder) {
        result.errors.push('Root folder not found')
        return result
      }

      // Ensure album has tracks
      await this.ensureAlbumHasTracks(album)

      // Import each audio file
      for (const filePath of audioFiles) {
        try {
          const importResult = await this.importAudioFile(filePath, album, artist, rootFolder)

          if (importResult.success) {
            result.filesImported++
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

      // Clean up the folder after import
      await this.cleanupDownloadFolder(importPath)

      result.success = result.filesImported > 0
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Import failed')
    }

    return result
  }

  /**
   * Import a single audio file into the library
   */
  private async importAudioFile(
    sourcePath: string,
    album: Album,
    artist: Artist,
    rootFolder: RootFolder
  ): Promise<{ success: boolean; error?: string; destinationPath?: string }> {
    // Get media info from file
    const mediaInfo = await mediaInfoService.getMediaInfo(sourcePath)
    if (!mediaInfo) {
      return { success: false, error: 'Could not read media info' }
    }

    // Find matching track or create one
    let track = await this.findMatchingTrack(album, mediaInfo, sourcePath)

    if (!track) {
      // Create a new track for this file
      track = await Track.create({
        albumId: album.id,
        title: mediaInfo.title || path.basename(sourcePath, path.extname(sourcePath)),
        trackNumber: mediaInfo.trackNumber || await this.getNextTrackNumber(album.id),
        discNumber: mediaInfo.discNumber || 1,
        durationMs: mediaInfo.duration ? Math.round(mediaInfo.duration * 1000) : null,
        hasFile: false,
      })
    }

    // Generate destination path
    const extension = path.extname(sourcePath)
    const relativePath = fileNamingService.getTrackPath(
      { track, album, artist },
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

    // Create or update track file record
    let trackFile = await TrackFile.query().where('trackId', track.id).first()

    const quality = this.determineQuality(mediaInfo)
    const mediaInfoData = {
      codec: mediaInfo.codec,
      bitrate: mediaInfo.bitrate,
      sampleRate: mediaInfo.sampleRate,
      channels: mediaInfo.channels,
      bitsPerSample: mediaInfo.bitDepth,
    }

    if (trackFile) {
      trackFile.merge({
        relativePath,
        sizeBytes: stats.size,
        quality,
        mediaInfo: mediaInfoData,
      })
      await trackFile.save()
    } else {
      trackFile = await TrackFile.create({
        trackId: track.id,
        albumId: album.id,
        relativePath,
        sizeBytes: stats.size,
        quality,
        dateAdded: DateTime.now(),
        mediaInfo: mediaInfoData,
      })
    }

    // Update track to indicate it has a file
    track.hasFile = true
    track.trackFileId = trackFile.id
    await track.save()

    return { success: true, destinationPath: absolutePath }
  }

  /**
   * Find a track that matches the audio file
   */
  private async findMatchingTrack(
    album: Album,
    mediaInfo: { title?: string; trackNumber?: number; discNumber?: number },
    filePath: string
  ): Promise<Track | null> {
    // Try to match by track number and disc number
    if (mediaInfo.trackNumber) {
      const query = Track.query()
        .where('albumId', album.id)
        .where('trackNumber', mediaInfo.trackNumber)

      if (mediaInfo.discNumber) {
        query.where('discNumber', mediaInfo.discNumber)
      }

      const track = await query.first()
      if (track) return track
    }

    // Try to match by title (fuzzy)
    if (mediaInfo.title) {
      const track = await Track.query()
        .where('albumId', album.id)
        .whereILike('title', `%${mediaInfo.title}%`)
        .first()

      if (track) return track
    }

    // Try to parse track number from filename
    const parsed = fileNamingService.parseTrackFileName(path.basename(filePath))
    if (parsed?.trackNumber) {
      const query = Track.query()
        .where('albumId', album.id)
        .where('trackNumber', parsed.trackNumber)

      if (parsed.discNumber) {
        query.where('discNumber', parsed.discNumber)
      }

      const track = await query.first()
      if (track) return track
    }

    return null
  }

  /**
   * Ensure album has tracks (fetch from MusicBrainz if empty)
   */
  private async ensureAlbumHasTracks(album: Album): Promise<void> {
    const trackCount = await Track.query()
      .where('albumId', album.id)
      .count('* as total')

    const count = Number((trackCount[0].$extras as { total: string }).total) || 0

    if (count === 0 && album.musicbrainzReleaseGroupId) {
      // Fetch tracks from MusicBrainz
      try {
        const { musicBrainzService } = await import('#services/metadata/musicbrainz_service')
        const releases = await musicBrainzService.getAlbumReleases(album.musicbrainzReleaseGroupId)

        if (releases.length > 0) {
          // Use the first release's tracks (prefer the most complete one)
          const release = releases.reduce((best, current) =>
            current.trackCount > best.trackCount ? current : best
          )

          // Extract tracks from all media (discs)
          let discNumber = 1
          for (const medium of release.media) {
            for (const mbTrack of medium.tracks) {
              await Track.create({
                albumId: album.id,
                musicbrainzId: mbTrack.id,
                title: mbTrack.title,
                trackNumber: mbTrack.position,
                discNumber: discNumber,
                durationMs: mbTrack.length || null,
                hasFile: false,
              })
            }
            discNumber++
          }
        }
      } catch (error) {
        console.error('Failed to fetch tracks from MusicBrainz:', error)
      }
    }
  }

  /**
   * Get next track number for an album
   */
  private async getNextTrackNumber(albumId: number): Promise<number> {
    const result = await Track.query()
      .where('albumId', albumId)
      .max('trackNumber as maxTrack')

    const maxTrack = (result[0].$extras as { maxTrack: number | null }).maxTrack
    return (maxTrack || 0) + 1
  }

  /**
   * Determine quality level from media info
   */
  private determineQuality(mediaInfo: {
    codec?: string
    bitrate?: number
    bitDepth?: number
    sampleRate?: number
  }): string {
    const codec = mediaInfo.codec?.toLowerCase() || ''

    if (['flac', 'alac', 'wav', 'ape', 'wv'].some((c) => codec.includes(c))) {
      if (
        (mediaInfo.bitDepth && mediaInfo.bitDepth > 16) ||
        (mediaInfo.sampleRate && mediaInfo.sampleRate > 48000)
      ) {
        return 'Hi-Res Lossless'
      }
      return 'Lossless'
    }

    if (mediaInfo.bitrate) {
      if (mediaInfo.bitrate >= 320000) return '320kbps'
      if (mediaInfo.bitrate >= 256000) return '256kbps'
      if (mediaInfo.bitrate >= 192000) return '192kbps'
      if (mediaInfo.bitrate >= 128000) return '128kbps'
      return 'Low Quality'
    }

    return 'Unknown'
  }

  /**
   * Find all audio files in a directory recursively
   */
  private async findAudioFiles(dir: string): Promise<string[]> {
    const results: string[] = []

    try {
      const stats = await fs.stat(dir)

      // If it's a file, check if it's audio
      if (stats.isFile()) {
        if (fileNamingService.isAudioFile(dir)) {
          return [dir]
        }
        return []
      }

      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          // Skip common non-music directories
          const skipDirs = ['sample', 'samples', 'proof', 'subs', 'covers', 'scans']
          if (!skipDirs.includes(entry.name.toLowerCase())) {
            const subFiles = await this.findAudioFiles(fullPath)
            results.push(...subFiles)
          }
        } else if (entry.isFile() && fileNamingService.isAudioFile(entry.name)) {
          results.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error)
    }

    return results
  }

  /**
   * Clean up download folder after import
   * Removes empty directories and non-essential files
   */
  private async cleanupDownloadFolder(downloadPath: string): Promise<void> {
    try {
      const stats = await fs.stat(downloadPath)

      if (stats.isFile()) {
        // Single file download, nothing to clean
        return
      }

      // Remove common non-music files
      const deletePatterns = [
        /\.nfo$/i,
        /\.sfv$/i,
        /\.txt$/i,
        /\.url$/i,
        /\.m3u$/i,
        /\.cue$/i,
        /\.log$/i,
        /\.accurip$/i,
        /thumbs\.db$/i,
        /\.ds_store$/i,
      ]

      await this.cleanDirectory(downloadPath, deletePatterns)

      // Remove empty directories
      await this.removeEmptyDirectories(downloadPath)

      // Try to remove the root download folder if empty
      try {
        const remaining = await fs.readdir(downloadPath)
        if (remaining.length === 0) {
          await fs.rmdir(downloadPath)
        }
      } catch {
        // Folder not empty or error, that's fine
      }
    } catch (error) {
      console.error('Error cleaning up download folder:', error)
    }
  }

  /**
   * Clean a directory of unwanted files
   */
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

  /**
   * Remove empty directories recursively
   */
  private async removeEmptyDirectories(dir: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      // First, recurse into subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(dir, entry.name)
          await this.removeEmptyDirectories(subPath)
        }
      }

      // Check if directory is now empty
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

export const downloadImportService = new DownloadImportService()
