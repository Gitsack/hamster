import { test } from '@japa/runner'
import ImportList from '#models/import_list'
import ImportListsController from '#controllers/import_lists_controller'
import { importListSyncService } from '#services/import_lists/import_list_sync'

test.group('ImportListsController', (group) => {
  let list1: ImportList
  let list2: ImportList

  group.setup(async () => {
    list1 = await ImportList.create({
      name: 'ImportListTest Trakt Watchlist',
      type: 'trakt_watchlist',
      enabled: true,
      settings: { traktUsername: 'testuser' },
      mediaType: 'movies',
      qualityProfileId: null,
      rootFolderId: null,
      autoAdd: false,
      syncIntervalMinutes: 360,
    })

    list2 = await ImportList.create({
      name: 'ImportListTest IMDb List',
      type: 'imdb_list',
      enabled: false,
      settings: { imdbListId: 'ls123456' },
      mediaType: 'tv',
      qualityProfileId: null,
      rootFolderId: null,
      autoAdd: true,
      syncIntervalMinutes: 120,
    })
  })

  group.teardown(async () => {
    await ImportList.query().where('name', 'like', 'ImportListTest%').delete()
  })

  // ---- index ----

  test('index returns list of import lists', async ({ assert }) => {
    const controller = new ImportListsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((l: any) => l.name)
    assert.include(names, 'ImportListTest Trakt Watchlist')
    assert.include(names, 'ImportListTest IMDb List')

    // Verify shape
    const list = result.find((l: any) => l.name === 'ImportListTest Trakt Watchlist') as Record<
      string,
      unknown
    >
    assert.property(list, 'id')
    assert.property(list, 'name')
    assert.property(list, 'type')
    assert.property(list, 'enabled')
    assert.property(list, 'settings')
    assert.property(list, 'mediaType')
    assert.property(list, 'autoAdd')
    assert.property(list, 'syncIntervalMinutes')
    assert.equal(list.type, 'trakt_watchlist')
    assert.equal(list.enabled, true)
    assert.equal(list.mediaType, 'movies')
  })

  // ---- store ----

  test('store creates a new import list', async ({ assert }) => {
    const controller = new ImportListsController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'ImportListTest New List',
          type: 'imdb_list' as const,
          mediaType: 'movies' as const,
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
    assert.equal(result.name, 'ImportListTest New List')
    assert.equal(result.type, 'imdb_list')
    assert.isNotNull(result.id)

    // Verify defaults in database
    const created = await ImportList.find(result.id as string)
    assert.isNotNull(created)
    assert.equal(created!.enabled, true)
    assert.equal(created!.autoAdd, false)
    assert.equal(created!.syncIntervalMinutes, 360)

    // Cleanup
    if (result.id) {
      await ImportList.query().where('id', result.id as string).delete()
    }
  })

  test('store applies provided optional fields', async ({ assert }) => {
    const controller = new ImportListsController()
    let result: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'ImportListTest Custom Options',
          type: 'trakt_list' as const,
          enabled: false,
          settings: { traktListSlug: 'my-list', traktUsername: 'user1' },
          mediaType: 'tv' as const,
          autoAdd: true,
          syncIntervalMinutes: 60,
        }),
      },
      response: {
        created(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const created = await ImportList.find(result.id as string)
    assert.isNotNull(created)
    assert.equal(created!.enabled, false)
    assert.equal(created!.autoAdd, true)
    assert.equal(created!.syncIntervalMinutes, 60)
    assert.equal(created!.mediaType, 'tv')

    // Cleanup
    await ImportList.query().where('id', result.id as string).delete()
  })

  // ---- show ----

  test('show returns import list details', async ({ assert }) => {
    const controller = new ImportListsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: list1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'ImportListTest Trakt Watchlist')
    assert.equal(result.type, 'trakt_watchlist')
    assert.equal(result.enabled, true)
    assert.equal(result.mediaType, 'movies')
    assert.property(result, 'qualityProfile')
    assert.property(result, 'rootFolder')
  })

  test('show returns notFound for non-existent list', async ({ assert }) => {
    const controller = new ImportListsController()
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

    assert.equal(notFoundResult.error, 'Import list not found')
  })

  // ---- update ----

  test('update modifies import list', async ({ assert }) => {
    const toUpdate = await ImportList.create({
      name: 'ImportListTest Update Me',
      type: 'trakt_watchlist',
      enabled: true,
      settings: {},
      mediaType: 'movies',
      qualityProfileId: null,
      rootFolderId: null,
      autoAdd: false,
      syncIntervalMinutes: 360,
    })

    const controller = new ImportListsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({
          name: 'ImportListTest Updated Name',
          type: 'imdb_list' as const,
          mediaType: 'tv' as const,
          enabled: false,
          autoAdd: true,
          syncIntervalMinutes: 30,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'ImportListTest Updated Name')
    assert.equal(result.type, 'imdb_list')

    // Verify in database
    await toUpdate.refresh()
    assert.equal(toUpdate.name, 'ImportListTest Updated Name')
    assert.equal(toUpdate.type, 'imdb_list')
    assert.equal(toUpdate.enabled, false)
    assert.equal(toUpdate.autoAdd, true)
    assert.equal(toUpdate.syncIntervalMinutes, 30)

    await toUpdate.delete()
  })

  test('update returns notFound for non-existent list', async ({ assert }) => {
    const controller = new ImportListsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          name: 'Whatever',
          type: 'imdb_list' as const,
          mediaType: 'movies' as const,
        }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Import list not found')
  })

  // ---- destroy ----

  test('destroy deletes an import list', async ({ assert }) => {
    const toDelete = await ImportList.create({
      name: 'ImportListTest Delete Me',
      type: 'imdb_list',
      enabled: true,
      settings: {},
      mediaType: 'movies',
      qualityProfileId: null,
      rootFolderId: null,
      autoAdd: false,
      syncIntervalMinutes: 360,
    })

    const controller = new ImportListsController()
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

    const deleted = await ImportList.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent list', async ({ assert }) => {
    const controller = new ImportListsController()
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

    assert.equal(notFoundResult.error, 'Import list not found')
  })

  // ---- sync ----

  test('sync triggers sync for a single list', async ({ assert }) => {
    const controller = new ImportListsController()
    let result: Record<string, unknown> = {}

    // Mock the sync service
    const originalSyncList = importListSyncService.syncList.bind(importListSyncService)
    importListSyncService.syncList = async (_list: ImportList) => ({
      listId: list1.id,
      listName: list1.name,
      itemsFound: 5,
      itemsAdded: 3,
      itemsExisting: 2,
      errors: [],
    })

    try {
      await controller.sync({
        params: { id: list1.id },
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
          notFound() {},
        },
      } as never)

      assert.equal(result.listId, list1.id)
      assert.equal(result.itemsFound, 5)
      assert.equal(result.itemsAdded, 3)
      assert.equal(result.itemsExisting, 2)
      assert.deepEqual(result.errors, [])
    } finally {
      importListSyncService.syncList = originalSyncList
    }
  })

  test('sync returns notFound for non-existent list', async ({ assert }) => {
    const controller = new ImportListsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.sync({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Import list not found')
  })

  // ---- syncAll ----

  test('syncAll triggers sync for all enabled lists', async ({ assert }) => {
    const controller = new ImportListsController()
    let result: Record<string, unknown> = {}

    // Mock the sync service
    const originalSyncAll = importListSyncService.syncAll.bind(importListSyncService)
    importListSyncService.syncAll = async () => [
      {
        listId: 'id1',
        listName: 'List 1',
        itemsFound: 10,
        itemsAdded: 4,
        itemsExisting: 6,
        errors: [],
      },
      {
        listId: 'id2',
        listName: 'List 2',
        itemsFound: 5,
        itemsAdded: 2,
        itemsExisting: 2,
        errors: ['Some error'],
      },
    ]

    try {
      await controller.syncAll({
        response: {
          json(data: unknown) {
            result = data as Record<string, unknown>
          },
        },
      } as never)

      assert.property(result, 'results')
      assert.property(result, 'totalAdded')
      assert.property(result, 'totalErrors')
      assert.equal(result.totalAdded, 6)
      assert.equal(result.totalErrors, 1)

      const results = result.results as any[]
      assert.equal(results.length, 2)
    } finally {
      importListSyncService.syncAll = originalSyncAll
    }
  })
})
