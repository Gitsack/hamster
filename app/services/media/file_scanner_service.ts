import fs from 'node:fs/promises'
import path from 'node:path'
import { fileNamingService } from './file_naming_service.js'
import { mediaInfoService, type MediaInfo } from './media_info_service.js'
import RootFolder from '#models/root_folder'
import Artist from '#models/artist'
import Album from '#models/album'
import Track from '#models/track'
import TrackFile from '#models/track_file'
import { DateTime } from 'luxon'

interface ScanProgress {
  phase: 'scanning' | 'processing' | 'complete'
  total: number
  current: number
  currentFile?: string
}

interface ScanResult {
  filesFound: number
  filesImported: number
  filesUpdated: number
  filesSkipped: number
  errors: string[]
}

type ProgressCallback = (progress: ScanProgress) => void

/**
 * Service for scanning directories and importing/updating existing audio files in the library.
 */
export class FileScannerService {
  /**
   * Scan a root folder and update the library
   */
  async scanRootFolder(
    rootFolderId: number,
    onProgress?: ProgressCallback
  ): Promise<ScanResult> {
    const rootFolder = await RootFolder.find(rootFolderId)
    if (!rootFolder) {
      return {
        filesFound: 0,
        filesImported: 0,
        filesUpdated: 0,
        filesSkipped: 0,
        errors: ['Root folder not found'],
      }
    }

    return this.scanDirectory(rootFolder.path, rootFolder, onProgress)
  }

  /**
   * Scan a specific directory
   */
  async scanDirectory(
    directory: string,
    rootFolder: RootFolder,
    onProgress?: ProgressCallback
  ): Promise<ScanResult> {
    const result: ScanResult = {
      filesFound: 0,
      filesImported: 0,
      filesUpdated: 0,
      filesSkipped: 0,
      errors: [],
    }

    try {
      // Find all audio files
      onProgress?.({ phase: 'scanning', total: 0, current: 0 })
      const audioFiles = await this.findAudioFiles(directory)
      result.filesFound = audioFiles.length

      // Process each file
      for (let i = 0; i < audioFiles.length; i++) {
        const filePath = audioFiles[i]
        onProgress?.({
          phase: 'processing',
          total: audioFiles.length,
          current: i + 1,
          currentFile: path.basename(filePath),
        })

        try {
          const processed = await this.processFile(filePath, rootFolder)
          if (processed.imported) result.filesImported++
          else if (processed.updated) result.filesUpdated++
          else result.filesSkipped++
        } catch (error) {
          result.errors.push(
            `${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      // Update root folder statistics
      await this.updateRootFolderStats(rootFolder)

      onProgress?.({ phase: 'complete', total: result.filesFound, current: result.filesFound })
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Scan failed')
    }

    return result
  }

  /**
   * Scan for new files in an artist's directory
   */
  async scanArtist(artistId: number, onProgress?: ProgressCallback): Promise<ScanResult> {
    const artist = await Artist.find(artistId)
    if (!artist) {
      return {
        filesFound: 0,
        filesImported: 0,
        filesUpdated: 0,
        filesSkipped: 0,
        errors: ['Artist not found'],
      }
    }

    const rootFolder = await RootFolder.find(artist.rootFolderId)
    if (!rootFolder) {
      return {
        filesFound: 0,
        filesImported: 0,
        filesUpdated: 0,
        filesSkipped: 0,
        errors: ['Root folder not found'],
      }
    }

    const artistPath = path.join(rootFolder.path, await fileNamingService.getArtistFolderName({ artist }))
    return this.scanDirectory(artistPath, rootFolder, onProgress)
  }

  /**
   * Process a single audio file
   */
  private async processFile(
    filePath: string,
    rootFolder: RootFolder
  ): Promise<{ imported: boolean; updated: boolean }> {
    const relativePath = path.relative(rootFolder.path, filePath)

    // Check if file already exists in database
    const existingFile = await TrackFile.query()
      .where('relativePath', relativePath)
      .whereHas('track', (q) => {
        q.whereHas('album', (q2) => {
          q2.whereHas('artist', (q3) => {
            q3.where('rootFolderId', rootFolder.id)
          })
        })
      })
      .first()

    if (existingFile) {
      // Check if file has changed (by size)
      const stats = await fs.stat(filePath)
      if (existingFile.sizeBytes === stats.size) {
        return { imported: false, updated: false } // Skip unchanged
      }

      // Update existing file
      const mediaInfo = await mediaInfoService.getMediaInfo(filePath)
      if (mediaInfo) {
        existingFile.merge({
          sizeBytes: stats.size,
          mediaInfo: {
            codec: mediaInfo.codec,
            bitrate: mediaInfo.bitrate,
            sampleRate: mediaInfo.sampleRate,
            channels: mediaInfo.channels,
            bitsPerSample: mediaInfo.bitDepth,
          },
        })
        await existingFile.save()
        return { imported: false, updated: true }
      }
      return { imported: false, updated: false }
    }

    // Try to match file to existing track/album/artist structure
    const pathParts = relativePath.split(path.sep)
    if (pathParts.length < 2) {
      return { imported: false, updated: false } // File at root, skip
    }

    const artistFolderName = pathParts[0]
    const albumFolderName = pathParts.length >= 3 ? pathParts[1] : null

    // Find or create artist
    let artist = await Artist.query()
      .where('rootFolderId', rootFolder.id)
      .where((q) => {
        // Try to match by folder name pattern
        q.whereILike('name', artistFolderName)
      })
      .first()

    if (!artist) {
      // Create new artist from folder
      artist = await Artist.create({
        rootFolderId: rootFolder.id,
        name: artistFolderName,
        status: 'continuing',
        monitored: true,
      })
    }

    // Find or create album if we have album folder
    let album: Album | null = null
    if (albumFolderName) {
      const albumName = this.parseAlbumName(albumFolderName)

      album = await Album.query()
        .where('artistId', artist.id)
        .whereILike('title', albumName.title)
        .first()

      if (!album) {
        album = await Album.create({
          artistId: artist.id,
          title: albumName.title,
          releaseDate: albumName.year ? DateTime.fromObject({ year: albumName.year }) : null,
          monitored: true,
        })
      }
    } else {
      // Use or create a default "Singles" album
      album = await Album.query()
        .where('artistId', artist.id)
        .where('title', 'Singles')
        .first()

      if (!album) {
        album = await Album.create({
          artistId: artist.id,
          title: 'Singles',
          monitored: true,
        })
      }
    }

    // Get media info
    const mediaInfo = await mediaInfoService.getMediaInfo(filePath)
    if (!mediaInfo) {
      return { imported: false, updated: false }
    }

    // Find or create track
    const fileName = path.basename(filePath)
    const parsed = fileNamingService.parseTrackFileName(fileName)

    let track = await Track.query()
      .where('albumId', album.id)
      .where((q) => {
        if (parsed?.trackNumber) {
          q.where('trackNumber', parsed.trackNumber)
          if (parsed.discNumber) {
            q.where('discNumber', parsed.discNumber)
          }
        } else if (mediaInfo.title) {
          q.whereILike('title', mediaInfo.title)
        }
      })
      .first()

    if (!track) {
      const trackTitle = mediaInfo.title || parsed?.title || path.basename(filePath, path.extname(filePath))
      track = await Track.create({
        albumId: album.id,
        title: trackTitle,
        trackNumber: parsed?.trackNumber || mediaInfo.trackNumber || 1,
        discNumber: parsed?.discNumber || mediaInfo.discNumber || 1,
        durationMs: mediaInfo.duration ? Math.round(mediaInfo.duration * 1000) : null,
      })
    }

    // Create track file
    const stats = await fs.stat(filePath)
    await TrackFile.create({
      trackId: track.id,
      albumId: album.id,
      relativePath,
      sizeBytes: stats.size,
      quality: this.determineQuality(mediaInfo),
      dateAdded: DateTime.now(),
      mediaInfo: {
        codec: mediaInfo.codec,
        bitrate: mediaInfo.bitrate,
        sampleRate: mediaInfo.sampleRate,
        channels: mediaInfo.channels,
        bitsPerSample: mediaInfo.bitDepth,
      },
    })

    return { imported: true, updated: false }
  }

  /**
   * Parse album name from folder name
   * Handles formats like "[2020] Album Name" or "Album Name (2020)"
   */
  private parseAlbumName(folderName: string): { title: string; year?: number } {
    // Try [YEAR] prefix
    const bracketMatch = folderName.match(/^\[(\d{4})\]\s*(.+)$/)
    if (bracketMatch) {
      return { title: bracketMatch[2], year: parseInt(bracketMatch[1], 10) }
    }

    // Try (YEAR) suffix
    const parenMatch = folderName.match(/^(.+)\s*\((\d{4})\)$/)
    if (parenMatch) {
      return { title: parenMatch[1].trim(), year: parseInt(parenMatch[2], 10) }
    }

    return { title: folderName }
  }

  /**
   * Determine quality level
   */
  private determineQuality(mediaInfo: MediaInfo): string {
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
   * Find all audio files recursively
   */
  private async findAudioFiles(dir: string): Promise<string[]> {
    const results: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          const subFiles = await this.findAudioFiles(fullPath)
          results.push(...subFiles)
        } else if (entry.isFile() && fileNamingService.isAudioFile(entry.name)) {
          results.push(fullPath)
        }
      }
    } catch {
      // Ignore errors (permission issues, etc.)
    }

    return results
  }

  /**
   * Update root folder statistics
   */
  private async updateRootFolderStats(_rootFolder: RootFolder): Promise<void> {
    // TODO: Implement root folder statistics if needed
    // Count artists in this root folder
    // const artistCount = await Artist.query()
    //   .where('rootFolderId', rootFolder.id)
    //   .count('* as total')
    //
    // Get total size of all track files
    // const sizeResult = await TrackFile.query()
    //   .whereHas('track', (q) => {
    //     q.whereHas('album', (q2) => {
    //       q2.whereHas('artist', (q3) => {
    //         q3.where('rootFolderId', rootFolder.id)
    //       })
    //     })
    //   })
    //   .sum('sizeBytes as total')
  }
}

export const fileScannerService = new FileScannerService()
