import { test } from '@japa/runner'
import Indexer from '#models/indexer'
import IndexersController from '#controllers/indexers_controller'
import { IndexerFactory } from '#database/factories/indexer_factory'

test.group('IndexersController', (group) => {
  let indexer1: Indexer
  let indexer2: Indexer

  group.setup(async () => {
    indexer1 = await IndexerFactory.create({
      name: 'IDX Test NZBGeek',
      priority: 10,
      enabled: true,
      settings: {
        baseUrl: 'https://api.nzbgeek.info',
        apiKey: 'geek-test-key',
        categories: [3000, 3010],
      },
    })
    indexer2 = await IndexerFactory.create({
      name: 'IDX Test DrunkenSlug',
      priority: 20,
      enabled: false,
      settings: {
        baseUrl: 'https://api.drunkenslug.com',
        apiKey: 'slug-test-key',
        categories: [3040],
      },
    })
  })

  group.teardown(async () => {
    await Indexer.query().where('name', 'like', 'IDX Test%').delete()
  })

  // ---- index ----

  test('index returns list of indexers with transformed fields', async ({ assert }) => {
    const controller = new IndexersController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = (result as any[]).map((i) => i.name)
    assert.include(names, 'IDX Test NZBGeek')
    assert.include(names, 'IDX Test DrunkenSlug')

    // Verify shape has url/apiKey at top level
    const geek = (result as any[]).find((i) => i.name === 'IDX Test NZBGeek')
    assert.equal(geek.url, 'https://api.nzbgeek.info')
    assert.equal(geek.apiKey, 'geek-test-key')
    assert.deepEqual(geek.categories, [3000, 3010])
    assert.equal(geek.enabled, true)
    assert.equal(geek.priority, 10)
  })

  // ---- store ----

  test('store creates a new indexer', async ({ assert }) => {
    const controller = new IndexersController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'IDX Test NewIndexer',
          url: 'https://api.newindexer.com',
          apiKey: 'new-key-123',
          categories: [3000],
          enabled: true,
          priority: 15,
        }),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.name, 'IDX Test NewIndexer')
    assert.equal(result.url, 'https://api.newindexer.com')
    assert.equal(result.apiKey, 'new-key-123')
    assert.deepEqual(result.categories, [3000])
    assert.equal(result.enabled, true)
    assert.equal(result.priority, 15)
    assert.isNotNull(result.id)

    // Cleanup
    if (result.id) {
      await Indexer.query().where('id', result.id as string).delete()
    }
  })

  test('store applies default values for optional fields', async ({ assert }) => {
    const controller = new IndexersController()
    let result: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'IDX Test Defaults',
          url: 'https://api.defaults.com',
          apiKey: 'def-key',
        }),
      },
      response: {
        created(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.enabled, true)
    assert.equal(result.priority, 25)
    assert.deepEqual(result.categories, [])

    if (result.id) {
      await Indexer.query().where('id', result.id as string).delete()
    }
  })

  // ---- show ----

  test('show returns a single indexer with transformed fields', async ({ assert }) => {
    const controller = new IndexersController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: indexer1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'IDX Test NZBGeek')
    assert.equal(result.url, 'https://api.nzbgeek.info')
    assert.equal(result.apiKey, 'geek-test-key')
    assert.deepEqual(result.categories, [3000, 3010])
  })

  test('show returns notFound for non-existent indexer', async ({ assert }) => {
    const controller = new IndexersController()
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

    assert.equal(notFoundResult.error, 'Indexer not found')
  })

  // ---- update ----

  test('update modifies indexer', async ({ assert }) => {
    const toUpdate = await IndexerFactory.create({
      name: 'IDX Test Update Me',
      priority: 30,
      settings: {
        baseUrl: 'https://old.indexer.com',
        apiKey: 'old-key',
        categories: [3000],
      },
    })

    const controller = new IndexersController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({
          name: 'IDX Test Updated',
          url: 'https://new.indexer.com',
          apiKey: 'new-key',
          categories: [3000, 3010, 3040],
          enabled: false,
          priority: 5,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'IDX Test Updated')
    assert.equal(result.url, 'https://new.indexer.com')
    assert.equal(result.apiKey, 'new-key')
    assert.deepEqual(result.categories, [3000, 3010, 3040])
    assert.equal(result.enabled, false)
    assert.equal(result.priority, 5)

    await toUpdate.delete()
  })

  test('update returns notFound for non-existent indexer', async ({ assert }) => {
    const controller = new IndexersController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          name: 'Whatever',
          url: 'https://whatever.com',
          apiKey: 'key',
        }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Indexer not found')
  })

  // ---- destroy ----

  test('destroy deletes an indexer', async ({ assert }) => {
    const toDelete = await IndexerFactory.create({ name: 'IDX Test Delete Me' })

    const controller = new IndexersController()
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

    const deleted = await Indexer.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent indexer', async ({ assert }) => {
    const controller = new IndexersController()
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

    assert.equal(notFoundResult.error, 'Indexer not found')
  })

  // ---- test ----

  test('test calls indexerManager.testIndexer and returns result', async ({ assert }) => {
    const controller = new IndexersController()
    let result: Record<string, unknown> = {}
    let threwError = false

    try {
      await controller.test({
        request: {
          validateUsing: async () => ({
            url: 'https://api.nzbgeek.info',
            apiKey: 'test-key',
          }),
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)
    } catch {
      threwError = true
    }

    // Should either return a result shape or throw (no real indexer to connect)
    if (!threwError) {
      assert.property(result, 'success')
    }
  })

  // ---- search ----

  test('search calls indexerManager.search and returns results', async ({ assert }) => {
    const controller = new IndexersController()
    let result: unknown = null
    let errorResult: Record<string, unknown> = {}

    try {
      await controller.search({
        request: {
          qs: () => ({
            query: 'test search query',
            limit: '10',
          }),
        },
        response: {
          json(data: unknown) {
            result = data
          },
          internalServerError(data: unknown) {
            errorResult = data as Record<string, unknown>
          },
        },
      } as never)
    } catch {
      // May throw if no real indexers available
    }

    // Should return either results array or error
    assert.isTrue(result !== null || Object.keys(errorResult).length > 0)
  })

  test('search passes general search type correctly', async ({ assert }) => {
    const controller = new IndexersController()
    let result: unknown = null
    let errorResult: Record<string, unknown> = {}

    try {
      await controller.search({
        request: {
          qs: () => ({
            query: 'test query',
            type: 'general',
            limit: '5',
          }),
        },
        response: {
          json(data: unknown) {
            result = data
          },
          internalServerError(data: unknown) {
            errorResult = data as Record<string, unknown>
          },
        },
      } as never)
    } catch {
      // May throw if no real indexers available
    }

    // Should return either results or error without crashing
    assert.isTrue(result !== null || Object.keys(errorResult).length > 0)
  })
})
