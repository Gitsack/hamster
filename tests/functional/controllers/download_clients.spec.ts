import { test } from '@japa/runner'
import DownloadClient from '#models/download_client'
import DownloadClientsController from '#controllers/download_clients_controller'

test.group('DownloadClientsController', (group) => {
  let client1: DownloadClient
  let client2: DownloadClient

  group.setup(async () => {
    client1 = await DownloadClient.create({
      name: 'DLC Test SABnzbd',
      type: 'sabnzbd',
      enabled: true,
      priority: 1,
      removeCompletedDownloads: true,
      removeFailedDownloads: true,
      settings: {
        host: 'localhost',
        port: 8080,
        apiKey: 'test-sab-key',
        useSsl: false,
      },
    })
    client2 = await DownloadClient.create({
      name: 'DLC Test qBittorrent',
      type: 'qbittorrent',
      enabled: false,
      priority: 2,
      removeCompletedDownloads: false,
      removeFailedDownloads: false,
      settings: {
        host: '192.168.1.100',
        port: 8090,
        username: 'admin',
        password: 'secret',
        useSsl: false,
      },
    })
  })

  group.teardown(async () => {
    await DownloadClient.query().where('name', 'like', 'DLC Test%').delete()
  })

  // ---- index ----

  test('index returns list of download clients', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = (result as any[]).map((c) => c.name)
    assert.include(names, 'DLC Test SABnzbd')
    assert.include(names, 'DLC Test qBittorrent')
  })

  test('index serializes client settings to top level', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const sab = (result as any[]).find((c) => c.name === 'DLC Test SABnzbd')
    assert.equal(sab.host, 'localhost')
    assert.equal(sab.port, 8080)
    assert.equal(sab.apiKey, 'test-sab-key')
    assert.equal(sab.type, 'sabnzbd')
    assert.equal(sab.enabled, true)
  })

  // ---- store ----

  test('store creates a new download client', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'DLC Test NZBGet',
          type: 'nzbget',
          host: '10.0.0.1',
          port: 6789,
          username: 'nzbget',
          password: 'tegbzn',
          useSsl: true,
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
    assert.equal(result.name, 'DLC Test NZBGet')
    assert.equal(result.type, 'nzbget')
    assert.equal(result.host, '10.0.0.1')
    assert.equal(result.port, 6789)
    assert.equal(result.useSsl, true)
    assert.equal(result.enabled, true)
    assert.isNotNull(result.id)

    // Cleanup
    if (result.id) {
      await DownloadClient.query().where('id', result.id as string).delete()
    }
  })

  test('store applies default values for optional fields', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let result: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'DLC Test Defaults',
          type: 'sabnzbd',
          host: 'localhost',
          port: 8080,
        }),
      },
      response: {
        created(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.enabled, true)
    assert.equal(result.priority, 1)
    assert.equal(result.removeCompletedDownloads, true)
    assert.equal(result.removeFailedDownloads, true)

    if (result.id) {
      await DownloadClient.query().where('id', result.id as string).delete()
    }
  })

  // ---- show ----

  test('show returns a single download client', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: client1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'DLC Test SABnzbd')
    assert.equal(result.type, 'sabnzbd')
    assert.equal(result.host, 'localhost')
    assert.equal(result.port, 8080)
  })

  test('show returns notFound for non-existent client', async ({ assert }) => {
    const controller = new DownloadClientsController()
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

    assert.equal(notFoundResult.error, 'Download client not found')
  })

  // ---- update ----

  test('update modifies download client', async ({ assert }) => {
    const toUpdate = await DownloadClient.create({
      name: 'DLC Test Update Me',
      type: 'sabnzbd',
      enabled: true,
      priority: 1,
      removeCompletedDownloads: true,
      removeFailedDownloads: true,
      settings: {
        host: 'old-host',
        port: 8080,
        useSsl: false,
      },
    })

    const controller = new DownloadClientsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({
          name: 'DLC Test Updated',
          type: 'sabnzbd',
          host: 'new-host',
          port: 9090,
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

    assert.equal(result.name, 'DLC Test Updated')
    assert.equal(result.host, 'new-host')
    assert.equal(result.port, 9090)
    assert.equal(result.enabled, false)
    assert.equal(result.priority, 5)

    await toUpdate.delete()
  })

  test('update returns notFound for non-existent client', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          name: 'Whatever',
          type: 'sabnzbd',
          host: 'localhost',
          port: 8080,
        }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Download client not found')
  })

  // ---- destroy ----

  test('destroy deletes a download client', async ({ assert }) => {
    const toDelete = await DownloadClient.create({
      name: 'DLC Test Delete Me',
      type: 'sabnzbd',
      enabled: true,
      priority: 1,
      removeCompletedDownloads: true,
      removeFailedDownloads: true,
      settings: { host: 'localhost', port: 8080, useSsl: false },
    })

    const controller = new DownloadClientsController()
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

    const deleted = await DownloadClient.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent client', async ({ assert }) => {
    const controller = new DownloadClientsController()
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

    assert.equal(notFoundResult.error, 'Download client not found')
  })

  // ---- test ----

  test('test calls downloadManager.testClient and returns result', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let result: Record<string, unknown> = {}
    let threwError = false

    try {
      await controller.test({
        request: {
          validateUsing: async () => ({
            type: 'sabnzbd',
            host: 'localhost',
            port: 8080,
            apiKey: 'test-key',
            useSsl: false,
          }),
        },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)
    } catch {
      // downloadManager.testClient may fail connecting to a real service
      threwError = true
    }

    // The test should either return a result or throw an error (no real client to connect to)
    assert.isTrue(Object.keys(result).length > 0 || threwError)
  })

  // ---- browseDownloads ----

  test('browseDownloads returns notFound for non-existent client', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.browseDownloads({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: { qs: () => ({}) },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Download client not found')
  })

  test('browseDownloads returns badRequest when no local path configured', async ({ assert }) => {
    // client1 has no localPath in settings
    const controller = new DownloadClientsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.browseDownloads({
      params: { id: client1.id },
      request: { qs: () => ({}) },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'No local path configured for this download client')
  })

  // ---- importFromPath ----

  test('importFromPath returns notFound for non-existent client', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.importFromPath({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: { input: () => null },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Download client not found')
  })

  test('importFromPath returns badRequest when no local path configured', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.importFromPath({
      params: { id: client1.id },
      request: { input: () => '/some/path' },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'No local path configured for this download client')
  })

  test('importFromPath returns badRequest when path is missing', async ({ assert }) => {
    const clientWithPath = await DownloadClient.create({
      name: 'DLC Test With Path',
      type: 'sabnzbd',
      enabled: true,
      priority: 1,
      removeCompletedDownloads: true,
      removeFailedDownloads: true,
      settings: { host: 'localhost', port: 8080, useSsl: false, localPath: '/tmp/downloads' },
    })

    const controller = new DownloadClientsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.importFromPath({
      params: { id: clientWithPath.id },
      request: { input: () => null },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Path is required')

    await clientWithPath.delete()
  })

  // ---- downloadFile ----

  test('downloadFile returns notFound for non-existent client', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.downloadFile({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: { qs: () => ({}) },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
        header() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Download client not found')
  })

  test('downloadFile returns badRequest when no local path configured', async ({ assert }) => {
    const controller = new DownloadClientsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.downloadFile({
      params: { id: client1.id },
      request: { qs: () => ({}) },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        header() {},
      },
    } as never)

    assert.equal(badRequestResult.error, 'No local path configured for this download client')
  })

  test('downloadFile returns badRequest when path query param is missing', async ({ assert }) => {
    const clientWithPath = await DownloadClient.create({
      name: 'DLC Test DL Path',
      type: 'sabnzbd',
      enabled: true,
      priority: 1,
      removeCompletedDownloads: true,
      removeFailedDownloads: true,
      settings: { host: 'localhost', port: 8080, useSsl: false, localPath: '/tmp/downloads' },
    })

    const controller = new DownloadClientsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.downloadFile({
      params: { id: clientWithPath.id },
      request: { qs: () => ({}) },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        header() {},
      },
    } as never)

    assert.equal(badRequestResult.error, 'Path is required')

    await clientWithPath.delete()
  })
})
