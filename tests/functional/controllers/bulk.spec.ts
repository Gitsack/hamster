import { test } from '@japa/runner'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import BulkController from '#controllers/bulk_controller'
import { MovieFactory } from '../../../database/factories/movie_factory.js'
import { TvShowFactory } from '../../../database/factories/tv_show_factory.js'

test.group('BulkController', (group) => {
  const movieIds: string[] = []
  const tvShowIds: string[] = []

  group.teardown(async () => {
    if (movieIds.length > 0) {
      await Movie.query().whereIn('id', movieIds).delete()
    }
    await Movie.query().where('title', 'like', 'Bulk Test%').delete()
    if (tvShowIds.length > 0) {
      await TvShow.query().whereIn('id', tvShowIds).delete()
    }
    await TvShow.query().where('title', 'like', 'Bulk Test%').delete()
  })

  // ---- movies: delete ----

  test('movies bulk delete removes movies', async ({ assert }) => {
    const m1 = await MovieFactory.create({ title: 'Bulk Test Delete 1' })
    const m2 = await MovieFactory.create({ title: 'Bulk Test Delete 2' })

    const controller = new BulkController()
    let result: Record<string, unknown> = {}

    await controller.movies({
      request: {
        validateUsing: async () => ({
          ids: [m1.id, m2.id],
          action: 'delete' as const,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        unprocessableEntity() {},
      },
    } as never)

    assert.equal(result.processed, 2)
    assert.deepEqual(result.errors, [])

    const deleted1 = await Movie.find(m1.id)
    const deleted2 = await Movie.find(m2.id)
    assert.isNull(deleted1)
    assert.isNull(deleted2)
  })

  // ---- movies: request ----

  test('movies bulk request sets requested to true', async ({ assert }) => {
    const m1 = await MovieFactory.create({ title: 'Bulk Test Request 1', requested: false })
    const m2 = await MovieFactory.create({ title: 'Bulk Test Request 2', requested: false })
    movieIds.push(m1.id, m2.id)

    const controller = new BulkController()
    let result: Record<string, unknown> = {}

    await controller.movies({
      request: {
        validateUsing: async () => ({
          ids: [m1.id, m2.id],
          action: 'request' as const,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        unprocessableEntity() {},
      },
    } as never)

    assert.equal(result.processed, 2)
    assert.deepEqual(result.errors, [])

    await m1.refresh()
    await m2.refresh()
    assert.isTrue(m1.requested)
    assert.isTrue(m2.requested)
  })

  // ---- movies: unrequest ----

  test('movies bulk unrequest sets requested to false', async ({ assert }) => {
    const m1 = await MovieFactory.create({ title: 'Bulk Test Unrequest 1', requested: true })
    movieIds.push(m1.id)

    const controller = new BulkController()
    let result: Record<string, unknown> = {}

    await controller.movies({
      request: {
        validateUsing: async () => ({
          ids: [m1.id],
          action: 'unrequest' as const,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        unprocessableEntity() {},
      },
    } as never)

    assert.equal(result.processed, 1)

    await m1.refresh()
    assert.isFalse(m1.requested)
  })

  // ---- movies: updateQualityProfile without qualityProfileId ----

  test('movies updateQualityProfile returns unprocessableEntity when qualityProfileId missing', async ({
    assert,
  }) => {
    const controller = new BulkController()
    let unprocessableResult: Record<string, unknown> = {}

    await controller.movies({
      request: {
        validateUsing: async () => ({
          ids: ['some-id'],
          action: 'updateQualityProfile' as const,
        }),
      },
      response: {
        json() {},
        unprocessableEntity(data: unknown) {
          unprocessableResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = unprocessableResult.error as Record<string, string>
    assert.equal(error.code, 'VALIDATION_ERROR')
  })

  // ---- movies: not found ids produce errors ----

  test('movies bulk action reports errors for non-existent ids', async ({ assert }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const controller = new BulkController()
    let result: Record<string, unknown> = {}

    await controller.movies({
      request: {
        validateUsing: async () => ({
          ids: [fakeId],
          action: 'request' as const,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        unprocessableEntity() {},
      },
    } as never)

    assert.equal(result.processed, 0)
    const errors = result.errors as string[]
    assert.isTrue(errors.length >= 1)
    assert.isTrue(errors[0].includes(fakeId))
  })

  // ---- tvshows: delete ----

  test('tvshows bulk delete removes tv shows', async ({ assert }) => {
    const s1 = await TvShowFactory.create({ title: 'Bulk Test TV Delete 1' })
    const s2 = await TvShowFactory.create({ title: 'Bulk Test TV Delete 2' })

    const controller = new BulkController()
    let result: Record<string, unknown> = {}

    await controller.tvshows({
      request: {
        validateUsing: async () => ({
          ids: [s1.id, s2.id],
          action: 'delete' as const,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        unprocessableEntity() {},
      },
    } as never)

    assert.equal(result.processed, 2)
    assert.deepEqual(result.errors, [])

    const deleted1 = await TvShow.find(s1.id)
    const deleted2 = await TvShow.find(s2.id)
    assert.isNull(deleted1)
    assert.isNull(deleted2)
  })

  // ---- tvshows: request ----

  test('tvshows bulk request sets requested to true', async ({ assert }) => {
    const s1 = await TvShowFactory.create({ title: 'Bulk Test TV Request 1', requested: false })
    tvShowIds.push(s1.id)

    const controller = new BulkController()
    let result: Record<string, unknown> = {}

    await controller.tvshows({
      request: {
        validateUsing: async () => ({
          ids: [s1.id],
          action: 'request' as const,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        unprocessableEntity() {},
      },
    } as never)

    assert.equal(result.processed, 1)

    await s1.refresh()
    assert.isTrue(s1.requested)
  })

  // ---- tvshows: updateQualityProfile without qualityProfileId ----

  test('tvshows updateQualityProfile returns unprocessableEntity when qualityProfileId missing', async ({
    assert,
  }) => {
    const controller = new BulkController()
    let unprocessableResult: Record<string, unknown> = {}

    await controller.tvshows({
      request: {
        validateUsing: async () => ({
          ids: ['some-id'],
          action: 'updateQualityProfile' as const,
        }),
      },
      response: {
        json() {},
        unprocessableEntity(data: unknown) {
          unprocessableResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = unprocessableResult.error as Record<string, string>
    assert.equal(error.code, 'VALIDATION_ERROR')
  })

  // ---- artists: updateQualityProfile without qualityProfileId ----

  test('artists updateQualityProfile returns unprocessableEntity when qualityProfileId missing', async ({
    assert,
  }) => {
    const controller = new BulkController()
    let unprocessableResult: Record<string, unknown> = {}

    await controller.artists({
      request: {
        validateUsing: async () => ({
          ids: ['some-id'],
          action: 'updateQualityProfile' as const,
        }),
      },
      response: {
        json() {},
        unprocessableEntity(data: unknown) {
          unprocessableResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = unprocessableResult.error as Record<string, string>
    assert.equal(error.code, 'VALIDATION_ERROR')
  })

  // ---- books: updateQualityProfile without qualityProfileId ----

  test('books updateQualityProfile returns unprocessableEntity when qualityProfileId missing', async ({
    assert,
  }) => {
    const controller = new BulkController()
    let unprocessableResult: Record<string, unknown> = {}

    await controller.books({
      request: {
        validateUsing: async () => ({
          ids: ['some-id'],
          action: 'updateQualityProfile' as const,
        }),
      },
      response: {
        json() {},
        unprocessableEntity(data: unknown) {
          unprocessableResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = unprocessableResult.error as Record<string, string>
    assert.equal(error.code, 'VALIDATION_ERROR')
  })

  // ---- books: not found ids produce errors ----

  test('books bulk action reports errors for non-existent ids', async ({ assert }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const controller = new BulkController()
    let result: Record<string, unknown> = {}

    await controller.books({
      request: {
        validateUsing: async () => ({
          ids: [fakeId],
          action: 'request' as const,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        unprocessableEntity() {},
      },
    } as never)

    assert.equal(result.processed, 0)
    const errors = result.errors as string[]
    assert.isTrue(errors.length >= 1)
    assert.isTrue(errors[0].includes(fakeId))
  })
})
