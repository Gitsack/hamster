import type { HttpContext } from '@adonisjs/core/http'
import fs from 'node:fs'
import path from 'node:path'
import TrackFile from '#models/track_file'
import Track from '#models/track'
import Album from '#models/album'
import Artist from '#models/artist'
import RootFolder from '#models/root_folder'
import MovieFile from '#models/movie_file'
import Movie from '#models/movie'
import EpisodeFile from '#models/episode_file'
import TvShow from '#models/tv_show'
import { videoTranscodingService } from '#services/media/video_transcoding_service'

const AUDIO_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.wma': 'audio/x-ms-wma',
  '.ape': 'audio/ape',
  '.wv': 'audio/wavpack',
  '.dsf': 'audio/dsf',
  '.dff': 'audio/dff',
}

const VIDEO_MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.m4v': 'video/x-m4v',
  '.ts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
}

export default class PlaybackController {
  /**
   * Stream an audio file with range request support
   */
  async stream({ params, request, response }: HttpContext) {
    const trackFileId = params.id
    if (!trackFileId) {
      return response.badRequest({ error: 'Invalid track file ID' })
    }

    // Get track file with all related data
    const trackFile = await TrackFile.find(trackFileId)
    if (!trackFile) {
      return response.notFound({ error: 'Track file not found' })
    }

    // Get the full path
    const track = await Track.find(trackFile.trackId)
    if (!track) {
      return response.notFound({ error: 'Track not found' })
    }

    const album = await Album.find(track.albumId)
    if (!album) {
      return response.notFound({ error: 'Album not found' })
    }

    const artist = await Artist.find(album.artistId)
    if (!artist) {
      return response.notFound({ error: 'Artist not found' })
    }

    const rootFolder = await RootFolder.find(artist.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, trackFile.relativePath)

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return response.notFound({ error: 'Audio file not found on disk' })
    }

    // Get file stats
    const stats = fs.statSync(absolutePath)
    const fileSize = stats.size

    // Get MIME type
    const ext = path.extname(absolutePath).toLowerCase()
    const mimeType = AUDIO_MIME_TYPES[ext] || 'application/octet-stream'

    // Handle range request
    const rangeHeader = request.header('range')

    if (rangeHeader) {
      // Parse range header
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = Number.parseInt(parts[0], 10)
      const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      // Create read stream for the range
      const stream = fs.createReadStream(absolutePath, { start, end })

      response.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      response.header('Accept-Ranges', 'bytes')
      response.header('Content-Length', chunkSize.toString())
      response.header('Content-Type', mimeType)
      response.header('Cache-Control', 'public, max-age=31536000')

      return response.status(206).stream(stream)
    }

    // No range request - stream entire file
    const stream = fs.createReadStream(absolutePath)

    response.header('Content-Length', fileSize.toString())
    response.header('Content-Type', mimeType)
    response.header('Accept-Ranges', 'bytes')
    response.header('Cache-Control', 'public, max-age=31536000')

    return response.stream(stream)
  }

  /**
   * Get track info for playback
   */
  async info({ params, response }: HttpContext) {
    const trackFileId = params.id
    if (!trackFileId) {
      return response.badRequest({ error: 'Invalid track file ID' })
    }

    const trackFile = await TrackFile.query()
      .where('id', trackFileId)
      .preload('track', (q) => {
        q.preload('album', (q2) => {
          q2.preload('artist')
        })
      })
      .first()

    if (!trackFile) {
      return response.notFound({ error: 'Track file not found' })
    }

    const track = trackFile.track
    const album = track.album
    const artist = album.artist

    return response.json({
      id: trackFile.id,
      trackId: track.id,
      title: track.title,
      trackNumber: track.trackNumber,
      discNumber: track.discNumber,
      duration: track.durationMs ? track.durationMs / 1000 : null,
      album: {
        id: album.id,
        title: album.title,
        coverUrl: album.imageUrl,
      },
      artist: {
        id: artist.id,
        name: artist.name,
      },
      quality: trackFile.quality,
      format: trackFile.mediaInfo?.codec,
      bitrate: trackFile.mediaInfo?.bitrate,
      sampleRate: trackFile.mediaInfo?.sampleRate,
      streamUrl: `/api/v1/playback/stream/${trackFile.id}`,
    })
  }

  /**
   * Get album artwork
   */
  async artwork({ params, response }: HttpContext) {
    const albumId = params.id
    if (!albumId) {
      return response.badRequest({ error: 'Invalid album ID' })
    }

    const album = await Album.query().where('id', albumId).preload('artist').first()

    if (!album) {
      return response.notFound({ error: 'Album not found' })
    }

    // If album has an imageUrl, redirect to it
    if (album.imageUrl) {
      return response.redirect(album.imageUrl)
    }

    // Try to find folder.jpg in album directory
    const rootFolder = await RootFolder.find(album.artist.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'No artwork available' })
    }

    const albumPath = path.join(rootFolder.path, album.artist.name, album.title)

    const coverPaths = [
      path.join(albumPath, 'folder.jpg'),
      path.join(albumPath, 'cover.jpg'),
      path.join(albumPath, 'folder.png'),
      path.join(albumPath, 'cover.png'),
    ]

    for (const coverPath of coverPaths) {
      if (fs.existsSync(coverPath)) {
        const ext = path.extname(coverPath).toLowerCase()
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
        const stream = fs.createReadStream(coverPath)

        response.header('Content-Type', mimeType)
        response.header('Cache-Control', 'public, max-age=86400')

        return response.stream(stream)
      }
    }

    return response.notFound({ error: 'No artwork available' })
  }

  /**
   * Get a playlist for an album (all tracks)
   */
  async albumPlaylist({ params, response }: HttpContext) {
    try {
      const albumId = params.id
      if (!albumId) {
        return response.badRequest({ error: 'Invalid album ID' })
      }

      // Get album with artist first
      const album = await Album.query().where('id', albumId).preload('artist').first()

      if (!album) {
        return response.notFound({ error: 'Album not found' })
      }

      // Get track files for this album directly
      const trackFiles = await TrackFile.query()
        .where('albumId', albumId)
        .whereNotNull('trackId')
        .preload('track')

      const playlist = trackFiles
        .filter((tf) => tf.track)
        .map((tf) => ({
          id: tf.id,
          trackId: tf.track.id,
          title: tf.track.title,
          trackNumber: tf.track.trackNumber,
          discNumber: tf.track.discNumber,
          duration: tf.track.durationMs ? tf.track.durationMs / 1000 : null,
          album: {
            id: album.id,
            title: album.title,
            coverUrl: album.imageUrl,
          },
          artist: {
            id: album.artist?.id,
            name: album.artist?.name || 'Unknown Artist',
          },
          streamUrl: `/api/v1/playback/stream/${tf.id}`,
        }))
        .sort((a, b) => {
          if (a.discNumber !== b.discNumber) {
            return a.discNumber - b.discNumber
          }
          return a.trackNumber - b.trackNumber
        })

      return response.json(playlist)
    } catch (error) {
      console.error('Album playlist error:', error)
      return response.internalServerError({
        error: 'Failed to load playlist',
        details: String(error),
      })
    }
  }

  /**
   * Stream a movie file with range request support
   */
  async streamMovie({ params, request, response }: HttpContext) {
    const movieFileId = params.id
    if (!movieFileId) {
      return response.badRequest({ error: 'Invalid movie file ID' })
    }

    // Get movie file with related data
    const movieFile = await MovieFile.find(movieFileId)
    if (!movieFile) {
      return response.notFound({ error: 'Movie file not found' })
    }

    // Get the movie for root folder
    const movie = await Movie.find(movieFile.movieId)
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    const rootFolder = await RootFolder.find(movie.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, movieFile.relativePath)

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return response.notFound({ error: 'Video file not found on disk' })
    }

    // Get file stats
    const stats = fs.statSync(absolutePath)
    const fileSize = stats.size

    // Get MIME type
    const ext = path.extname(absolutePath).toLowerCase()
    const mimeType = VIDEO_MIME_TYPES[ext] || 'video/mp4'

    // Handle range request
    const rangeHeader = request.header('range')

    if (rangeHeader) {
      // Parse range header
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = Number.parseInt(parts[0], 10)
      const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      // Create read stream for the range
      const stream = fs.createReadStream(absolutePath, { start, end })

      response.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      response.header('Accept-Ranges', 'bytes')
      response.header('Content-Length', chunkSize.toString())
      response.header('Content-Type', mimeType)
      response.header('Cache-Control', 'public, max-age=31536000')

      return response.status(206).stream(stream)
    }

    // No range request - stream entire file
    const stream = fs.createReadStream(absolutePath)

    response.header('Content-Length', fileSize.toString())
    response.header('Content-Type', mimeType)
    response.header('Accept-Ranges', 'bytes')
    response.header('Cache-Control', 'public, max-age=31536000')

    return response.stream(stream)
  }

  /**
   * Stream an episode file with range request support
   */
  async streamEpisode({ params, request, response }: HttpContext) {
    const episodeFileId = params.id
    if (!episodeFileId) {
      return response.badRequest({ error: 'Invalid episode file ID' })
    }

    // Get episode file with related data
    const episodeFile = await EpisodeFile.find(episodeFileId)
    if (!episodeFile) {
      return response.notFound({ error: 'Episode file not found' })
    }

    // Get the TV show for root folder
    const tvShow = await TvShow.find(episodeFile.tvShowId)
    if (!tvShow) {
      return response.notFound({ error: 'TV show not found' })
    }

    const rootFolder = await RootFolder.find(tvShow.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, episodeFile.relativePath)

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return response.notFound({ error: 'Video file not found on disk' })
    }

    // Get file stats
    const stats = fs.statSync(absolutePath)
    const fileSize = stats.size

    // Get MIME type
    const ext = path.extname(absolutePath).toLowerCase()
    const mimeType = VIDEO_MIME_TYPES[ext] || 'video/mp4'

    // Handle range request
    const rangeHeader = request.header('range')

    if (rangeHeader) {
      // Parse range header
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = Number.parseInt(parts[0], 10)
      const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      // Create read stream for the range
      const stream = fs.createReadStream(absolutePath, { start, end })

      response.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      response.header('Accept-Ranges', 'bytes')
      response.header('Content-Length', chunkSize.toString())
      response.header('Content-Type', mimeType)
      response.header('Cache-Control', 'public, max-age=31536000')

      return response.status(206).stream(stream)
    }

    // No range request - stream entire file
    const stream = fs.createReadStream(absolutePath)

    response.header('Content-Length', fileSize.toString())
    response.header('Content-Type', mimeType)
    response.header('Accept-Ranges', 'bytes')
    response.header('Cache-Control', 'public, max-age=31536000')

    return response.stream(stream)
  }

  /**
   * Helper to resolve movie file path
   */
  private async resolveMovieFilePath(movieFileId: string): Promise<string | null> {
    const movieFile = await MovieFile.find(movieFileId)
    if (!movieFile) return null

    const movie = await Movie.find(movieFile.movieId)
    if (!movie) return null

    const rootFolder = await RootFolder.find(movie.rootFolderId)
    if (!rootFolder) return null

    return path.join(rootFolder.path, movieFile.relativePath)
  }

  /**
   * Helper to resolve episode file path
   */
  private async resolveEpisodeFilePath(episodeFileId: string): Promise<string | null> {
    const episodeFile = await EpisodeFile.find(episodeFileId)
    if (!episodeFile) return null

    const tvShow = await TvShow.find(episodeFile.tvShowId)
    if (!tvShow) return null

    const rootFolder = await RootFolder.find(tvShow.rootFolderId)
    if (!rootFolder) return null

    return path.join(rootFolder.path, episodeFile.relativePath)
  }

  /**
   * Get playback info for a movie - determines if transcoding is needed
   */
  async moviePlaybackInfo({ params, response }: HttpContext) {
    const movieFileId = params.id
    if (!movieFileId) {
      return response.badRequest({ error: 'Invalid movie file ID' })
    }

    const filePath = await this.resolveMovieFilePath(movieFileId)
    if (!filePath) {
      return response.notFound({ error: 'Movie file not found' })
    }

    if (!fs.existsSync(filePath)) {
      return response.notFound({ error: 'Video file not found on disk' })
    }

    try {
      const playbackInfo = await videoTranscodingService.getPlaybackInfo(
        filePath,
        movieFileId,
        'movie'
      )
      return response.json(playbackInfo)
    } catch (error) {
      console.error('Failed to get movie playback info:', error)
      // Fall back to direct play
      return response.json({
        needsTranscode: false,
        transcodeReason: null,
        playbackUrl: `/api/v1/playback/movie/${movieFileId}`,
        duration: 0,
        audioCodec: null,
      })
    }
  }

  /**
   * Get playback info for an episode - determines if transcoding is needed
   */
  async episodePlaybackInfo({ params, response }: HttpContext) {
    const episodeFileId = params.id
    if (!episodeFileId) {
      return response.badRequest({ error: 'Invalid episode file ID' })
    }

    const filePath = await this.resolveEpisodeFilePath(episodeFileId)
    if (!filePath) {
      return response.notFound({ error: 'Episode file not found' })
    }

    if (!fs.existsSync(filePath)) {
      return response.notFound({ error: 'Video file not found on disk' })
    }

    try {
      const playbackInfo = await videoTranscodingService.getPlaybackInfo(
        filePath,
        episodeFileId,
        'episode'
      )
      return response.json(playbackInfo)
    } catch (error) {
      console.error('Failed to get episode playback info:', error)
      // Fall back to direct play
      return response.json({
        needsTranscode: false,
        transcodeReason: null,
        playbackUrl: `/api/v1/playback/episode/${episodeFileId}`,
        duration: 0,
        audioCodec: null,
      })
    }
  }

  /**
   * Get HLS manifest for a transcoding session
   */
  async hlsManifest({ params, response }: HttpContext) {
    const sessionId = params.sessionId
    if (!sessionId) {
      return response.badRequest({ error: 'Invalid session ID' })
    }

    const manifest = videoTranscodingService.getManifest(sessionId)
    if (!manifest) {
      return response.notFound({ error: 'Session not found or expired' })
    }

    response.header('Content-Type', 'application/vnd.apple.mpegurl')
    response.header('Cache-Control', 'no-cache')
    return response.send(manifest)
  }

  /**
   * Get HLS segment for a transcoding session
   */
  async hlsSegment({ params, response }: HttpContext) {
    const sessionId = params.sessionId
    const segmentIndex = Number.parseInt(params.index, 10)

    if (!sessionId) {
      return response.badRequest({ error: 'Invalid session ID' })
    }

    if (isNaN(segmentIndex) || segmentIndex < 0) {
      return response.badRequest({ error: 'Invalid segment index' })
    }

    try {
      const segment = await videoTranscodingService.getSegment(sessionId, segmentIndex)
      if (!segment) {
        return response.notFound({ error: 'Segment not found or session expired' })
      }

      response.header('Content-Type', 'video/mp2t')
      response.header('Content-Length', segment.length.toString())
      response.header('Cache-Control', 'public, max-age=3600')
      return response.send(segment)
    } catch (error) {
      console.error('Failed to get segment:', error)
      return response.internalServerError({ error: 'Failed to get segment' })
    }
  }

  /**
   * Clean up an HLS transcoding session
   */
  async hlsCleanup({ params, response }: HttpContext) {
    const sessionId = params.sessionId
    if (!sessionId) {
      return response.badRequest({ error: 'Invalid session ID' })
    }

    const destroyed = videoTranscodingService.destroySession(sessionId)
    return response.json({ success: destroyed })
  }
}
