import { test } from '@japa/runner'
import Artist from '#models/artist'
import ArtistsController from '#controllers/artists_controller'
import { ArtistFactory } from '../../../database/factories/artist_factory.js'

test.group('ArtistsController', (group) => {
  let artist1: Artist
  let artist2: Artist

  group.setup(async () => {
    artist1 = await ArtistFactory.create({
      name: 'Artists Test Alpha',
      sortName: 'Artists Test Alpha',
      musicbrainzId: 'mb-test-001',
      status: 'continuing',
      requested: true,
      monitored: true,
    })
    artist2 = await ArtistFactory.create({
      name: 'Artists Test Beta',
      sortName: 'Artists Test Beta',
      musicbrainzId: 'mb-test-002',
      status: 'ended',
      requested: false,
      monitored: false,
    })
  })

  group.teardown(async () => {
    await Artist.query().whereIn('id', [artist1.id, artist2.id]).delete()
    await Artist.query().where('name', 'like', 'Artists Test%').delete()
  })

  // ---- index ----

  test('index returns list of artists', async ({ assert }) => {
    const controller = new ArtistsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((a: any) => a.name)
    assert.include(names, 'Artists Test Alpha')
    assert.include(names, 'Artists Test Beta')
  })

  test('index returns expected artist shape', async ({ assert }) => {
    const controller = new ArtistsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const artist = result.find((a: any) => a.id === artist1.id) as Record<string, unknown>
    assert.isNotNull(artist)
    assert.equal(artist.name, 'Artists Test Alpha')
    assert.equal(artist.musicbrainzId, 'mb-test-001')
    assert.equal(artist.status, 'continuing')
    assert.equal(artist.requested, true)
    assert.equal(artist.monitored, true)
  })

  // ---- show ----

  test('show returns artist details with albums', async ({ assert }) => {
    const controller = new ArtistsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: artist1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, artist1.id)
    assert.equal(result.name, 'Artists Test Alpha')
    assert.equal(result.musicbrainzId, 'mb-test-001')
    assert.isArray(result.albums)
  })

  test('show returns notFound for non-existent artist', async ({ assert }) => {
    const controller = new ArtistsController()
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

    assert.equal(notFoundResult.error, 'Artist not found')
  })

  // ---- update ----

  test('update modifies artist properties', async ({ assert }) => {
    const controller = new ArtistsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: artist2.id },
      request: {
        validateUsing: async () => ({
          requested: true,
          monitored: true,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, artist2.id)
    assert.equal(result.requested, true)
    assert.equal(result.monitored, true)

    // Verify in database
    await artist2.refresh()
    assert.equal(artist2.requested, true)
    assert.equal(artist2.monitored, true)

    // Reset
    artist2.requested = false
    artist2.monitored = false
    await artist2.save()
  })

  test('update returns notFound for non-existent artist', async ({ assert }) => {
    const controller = new ArtistsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          requested: true,
        }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Artist not found')
  })

  // ---- destroy ----

  test('destroy deletes an artist', async ({ assert }) => {
    const toDelete = await ArtistFactory.create({
      name: 'Artists Test Destroy',
      sortName: 'Artists Test Destroy',
    })

    const controller = new ArtistsController()
    let noContentCalled = false

    await controller.destroy({
      params: { id: toDelete.id },
      response: {
        noContent() {
          noContentCalled = true
        },
        notFound() {},
      },
    } as never)

    assert.isTrue(noContentCalled)

    const deleted = await Artist.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent artist', async ({ assert }) => {
    const controller = new ArtistsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        noContent() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Artist not found')
  })

  // ---- search ----

  test('search returns empty array when query is too short', async ({ assert }) => {
    const controller = new ArtistsController()
    let result: unknown[] = []

    await controller.search({
      request: {
        input: (key: string, defaultVal: string) => (key === 'q' ? 'a' : defaultVal),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.deepEqual(result, [])
  })

  test('search returns empty array when query is empty', async ({ assert }) => {
    const controller = new ArtistsController()
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

    assert.deepEqual(result, [])
  })

  // ---- enrich ----

  test('enrich returns badRequest when artist already has musicbrainzId', async ({ assert }) => {
    const controller = new ArtistsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.enrich({
      params: { id: artist1.id },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.include(badRequestResult.error as string, 'already has a MusicBrainz ID')
  })

  test('enrich returns notFound for non-existent artist', async ({ assert }) => {
    const controller = new ArtistsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.enrich({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Artist not found')
  })

  // ---- refresh ----

  test('refresh returns notFound for non-existent artist', async ({ assert }) => {
    const controller = new ArtistsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.refresh({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Artist not found')
  })

  test('refresh returns badRequest when artist has no musicbrainzId', async ({ assert }) => {
    const noMbArtist = await ArtistFactory.create({
      name: 'Artists Test No MB',
      sortName: 'Artists Test No MB',
      musicbrainzId: null,
    })

    const controller = new ArtistsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.refresh({
      params: { id: noMbArtist.id },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Artist has no MusicBrainz ID')

    await noMbArtist.delete()
  })
})
