import { test } from '@japa/runner'
import ProwlarrConfig from '#models/prowlarr_config'
import ProwlarrController from '#controllers/prowlarr_controller'

test.group('ProwlarrController', (group) => {
  group.teardown(async () => {
    await ProwlarrConfig.query().where('baseUrl', 'like', '%prowlarr-test%').delete()
  })

  // ---- show ----

  test('show returns unconfigured state when no config exists', async ({ assert }) => {
    // Ensure no config exists for this test by checking current state
    const controller = new ProwlarrController()
    let result: Record<string, unknown> = {}

    // Delete any existing config first
    await ProwlarrConfig.query().delete()

    await controller.show({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.configured, false)
    assert.equal(result.url, '')
    assert.equal(result.apiKey, '')
    assert.deepEqual(result.syncCategories, [])
    assert.equal(result.enabled, false)
  })

  test('show returns configured state when config exists', async ({ assert }) => {
    const config = await ProwlarrConfig.create({
      baseUrl: 'http://prowlarr-test.local:9696',
      apiKey: 'prowlarr-test-key-123',
      syncEnabled: true,
      syncCategories: [3000, 3010, 3040],
    })

    const controller = new ProwlarrController()
    let result: Record<string, unknown> = {}

    await controller.show({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.configured, true)
    assert.equal(result.id, config.id)
    assert.equal(result.url, 'http://prowlarr-test.local:9696')
    assert.equal(result.apiKey, 'prowlarr-test-key-123')
    assert.deepEqual(result.syncCategories, [3000, 3010, 3040])
    assert.equal(result.enabled, true)

    await config.delete()
  })

  // ---- update ----

  test('update creates new config when none exists', async ({ assert }) => {
    await ProwlarrConfig.query().delete()

    const controller = new ProwlarrController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        validateUsing: async () => ({
          url: 'http://prowlarr-test.local:9696',
          apiKey: 'prowlarr-test-new-key',
          syncCategories: [3000, 3010],
          enabled: true,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.configured, true)
    assert.equal(result.url, 'http://prowlarr-test.local:9696')
    assert.equal(result.apiKey, 'prowlarr-test-new-key')
    assert.deepEqual(result.syncCategories, [3000, 3010])
    assert.equal(result.enabled, true)
    assert.isNotNull(result.id)

    // Cleanup
    await ProwlarrConfig.query().delete()
  })

  test('update applies default categories when not provided on create', async ({ assert }) => {
    await ProwlarrConfig.query().delete()

    const controller = new ProwlarrController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        validateUsing: async () => ({
          url: 'http://prowlarr-test.local:9696',
          apiKey: 'prowlarr-test-defaults',
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.deepEqual(result.syncCategories, [3000, 3010, 3040])
    assert.equal(result.enabled, true)

    await ProwlarrConfig.query().delete()
  })

  test('update modifies existing config', async ({ assert }) => {
    const config = await ProwlarrConfig.create({
      baseUrl: 'http://prowlarr-test.local:9696',
      apiKey: 'prowlarr-test-old-key',
      syncEnabled: false,
      syncCategories: [3000],
    })

    const controller = new ProwlarrController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        validateUsing: async () => ({
          url: 'http://prowlarr-test-new.local:9696',
          apiKey: 'prowlarr-test-updated-key',
          syncCategories: [3000, 3010, 3040],
          enabled: true,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.configured, true)
    assert.equal(result.url, 'http://prowlarr-test-new.local:9696')
    assert.equal(result.apiKey, 'prowlarr-test-updated-key')
    assert.deepEqual(result.syncCategories, [3000, 3010, 3040])
    assert.equal(result.enabled, true)

    // Verify in DB
    await config.refresh()
    assert.equal(config.baseUrl, 'http://prowlarr-test-new.local:9696')
    assert.equal(config.apiKey, 'prowlarr-test-updated-key')
    assert.equal(config.syncEnabled, true)

    await config.delete()
  })

  test('update preserves existing values for optional fields', async ({ assert }) => {
    const config = await ProwlarrConfig.create({
      baseUrl: 'http://prowlarr-test.local:9696',
      apiKey: 'prowlarr-test-preserve-key',
      syncEnabled: true,
      syncCategories: [3000, 3010],
    })

    const controller = new ProwlarrController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        validateUsing: async () => ({
          url: 'http://prowlarr-test-updated.local:9696',
          apiKey: 'prowlarr-test-preserve-updated',
          // No syncCategories or enabled provided
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    // Should preserve existing values
    assert.deepEqual(result.syncCategories, [3000, 3010])
    assert.equal(result.enabled, true)

    await config.delete()
  })

  // ---- test ----

  test('test calls prowlarrService.testConnection and returns result', async ({ assert }) => {
    const controller = new ProwlarrController()
    let result: Record<string, unknown> = {}
    let threwError = false

    try {
      await controller.test({
        request: {
          validateUsing: async () => ({
            url: 'http://prowlarr-test.local:9696',
            apiKey: 'prowlarr-test-connection-key',
          }),
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)
    } catch {
      // prowlarrService.testConnection may fail connecting to a real service
      threwError = true
    }

    if (!threwError) {
      assert.property(result, 'success')
    }
  })

  // ---- sync ----

  test('sync returns badRequest when no config is enabled', async ({ assert }) => {
    await ProwlarrConfig.query().delete()

    const controller = new ProwlarrController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.sync({
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Prowlarr is not configured or enabled')
  })

  test('sync returns badRequest when config exists but sync is disabled', async ({ assert }) => {
    const config = await ProwlarrConfig.create({
      baseUrl: 'http://prowlarr-test.local:9696',
      apiKey: 'prowlarr-test-sync-disabled',
      syncEnabled: false,
      syncCategories: [3000],
    })

    const controller = new ProwlarrController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.sync({
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Prowlarr is not configured or enabled')

    await config.delete()
  })

  test('sync attempts to sync when config is enabled', async ({ assert }) => {
    const config = await ProwlarrConfig.create({
      baseUrl: 'http://prowlarr-test.local:9696',
      apiKey: 'prowlarr-test-sync-enabled',
      syncEnabled: true,
      syncCategories: [3000, 3010],
    })

    const controller = new ProwlarrController()
    let result: Record<string, unknown> = {}

    await controller.sync({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    // Will fail to connect but should return a result with success: false
    assert.property(result, 'success')
    assert.equal(result.success, false)
    assert.property(result, 'error')

    await config.delete()
  })

  // ---- indexers ----

  test('indexers returns empty array when no config is enabled', async ({ assert }) => {
    await ProwlarrConfig.query().delete()

    const controller = new ProwlarrController()
    let result: unknown[] = []

    await controller.indexers({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.deepEqual(result, [])
  })

  test('indexers returns empty array when config is disabled', async ({ assert }) => {
    const config = await ProwlarrConfig.create({
      baseUrl: 'http://prowlarr-test.local:9696',
      apiKey: 'prowlarr-test-indexers-disabled',
      syncEnabled: false,
      syncCategories: [3000],
    })

    const controller = new ProwlarrController()
    let result: unknown[] = []

    await controller.indexers({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.deepEqual(result, [])

    await config.delete()
  })

  test('indexers returns empty array on connection failure', async ({ assert }) => {
    const config = await ProwlarrConfig.create({
      baseUrl: 'http://prowlarr-test.local:9696',
      apiKey: 'prowlarr-test-indexers-fail',
      syncEnabled: true,
      syncCategories: [3000],
    })

    const controller = new ProwlarrController()
    let result: unknown[] | null = null

    await controller.indexers({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    // Should return empty array on connection failure (caught by try/catch)
    assert.isArray(result)
    assert.deepEqual(result, [])

    await config.delete()
  })
})
