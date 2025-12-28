import type { HttpContext } from '@adonisjs/core/http'
import Artist from '#models/artist'
import Album from '#models/album'
import Track from '#models/track'
import vine from '@vinejs/vine'
import { musicBrainzService } from '#services/metadata/musicbrainz_service'
import { coverArtService } from '#services/metadata/cover_art_service'
import { DateTime } from 'luxon'

const addArtistValidator = vine.compile(
  vine.object({
    musicbrainzId: vine.string(),
    rootFolderId: vine.number(),
    qualityProfileId: vine.number(),
    metadataProfileId: vine.number(),
    monitored: vine.boolean().optional(),
  })
)

const updateArtistValidator = vine.compile(
  vine.object({
    monitored: vine.boolean().optional(),
    qualityProfileId: vine.number().optional(),
    metadataProfileId: vine.number().optional(),
    rootFolderId: vine.number().optional(),
  })
)

export default class ArtistsController {
  /**
   * List all artists in the library
   */
  async index({ response }: HttpContext) {
    const artists = await Artist.query()
      .preload('qualityProfile')
      .preload('metadataProfile')
      .preload('rootFolder')
      .withCount('albums')
      .orderBy('sortName', 'asc')

    return response.json(
      artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        sortName: artist.sortName,
        musicbrainzId: artist.musicbrainzId,
        status: artist.status,
        artistType: artist.artistType,
        country: artist.country,
        imageUrl: artist.imageUrl,
        monitored: artist.monitored,
        albumCount: (artist.$extras as { albums_count?: string }).albums_count || 0,
        qualityProfile: artist.qualityProfile
          ? { id: artist.qualityProfile.id, name: artist.qualityProfile.name }
          : null,
        metadataProfile: artist.metadataProfile
          ? { id: artist.metadataProfile.id, name: artist.metadataProfile.name }
          : null,
        rootFolder: artist.rootFolder
          ? { id: artist.rootFolder.id, path: artist.rootFolder.path }
          : null,
      }))
    )
  }

  /**
   * Get artist details with albums
   */
  async show({ params, response }: HttpContext) {
    const artist = await Artist.query()
      .where('id', params.id)
      .preload('qualityProfile')
      .preload('metadataProfile')
      .preload('rootFolder')
      .preload('albums', (albumQuery) => {
        albumQuery.orderBy('releaseDate', 'desc')
      })
      .first()

    if (!artist) {
      return response.notFound({ error: 'Artist not found' })
    }

    // Get track file counts for each album
    const albumsWithCounts = await Promise.all(
      artist.albums.map(async (album) => {
        const trackCount = await Track.query().where('albumId', album.id).count('* as total')
        const fileCount = await Track.query().where('albumId', album.id).where('hasFile', true).count('* as total')

        return {
          id: album.id,
          title: album.title,
          musicbrainzId: album.musicbrainzId,
          releaseDate: album.releaseDate?.toISODate(),
          albumType: album.albumType,
          imageUrl: album.imageUrl,
          monitored: album.monitored,
          trackCount: Number((trackCount[0].$extras as { total: string }).total) || 0,
          fileCount: Number((fileCount[0].$extras as { total: string }).total) || 0,
        }
      })
    )

    return response.json({
      id: artist.id,
      name: artist.name,
      sortName: artist.sortName,
      musicbrainzId: artist.musicbrainzId,
      disambiguation: artist.disambiguation,
      overview: artist.overview,
      status: artist.status,
      artistType: artist.artistType,
      country: artist.country,
      formedAt: artist.formedAt?.toISODate(),
      endedAt: artist.endedAt?.toISODate(),
      imageUrl: artist.imageUrl,
      monitored: artist.monitored,
      qualityProfile: artist.qualityProfile
        ? { id: artist.qualityProfile.id, name: artist.qualityProfile.name }
        : null,
      metadataProfile: artist.metadataProfile
        ? { id: artist.metadataProfile.id, name: artist.metadataProfile.name }
        : null,
      rootFolder: artist.rootFolder
        ? { id: artist.rootFolder.id, path: artist.rootFolder.path }
        : null,
      albums: albumsWithCounts,
    })
  }

  /**
   * Add a new artist from MusicBrainz
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(addArtistValidator)

    // Check if artist already exists
    const existing = await Artist.findBy('musicbrainzId', data.musicbrainzId)
    if (existing) {
      return response.conflict({ error: 'Artist already exists in library' })
    }

    // Fetch artist metadata from MusicBrainz
    const mbArtist = await musicBrainzService.getArtist(data.musicbrainzId)
    if (!mbArtist) {
      return response.notFound({ error: 'Artist not found on MusicBrainz' })
    }

    // Create artist
    const artist = await Artist.create({
      musicbrainzId: data.musicbrainzId,
      name: mbArtist.name,
      sortName: mbArtist.sortName,
      disambiguation: mbArtist.disambiguation || null,
      status: mbArtist.endDate ? 'ended' : 'continuing',
      artistType: mbArtist.type || null,
      country: mbArtist.country || null,
      formedAt: mbArtist.beginDate ? DateTime.fromISO(mbArtist.beginDate) : null,
      endedAt: mbArtist.endDate ? DateTime.fromISO(mbArtist.endDate) : null,
      monitored: data.monitored ?? true,
      qualityProfileId: data.qualityProfileId,
      metadataProfileId: data.metadataProfileId,
      rootFolderId: data.rootFolderId,
      addedAt: DateTime.now(),
    })

    // Fetch and add albums in background (don't block response)
    this.fetchArtistAlbums(artist).catch((error) => {
      console.error(`Failed to fetch albums for artist ${artist.id}:`, error)
    })

    return response.created({
      id: artist.id,
      name: artist.name,
      musicbrainzId: artist.musicbrainzId,
    })
  }

  /**
   * Update artist settings
   */
  async update({ params, request, response }: HttpContext) {
    const artist = await Artist.find(params.id)
    if (!artist) {
      return response.notFound({ error: 'Artist not found' })
    }

    const data = await request.validateUsing(updateArtistValidator)

    artist.merge({
      monitored: data.monitored ?? artist.monitored,
      qualityProfileId: data.qualityProfileId ?? artist.qualityProfileId,
      metadataProfileId: data.metadataProfileId ?? artist.metadataProfileId,
      rootFolderId: data.rootFolderId ?? artist.rootFolderId,
    })
    await artist.save()

    return response.json({
      id: artist.id,
      name: artist.name,
      monitored: artist.monitored,
    })
  }

  /**
   * Delete an artist and all related data
   */
  async destroy({ params, response }: HttpContext) {
    const artist = await Artist.find(params.id)
    if (!artist) {
      return response.notFound({ error: 'Artist not found' })
    }

    // Delete all related albums, tracks, etc. (cascade handled by DB)
    await artist.delete()

    return response.noContent()
  }

  /**
   * Refresh artist metadata from MusicBrainz
   */
  async refresh({ params, response }: HttpContext) {
    const artist = await Artist.find(params.id)
    if (!artist) {
      return response.notFound({ error: 'Artist not found' })
    }

    if (!artist.musicbrainzId) {
      return response.badRequest({ error: 'Artist has no MusicBrainz ID' })
    }

    // Fetch updated metadata
    const mbArtist = await musicBrainzService.getArtist(artist.musicbrainzId)
    if (!mbArtist) {
      return response.badRequest({ error: 'Failed to fetch artist from MusicBrainz' })
    }

    // Update artist
    artist.merge({
      name: mbArtist.name,
      sortName: mbArtist.sortName,
      disambiguation: mbArtist.disambiguation || null,
      status: mbArtist.endDate ? 'ended' : 'continuing',
      artistType: mbArtist.type || null,
      country: mbArtist.country || null,
      formedAt: mbArtist.beginDate ? DateTime.fromISO(mbArtist.beginDate) : null,
      endedAt: mbArtist.endDate ? DateTime.fromISO(mbArtist.endDate) : null,
    })
    await artist.save()

    // Refresh albums
    await this.fetchArtistAlbums(artist)

    return response.json({
      id: artist.id,
      name: artist.name,
      refreshed: true,
    })
  }

  /**
   * Search MusicBrainz for artists (for adding new artists)
   */
  async search({ request, response }: HttpContext) {
    const query = request.input('q', '')
    if (!query || query.length < 2) {
      return response.json([])
    }

    const results = await musicBrainzService.searchArtists(query, 25)

    // Check which artists are already in the library
    const existingMbIds = await Artist.query()
      .whereIn(
        'musicbrainzId',
        results.map((r) => r.id)
      )
      .select('musicbrainzId')

    const existingSet = new Set(existingMbIds.map((a) => a.musicbrainzId))

    return response.json(
      results.map((artist) => ({
        musicbrainzId: artist.id,
        name: artist.name,
        sortName: artist.sortName,
        disambiguation: artist.disambiguation,
        type: artist.type,
        country: artist.country,
        beginDate: artist.beginDate,
        endDate: artist.endDate,
        inLibrary: existingSet.has(artist.id),
      }))
    )
  }

  /**
   * Fetch and store albums for an artist
   */
  private async fetchArtistAlbums(artist: Artist): Promise<void> {
    if (!artist.musicbrainzId) return

    const mbAlbums = await musicBrainzService.getArtistAlbums(artist.musicbrainzId)

    for (const mbAlbum of mbAlbums) {
      // Skip if album already exists
      const existing = await Album.findBy('musicbrainzReleaseGroupId', mbAlbum.id)
      if (existing) continue

      // Map primary type to our album type
      const albumType = this.mapAlbumType(mbAlbum.primaryType)

      // Try to get cover art
      const coverUrl = coverArtService.getFrontCoverUrl(mbAlbum.id, '500')

      await Album.create({
        artistId: artist.id,
        musicbrainzReleaseGroupId: mbAlbum.id,
        title: mbAlbum.title,
        albumType,
        secondaryTypes: mbAlbum.secondaryTypes || [],
        releaseDate: mbAlbum.releaseDate ? DateTime.fromISO(mbAlbum.releaseDate) : null,
        imageUrl: coverUrl,
        monitored: false, // Albums are not monitored by default - user must explicitly select them
        anyReleaseOk: true,
      })
    }
  }

  private mapAlbumType(primaryType?: string): 'album' | 'ep' | 'single' | 'compilation' | 'live' | 'remix' | 'other' {
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
}
