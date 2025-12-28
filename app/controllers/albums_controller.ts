import type { HttpContext } from '@adonisjs/core/http'
import Album from '#models/album'
import Track from '#models/track'
import TrackFile from '#models/track_file'
import vine from '@vinejs/vine'

const updateAlbumValidator = vine.compile(
  vine.object({
    monitored: vine.boolean().optional(),
    anyReleaseOk: vine.boolean().optional(),
  })
)

export default class AlbumsController {
  /**
   * List all albums (optionally filtered by artist)
   */
  async index({ request, response }: HttpContext) {
    const artistId = request.input('artistId')

    const query = Album.query()
      .preload('artist')
      .orderBy('releaseDate', 'desc')

    if (artistId) {
      query.where('artistId', artistId)
    }

    const albums = await query

    // Get track counts for each album
    const albumsWithCounts = await Promise.all(
      albums.map(async (album) => {
        const trackCount = await Track.query().where('albumId', album.id).count('* as total')
        const fileCount = await Track.query().where('albumId', album.id).where('hasFile', true).count('* as total')

        return {
          id: album.id,
          title: album.title,
          artistId: album.artistId,
          artistName: album.artist?.name,
          musicbrainzId: album.musicbrainzId,
          releaseDate: album.releaseDate?.toISODate(),
          albumType: album.albumType,
          secondaryTypes: album.secondaryTypes,
          imageUrl: album.imageUrl,
          monitored: album.monitored,
          trackCount: Number((trackCount[0].$extras as { total: string }).total) || 0,
          fileCount: Number((fileCount[0].$extras as { total: string }).total) || 0,
        }
      })
    )

    return response.json(albumsWithCounts)
  }

  /**
   * Get album details with tracks
   */
  async show({ params, response }: HttpContext) {
    const album = await Album.query()
      .where('id', params.id)
      .preload('artist')
      .preload('tracks', (trackQuery) => {
        trackQuery.orderBy('discNumber', 'asc').orderBy('trackNumber', 'asc')
      })
      .preload('trackFiles')
      .first()

    if (!album) {
      return response.notFound({ error: 'Album not found' })
    }

    return response.json({
      id: album.id,
      title: album.title,
      artistId: album.artistId,
      artistName: album.artist?.name,
      musicbrainzId: album.musicbrainzId,
      musicbrainzReleaseGroupId: album.musicbrainzReleaseGroupId,
      overview: album.overview,
      releaseDate: album.releaseDate?.toISODate(),
      albumType: album.albumType,
      secondaryTypes: album.secondaryTypes,
      imageUrl: album.imageUrl,
      monitored: album.monitored,
      anyReleaseOk: album.anyReleaseOk,
      tracks: album.tracks.map((track) => ({
        id: track.id,
        title: track.title,
        discNumber: track.discNumber,
        trackNumber: track.trackNumber,
        durationMs: track.durationMs,
        hasFile: track.hasFile,
        trackFileId: track.trackFileId,
      })),
      trackFiles: album.trackFiles.map((file) => ({
        id: file.id,
        path: file.relativePath,
        size: file.sizeBytes,
        quality: file.quality,
        format: file.mediaInfo?.codec,
        bitrate: file.mediaInfo?.bitrate,
      })),
    })
  }

  /**
   * Update album settings
   */
  async update({ params, request, response }: HttpContext) {
    const album = await Album.find(params.id)
    if (!album) {
      return response.notFound({ error: 'Album not found' })
    }

    const data = await request.validateUsing(updateAlbumValidator)

    album.merge({
      monitored: data.monitored ?? album.monitored,
      anyReleaseOk: data.anyReleaseOk ?? album.anyReleaseOk,
    })
    await album.save()

    return response.json({
      id: album.id,
      title: album.title,
      monitored: album.monitored,
      anyReleaseOk: album.anyReleaseOk,
    })
  }

  /**
   * Get wanted (missing) albums
   */
  async wanted({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 50)

    // Get albums that are monitored but have no track files
    const albums = await Album.query()
      .where('monitored', true)
      .whereDoesntHave('trackFiles', () => {})
      .preload('artist')
      .orderBy('releaseDate', 'desc')
      .paginate(page, limit)

    const albumsWithCounts = await Promise.all(
      albums.all().map(async (album) => {
        const trackCount = await Track.query().where('albumId', album.id).count('* as total')

        return {
          id: album.id,
          title: album.title,
          artistId: album.artistId,
          artistName: album.artist?.name,
          musicbrainzId: album.musicbrainzId,
          releaseDate: album.releaseDate?.toISODate(),
          albumType: album.albumType,
          imageUrl: album.imageUrl,
          trackCount: Number((trackCount[0].$extras as { total: string }).total) || 0,
        }
      })
    )

    return response.json({
      data: albumsWithCounts,
      meta: {
        total: albums.total,
        perPage: albums.perPage,
        currentPage: albums.currentPage,
        lastPage: albums.lastPage,
      },
    })
  }

  /**
   * Search for releases on indexers for this album
   */
  async searchReleases({ params, request, response }: HttpContext) {
    const album = await Album.query().where('id', params.id).preload('artist').first()

    if (!album) {
      return response.notFound({ error: 'Album not found' })
    }

    // Import indexer manager
    const { indexerManager } = await import('#services/indexers/indexer_manager')

    const results = await indexerManager.search({
      artist: album.artist?.name,
      album: album.title,
      year: album.releaseDate?.year,
      limit: request.input('limit', 100),
    })

    return response.json(results)
  }

  /**
   * Get file details for an album
   */
  async files({ params, response }: HttpContext) {
    const album = await Album.find(params.id)
    if (!album) {
      return response.notFound({ error: 'Album not found' })
    }

    const files = await TrackFile.query()
      .where('albumId', params.id)
      .preload('track')
      .orderBy('relativePath', 'asc')

    return response.json(
      files.map((file) => ({
        id: file.id,
        path: file.relativePath,
        relativePath: file.relativePath,
        size: file.sizeBytes,
        quality: file.quality,
        format: file.mediaInfo?.codec,
        bitrate: file.mediaInfo?.bitrate,
        sampleRate: file.mediaInfo?.sampleRate,
        channels: file.mediaInfo?.channels,
        track: file.track
          ? {
              id: file.track.id,
              title: file.track.title,
              discNumber: file.track.discNumber,
              trackNumber: file.track.trackNumber,
            }
          : null,
      }))
    )
  }
}
