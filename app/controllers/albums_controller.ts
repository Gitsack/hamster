import type { HttpContext } from '@adonisjs/core/http'
import Album from '#models/album'
import Artist from '#models/artist'
import Track from '#models/track'
import TrackFile from '#models/track_file'
import vine from '@vinejs/vine'
import { musicBrainzService } from '#services/metadata/musicbrainz_service'
import { coverArtService } from '#services/metadata/cover_art_service'
import { DateTime } from 'luxon'
import { requestedSearchTask } from '#services/tasks/requested_search_task'

const addAlbumValidator = vine.compile(
  vine.object({
    musicbrainzId: vine.string(), // Release group ID
    artistMusicbrainzId: vine.string(),
    rootFolderId: vine.string().optional(),
    qualityProfileId: vine.string(),
    requested: vine.boolean().optional(),
    searchForAlbum: vine.boolean().optional(),
  })
)

const updateAlbumValidator = vine.compile(
  vine.object({
    requested: vine.boolean().optional(),
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
          requested: album.requested,
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

      // Create artist with requested=false so we don't auto-fetch all albums
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
        requested: false, // Artist not requested - only specific albums
        qualityProfileId: data.qualityProfileId,
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
      requested: data.requested ?? true,
      anyReleaseOk: true,
    })

    // Fetch tracks from MusicBrainz
    await this.fetchAlbumTracks(album)

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
      requested: album.requested,
    })
  }

  /**
   * Fetch and create tracks for an album from MusicBrainz
   */
  private async fetchAlbumTracks(album: Album): Promise<void> {
    if (!album.musicbrainzReleaseGroupId) return

    try {
      const releases = await musicBrainzService.getAlbumReleases(album.musicbrainzReleaseGroupId)

      if (releases.length === 0) return

      // Use the release with the most tracks (usually the most complete one)
      const release = releases.reduce((best, current) =>
        current.trackCount > best.trackCount ? current : best
      )

      // Store the release ID for future reference
      if (!album.musicbrainzId) {
        album.musicbrainzId = release.id
        await album.save()
      }

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
    } catch (error) {
      console.error(`Failed to fetch tracks for album ${album.id}:`, error)
    }
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
    let album = await Album.query()
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

    // Lazy-load tracks from MusicBrainz if album has none
    if (album.tracks.length === 0 && album.musicbrainzReleaseGroupId) {
      await this.fetchAlbumTracks(album)
      // Reload tracks after fetching
      album = await Album.query()
        .where('id', params.id)
        .preload('artist')
        .preload('tracks', (trackQuery) => {
          trackQuery.orderBy('discNumber', 'asc').orderBy('trackNumber', 'asc')
        })
        .preload('trackFiles')
        .firstOrFail()
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
      requested: album.requested,
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
        downloadUrl: `/api/v1/files/tracks/${file.id}/download`,
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
      requested: data.requested ?? album.requested,
      anyReleaseOk: data.anyReleaseOk ?? album.anyReleaseOk,
    })
    await album.save()

    return response.json({
      id: album.id,
      title: album.title,
      requested: album.requested,
      anyReleaseOk: album.anyReleaseOk,
    })
  }

  /**
   * Get requested (missing) albums
   */
  async requested({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 50)

    // Get albums that are requested but have no track files
    const albums = await Album.query()
      .where('requested', true)
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
   * Search and grab the best release for an album
   */
  async searchAndDownload({ params, request, response }: HttpContext) {
    const album = await Album.query().where('id', params.id).preload('artist').first()

    if (!album) {
      return response.notFound({ error: 'Album not found' })
    }

    // Check if there's already an active download for this album
    const { default: Download } = await import('#models/download')
    const existingDownload = await Download.query()
      .where('albumId', album.id)
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
      .first()

    if (existingDownload) {
      return response.conflict({
        error: 'Album already has an active download',
        downloadId: existingDownload.id,
        status: existingDownload.status,
      })
    }

    // Check if searching for a specific track
    const trackIdParam = request.qs().trackId
    const trackId = trackIdParam ? parseInt(String(trackIdParam), 10) : null
    let searchQuery: { artist?: string; album?: string; track?: string; year?: number; limit: number }

    if (trackId && !isNaN(trackId)) {
      // Search for specific track (might find a single or EP)
      const track = await Track.find(trackId)
      if (!track) {
        return response.notFound({ error: 'Track not found' })
      }

      searchQuery = {
        artist: album.artist?.name,
        track: track.title,
        limit: 25,
      }
    } else {
      // Search for full album
      searchQuery = {
        artist: album.artist?.name,
        album: album.title,
        year: album.releaseDate?.year,
        limit: 25,
      }
    }

    try {
      const { indexerManager } = await import('#services/indexers/indexer_manager')
      const { downloadManager } = await import('#services/download_clients/download_manager')

      const results = await indexerManager.search(searchQuery)

      if (results.length === 0) {
        const searchType = trackId ? 'track' : 'album'
        return response.notFound({ error: `No releases found for this ${searchType}` })
      }

      // Sort by size (prefer larger files, usually better quality) and grab the first
      const sorted = results.sort((a, b) => b.size - a.size)
      const bestResult = sorted[0]

      const download = await downloadManager.grab({
        title: bestResult.title,
        downloadUrl: bestResult.downloadUrl,
        size: bestResult.size,
        albumId: album.id,
        indexerId: bestResult.indexerId,
        indexerName: bestResult.indexer,
        guid: bestResult.id,
      })

      return response.created({
        id: download.id,
        title: download.title,
        status: download.status,
        release: {
          title: bestResult.title,
          indexer: bestResult.indexer,
          size: bestResult.size,
        },
      })
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to search and download',
      })
    }
  }

  /**
   * Get tracks for an album by MusicBrainz ID (for search exploration)
   */
  async tracksByMbid({ params, response }: HttpContext) {
    const mbid = params.mbid

    try {
      // Get releases for this release group
      const releases = await musicBrainzService.getAlbumReleases(mbid)

      if (releases.length === 0) {
        return response.json([])
      }

      // Use the first release with the most tracks
      const bestRelease = releases.reduce((best, current) =>
        current.trackCount > best.trackCount ? current : best
      )

      // Flatten tracks from all media
      const tracks: Array<{
        musicbrainzId: string
        title: string
        position: number
        duration?: number
        artistName?: string
      }> = []

      for (const medium of bestRelease.media) {
        for (const track of medium.tracks) {
          tracks.push({
            musicbrainzId: track.id,
            title: track.title,
            position: track.position,
            duration: track.length ? Math.round(track.length / 1000) : undefined, // Convert ms to seconds
            artistName: track.artistName,
          })
        }
      }

      return response.json(tracks)
    } catch (error) {
      console.error(`Failed to get tracks for album ${mbid}:`, error)
      return response.json([])
    }
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

  /**
   * Trigger immediate search for an album
   */
  async searchNow({ params, response }: HttpContext) {
    const album = await Album.find(params.id)
    if (!album) {
      return response.notFound({ error: 'Album not found' })
    }

    try {
      const result = await requestedSearchTask.searchSingleAlbum(album.id)
      return response.json({
        found: result.found,
        grabbed: result.grabbed,
        error: result.error,
      })
    } catch (error) {
      return response.internalServerError({
        error: error instanceof Error ? error.message : 'Search failed',
      })
    }
  }
}
