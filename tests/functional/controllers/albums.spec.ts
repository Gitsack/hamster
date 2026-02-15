import { test } from '@japa/runner'
import Album from '#models/album'
import Track from '#models/track'
import TrackFile from '#models/track_file'
import AlbumsController from '#controllers/albums_controller'
import { ArtistFactory } from '../../../database/factories/artist_factory.js'
import { AlbumFactory } from '../../../database/factories/album_factory.js'
import Artist from '#models/artist'

test.group('AlbumsController', (group) => {
  let artist: Artist
  let album1: Album
  let album2: Album

  group.setup(async () => {
    artist = await ArtistFactory.create({
      name: 'Albums Test Artist',
      musicbrainzId: 'albums-test-artist-mbid',
    })

    album1 = await AlbumFactory.create({
      artistId: artist.id,
      title: 'Albums Test Alpha',
      albumType: 'album',
      requested: true,
    })

    album2 = await AlbumFactory.create({
      artistId: artist.id,
      title: 'Albums Test Beta',
      albumType: 'ep',
      requested: false,
    })

    // Create some tracks for album1
    await Track.create({
      albumId: album1.id,
      title: 'Albums Test Track 1',
      discNumber: 1,
      trackNumber: 1,
      hasFile: false,
      requested: false,
    })
    await Track.create({
      albumId: album1.id,
      title: 'Albums Test Track 2',
      discNumber: 1,
      trackNumber: 2,
      hasFile: false,
      requested: false,
    })
  })

  group.teardown(async () => {
    await TrackFile.query().whereIn('albumId', [album1.id, album2.id]).delete()
    await Track.query().whereIn('albumId', [album1.id, album2.id]).delete()
    await Album.query().where('artistId', artist.id).delete()
    await artist.delete()
  })

  // ---- index ----

  test('index returns list of albums', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: unknown[] = []

    await controller.index({
      request: {
        input: () => undefined,
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const titles = result.map((a: any) => a.title)
    assert.include(titles, 'Albums Test Alpha')
    assert.include(titles, 'Albums Test Beta')
  })

  test('index returns expected album shape', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: unknown[] = []

    await controller.index({
      request: {
        input: () => undefined,
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const album = result.find((a: any) => a.id === album1.id) as Record<string, unknown>
    assert.isNotNull(album)
    assert.equal(album.title, 'Albums Test Alpha')
    assert.equal(album.albumType, 'album')
    assert.equal(album.requested, true)
    assert.equal(album.artistName, 'Albums Test Artist')
    assert.property(album, 'trackCount')
    assert.equal(album.trackCount, 2)
    assert.property(album, 'fileCount')
    assert.equal(album.fileCount, 0)
  })

  test('index filters by artistId', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: unknown[] = []

    await controller.index({
      request: {
        input: (key: string) => (key === 'artistId' ? artist.id : undefined),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    // All returned albums should belong to the artist
    for (const a of result as any[]) {
      assert.equal(a.artistId, artist.id)
    }
    const titles = result.map((a: any) => a.title)
    assert.include(titles, 'Albums Test Alpha')
    assert.include(titles, 'Albums Test Beta')
  })

  // ---- show ----

  test('show returns album details with tracks', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: album1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, album1.id)
    assert.equal(result.title, 'Albums Test Alpha')
    assert.equal(result.artistName, 'Albums Test Artist')
    assert.property(result, 'tracks')
    const tracks = result.tracks as unknown[]
    assert.equal(tracks.length, 2)
  })

  test('show returns track shape with expected fields', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: album1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    const tracks = result.tracks as Record<string, unknown>[]
    const track = tracks.find((t) => t.title === 'Albums Test Track 1')
    assert.isNotNull(track)
    assert.property(track!, 'id')
    assert.property(track!, 'discNumber')
    assert.property(track!, 'trackNumber')
    assert.property(track!, 'hasFile')
  })

  test('show returns notFound for non-existent album', async ({ assert }) => {
    const controller = new AlbumsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.show({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Album not found')
  })

  // ---- update ----

  test('update modifies album properties', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: album2.id },
      request: {
        validateUsing: async () => ({ anyReleaseOk: false }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
        badRequest() {},
      },
    } as never)

    assert.equal(result.id, album2.id)
    assert.equal(result.anyReleaseOk, false)

    // Verify in database
    await album2.refresh()
    assert.equal(album2.anyReleaseOk, false)

    // Reset
    album2.anyReleaseOk = true
    await album2.save()
  })

  test('update returns notFound for non-existent album', async ({ assert }) => {
    const controller = new AlbumsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({ requested: true }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Album not found')
  })

  test('update unrequesting album without files deletes it', async ({ assert }) => {
    const toUnrequest = await AlbumFactory.create({
      artistId: artist.id,
      title: 'Albums Test Unrequest',
      requested: true,
    })
    const albumId = toUnrequest.id

    const controller = new AlbumsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: albumId },
      request: {
        validateUsing: async () => ({ requested: false }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
        badRequest() {},
      },
    } as never)

    assert.equal(result.deleted, true)

    const deleted = await Album.find(albumId)
    assert.isNull(deleted)
  })

  // ---- requested ----

  test('requested returns requested albums without files', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: Record<string, unknown> = {}

    await controller.requested({
      request: {
        input: (key: string, defaultVal: unknown) => {
          if (key === 'page') return 1
          if (key === 'limit') return 50
          return defaultVal
        },
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'data')
    assert.property(result, 'meta')

    const data = result.data as any[]
    const meta = result.meta as Record<string, unknown>
    assert.isArray(data)
    assert.property(meta, 'total')
    assert.property(meta, 'currentPage')

    // album1 is requested and has no files, should appear
    const found = data.find((a: any) => a.id === album1.id)
    assert.isNotNull(found)
  })

  // ---- files ----

  test('files returns empty array for album with no files', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: unknown[] = []

    await controller.files({
      params: { id: album1.id },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
        notFound() {},
      },
    } as never)

    assert.isArray(result)
    assert.equal(result.length, 0)
  })

  test('files returns notFound for non-existent album', async ({ assert }) => {
    const controller = new AlbumsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.files({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Album not found')
  })

  // ---- search ----

  test('search returns empty array when query is too short', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: unknown[] = []

    await controller.search({
      request: {
        input: (key: string) => {
          if (key === 'q') return 'a'
          return ''
        },
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isArray(result)
    assert.equal(result.length, 0)
  })

  test('search returns empty array when query is empty', async ({ assert }) => {
    const controller = new AlbumsController()
    let result: unknown[] = []

    await controller.search({
      request: {
        input: (key: string, defaultVal: string) => (key === 'q' ? '' : defaultVal),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isArray(result)
    assert.equal(result.length, 0)
  })

  // ---- store ----

  test('store returns conflict for duplicate musicbrainzId', async ({ assert }) => {
    // First create an album with a known release group ID
    const existingAlbum = await AlbumFactory.create({
      artistId: artist.id,
      title: 'Albums Test Existing',
    })
    existingAlbum.musicbrainzReleaseGroupId = 'albums-test-existing-rg'
    await existingAlbum.save()

    const controller = new AlbumsController()
    let conflictResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          musicbrainzId: 'albums-test-existing-rg',
          artistMusicbrainzId: 'albums-test-artist-mbid',
          qualityProfileId: '00000000-0000-0000-0000-000000000001',
        }),
        body: () => ({}),
      },
      response: {
        created() {},
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
        notFound() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(conflictResult.error, 'Album already exists in library')

    // Cleanup
    await existingAlbum.delete()
  })

  // ---- searchReleases ----

  test('searchReleases returns notFound for non-existent album', async ({ assert }) => {
    const controller = new AlbumsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.searchReleases({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        input: () => 100,
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Album not found')
  })

  // ---- searchAndDownload ----

  test('searchAndDownload returns notFound for non-existent album', async ({ assert }) => {
    const controller = new AlbumsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.searchAndDownload({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        qs: () => ({}),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        conflict() {},
        created() {},
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Album not found')
  })

  // ---- searchNow ----

  test('searchNow returns notFound for non-existent album', async ({ assert }) => {
    const controller = new AlbumsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.searchNow({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Album not found')
  })

  // ---- enrich ----

  test('enrich returns notFound for non-existent album', async ({ assert }) => {
    const controller = new AlbumsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.enrich({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Album not found')
  })

  test('enrich returns badRequest when album already has musicbrainz ID', async ({ assert }) => {
    const enrichedAlbum = await AlbumFactory.create({
      artistId: artist.id,
      title: 'Albums Test Already Enriched',
      musicbrainzId: 'already-has-mbid',
    })

    const controller = new AlbumsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.enrich({
      params: { id: enrichedAlbum.id },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Album already has a MusicBrainz ID')

    await enrichedAlbum.delete()
  })
})
