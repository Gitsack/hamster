import type { HttpContext } from '@adonisjs/core/http'
import fs from 'node:fs'
import path from 'node:path'
import TrackFile from '#models/track_file'
import Track from '#models/track'
import Album from '#models/album'
import Artist from '#models/artist'
import RootFolder from '#models/root_folder'

const MIME_TYPES: Record<string, string> = {
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

export default class PlaybackController {
  /**
   * Stream an audio file with range request support
   */
  async stream({ params, request, response }: HttpContext) {
    const trackFileId = parseInt(params.id, 10)
    if (isNaN(trackFileId)) {
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
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

    // Handle range request
    const rangeHeader = request.header('range')

    if (rangeHeader) {
      // Parse range header
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
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
    const trackFileId = parseInt(params.id, 10)
    if (isNaN(trackFileId)) {
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
    const albumId = parseInt(params.id, 10)
    if (isNaN(albumId)) {
      return response.badRequest({ error: 'Invalid album ID' })
    }

    const album = await Album.query()
      .where('id', albumId)
      .preload('artist')
      .first()

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

    const albumPath = path.join(
      rootFolder.path,
      album.artist.name,
      album.title
    )

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
    const albumId = parseInt(params.id, 10)
    if (isNaN(albumId)) {
      return response.badRequest({ error: 'Invalid album ID' })
    }

    const tracks = await Track.query()
      .where('albumId', albumId)
      .preload('file')
      .preload('album', (q) => q.preload('artist'))
      .orderBy('discNumber', 'asc')
      .orderBy('trackNumber', 'asc')

    const playlist = tracks
      .filter((t) => t.file)
      .map((t) => ({
        id: t.file!.id,
        trackId: t.id,
        title: t.title,
        trackNumber: t.trackNumber,
        discNumber: t.discNumber,
        duration: t.durationMs ? t.durationMs / 1000 : null,
        album: {
          id: t.album.id,
          title: t.album.title,
          coverUrl: t.album.imageUrl,
        },
        artist: {
          id: t.album.artist.id,
          name: t.album.artist.name,
        },
        streamUrl: `/api/v1/playback/stream/${t.file!.id}`,
      }))

    return response.json(playlist)
  }
}
