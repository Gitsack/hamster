import { test } from '@japa/runner'
import Track from '#models/track'
import Album from '#models/album'
import Artist from '#models/artist'
import TracksController from '#controllers/tracks_controller'
import { ArtistFactory } from '../../../database/factories/artist_factory.js'
import { AlbumFactory } from '../../../database/factories/album_factory.js'

test.group('TracksController', (group) => {
  let artist: Artist
  let album: Album
  let track1: Track
  let track2: Track

  group.setup(async () => {
    artist = await ArtistFactory.create({
      name: 'Tracks Test Artist',
      musicbrainzId: 'tracks-test-artist-mbid',
    })

    album = await AlbumFactory.create({
      artistId: artist.id,
      title: 'Tracks Test Album',
    })

    track1 = await Track.create({
      albumId: album.id,
      musicbrainzId: 'tracks-test-recording-001',
      title: 'Tracks Test Song Alpha',
      discNumber: 1,
      trackNumber: 1,
      durationMs: 240000,
      hasFile: false,
      requested: false,
    })

    track2 = await Track.create({
      albumId: album.id,
      musicbrainzId: 'tracks-test-recording-002',
      title: 'Tracks Test Song Beta',
      discNumber: 1,
      trackNumber: 2,
      durationMs: 180000,
      hasFile: false,
      requested: false,
    })
  })

  group.teardown(async () => {
    await Track.query().where('albumId', album.id).delete()
    await Album.query().where('id', album.id).delete()
    await artist.delete()
  })

  // ---- search ----

  test('search returns empty array when query is too short', async ({ assert }) => {
    const controller = new TracksController()
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
    const controller = new TracksController()
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

  test('search returns empty array when query is missing', async ({ assert }) => {
    const controller = new TracksController()
    let result: unknown[] = []

    await controller.search({
      request: {
        input: (_key: string, defaultVal: string) => defaultVal,
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

  test('search accepts artist parameter without error', async ({ assert }) => {
    const controller = new TracksController()
    let result: unknown[] = []

    // Query is too short, should still return empty array without error
    await controller.search({
      request: {
        input: (key: string) => {
          if (key === 'q') return 'x'
          if (key === 'artist') return 'Some Artist'
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
})
