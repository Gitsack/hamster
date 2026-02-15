import { test } from '@japa/runner'
import MediaServerConfig from '#models/media_server_config'
import MediaServersController from '#controllers/media_servers_controller'
import { mediaServerService } from '#services/media_servers/media_server_service'

test.group('MediaServersController', (group) => {
  let server1: MediaServerConfig
  let server2: MediaServerConfig

  let originalTestConnection: typeof mediaServerService.testConnection
  let originalTriggerRefresh: typeof mediaServerService.triggerRefresh

  group.setup(async () => {
    server1 = await MediaServerConfig.create({
      name: 'MediaServerTest Plex',
      type: 'plex',
      host: '192.168.1.100',
      port: 32400,
      apiKey: 'test-api-key-12345',
      useSsl: false,
      enabled: true,
      librarySections: ['1', '2'],
    })

    server2 = await MediaServerConfig.create({
      name: 'MediaServerTest Jellyfin',
      type: 'jellyfin',
      host: '192.168.1.200',
      port: 8096,
      apiKey: 'jelly-key-67890',
      useSsl: true,
      enabled: false,
      librarySections: [],
    })

    originalTestConnection = mediaServerService.testConnection.bind(mediaServerService)
    originalTriggerRefresh = mediaServerService.triggerRefresh.bind(mediaServerService)
  })

  group.teardown(async () => {
    await MediaServerConfig.query().where('name', 'like', 'MediaServerTest%').delete()
    mediaServerService.testConnection = originalTestConnection
    mediaServerService.triggerRefresh = originalTriggerRefresh
  })

  // ---- index ----

  test('index returns list of media servers with masked API keys', async ({ assert }) => {
    const controller = new MediaServersController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((s: any) => s.name)
    assert.include(names, 'MediaServerTest Plex')
    assert.include(names, 'MediaServerTest Jellyfin')

    // Verify API key is masked
    const plex = result.find((s: any) => s.name === 'MediaServerTest Plex') as Record<
      string,
      unknown
    >
    assert.isString(plex.apiKey)
    assert.isTrue((plex.apiKey as string).includes('****'))
    assert.equal(plex.apiKey, 'test****')
  })

  test('index returns servers ordered by name', async ({ assert }) => {
    const controller = new MediaServersController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const testServers = (result as any[]).filter((s) => s.name.startsWith('MediaServerTest'))
    // Jellyfin comes before Plex alphabetically
    const jellyfinIdx = testServers.findIndex((s) => s.name === 'MediaServerTest Jellyfin')
    const plexIdx = testServers.findIndex((s) => s.name === 'MediaServerTest Plex')
    assert.isTrue(jellyfinIdx < plexIdx)
  })

  // ---- store ----

  test('store creates a new media server config', async ({ assert }) => {
    const controller = new MediaServersController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'MediaServerTest Emby',
          type: 'emby' as const,
          host: '10.0.0.50',
          port: 8920,
          apiKey: 'emby-secret-key-abc',
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
    assert.property(result, 'id')
    assert.equal(result.name, 'MediaServerTest Emby')

    // Verify API key is masked in response
    assert.isTrue((result.apiKey as string).includes('****'))
    assert.equal(result.apiKey, 'emby****')

    // Verify defaults in database
    const created = await MediaServerConfig.find(result.id as string)
    assert.isNotNull(created)
    assert.equal(created!.useSsl, false)
    assert.equal(created!.enabled, true)
    assert.deepEqual(created!.librarySections, [])

    // Verify full API key is stored
    assert.equal(created!.apiKey, 'emby-secret-key-abc')

    await created!.delete()
  })

  test('store applies provided optional fields', async ({ assert }) => {
    const controller = new MediaServersController()
    let result: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'MediaServerTest Custom',
          type: 'plex' as const,
          host: 'plex.local',
          port: 32400,
          apiKey: 'custom-key-xyz',
          useSsl: true,
          enabled: false,
          librarySections: ['3', '4', '5'],
        }),
      },
      response: {
        created(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const created = await MediaServerConfig.find(result.id as string)
    assert.isNotNull(created)
    assert.equal(created!.useSsl, true)
    assert.equal(created!.enabled, false)
    assert.deepEqual(created!.librarySections, ['3', '4', '5'])

    await created!.delete()
  })

  // ---- show ----

  test('show returns media server with masked API key', async ({ assert }) => {
    const controller = new MediaServersController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: server1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'MediaServerTest Plex')
    assert.equal(result.type, 'plex')
    assert.equal(result.host, '192.168.1.100')
    assert.equal(result.port, 32400)
    assert.isTrue((result.apiKey as string).includes('****'))
  })

  test('show returns notFound for non-existent server', async ({ assert }) => {
    const controller = new MediaServersController()
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

    assert.equal(notFoundResult.error, 'Media server not found')
  })

  // ---- update ----

  test('update modifies media server config', async ({ assert }) => {
    const toUpdate = await MediaServerConfig.create({
      name: 'MediaServerTest Update Me',
      type: 'plex',
      host: 'old.host',
      port: 32400,
      apiKey: 'old-api-key-1234',
      useSsl: false,
      enabled: true,
      librarySections: [],
    })

    const controller = new MediaServersController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({
          name: 'MediaServerTest Updated',
          type: 'jellyfin' as const,
          host: 'new.host',
          port: 8096,
          apiKey: 'new-api-key-5678',
          useSsl: true,
          enabled: false,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'MediaServerTest Updated')

    // Verify API key is masked in response
    assert.isTrue((result.apiKey as string).includes('****'))

    // Verify in database
    await toUpdate.refresh()
    assert.equal(toUpdate.name, 'MediaServerTest Updated')
    assert.equal(toUpdate.type, 'jellyfin')
    assert.equal(toUpdate.host, 'new.host')
    assert.equal(toUpdate.port, 8096)
    assert.equal(toUpdate.apiKey, 'new-api-key-5678')
    assert.equal(toUpdate.useSsl, true)
    assert.equal(toUpdate.enabled, false)

    await toUpdate.delete()
  })

  test('update preserves masked API key when masked value is sent', async ({ assert }) => {
    const toUpdate = await MediaServerConfig.create({
      name: 'MediaServerTest Mask Preserve',
      type: 'plex',
      host: 'host.local',
      port: 32400,
      apiKey: 'original-secret-key',
      useSsl: false,
      enabled: true,
      librarySections: [],
    })

    const controller = new MediaServersController()

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({
          name: 'MediaServerTest Mask Preserve',
          type: 'plex' as const,
          host: 'host.local',
          port: 32400,
          apiKey: 'orig****', // masked value
        }),
      },
      response: {
        json() {},
        notFound() {},
      },
    } as never)

    // Verify original API key is preserved
    await toUpdate.refresh()
    assert.equal(toUpdate.apiKey, 'original-secret-key')

    await toUpdate.delete()
  })

  test('update returns notFound for non-existent server', async ({ assert }) => {
    const controller = new MediaServersController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          name: 'Whatever',
          type: 'plex' as const,
          host: 'host',
          port: 32400,
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

    assert.equal(notFoundResult.error, 'Media server not found')
  })

  // ---- destroy ----

  test('destroy deletes a media server config', async ({ assert }) => {
    const toDelete = await MediaServerConfig.create({
      name: 'MediaServerTest Delete Me',
      type: 'emby',
      host: 'delete.host',
      port: 8920,
      apiKey: 'delete-key',
      useSsl: false,
      enabled: true,
      librarySections: [],
    })

    const controller = new MediaServersController()
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

    const deleted = await MediaServerConfig.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent server', async ({ assert }) => {
    const controller = new MediaServersController()
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

    assert.equal(notFoundResult.error, 'Media server not found')
  })

  // ---- test ----

  test('test returns success when connection succeeds', async ({ assert }) => {
    mediaServerService.testConnection = async () => ({
      success: true,
      name: 'My Plex Server',
    })

    const controller = new MediaServersController()
    let result: Record<string, unknown> = {}

    await controller.test({
      params: { id: server1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.success, true)
    assert.equal(result.name, 'My Plex Server')
  })

  test('test returns failure when connection fails', async ({ assert }) => {
    mediaServerService.testConnection = async () => ({
      success: false,
      error: 'Connection refused',
    })

    const controller = new MediaServersController()
    let result: Record<string, unknown> = {}

    await controller.test({
      params: { id: server1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.success, false)
    assert.equal(result.error, 'Connection refused')
  })

  test('test returns notFound for non-existent server', async ({ assert }) => {
    const controller = new MediaServersController()
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

    assert.equal(notFoundResult.error, 'Media server not found')
  })

  // ---- refresh ----

  test('refresh returns success when refresh succeeds', async ({ assert }) => {
    mediaServerService.triggerRefresh = async () => {}

    const controller = new MediaServersController()
    let result: Record<string, unknown> = {}

    await controller.refresh({
      params: { id: server1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.success, true)
  })

  test('refresh returns failure when refresh throws', async ({ assert }) => {
    mediaServerService.triggerRefresh = async () => {
      throw new Error('Plex refresh failed: HTTP 503')
    }

    const controller = new MediaServersController()
    let result: Record<string, unknown> = {}

    await controller.refresh({
      params: { id: server1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.success, false)
    assert.equal(result.error, 'Plex refresh failed: HTTP 503')
  })

  test('refresh returns notFound for non-existent server', async ({ assert }) => {
    const controller = new MediaServersController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.refresh({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Media server not found')
  })
})
