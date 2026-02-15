import { test } from '@japa/runner'
import NotificationProvider from '#models/notification_provider'
import NotificationsController from '#controllers/notifications_controller'

test.group('NotificationsController', (group) => {
  let provider1: NotificationProvider
  let provider2: NotificationProvider

  group.setup(async () => {
    provider1 = await NotificationProvider.create({
      name: 'Notif Test Discord',
      type: 'discord',
      enabled: true,
      settings: { webhookUrl: 'https://discord.com/api/webhooks/1234567890/abcdefghij' },
      onGrab: true,
      onDownloadComplete: true,
      onImportComplete: true,
      onImportFailed: true,
      onUpgrade: false,
      onRename: false,
      onDelete: false,
      onHealthIssue: true,
      onHealthRestored: false,
      includeMusic: true,
      includeMovies: true,
      includeTv: true,
      includeBooks: false,
    })
    provider2 = await NotificationProvider.create({
      name: 'Notif Test Telegram',
      type: 'telegram',
      enabled: false,
      settings: { botToken: 'bot123456:ABC-DEF', chatId: '999888' },
      onGrab: false,
      onDownloadComplete: false,
      onImportComplete: false,
      onImportFailed: false,
      onUpgrade: false,
      onRename: false,
      onDelete: false,
      onHealthIssue: false,
      onHealthRestored: false,
      includeMusic: true,
      includeMovies: true,
      includeTv: true,
      includeBooks: true,
    })
  })

  group.teardown(async () => {
    await NotificationProvider.query()
      .whereIn('id', [provider1.id, provider2.id])
      .delete()
    await NotificationProvider.query().where('name', 'like', 'Notif Test%').delete()
  })

  // ---- index ----

  test('index returns list of notification providers', async ({ assert }) => {
    const controller = new NotificationsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((p: any) => p.name)
    assert.include(names, 'Notif Test Discord')
    assert.include(names, 'Notif Test Telegram')
  })

  test('index masks sensitive settings', async ({ assert }) => {
    const controller = new NotificationsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const discord = result.find((p: any) => p.name === 'Notif Test Discord') as Record<
      string,
      any
    >
    assert.isNotNull(discord)
    // webhookUrl should be masked
    assert.include(discord.settings.webhookUrl, '****')

    const telegram = result.find((p: any) => p.name === 'Notif Test Telegram') as Record<
      string,
      any
    >
    assert.isNotNull(telegram)
    // botToken should be masked
    assert.include(telegram.settings.botToken, '****')
  })

  // ---- store ----

  test('store creates a new notification provider', async ({ assert }) => {
    const controller = new NotificationsController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'Notif Test Slack',
          type: 'slack' as const,
          enabled: true,
          settings: { webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
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
    assert.equal(result.name, 'Notif Test Slack')
    assert.equal(result.type, 'slack')
    assert.isNotNull(result.id)

    // Cleanup
    if (result.id) {
      await NotificationProvider.query().where('id', result.id as string).delete()
    }
  })

  // ---- show ----

  test('show returns notification provider', async ({ assert }) => {
    const controller = new NotificationsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: provider1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'Notif Test Discord')
    assert.equal(result.type, 'discord')
    assert.property(result, 'settings')
  })

  test('show masks sensitive settings', async ({ assert }) => {
    const controller = new NotificationsController()
    let result: Record<string, any> = {}

    await controller.show({
      params: { id: provider1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, any>
        },
        notFound() {},
      },
    } as never)

    assert.include(result.settings.webhookUrl, '****')
  })

  test('show returns notFound for non-existent provider', async ({ assert }) => {
    const controller = new NotificationsController()
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

  test('update modifies notification provider', async ({ assert }) => {
    const toUpdate = await NotificationProvider.create({
      name: 'Notif Test Update Me',
      type: 'ntfy',
      enabled: true,
      settings: { topic: 'test-topic', password: 'secret123' },
      onGrab: false,
      onDownloadComplete: false,
      onImportComplete: false,
      onImportFailed: false,
      onUpgrade: false,
      onRename: false,
      onDelete: false,
      onHealthIssue: false,
      onHealthRestored: false,
      includeMusic: true,
      includeMovies: true,
      includeTv: true,
      includeBooks: true,
    })

    const controller = new NotificationsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({
          name: 'Notif Test Updated',
          type: 'ntfy' as const,
          enabled: false,
          settings: { topic: 'new-topic', password: 'newsecret' },
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'Notif Test Updated')
    assert.equal(result.enabled, false)

    await toUpdate.delete()
  })

  test('update returns notFound for non-existent provider', async ({ assert }) => {
    const controller = new NotificationsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          name: 'Whatever',
          type: 'discord' as const,
          settings: { webhookUrl: 'https://example.com' },
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

  test('destroy deletes a notification provider', async ({ assert }) => {
    const toDelete = await NotificationProvider.create({
      name: 'Notif Test Delete Me',
      type: 'gotify',
      enabled: true,
      settings: { serverUrl: 'https://gotify.example.com', appToken: 'token123' },
      onGrab: false,
      onDownloadComplete: false,
      onImportComplete: false,
      onImportFailed: false,
      onUpgrade: false,
      onRename: false,
      onDelete: false,
      onHealthIssue: false,
      onHealthRestored: false,
      includeMusic: true,
      includeMovies: true,
      includeTv: true,
      includeBooks: true,
    })

    const controller = new NotificationsController()
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

    const deleted = await NotificationProvider.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent provider', async ({ assert }) => {
    const controller = new NotificationsController()
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

  test('test returns notFound for non-existent provider', async ({ assert }) => {
    const controller = new NotificationsController()
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

  // ---- types ----

  test('types returns list of available provider types', async ({ assert }) => {
    const controller = new NotificationsController()
    let result: unknown[] = []

    await controller.types({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 7)
    const types = result.map((t: any) => t.type)
    assert.include(types, 'discord')
    assert.include(types, 'telegram')
    assert.include(types, 'pushover')
    assert.include(types, 'slack')
    assert.include(types, 'gotify')
    assert.include(types, 'email')
    assert.include(types, 'ntfy')
  })

  test('types returns fields for each provider type', async ({ assert }) => {
    const controller = new NotificationsController()
    let result: unknown[] = []

    await controller.types({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    for (const providerType of result as any[]) {
      assert.property(providerType, 'type')
      assert.property(providerType, 'name')
      assert.property(providerType, 'fields')
      assert.isArray(providerType.fields)
      assert.isTrue(providerType.fields.length > 0)

      for (const field of providerType.fields) {
        assert.property(field, 'name')
        assert.property(field, 'label')
        assert.property(field, 'type')
        assert.property(field, 'required')
      }
    }
  })

  // ---- history ----

  test('history returns notification history', async ({ assert }) => {
    const controller = new NotificationsController()
    let result: unknown = null

    await controller.history({
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

  test('history accepts providerId filter', async ({ assert }) => {
    const controller = new NotificationsController()
    let result: unknown = null

    await controller.history({
      request: {
        qs() {
          return { providerId: provider1.id, limit: '5', offset: '0' }
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
})
