import { test } from '@japa/runner'
import Webhook from '#models/webhook'
import WebhooksController from '#controllers/webhooks_controller'

test.group('WebhooksController', (group) => {
  let webhook1: Webhook
  let webhook2: Webhook

  group.setup(async () => {
    webhook1 = await Webhook.create({
      name: 'Webhook Test Alpha',
      url: 'https://example.com/webhook/alpha',
      enabled: true,
      method: 'POST',
      events: [],
      headers: { 'X-Custom': 'test' },
      payloadTemplate: null,
      onGrab: true,
      onDownloadComplete: true,
      onImportComplete: true,
      onImportFailed: true,
      onUpgrade: false,
      onRename: false,
      onDelete: false,
      onHealthIssue: true,
      onHealthRestored: false,
    })
    webhook2 = await Webhook.create({
      name: 'Webhook Test Beta',
      url: 'https://example.com/webhook/beta',
      enabled: false,
      method: 'GET',
      events: [],
      headers: null,
      payloadTemplate: null,
      onGrab: false,
      onDownloadComplete: false,
      onImportComplete: false,
      onImportFailed: false,
      onUpgrade: false,
      onRename: false,
      onDelete: false,
      onHealthIssue: false,
      onHealthRestored: false,
    })
  })

  group.teardown(async () => {
    await Webhook.query().whereIn('id', [webhook1.id, webhook2.id]).delete()
    await Webhook.query().where('name', 'like', 'Webhook Test%').delete()
  })

  // ---- index ----

  test('index returns list of webhooks', async ({ assert }) => {
    const controller = new WebhooksController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((w: any) => w.name)
    assert.include(names, 'Webhook Test Alpha')
    assert.include(names, 'Webhook Test Beta')
  })

  test('index returns webhooks ordered by name', async ({ assert }) => {
    const controller = new WebhooksController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const testWebhooks = (result as any[]).filter((w) => w.name.startsWith('Webhook Test'))
    const names = testWebhooks.map((w: any) => w.name)
    const sorted = [...names].sort()
    assert.deepEqual(names, sorted)
  })

  // ---- store ----

  test('store creates a new webhook', async ({ assert }) => {
    const controller = new WebhooksController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'Webhook Test New',
          url: 'https://example.com/webhook/new',
          enabled: true,
          method: 'POST' as const,
          headers: { Authorization: 'Bearer token' },
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
    assert.equal(result.name, 'Webhook Test New')
    assert.equal(result.url, 'https://example.com/webhook/new')
    assert.equal(result.method, 'POST')
    assert.isNotNull(result.id)

    // Cleanup
    if (result.id) {
      await Webhook.query().where('id', result.id as string).delete()
    }
  })

  test('store applies default values', async ({ assert }) => {
    const controller = new WebhooksController()
    let result: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'Webhook Test Defaults',
          url: 'https://example.com/webhook/defaults',
        }),
      },
      response: {
        created(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.enabled, true)
    assert.equal(result.method, 'POST')
    assert.equal(result.onGrab, true)
    assert.equal(result.onDownloadComplete, true)
    assert.equal(result.onRename, false)
    assert.equal(result.onDelete, false)

    // Cleanup
    if (result.id) {
      await Webhook.query().where('id', result.id as string).delete()
    }
  })

  // ---- show ----

  test('show returns webhook details', async ({ assert }) => {
    const controller = new WebhooksController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: webhook1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'Webhook Test Alpha')
    assert.equal(result.url, 'https://example.com/webhook/alpha')
    assert.equal(result.method, 'POST')
    assert.equal(result.enabled, true)
  })

  test('show returns notFound for non-existent webhook', async ({ assert }) => {
    const controller = new WebhooksController()
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

    assert.property(notFoundResult, 'error')
  })

  // ---- update ----

  test('update modifies webhook', async ({ assert }) => {
    const toUpdate = await Webhook.create({
      name: 'Webhook Test Update Me',
      url: 'https://example.com/webhook/old',
      enabled: true,
      method: 'POST',
      events: [],
      headers: null,
      payloadTemplate: null,
      onGrab: true,
      onDownloadComplete: true,
      onImportComplete: true,
      onImportFailed: true,
      onUpgrade: false,
      onRename: false,
      onDelete: false,
      onHealthIssue: false,
      onHealthRestored: false,
    })

    const controller = new WebhooksController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({
          name: 'Webhook Test Updated',
          url: 'https://example.com/webhook/updated',
          enabled: false,
          method: 'PUT' as const,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'Webhook Test Updated')
    assert.equal(result.url, 'https://example.com/webhook/updated')
    assert.equal(result.enabled, false)
    assert.equal(result.method, 'PUT')

    // Verify in database
    await toUpdate.refresh()
    assert.equal(toUpdate.name, 'Webhook Test Updated')

    await toUpdate.delete()
  })

  test('update returns notFound for non-existent webhook', async ({ assert }) => {
    const controller = new WebhooksController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          name: 'Whatever',
          url: 'https://example.com',
        }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- destroy ----

  test('destroy deletes a webhook', async ({ assert }) => {
    const toDelete = await Webhook.create({
      name: 'Webhook Test Delete Me',
      url: 'https://example.com/webhook/delete',
      enabled: true,
      method: 'POST',
      events: [],
      headers: null,
      payloadTemplate: null,
      onGrab: false,
      onDownloadComplete: false,
      onImportComplete: false,
      onImportFailed: false,
      onUpgrade: false,
      onRename: false,
      onDelete: false,
      onHealthIssue: false,
      onHealthRestored: false,
    })

    const controller = new WebhooksController()
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

    const deleted = await Webhook.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent webhook', async ({ assert }) => {
    const controller = new WebhooksController()
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

    assert.property(notFoundResult, 'error')
  })

  // ---- test ----

  test('test returns notFound for non-existent webhook', async ({ assert }) => {
    const controller = new WebhooksController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.test({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- history ----

  test('history returns webhook history', async ({ assert }) => {
    const controller = new WebhooksController()
    let result: unknown = null

    await controller.history({
      params: { id: webhook1.id },
      request: {
        qs() {
          return { limit: '10', offset: '0' }
        },
      },
      response: {
        json(data: unknown) {
          result = data
        },
      },
    } as never)

    assert.isNotNull(result)
  })

  // ---- clearHistory ----

  test('clearHistory returns notFound for non-existent webhook', async ({ assert }) => {
    const controller = new WebhooksController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.clearHistory({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        noContent() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  test('clearHistory clears history for existing webhook', async ({ assert }) => {
    const controller = new WebhooksController()
    let noContentCalled = false

    await controller.clearHistory({
      params: { id: webhook1.id },
      response: {
        noContent() {
          noContentCalled = true
        },
        notFound() {},
      },
    } as never)

    assert.isTrue(noContentCalled)
  })
})
