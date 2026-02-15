import { test } from '@japa/runner'
import BlacklistedRelease from '#models/blacklisted_release'
import BlacklistController from '#controllers/blacklist_controller'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'

test.group('BlacklistController', (group) => {
  let entry1: BlacklistedRelease
  let entry2: BlacklistedRelease
  const movieId = randomUUID()

  group.setup(async () => {
    entry1 = await BlacklistedRelease.create({
      guid: 'bl-test-guid-1',
      indexer: 'bl-test-indexer',
      title: 'Blacklist Test Release 1',
      movieId,
      reason: 'download failed',
      failureType: 'download_failed',
      blacklistedAt: DateTime.now(),
      expiresAt: DateTime.now().plus({ days: 30 }),
    })

    entry2 = await BlacklistedRelease.create({
      guid: 'bl-test-guid-2',
      indexer: 'bl-test-indexer',
      title: 'Blacklist Test Release 2',
      movieId,
      reason: 'extraction failed',
      failureType: 'extraction_failed',
      blacklistedAt: DateTime.now(),
      expiresAt: DateTime.now().plus({ days: 30 }),
    })
  })

  group.teardown(async () => {
    await BlacklistedRelease.query()
      .where('indexer', 'bl-test-indexer')
      .delete()
  })

  // ---- index (paginated, no filter) ----

  test('index returns paginated blacklist entries', async ({ assert }) => {
    const controller = new BlacklistController()
    let result: Record<string, unknown> = {}

    await controller.index({
      request: {
        input: (key: string, defaultVal: unknown) => {
          if (key === 'page') return 1
          if (key === 'limit') return 50
          if (key === 'mediaType') return undefined
          if (key === 'mediaId') return undefined
          return defaultVal
        },
        qs: () => ({}),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    const data = result.data as unknown[]
    assert.isTrue(data.length >= 2)

    const titles = data.map((e: any) => e.title)
    assert.include(titles, 'Blacklist Test Release 1')
    assert.include(titles, 'Blacklist Test Release 2')

    const meta = result.meta as Record<string, unknown>
    assert.property(meta, 'total')
  })

  // ---- index (with media filter) ----

  test('index returns entries filtered by mediaType and mediaId', async ({ assert }) => {
    const controller = new BlacklistController()
    let result: Record<string, unknown> = {}

    await controller.index({
      request: {
        input: (key: string, defaultVal: unknown) => {
          if (key === 'page') return 1
          if (key === 'limit') return 50
          if (key === 'mediaType') return 'movie'
          if (key === 'mediaId') return movieId
          return defaultVal
        },
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    const data = result.data as any[]
    assert.isTrue(data.length >= 2)

    for (const entry of data) {
      assert.equal(entry.movieId, movieId)
    }
  })

  test('index returns badRequest for invalid media type', async ({ assert }) => {
    const controller = new BlacklistController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.index({
      request: {
        input: (key: string, defaultVal: unknown) => {
          if (key === 'page') return 1
          if (key === 'limit') return 50
          if (key === 'mediaType') return 'invalid'
          if (key === 'mediaId') return randomUUID()
          return defaultVal
        },
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Invalid media type')
  })

  // ---- destroy ----

  test('destroy removes a blacklist entry', async ({ assert }) => {
    const toDelete = await BlacklistedRelease.create({
      guid: 'bl-test-guid-delete',
      indexer: 'bl-test-indexer',
      title: 'Blacklist Test Delete Me',
      reason: 'failed',
      failureType: 'download_failed',
      blacklistedAt: DateTime.now(),
      expiresAt: DateTime.now().plus({ days: 30 }),
    })

    const controller = new BlacklistController()
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

    const deleted = await BlacklistedRelease.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent entry', async ({ assert }) => {
    const controller = new BlacklistController()
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

    assert.equal(notFoundResult.error, 'Blacklist entry not found')
  })

  // ---- clearMedia ----

  test('clearMedia removes all entries for a movie', async ({ assert }) => {
    const clearMovieId = randomUUID()
    await BlacklistedRelease.create({
      guid: 'bl-test-guid-clear-1',
      indexer: 'bl-test-indexer',
      title: 'Blacklist Test Clear 1',
      movieId: clearMovieId,
      reason: 'failed',
      failureType: 'download_failed',
      blacklistedAt: DateTime.now(),
      expiresAt: DateTime.now().plus({ days: 30 }),
    })
    await BlacklistedRelease.create({
      guid: 'bl-test-guid-clear-2',
      indexer: 'bl-test-indexer',
      title: 'Blacklist Test Clear 2',
      movieId: clearMovieId,
      reason: 'failed',
      failureType: 'download_failed',
      blacklistedAt: DateTime.now(),
      expiresAt: DateTime.now().plus({ days: 30 }),
    })

    const controller = new BlacklistController()
    let result: Record<string, unknown> = {}

    await controller.clearMedia({
      params: { type: 'movie', id: clearMovieId },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.isTrue((result.deleted as number) >= 2)

    const remaining = await BlacklistedRelease.query().where('movieId', clearMovieId)
    assert.equal(remaining.length, 0)
  })

  test('clearMedia returns badRequest for invalid media type', async ({ assert }) => {
    const controller = new BlacklistController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.clearMedia({
      params: { type: 'invalid', id: randomUUID() },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Invalid media type')
  })

  test('clearMedia supports episode type', async ({ assert }) => {
    const episodeId = randomUUID()
    await BlacklistedRelease.create({
      guid: 'bl-test-guid-ep-clear',
      indexer: 'bl-test-indexer',
      title: 'Blacklist Test Episode Clear',
      episodeId,
      reason: 'failed',
      failureType: 'download_failed',
      blacklistedAt: DateTime.now(),
      expiresAt: DateTime.now().plus({ days: 30 }),
    })

    const controller = new BlacklistController()
    let result: Record<string, unknown> = {}

    await controller.clearMedia({
      params: { type: 'episode', id: episodeId },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.isTrue((result.deleted as number) >= 1)
  })

  // ---- cleanup ----

  test('cleanup removes expired entries', async ({ assert }) => {
    // Create an expired entry
    await BlacklistedRelease.create({
      guid: 'bl-test-guid-expired',
      indexer: 'bl-test-indexer',
      title: 'Blacklist Test Expired',
      reason: 'failed',
      failureType: 'download_failed',
      blacklistedAt: DateTime.now().minus({ days: 60 }),
      expiresAt: DateTime.now().minus({ days: 30 }),
    })

    const controller = new BlacklistController()
    let result: Record<string, unknown> = {}

    await controller.cleanup({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'message')
    assert.property(result, 'count')
    assert.isTrue((result.count as number) >= 1)
  })
})
