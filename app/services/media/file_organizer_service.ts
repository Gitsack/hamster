import fs from 'node:fs/promises'
import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { fileNamingService } from './file_naming_service.js'
import { mediaInfoService } from './media_info_service.js'
import { eventEmitter } from '#services/events/event_emitter'
import RootFolder from '#models/root_folder'
import Artist from '#models/artist'
import Album from '#models/album'
import Track from '#models/track'
import TrackFile from '#models/track_file'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Author from '#models/author'
import Book from '#models/book'
import { DateTime } from 'luxon'

interface ImportResult {
  success: boolean
  trackFile?: TrackFile
  error?: string
  sourceFile: string
  destinationFile?: string
}

export interface RenamePreviewItem {
  id: string
  currentPath: string
  newPath: string
  willChange: boolean
}

interface ImportOptions {
  deleteSource?: boolean
  overwriteExisting?: boolean
  album?: Album
  artist?: Artist
  rootFolder?: RootFolder
}

/**
 * Service for organizing audio files into the proper folder structure,
 * extracting metadata, and creating database records.
 */
export class FileOrganizerService {
  /**
   * Import a single audio file into the library
   */
  async importFile(sourcePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    try {
      // Verify source exists
      try {
        await fs.access(sourcePath)
      } catch {
        return { success: false, error: 'Source file not found', sourceFile: sourcePath }
      }

      // Get media info
      const mediaInfo = await mediaInfoService.getMediaInfo(sourcePath)
      if (!mediaInfo) {
        return { success: false, error: 'Could not read media info', sourceFile: sourcePath }
      }

      // Get or determine album/artist
      const album = options.album
      const artist =
        options.artist || (album ? await album.related('artist').query().first() : null)
      const rootFolder =
        options.rootFolder || (artist ? await RootFolder.find(artist.rootFolderId) : null)

      if (!album || !artist || !rootFolder) {
        return {
          success: false,
          error: 'Album, artist, and root folder are required',
          sourceFile: sourcePath,
        }
      }

      // Find or create track based on file metadata
      let track = await this.findMatchingTrack(album, mediaInfo, sourcePath)
      if (!track) {
        // Create a new track for unmatched files
        track = await Track.create({
          albumId: album.id,
          title: mediaInfo.title || path.basename(sourcePath, path.extname(sourcePath)),
          trackNumber: mediaInfo.trackNumber || 1,
          discNumber: mediaInfo.discNumber || 1,
          durationMs: mediaInfo.duration ? Math.round(mediaInfo.duration * 1000) : null,
        })
      }

      // Generate destination path
      const extension = path.extname(sourcePath)
      const relativePath = await fileNamingService.getTrackPath({ track, album, artist }, extension)
      const absolutePath = path.join(rootFolder.path, relativePath)

      // Create directories if needed
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })

      // Check if destination exists
      const destinationExists = await this.fileExists(absolutePath)
      if (destinationExists && !options.overwriteExisting) {
        return {
          success: false,
          error: 'Destination file already exists',
          sourceFile: sourcePath,
          destinationFile: absolutePath,
        }
      }

      // Copy or move file
      if (options.deleteSource) {
        await fs.rename(sourcePath, absolutePath)
      } else {
        await fs.copyFile(sourcePath, absolutePath)
      }

      // Get file stats
      const stats = await fs.stat(absolutePath)

      // Create or update track file record in a transaction
      let trackFile!: TrackFile
      await db.transaction(async (trx) => {
        const existing = await TrackFile.query({ client: trx }).where('trackId', track.id).first()

        if (existing) {
          existing.useTransaction(trx)
          existing.merge({
            relativePath,
            sizeBytes: stats.size,
            quality: this.determineQuality(mediaInfo),
            mediaInfo: {
              codec: mediaInfo.codec,
              bitrate: mediaInfo.bitrate,
              sampleRate: mediaInfo.sampleRate,
              channels: mediaInfo.channels,
              bitsPerSample: mediaInfo.bitDepth,
            },
          })
          await existing.save()
          trackFile = existing
        } else {
          trackFile = await TrackFile.create(
            {
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
            },
            { client: trx }
          )
        }
      })

      // Emit import completed event
      eventEmitter
        .emitImportCompleted({
          media: {
            id: album.id,
            title: `${artist.name} - ${album.title}`,
            year: album.releaseDate?.year ?? undefined,
            mediaType: 'music',
            posterUrl: album.imageUrl ?? undefined,
          },
          files: [
            {
              path: absolutePath,
              relativePath,
              size: stats.size,
              quality: this.determineQuality(mediaInfo),
            },
          ],
          isUpgrade: false,
        })
        .catch((err) =>
          logger.error({ err }, 'FileOrganizerService: Failed to emit import completed event')
        )

      return {
        success: true,
        trackFile,
        sourceFile: sourcePath,
        destinationFile: absolutePath,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceFile: sourcePath,
      }
    }
  }

  /**
   * Import all audio files from a directory
   */
  async importDirectory(sourceDir: string, options: ImportOptions = {}): Promise<ImportResult[]> {
    const results: ImportResult[] = []
    const files = await this.findAudioFiles(sourceDir)

    for (const file of files) {
      const result = await this.importFile(file, options)
      results.push(result)
    }

    return results
  }

  /**
   * Move an existing track file to a new location (e.g., after rename)
   */
  async moveTrackFile(trackFile: TrackFile, newRelativePath: string): Promise<boolean> {
    try {
      const track = await Track.find(trackFile.trackId)
      if (!track) return false

      const album = await Album.find(track.albumId)
      if (!album) return false

      const artist = await Artist.find(album.artistId)
      if (!artist) return false

      const rootFolder = await RootFolder.find(artist.rootFolderId)
      if (!rootFolder) return false

      const oldPath = path.join(rootFolder.path, trackFile.relativePath)
      const newPath = path.join(rootFolder.path, newRelativePath)

      // Create directories
      await fs.mkdir(path.dirname(newPath), { recursive: true })

      // Move file
      await fs.rename(oldPath, newPath)

      // Update record
      trackFile.relativePath = newRelativePath
      await trackFile.save()

      // Clean up empty directories
      await this.removeEmptyDirectories(path.dirname(oldPath), rootFolder.path)

      return true
    } catch (error) {
      logger.error({ err: error }, 'Failed to move track file')
      return false
    }
  }

  /**
   * Reorganize all files for an album based on current naming settings
   */
  async organizeAlbum(album: Album): Promise<{ moved: number; errors: string[] }> {
    const artist = await Artist.find(album.artistId)
    if (!artist) return { moved: 0, errors: ['Artist not found'] }

    const rootFolder = await RootFolder.find(artist.rootFolderId)
    if (!rootFolder) return { moved: 0, errors: ['Root folder not found'] }

    const tracks = await Track.query().where('albumId', album.id).preload('file')

    let moved = 0
    const errors: string[] = []

    for (const track of tracks) {
      if (!track.file) continue

      const expectedPath = await fileNamingService.getTrackPath(
        { track, album, artist },
        path.extname(track.file.relativePath)
      )

      if (track.file.relativePath !== expectedPath) {
        const success = await this.moveTrackFile(track.file, expectedPath)
        if (success) {
          moved++
        } else {
          errors.push(`Failed to move: ${track.file.relativePath}`)
        }
      }
    }

    return { moved, errors }
  }

  /**
   * Find matching track based on file metadata
   */
  private async findMatchingTrack(
    album: Album,
    mediaInfo: { title?: string; trackNumber?: number; discNumber?: number },
    filePath: string
  ): Promise<Track | null> {
    // Try to match by track number first
    if (mediaInfo.trackNumber) {
      const track = await Track.query()
        .where('albumId', album.id)
        .where('trackNumber', mediaInfo.trackNumber)
        .if(mediaInfo.discNumber, (q) => q.where('discNumber', mediaInfo.discNumber!))
        .first()

      if (track) return track
    }

    // Try to match by title
    if (mediaInfo.title) {
      const track = await Track.query()
        .where('albumId', album.id)
        .whereILike('title', mediaInfo.title)
        .first()

      if (track) return track
    }

    // Try to parse track number from filename
    const parsed = fileNamingService.parseTrackFileName(path.basename(filePath))
    if (parsed?.trackNumber) {
      const track = await Track.query()
        .where('albumId', album.id)
        .where('trackNumber', parsed.trackNumber)
        .if(parsed.discNumber, (q) => q.where('discNumber', parsed.discNumber!))
        .first()

      if (track) return track
    }

    return null
  }

  /**
   * Determine quality level based on media info
   */
  private determineQuality(mediaInfo: {
    codec?: string
    bitrate?: number
    bitDepth?: number
    sampleRate?: number
  }): string {
    const codec = mediaInfo.codec?.toLowerCase() || ''

    // Lossless formats
    if (['flac', 'alac', 'wav', 'ape', 'wv'].some((c) => codec.includes(c))) {
      if (mediaInfo.bitDepth && mediaInfo.bitDepth > 16) {
        return 'Hi-Res Lossless'
      }
      if (mediaInfo.sampleRate && mediaInfo.sampleRate > 48000) {
        return 'Hi-Res Lossless'
      }
      return 'Lossless'
    }

    // Lossy formats
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
    } catch (error) {
      logger.error({ dir, err: error }, 'Error reading directory')
    }

    return results
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  // =====================
  // Movie rename/organize
  // =====================

  /**
   * Preview what a movie rename would look like
   */
  async previewRenameMovie(movieId: string): Promise<RenamePreviewItem[]> {
    const movie = await Movie.query()
      .where('id', movieId)
      .preload('rootFolder')
      .preload('movieFile')
      .first()

    if (!movie || !movie.movieFile || !movie.rootFolder) return []

    const extension = path.extname(movie.movieFile.relativePath)
    const expectedPath = await fileNamingService.getMoviePath(
      { movie, quality: movie.movieFile.quality || undefined },
      extension
    )

    return [
      {
        id: movie.movieFile.id,
        currentPath: movie.movieFile.relativePath,
        newPath: expectedPath,
        willChange: movie.movieFile.relativePath !== expectedPath,
      },
    ]
  }

  /**
   * Rename/organize a movie file based on current naming settings
   */
  async renameMovie(movieId: string): Promise<{ moved: number; errors: string[] }> {
    const preview = await this.previewRenameMovie(movieId)
    const toMove = preview.filter((p) => p.willChange)

    if (toMove.length === 0) return { moved: 0, errors: [] }

    const movie = await Movie.query()
      .where('id', movieId)
      .preload('rootFolder')
      .preload('movieFile')
      .first()

    if (!movie || !movie.movieFile || !movie.rootFolder) {
      return { moved: 0, errors: ['Movie, file, or root folder not found'] }
    }

    const errors: string[] = []
    const item = toMove[0]

    try {
      const oldPath = path.join(movie.rootFolder.path, item.currentPath)
      const newPath = path.join(movie.rootFolder.path, item.newPath)

      await fs.mkdir(path.dirname(newPath), { recursive: true })
      await fs.rename(oldPath, newPath)

      movie.movieFile.relativePath = item.newPath
      await movie.movieFile.save()

      await this.removeEmptyDirectories(path.dirname(oldPath), movie.rootFolder.path)
    } catch (error) {
      errors.push(`Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return { moved: toMove.length - errors.length, errors }
  }

  // =====================
  // Episode rename/organize
  // =====================

  /**
   * Preview what a TV show episode rename would look like
   */
  async previewRenameEpisodes(tvShowId: string): Promise<RenamePreviewItem[]> {
    const tvShow = await TvShow.query().where('id', tvShowId).preload('rootFolder').first()

    if (!tvShow || !tvShow.rootFolder) return []

    const episodes = await Episode.query().where('tvShowId', tvShowId).preload('episodeFile')

    const previews: RenamePreviewItem[] = []

    for (const episode of episodes) {
      if (!episode.episodeFile) continue

      const extension = path.extname(episode.episodeFile.relativePath)
      const expectedPath = await fileNamingService.getEpisodePath(
        { episode, tvShow, quality: episode.episodeFile.quality || undefined },
        extension
      )

      previews.push({
        id: episode.episodeFile.id,
        currentPath: episode.episodeFile.relativePath,
        newPath: expectedPath,
        willChange: episode.episodeFile.relativePath !== expectedPath,
      })
    }

    return previews
  }

  /**
   * Rename/organize all episode files for a TV show
   */
  async renameEpisodes(tvShowId: string): Promise<{ moved: number; errors: string[] }> {
    const tvShow = await TvShow.query().where('id', tvShowId).preload('rootFolder').first()

    if (!tvShow || !tvShow.rootFolder) {
      return { moved: 0, errors: ['TV show or root folder not found'] }
    }

    const episodes = await Episode.query().where('tvShowId', tvShowId).preload('episodeFile')

    let moved = 0
    const errors: string[] = []

    for (const episode of episodes) {
      if (!episode.episodeFile) continue

      const extension = path.extname(episode.episodeFile.relativePath)
      const expectedPath = await fileNamingService.getEpisodePath(
        { episode, tvShow, quality: episode.episodeFile.quality || undefined },
        extension
      )

      if (episode.episodeFile.relativePath === expectedPath) continue

      try {
        const oldPath = path.join(tvShow.rootFolder.path, episode.episodeFile.relativePath)
        const newPath = path.join(tvShow.rootFolder.path, expectedPath)

        await fs.mkdir(path.dirname(newPath), { recursive: true })
        await fs.rename(oldPath, newPath)

        episode.episodeFile.relativePath = expectedPath
        await episode.episodeFile.save()

        await this.removeEmptyDirectories(path.dirname(oldPath), tvShow.rootFolder.path)
        moved++
      } catch (error) {
        errors.push(
          `S${episode.seasonNumber}E${episode.episodeNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return { moved, errors }
  }

  // =====================
  // Artist rename/organize
  // =====================

  /**
   * Preview what an artist rename would look like (all album tracks)
   */
  async previewRenameArtist(artistId: string): Promise<RenamePreviewItem[]> {
    const artist = await Artist.find(artistId)
    if (!artist || !artist.rootFolderId) return []

    const rootFolder = await RootFolder.find(artist.rootFolderId)
    if (!rootFolder) return []

    const albums = await Album.query().where('artistId', artist.id)
    const previews: RenamePreviewItem[] = []

    for (const album of albums) {
      const tracks = await Track.query().where('albumId', album.id).preload('file')

      for (const track of tracks) {
        if (!track.file) continue

        const extension = path.extname(track.file.relativePath)
        const expectedPath = await fileNamingService.getTrackPath(
          { track, album, artist },
          extension
        )

        previews.push({
          id: track.file.id,
          currentPath: track.file.relativePath,
          newPath: expectedPath,
          willChange: track.file.relativePath !== expectedPath,
        })
      }
    }

    return previews
  }

  /**
   * Rename/organize all files for an artist based on current naming settings
   */
  async renameArtist(artistId: string): Promise<{ moved: number; errors: string[] }> {
    const artist = await Artist.find(artistId)
    if (!artist || !artist.rootFolderId) {
      return { moved: 0, errors: ['Artist or root folder not configured'] }
    }

    const rootFolder = await RootFolder.find(artist.rootFolderId)
    if (!rootFolder) return { moved: 0, errors: ['Root folder not found'] }

    const albums = await Album.query().where('artistId', artist.id)

    let totalMoved = 0
    const allErrors: string[] = []

    for (const album of albums) {
      const result = await this.organizeAlbum(album)
      totalMoved += result.moved
      allErrors.push(...result.errors)
    }

    return { moved: totalMoved, errors: allErrors }
  }

  // =====================
  // Book rename/organize
  // =====================

  /**
   * Preview what a book rename would look like for an author's books
   */
  async previewRenameBooks(authorId: string): Promise<RenamePreviewItem[]> {
    const author = await Author.find(authorId)
    if (!author || !author.rootFolderId) return []

    const rootFolder = await RootFolder.find(author.rootFolderId)
    if (!rootFolder) return []

    const books = await Book.query().where('authorId', author.id).preload('bookFile')
    const previews: RenamePreviewItem[] = []

    for (const book of books) {
      if (!book.bookFile) continue

      const extension = path.extname(book.bookFile.relativePath)
      const expectedPath = await fileNamingService.getBookPath(
        { book, author, format: book.bookFile.format || undefined },
        extension
      )

      previews.push({
        id: book.bookFile.id,
        currentPath: book.bookFile.relativePath,
        newPath: expectedPath,
        willChange: book.bookFile.relativePath !== expectedPath,
      })
    }

    return previews
  }

  /**
   * Rename/organize all book files for an author
   */
  async renameBooks(authorId: string): Promise<{ moved: number; errors: string[] }> {
    const author = await Author.find(authorId)
    if (!author || !author.rootFolderId) {
      return { moved: 0, errors: ['Author or root folder not configured'] }
    }

    const rootFolder = await RootFolder.find(author.rootFolderId)
    if (!rootFolder) return { moved: 0, errors: ['Root folder not found'] }

    const books = await Book.query().where('authorId', author.id).preload('bookFile')

    let moved = 0
    const errors: string[] = []

    for (const book of books) {
      if (!book.bookFile) continue

      const extension = path.extname(book.bookFile.relativePath)
      const expectedPath = await fileNamingService.getBookPath(
        { book, author, format: book.bookFile.format || undefined },
        extension
      )

      if (book.bookFile.relativePath === expectedPath) continue

      try {
        const oldPath = path.join(rootFolder.path, book.bookFile.relativePath)
        const newPath = path.join(rootFolder.path, expectedPath)

        await fs.mkdir(path.dirname(newPath), { recursive: true })
        await fs.rename(oldPath, newPath)

        book.bookFile.relativePath = expectedPath
        await book.bookFile.save()

        await this.removeEmptyDirectories(path.dirname(oldPath), rootFolder.path)
        moved++
      } catch (error) {
        errors.push(`"${book.title}": ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return { moved, errors }
  }

  /**
   * Remove empty directories up to the root
   */
  private async removeEmptyDirectories(dir: string, root: string): Promise<void> {
    // Don't go above root
    if (!dir.startsWith(root) || dir === root) return

    try {
      const entries = await fs.readdir(dir)
      if (entries.length === 0) {
        await fs.rmdir(dir)
        // Recurse to parent
        await this.removeEmptyDirectories(path.dirname(dir), root)
      }
    } catch {
      // Directory not empty or other error, stop
    }
  }
}

export const fileOrganizerService = new FileOrganizerService()
