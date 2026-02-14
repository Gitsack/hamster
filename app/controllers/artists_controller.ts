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
    rootFolderId: vine.string().optional(),
    qualityProfileId: vine.string(),
    requested: vine.boolean().optional(),
    monitored: vine.boolean().optional(),
  })
)

const updateArtistValidator = vine.compile(
  vine.object({
    requested: vine.boolean().optional(),
    monitored: vine.boolean().optional(),
    qualityProfileId: vine.string().optional(),
    rootFolderId: vine.string().optional(),
  })
)

export default class ArtistsController {
  /**
   * List all artists in the library
   */
  async index({ response }: HttpContext) {
    const artists = await Artist.query()
      .preload('qualityProfile')
      .preload('rootFolder')
      .preload('albums', (query) => {
        query.whereNotNull('imageUrl').orderBy('releaseDate', 'desc').limit(1)
      })
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
        // Use artist image if available, otherwise use first album cover
        imageUrl: artist.imageUrl || artist.albums[0]?.imageUrl || null,
        requested: artist.requested,
        monitored: artist.monitored,
        albumCount: (artist.$extras as { albums_count?: string }).albums_count || 0,
        qualityProfile: artist.qualityProfile
          ? { id: artist.qualityProfile.id, name: artist.qualityProfile.name }
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
        const fileCount = await Track.query()
          .where('albumId', album.id)
          .where('hasFile', true)
          .count('* as total')

        return {
          id: album.id,
          title: album.title,
          musicbrainzId: album.musicbrainzReleaseGroupId, // Use release group ID for matching with discography
          releaseDate: album.releaseDate?.toISODate(),
          albumType: album.albumType,
          imageUrl: album.imageUrl,
          requested: album.requested,
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
      requested: artist.requested,
      monitored: artist.monitored,
      qualityProfile: artist.qualityProfile
        ? { id: artist.qualityProfile.id, name: artist.qualityProfile.name }
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
      requested: data.requested ?? true,
      monitored: data.monitored ?? true,
      qualityProfileId: data.qualityProfileId,
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
      requested: data.requested ?? artist.requested,
      monitored: data.monitored ?? artist.monitored,
      qualityProfileId: data.qualityProfileId ?? artist.qualityProfileId,
      rootFolderId: data.rootFolderId ?? artist.rootFolderId,
    })
    await artist.save()

    return response.json({
      id: artist.id,
      name: artist.name,
      requested: artist.requested,
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

    // Refresh albums and update artist image if needed
    await this.fetchArtistAlbums(artist)

    // If artist still has no image or current image is broken, try to find one
    if (!artist.imageUrl) {
      const albums = await Album.query()
        .where('artistId', artist.id)
        .where('albumType', 'album')
        .whereNotNull('musicbrainzReleaseGroupId')
        .orderBy('releaseDate', 'desc')

      for (const album of albums) {
        if (album.musicbrainzReleaseGroupId) {
          const verified = await coverArtService.getVerifiedCoverUrl(
            album.musicbrainzReleaseGroupId,
            '500'
          )
          if (verified) {
            artist.imageUrl = verified
            await artist.save()
            break
          }
        }
      }
    }

    return response.json({
      id: artist.id,
      name: artist.name,
      refreshed: true,
    })
  }

  /**
   * Enrich an artist that doesn't have a MusicBrainz ID by searching and linking
   */
  async enrich({ params, response }: HttpContext) {
    const artist = await Artist.find(params.id)
    if (!artist) {
      return response.notFound({ error: 'Artist not found' })
    }

    if (artist.musicbrainzId) {
      return response.badRequest({
        error: 'Artist already has a MusicBrainz ID. Use refresh instead.',
      })
    }

    // Search MusicBrainz for this artist
    const results = await musicBrainzService.searchArtists(artist.name, 10)
    if (results.length === 0) {
      return response.json({
        id: artist.id,
        name: artist.name,
        enriched: false,
        message: 'No matching artist found on MusicBrainz',
      })
    }

    // Find best match (exact name match preferred)
    const exactMatch = results.find((r) => r.name.toLowerCase() === artist.name.toLowerCase())
    const best = exactMatch || results[0]

    // Update artist with MusicBrainz data
    artist.merge({
      musicbrainzId: best.id,
      sortName: best.sortName || artist.name,
      disambiguation: best.disambiguation || null,
      artistType: best.type || null,
      country: best.country || null,
      status: best.endDate ? 'ended' : 'continuing',
      formedAt: best.beginDate ? DateTime.fromISO(best.beginDate) : null,
      endedAt: best.endDate ? DateTime.fromISO(best.endDate) : null,
    })
    await artist.save()

    // Fetch and update albums
    await this.fetchArtistAlbums(artist)

    return response.json({
      id: artist.id,
      name: artist.name,
      musicbrainzId: artist.musicbrainzId,
      enriched: true,
    })
  }

  /**
   * Get albums for an artist by MusicBrainz ID (for search exploration)
   */
  async albumsByMbid({ params, response }: HttpContext) {
    const mbid = params.mbid

    try {
      // Fetch albums from MusicBrainz
      const mbAlbums = await musicBrainzService.getArtistAlbums(mbid)

      // Check which albums are already in the library
      const existingMbIds = await Album.query()
        .whereIn(
          'musicbrainzReleaseGroupId',
          mbAlbums.map((a) => a.id)
        )
        .select('musicbrainzReleaseGroupId')

      const existingSet = new Set(existingMbIds.map((a) => a.musicbrainzReleaseGroupId))

      // Sort by release date (newest first) and filter to main releases
      const sortedAlbums = mbAlbums
        .filter((a) => a.primaryType === 'Album' || a.primaryType === 'EP')
        .sort((a, b) => {
          if (!a.releaseDate) return 1
          if (!b.releaseDate) return -1
          return b.releaseDate.localeCompare(a.releaseDate)
        })

      return response.json(
        sortedAlbums.map((album) => ({
          musicbrainzId: album.id,
          title: album.title,
          artistName: album.artistName,
          artistMusicbrainzId: album.artistId,
          releaseDate: album.releaseDate,
          type: album.primaryType,
          inLibrary: existingSet.has(album.id),
        }))
      )
    } catch (error) {
      console.error(`Failed to get albums for artist ${mbid}:`, error)
      return response.json([])
    }
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
   * Normalize album title for comparison (removes punctuation, extra spaces, common suffixes)
   */
  private normalizeTitle(title: string): string {
    return (
      title
        .toLowerCase()
        // Normalize unicode characters
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Remove common suffixes in parentheses
        .replace(
          /\s*\((?:deluxe|special|bonus|expanded|remaster|anniversary|edition|version|disc \d+).*?\)/gi,
          ''
        )
        // Remove brackets content
        .replace(/\s*\[.*?\]/g, '')
        // Normalize quotes and apostrophes
        .replace(/[''`]/g, "'")
        .replace(/[""]/g, '"')
        // Normalize dashes
        .replace(/[–—]/g, '-')
        // Remove punctuation for comparison
        .replace(/[^\w\s'-]/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
    )
  }

  /**
   * Fetch and store albums for an artist, matching existing albums by title
   */
  private async fetchArtistAlbums(artist: Artist): Promise<void> {
    if (!artist.musicbrainzId) return

    const mbAlbums = await musicBrainzService.getArtistAlbums(artist.musicbrainzId)
    let verifiedArtistCoverUrl: string | null = null

    // Get all existing albums for this artist (for title matching)
    const existingAlbums = await Album.query().where('artistId', artist.id)

    console.log(
      `[Enrich] Artist "${artist.name}" has ${existingAlbums.length} existing albums, MusicBrainz has ${mbAlbums.length} albums`
    )

    // Sort albums by release date (newest first) to get the most recent album cover
    const sortedAlbums = [...mbAlbums].sort((a, b) => {
      if (!a.releaseDate) return 1
      if (!b.releaseDate) return -1
      return b.releaseDate.localeCompare(a.releaseDate)
    })

    for (const mbAlbum of sortedAlbums) {
      // First check if album already exists by MusicBrainz ID
      const existingByMbId = await Album.findBy('musicbrainzReleaseGroupId', mbAlbum.id)
      if (existingByMbId) {
        // If we don't have an artist image yet, check if this existing album has one
        if (!verifiedArtistCoverUrl && existingByMbId.imageUrl) {
          const verified = await coverArtService.getVerifiedCoverUrl(mbAlbum.id, '500')
          if (verified) {
            verifiedArtistCoverUrl = verified
          }
        }
        continue
      }

      // Map primary type to our album type
      const albumType = this.mapAlbumType(mbAlbum.primaryType)

      // Try to get cover art URL (optimistic - may not exist)
      const coverUrl = coverArtService.getFrontCoverUrl(mbAlbum.id, '500')

      // For the artist image, verify the cover actually exists (check first few studio albums)
      if (!verifiedArtistCoverUrl && albumType === 'album') {
        const verified = await coverArtService.getVerifiedCoverUrl(mbAlbum.id, '500')
        if (verified) {
          verifiedArtistCoverUrl = verified
        }
      }

      // Try to find existing album by title that doesn't have a MusicBrainz ID
      // First try exact match, then normalized match
      const mbTitleNormalized = this.normalizeTitle(mbAlbum.title)

      const existingByTitle = existingAlbums.find((a) => {
        if (a.musicbrainzReleaseGroupId) return false

        // Exact match (case-insensitive)
        if (a.title.toLowerCase() === mbAlbum.title.toLowerCase()) return true

        // Normalized match
        const existingNormalized = this.normalizeTitle(a.title)
        if (existingNormalized === mbTitleNormalized) return true

        // Check if one contains the other (for "Album" vs "Album (Deluxe Edition)")
        if (
          existingNormalized.includes(mbTitleNormalized) ||
          mbTitleNormalized.includes(existingNormalized)
        ) {
          // Only match if the shorter one is at least 4 chars to avoid false positives
          const shorter =
            existingNormalized.length < mbTitleNormalized.length
              ? existingNormalized
              : mbTitleNormalized
          if (shorter.length >= 4) return true
        }

        return false
      })

      if (existingByTitle) {
        console.log(
          `[Enrich] Matched album "${existingByTitle.title}" -> MusicBrainz "${mbAlbum.title}" (${mbAlbum.id})`
        )
        // Update existing album with MusicBrainz data
        existingByTitle.merge({
          musicbrainzReleaseGroupId: mbAlbum.id,
          albumType,
          secondaryTypes: mbAlbum.secondaryTypes || [],
          releaseDate: mbAlbum.releaseDate
            ? DateTime.fromISO(mbAlbum.releaseDate)
            : existingByTitle.releaseDate,
          imageUrl: coverUrl || existingByTitle.imageUrl,
        })
        await existingByTitle.save()

        // Also match tracks for this album
        await this.matchAlbumTracks(existingByTitle)
      } else {
        // Log unmatched albums to help debug
        const unmatchedExisting = existingAlbums.filter((a) => !a.musicbrainzReleaseGroupId)
        if (unmatchedExisting.length > 0) {
          console.log(
            `[Enrich] No match for MusicBrainz album "${mbAlbum.title}" (normalized: "${mbTitleNormalized}")`
          )
          console.log(
            `[Enrich] Existing unmatched albums: ${unmatchedExisting.map((a) => `"${a.title}" (normalized: "${this.normalizeTitle(a.title)}")`).join(', ')}`
          )
        }
        // Create new album
        await Album.create({
          artistId: artist.id,
          musicbrainzReleaseGroupId: mbAlbum.id,
          title: mbAlbum.title,
          albumType,
          secondaryTypes: mbAlbum.secondaryTypes || [],
          releaseDate: mbAlbum.releaseDate ? DateTime.fromISO(mbAlbum.releaseDate) : null,
          imageUrl: coverUrl,
          requested: artist.monitored, // Auto-request new albums if artist is monitored
          anyReleaseOk: true,
        })
      }
    }

    // Update artist image with a verified album cover if not already set
    if (verifiedArtistCoverUrl && !artist.imageUrl) {
      artist.imageUrl = verifiedArtistCoverUrl
      await artist.save()
    }
  }

  /**
   * Match existing tracks with MusicBrainz track data
   */
  private async matchAlbumTracks(album: Album): Promise<void> {
    if (!album.musicbrainzReleaseGroupId) return

    try {
      const releases = await musicBrainzService.getAlbumReleases(album.musicbrainzReleaseGroupId)

      if (releases.length === 0) return

      // Use the release with the most tracks
      const release = releases.reduce((best, current) =>
        current.trackCount > best.trackCount ? current : best
      )

      // Get existing tracks for this album
      const existingTracks = await Track.query().where('albumId', album.id)

      // Match tracks from MusicBrainz to existing tracks
      let discNumber = 1
      for (const medium of release.media) {
        for (const mbTrack of medium.tracks) {
          // Try to find existing track by disc number + track number
          const existingByNumber = existingTracks.find(
            (t) => t.discNumber === discNumber && t.trackNumber === mbTrack.position
          )

          // Or by title if no exact position match
          const existingByTitle = !existingByNumber
            ? existingTracks.find(
                (t) => !t.musicbrainzId && t.title.toLowerCase() === mbTrack.title.toLowerCase()
              )
            : null

          const existing = existingByNumber || existingByTitle

          if (existing && !existing.musicbrainzId) {
            // Update existing track with MusicBrainz data
            existing.merge({
              musicbrainzId: mbTrack.id,
              title: mbTrack.title,
              trackNumber: mbTrack.position,
              discNumber: discNumber,
              durationMs: mbTrack.length || existing.durationMs,
            })
            await existing.save()
          }
        }
        discNumber++
      }
    } catch (error) {
      console.error(`Failed to match tracks for album ${album.id}:`, error)
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
}
