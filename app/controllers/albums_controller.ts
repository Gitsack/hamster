import type { HttpContext } from '@adonisjs/core/http'
import Album from '#models/album'
import Artist from '#models/artist'
import Track from '#models/track'
import TrackFile from '#models/track_file'
import vine from '@vinejs/vine'
import { musicBrainzService } from '#services/metadata/musicbrainz_service'
import { coverArtService } from '#services/metadata/cover_art_service'
import { DateTime } from 'luxon'

const addAlbumValidator = vine.compile(
  vine.object({
    musicbrainzId: vine.string(), // Release group ID
    artistMusicbrainzId: vine.string(),
    rootFolderId: vine.number(),
    qualityProfileId: vine.number(),
    metadataProfileId: vine.number(),
    monitored: vine.boolean().optional(),
    searchForAlbum: vine.boolean().optional(),
  })
)

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
   * Add a specific album to the library
   * Creates the artist if not exists, then adds only the selected album
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(addAlbumValidator)

    // Check if album already exists
    const existingAlbum = await Album.findBy('musicbrainzReleaseGroupId', data.musicbrainzId)
    if (existingAlbum) {
      return response.conflict({ error: 'Album already exists in library' })
    }

    // Find or create the artist
    let artist = await Artist.findBy('musicbrainzId', data.artistMusicbrainzId)

    if (!artist) {
      // Fetch artist metadata from MusicBrainz
      const mbArtist = await musicBrainzService.getArtist(data.artistMusicbrainzId)
      if (!mbArtist) {
        return response.notFound({ error: 'Artist not found on MusicBrainz' })
      }

      // Create artist with monitored=false so we don't auto-fetch all albums
      artist = await Artist.create({
        musicbrainzId: data.artistMusicbrainzId,
        name: mbArtist.name,
        sortName: mbArtist.sortName,
        disambiguation: mbArtist.disambiguation || null,
        status: mbArtist.endDate ? 'ended' : 'continuing',
        artistType: mbArtist.type || null,
        country: mbArtist.country || null,
        formedAt: mbArtist.beginDate ? DateTime.fromISO(mbArtist.beginDate) : null,
        endedAt: mbArtist.endDate ? DateTime.fromISO(mbArtist.endDate) : null,
        monitored: false, // Artist not monitored - only specific albums
        qualityProfileId: data.qualityProfileId,
        metadataProfileId: data.metadataProfileId,
        rootFolderId: data.rootFolderId,
        addedAt: DateTime.now(),
      })
    }

    // Fetch album metadata from MusicBrainz
    const mbAlbums = await musicBrainzService.getArtistAlbums(data.artistMusicbrainzId)
    const mbAlbum = mbAlbums.find((a) => a.id === data.musicbrainzId)

    if (!mbAlbum) {
      return response.notFound({ error: 'Album not found on MusicBrainz' })
    }

    // Map primary type to our album type
    const albumType = this.mapAlbumType(mbAlbum.primaryType)

    // Get cover art URL
    const coverUrl = coverArtService.getFrontCoverUrl(mbAlbum.id, '500')

    // Create the album
    const album = await Album.create({
      artistId: artist.id,
      musicbrainzReleaseGroupId: mbAlbum.id,
      title: mbAlbum.title,
      albumType,
      secondaryTypes: mbAlbum.secondaryTypes || [],
      releaseDate: mbAlbum.releaseDate ? DateTime.fromISO(mbAlbum.releaseDate) : null,
      imageUrl: coverUrl,
      monitored: data.monitored ?? true,
      anyReleaseOk: true,
    })

    // Optionally search for the album and trigger download
    if (data.searchForAlbum) {
      this.searchAndGrabAlbum(album).catch((error) => {
        console.error(`Failed to search for album ${album.id}:`, error)
      })
    }

    return response.created({
      id: album.id,
      title: album.title,
      artistId: artist.id,
      artistName: artist.name,
      monitored: album.monitored,
    })
  }

  /**
   * Search indexers for an album and grab the best result
   */
  private async searchAndGrabAlbum(album: Album): Promise<void> {
    await album.load('artist')

    const { indexerManager } = await import('#services/indexers/indexer_manager')
    const { downloadManager } = await import('#services/download_clients/download_manager')

    const results = await indexerManager.search({
      artist: album.artist?.name,
      album: album.title,
      year: album.releaseDate?.year,
      limit: 25,
    })

    if (results.length === 0) {
      console.log(`No releases found for album: ${album.title}`)
      return
    }

    // Sort by size (prefer larger files, usually better quality) and grab the first
    const sorted = results.sort((a, b) => b.size - a.size)
    const bestResult = sorted[0]

    try {
      await downloadManager.grab({
        title: bestResult.title,
        downloadUrl: bestResult.downloadUrl,
        size: bestResult.size,
        albumId: album.id,
        indexerId: bestResult.indexerId,
        indexerName: bestResult.indexer,
        guid: bestResult.id,
      })
      console.log(`Grabbed release for album ${album.title}: ${bestResult.title}`)
    } catch (error) {
      console.error(`Failed to grab release for album ${album.title}:`, error)
    }
  }

  private mapAlbumType(
    primaryType?: string
  ): 'album' | 'ep' | 'single' | 'compilation' | 'live' | 'remix' | 'other' {
    switch (primaryType?.toLowerCase()) {
      case 'album':
        return 'album'
      case 'ep':
        return 'ep'
      case 'single':
        return 'single'
      case 'compilation':
        return 'compilation'
      case 'live':
        return 'live'
      case 'remix':
        return 'remix'
      default:
        return 'other'
    }
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

  /**
   * Search MusicBrainz for albums (for adding new albums)
   */
  async search({ request, response }: HttpContext) {
    const query = request.input('q', '')
    const artistName = request.input('artist', '')

    if (!query || query.length < 2) {
      return response.json([])
    }

    const results = await musicBrainzService.searchAlbums(query, artistName || undefined, 25)

    // Check which albums are already in the library
    const existingMbIds = await Album.query()
      .whereIn(
        'musicbrainzReleaseGroupId',
        results.map((r) => r.id)
      )
      .select('musicbrainzReleaseGroupId')

    const existingSet = new Set(existingMbIds.map((a) => a.musicbrainzReleaseGroupId))

    return response.json(
      results.map((album) => ({
        musicbrainzId: album.id,
        title: album.title,
        artistName: album.artistName,
        artistMusicbrainzId: album.artistId,
        releaseDate: album.releaseDate,
        type: album.primaryType,
        inLibrary: existingSet.has(album.id),
      }))
    )
  }
}
