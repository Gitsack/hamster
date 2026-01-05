import fs from 'node:fs/promises'
import path from 'node:path'
import { fileNamingService } from './file_naming_service.js'
import { mediaInfoService, type MediaInfo } from './media_info_service.js'
import { musicBrainzService } from '../metadata/musicbrainz_service.js'
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
      .preload('track', (q) => q.preload('album'))
      .first()

    if (existingFile) {
      // Check if file has changed (by size)
      const stats = await fs.stat(filePath)
      const sizeChanged = existingFile.sizeBytes !== stats.size

      // Get media info to check if file needs re-matching to a better album
      const mediaInfo = await mediaInfoService.getMediaInfo(filePath)

      // Check if this file is in a "Singles" album but should be in a proper album
      if (mediaInfo?.album && existingFile.track?.album?.title === 'Singles') {
        const artist = await Artist.query()
          .whereHas('albums', (q) => q.where('id', existingFile.albumId))
          .first()

        if (artist) {
          // Don't pass year - we want to match by title regardless of year (remasters have different years)
          const betterAlbum = await this.findExistingAlbum(mediaInfo.album, artist.id)
          if (betterAlbum && betterAlbum.title !== 'Singles') {
            // Re-link file to the better album
            const track = existingFile.track
            track.albumId = betterAlbum.id
            track.hasFile = true
            await track.save()
            existingFile.albumId = betterAlbum.id
            await existingFile.save()
            return { imported: false, updated: true }
          }
        }
      }

      if (sizeChanged && mediaInfo) {
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

    // Get media info first - we'll use it for matching
    const mediaInfo = await mediaInfoService.getMediaInfo(filePath)
    if (!mediaInfo) {
      return { imported: false, updated: false }
    }

    // Try to match file to existing track/album/artist structure
    const pathParts = relativePath.split(path.sep)
    if (pathParts.length < 2) {
      return { imported: false, updated: false } // File at root, skip
    }

    const artistFolderName = pathParts[0]
    const albumFolderName = pathParts.length >= 3 ? pathParts[1] : null

    // Determine artist name: prefer file metadata over folder name
    const artistName = mediaInfo.artist || artistFolderName

    // Find existing artist (across all root folders for better matching)
    let artist = await this.findExistingArtist(artistName, rootFolder.id)
    let artistCreated = false

    if (!artist) {
      // Try folder name if metadata didn't match
      if (mediaInfo.artist && mediaInfo.artist !== artistFolderName) {
        artist = await this.findExistingArtist(artistFolderName, rootFolder.id)
      }
    }

    if (!artist) {
      // Create new artist
      artist = await Artist.create({
        rootFolderId: rootFolder.id,
        name: artistName,
        status: 'continuing',
        monitored: true,
      })
      artistCreated = true
    }

    // Determine album name: prefer file metadata over folder name
    const albumFolderParsed = albumFolderName ? this.parseAlbumName(albumFolderName) : null
    const albumTitle = mediaInfo.album || albumFolderParsed?.title || 'Singles'
    const albumYear = mediaInfo.year || albumFolderParsed?.year

    // Find or create album
    let album: Album | null = null
    let albumCreated = false

    if (albumTitle !== 'Singles') {
      album = await this.findExistingAlbum(albumTitle, artist.id, albumYear)

      if (!album) {
        album = await Album.create({
          artistId: artist.id,
          title: albumTitle,
          releaseDate: albumYear ? DateTime.fromObject({ year: albumYear }) : null,
          monitored: true,
        })
        albumCreated = true
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
        albumCreated = true
      }
    }

    // Enrich new records with MusicBrainz data (rate-limited)
    if (artistCreated) {
      await this.enrichArtistFromMusicBrainz(artist)
    }
    if (albumCreated && album.title !== 'Singles') {
      await this.enrichAlbumFromMusicBrainz(album, artist.name)
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

    // Mark track as having a file
    track.hasFile = true
    await track.save()

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
  }

  /**
   * Find existing artist by name or MusicBrainz ID (across all root folders)
   */
  private async findExistingArtist(
    name: string,
    rootFolderId: string
  ): Promise<Artist | null> {
    // 1. Try exact match by name in the same root folder first
    const exactMatch = await Artist.query()
      .where('rootFolderId', rootFolderId)
      .whereILike('name', name)
      .first()
    if (exactMatch) return exactMatch

    // 2. Try to find by name across all root folders (case-insensitive)
    const candidates = await Artist.query()
      .whereRaw('LOWER(name) = ?', [name.toLowerCase()])
      .exec()

    if (candidates.length === 0) return null

    // Prefer one with MusicBrainz ID (more authoritative)
    const enriched = candidates.find((a) => a.musicbrainzId)
    return enriched || candidates[0]
  }

  /**
   * Find existing album by title and artist
   * Uses fuzzy matching to handle variations like "(Deluxe Edition)" etc.
   */
  private async findExistingAlbum(
    title: string,
    artistId: string,
    year?: number
  ): Promise<Album | null> {
    const normalizedTitle = this.normalizeAlbumTitle(title)

    // Get all albums for this artist
    const albums = await Album.query()
      .where('artistId', artistId)
      .where('title', '!=', 'Singles')

    // Try exact match first
    const exactMatch = albums.find(
      (a) => a.title.toLowerCase() === title.toLowerCase()
    )
    if (exactMatch) return exactMatch

    // Try normalized match
    const normalizedMatch = albums.find(
      (a) => this.normalizeAlbumTitle(a.title) === normalizedTitle
    )
    if (normalizedMatch) return normalizedMatch

    // Try partial match (title starts with or contains)
    const partialMatch = albums.find(
      (a) =>
        this.normalizeAlbumTitle(a.title).startsWith(normalizedTitle) ||
        normalizedTitle.startsWith(this.normalizeAlbumTitle(a.title))
    )
    if (partialMatch) return partialMatch

    // If year provided, try to find by year as a fallback for common album names
    if (year) {
      const byYear = albums.find((a) => {
        if (!a.releaseDate) return false
        const albumYear = a.releaseDate.year
        return albumYear === year && this.normalizeAlbumTitle(a.title).includes(normalizedTitle.substring(0, 5))
      })
      if (byYear) return byYear
    }

    return null
  }

  /**
   * Normalize album title for fuzzy matching
   * Removes common suffixes like "(Deluxe Edition)", "(Remastered)", etc.
   */
  private normalizeAlbumTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/\s*[\(\[].*?[\)\]]\s*/g, '') // Remove content in parentheses/brackets
      .replace(/\s*-\s*(deluxe|remaster|expanded|anniversary|special|bonus).*$/i, '')
      .replace(/[''`]/g, "'") // Normalize quotes
      .replace(/[^\w\s']/g, '') // Remove special characters except apostrophes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  /**
   * Enrich artist with MusicBrainz metadata
   */
  private async enrichArtistFromMusicBrainz(artist: Artist): Promise<void> {
    if (artist.musicbrainzId) return // Already enriched

    try {
      const results = await musicBrainzService.searchArtists(artist.name, 5)
      if (results.length > 0) {
        // Find best match (exact name match preferred)
        const exactMatch = results.find(
          (r) => r.name.toLowerCase() === artist.name.toLowerCase()
        )
        const best = exactMatch || results[0]

        artist.musicbrainzId = best.id
        artist.sortName = best.sortName || artist.name
        artist.disambiguation = best.disambiguation || null
        artist.artistType = best.type || null
        artist.country = best.country || null
        await artist.save()
      }
    } catch (error) {
      // Don't fail the scan if enrichment fails
      console.error(`Failed to enrich artist ${artist.name}:`, error)
    }
  }

  /**
   * Enrich album with MusicBrainz metadata
   */
  private async enrichAlbumFromMusicBrainz(
    album: Album,
    artistName: string
  ): Promise<void> {
    if (album.musicbrainzId) return // Already enriched

    try {
      const results = await musicBrainzService.searchAlbums(album.title, artistName, 5)
      if (results.length > 0) {
        // Find best match (exact title match preferred)
        const exactMatch = results.find(
          (r) => r.title.toLowerCase() === album.title.toLowerCase()
        )
        const best = exactMatch || results[0]

        album.musicbrainzId = best.id
        album.musicbrainzReleaseGroupId = best.id
        album.albumType = (best.primaryType?.toLowerCase() as any) || 'album'
        if (best.releaseDate && !album.releaseDate) {
          album.releaseDate = DateTime.fromISO(best.releaseDate)
        }
        await album.save()
      }
    } catch (error) {
      // Don't fail the scan if enrichment fails
      console.error(`Failed to enrich album ${album.title}:`, error)
    }
  }
}

export const fileScannerService = new FileScannerService()
