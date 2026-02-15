import { test } from '@japa/runner'
import UnmatchedFile from '#models/unmatched_file'
import RootFolder from '#models/root_folder'
import UnmatchedFilesController from '#controllers/unmatched_files_controller'

test.group('UnmatchedFilesController', (group) => {
  let rootFolder: RootFolder
  let file1: UnmatchedFile
  let file2: UnmatchedFile
  let file3: UnmatchedFile

  group.setup(async () => {
    rootFolder = await RootFolder.create({
      name: 'UnmatchedTest Root',
      path: '/tmp/unmatched-test',
      mediaType: 'movies',
      accessible: true,
      scanStatus: 'idle',
    })

    file1 = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'unknown_movie.mkv',
      fileName: 'unknown_movie.mkv',
      mediaType: 'movies',
      fileSizeBytes: 1024000,
      status: 'pending',
    })

    file2 = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'unknown_episode.mkv',
      fileName: 'unknown_episode.mkv',
      mediaType: 'tv',
      fileSizeBytes: 2048000,
      status: 'pending',
    })

    file3 = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'ignored_file.mkv',
      fileName: 'ignored_file.mkv',
      mediaType: 'movies',
      fileSizeBytes: 512000,
      status: 'ignored',
    })
  })

  group.teardown(async () => {
    await UnmatchedFile.query().where('rootFolderId', rootFolder.id).delete()
    await rootFolder.delete()
  })

  // ---- index ----

  test('index returns paginated list of unmatched files', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
    let rawResult: any = null

    await controller.index({
      request: {
        validateUsing: async () => ({}),
      },
      response: {
        json(data: unknown) {
          rawResult = data
        },
      },
    } as never)

    // SimplePaginator has a toJSON method
    const result = rawResult.toJSON ? rawResult.toJSON() : rawResult
    assert.property(result, 'data')
    assert.property(result, 'meta')
    assert.isArray(result.data)
  })

  test('index filters by mediaType', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
    let rawResult: any = null

    await controller.index({
      request: {
        validateUsing: async () => ({ mediaType: 'tv' }),
      },
      response: {
        json(data: unknown) {
          rawResult = data
        },
      },
    } as never)

    const result = rawResult.toJSON ? rawResult.toJSON() : rawResult
    const data = result.data as Array<Record<string, unknown>>
    for (const file of data) {
      assert.equal(file.mediaType, 'tv')
    }
  })

  test('index filters by status', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
    let rawResult: any = null

    await controller.index({
      request: {
        validateUsing: async () => ({ status: 'ignored' }),
      },
      response: {
        json(data: unknown) {
          rawResult = data
        },
      },
    } as never)

    const result = rawResult.toJSON ? rawResult.toJSON() : rawResult
    const data = result.data as Array<Record<string, unknown>>
    for (const file of data) {
      assert.equal(file.status, 'ignored')
    }
  })

  test('index filters by rootFolderId', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
    let rawResult: any = null

    await controller.index({
      request: {
        validateUsing: async () => ({ rootFolderId: rootFolder.id }),
      },
      response: {
        json(data: unknown) {
          rawResult = data
        },
      },
    } as never)

    const result = rawResult.toJSON ? rawResult.toJSON() : rawResult
    const data = result.data as Array<Record<string, unknown>>
    assert.isTrue(data.length >= 3)
    for (const file of data) {
      assert.equal(file.rootFolderId, rootFolder.id)
    }
  })

  // ---- show ----

  test('show returns a single unmatched file', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: file1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, file1.id)
    assert.equal(result.fileName, 'unknown_movie.mkv')
  })

  test('show returns notFound for non-existent file', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
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

    assert.equal(notFoundResult.error, 'Unmatched file not found')
  })

  // ---- update ----

  test('update changes file status', async ({ assert }) => {
    const toUpdate = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'update_test.mkv',
      fileName: 'update_test.mkv',
      mediaType: 'movies',
      status: 'pending',
    })

    const controller = new UnmatchedFilesController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({ status: 'matched' }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.status, 'matched')

    await toUpdate.refresh()
    assert.equal(toUpdate.status, 'matched')

    await toUpdate.delete()
  })

  test('update returns notFound for non-existent file', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({ status: 'ignored' }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Unmatched file not found')
  })

  // ---- ignore ----

  test('ignore marks file as ignored', async ({ assert }) => {
    const toIgnore = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'ignore_test.mkv',
      fileName: 'ignore_test.mkv',
      mediaType: 'movies',
      status: 'pending',
    })

    const controller = new UnmatchedFilesController()
    let result: Record<string, unknown> = {}

    await controller.ignore({
      params: { id: toIgnore.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.status, 'ignored')

    await toIgnore.refresh()
    assert.equal(toIgnore.status, 'ignored')

    await toIgnore.delete()
  })

  test('ignore returns notFound for non-existent file', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.ignore({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Unmatched file not found')
  })

  // ---- destroy ----

  test('destroy deletes an unmatched file record', async ({ assert }) => {
    const toDelete = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'delete_test.mkv',
      fileName: 'delete_test.mkv',
      mediaType: 'movies',
      status: 'pending',
    })

    const controller = new UnmatchedFilesController()
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

    const deleted = await UnmatchedFile.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent file', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
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

    assert.equal(notFoundResult.error, 'Unmatched file not found')
  })

  // ---- bulkUpdate ----

  test('bulkUpdate updates status for multiple files', async ({ assert }) => {
    const bulkFile1 = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'bulk1.mkv',
      fileName: 'bulk1.mkv',
      mediaType: 'movies',
      status: 'pending',
    })
    const bulkFile2 = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'bulk2.mkv',
      fileName: 'bulk2.mkv',
      mediaType: 'movies',
      status: 'pending',
    })

    const controller = new UnmatchedFilesController()
    let result: Record<string, unknown> = {}

    await controller.bulkUpdate({
      request: {
        validateUsing: async () => ({
          ids: [bulkFile1.id, bulkFile2.id],
          status: 'ignored',
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.count, 2)
    assert.isString(result.message)

    await bulkFile1.refresh()
    await bulkFile2.refresh()
    assert.equal(bulkFile1.status, 'ignored')
    assert.equal(bulkFile2.status, 'ignored')

    await bulkFile1.delete()
    await bulkFile2.delete()
  })

  // ---- bulkDestroy ----

  test('bulkDestroy deletes multiple files', async ({ assert }) => {
    const bulkFile1 = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'bulkdel1.mkv',
      fileName: 'bulkdel1.mkv',
      mediaType: 'movies',
      status: 'pending',
    })
    const bulkFile2 = await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'bulkdel2.mkv',
      fileName: 'bulkdel2.mkv',
      mediaType: 'movies',
      status: 'pending',
    })

    const controller = new UnmatchedFilesController()
    let result: Record<string, unknown> = {}

    await controller.bulkDestroy({
      request: {
        validateUsing: async () => ({
          ids: [bulkFile1.id, bulkFile2.id],
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.count, 2)
    assert.isString(result.message)

    const deleted1 = await UnmatchedFile.find(bulkFile1.id)
    const deleted2 = await UnmatchedFile.find(bulkFile2.id)
    assert.isNull(deleted1)
    assert.isNull(deleted2)
  })

  // ---- stats ----

  test('stats returns counts by status and media type', async ({ assert }) => {
    const controller = new UnmatchedFilesController()
    let result: Record<string, unknown> = {}

    await controller.stats({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'pending')
    assert.property(result, 'matched')
    assert.property(result, 'ignored')
    assert.property(result, 'byMediaType')

    assert.isNumber(result.pending)
    assert.isNumber(result.matched)
    assert.isNumber(result.ignored)

    // We created 2 pending and 1 ignored in setup, so counts should be at least those
    assert.isTrue((result.pending as number) >= 2)
    assert.isTrue((result.ignored as number) >= 1)

    const byMediaType = result.byMediaType as Record<string, number>
    assert.isObject(byMediaType)
  })
})
