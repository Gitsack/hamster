import { test } from '@japa/runner'
import RootFolder from '#models/root_folder'
import RootFoldersController from '#controllers/root_folders_controller'
import { RootFolderFactory } from '../../../database/factories/root_folder_factory.js'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

test.group('RootFoldersController', (group) => {
  let folder1: RootFolder
  let folder2: RootFolder
  let tempDir: string

  group.setup(async () => {
    // Create a real temp directory for testing path validation
    tempDir = path.join(os.tmpdir(), `hamster-test-root-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    folder1 = await RootFolderFactory.create({
      name: 'Root Test Music',
      path: tempDir,
      mediaType: 'music',
    })
    folder2 = await RootFolderFactory.create({
      name: 'Root Test Movies',
      path: '/media/root-test-nonexistent',
      mediaType: 'movies',
    })
  })

  group.teardown(async () => {
    await RootFolder.query().whereIn('id', [folder1.id, folder2.id]).delete()
    await RootFolder.query().where('name', 'like', 'Root Test%').delete()
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // ---- index ----

  test('index returns list of root folders', async ({ assert }) => {
    const controller = new RootFoldersController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((f: any) => f.name)
    assert.include(names, 'Root Test Music')
    assert.include(names, 'Root Test Movies')
  })

  test('index returns folders with accessibility info', async ({ assert }) => {
    const controller = new RootFoldersController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const musicFolder = result.find((f: any) => f.name === 'Root Test Music') as Record<
      string,
      unknown
    >
    assert.isNotNull(musicFolder)
    assert.property(musicFolder, 'accessible')
    assert.property(musicFolder, 'freeSpace')
    assert.property(musicFolder, 'totalSpace')

    // Temp dir should be accessible
    assert.equal(musicFolder.accessible, true)
  })

  test('index marks non-existent folders as not accessible', async ({ assert }) => {
    const controller = new RootFoldersController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const moviesFolder = result.find((f: any) => f.name === 'Root Test Movies') as Record<
      string,
      unknown
    >
    assert.isNotNull(moviesFolder)
    assert.equal(moviesFolder.accessible, false)
  })

  // ---- store ----

  test('store creates a new root folder with existing path', async ({ assert }) => {
    const newTempDir = path.join(os.tmpdir(), `hamster-test-store-${Date.now()}`)
    await fs.mkdir(newTempDir, { recursive: true })

    const controller = new RootFoldersController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          path: newTempDir,
          name: 'Root Test New Folder',
          mediaType: 'music' as const,
        }),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
        badRequest() {},
        conflict() {},
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.name, 'Root Test New Folder')
    assert.equal(result.path, newTempDir)
    assert.equal(result.mediaType, 'music')

    // Cleanup
    if (result.id) {
      await RootFolder.query().where('id', result.id as string).delete()
    }
    try {
      await fs.rm(newTempDir, { recursive: true })
    } catch {
      // Ignore
    }
  })

  test('store returns badRequest for non-existent path', async ({ assert }) => {
    const controller = new RootFoldersController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          path: '/non/existent/path/for/test',
          name: 'Root Test Bad Path',
          mediaType: 'music' as const,
        }),
      },
      response: {
        created() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        conflict() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('store returns conflict for duplicate path', async ({ assert }) => {
    const controller = new RootFoldersController()
    let conflictResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          path: tempDir,
          name: 'Root Test Duplicate',
          mediaType: 'music' as const,
        }),
      },
      response: {
        created() {},
        badRequest() {},
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(conflictResult, 'error')
  })

  test('store creates directory when createIfMissing is true', async ({ assert }) => {
    const newDir = path.join(os.tmpdir(), `hamster-test-create-${Date.now()}`)

    const controller = new RootFoldersController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          path: newDir,
          name: 'Root Test Create Missing',
          mediaType: 'tv' as const,
          createIfMissing: true,
        }),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
        badRequest() {},
        conflict() {},
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.name, 'Root Test Create Missing')

    // Cleanup
    if (result.id) {
      await RootFolder.query().where('id', result.id as string).delete()
    }
    try {
      await fs.rm(newDir, { recursive: true })
    } catch {
      // Ignore
    }
  })

  // ---- show ----

  test('show returns root folder details', async ({ assert }) => {
    const controller = new RootFoldersController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: folder1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.name, 'Root Test Music')
    assert.equal(result.path, tempDir)
    assert.equal(result.mediaType, 'music')
  })

  test('show returns notFound for non-existent root folder', async ({ assert }) => {
    const controller = new RootFoldersController()
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

  test('update modifies root folder', async ({ assert }) => {
    const updateDir = path.join(os.tmpdir(), `hamster-test-update-${Date.now()}`)
    await fs.mkdir(updateDir, { recursive: true })

    const toUpdate = await RootFolderFactory.create({
      name: 'Root Test Update Me',
      path: tempDir,
      mediaType: 'music',
    })

    const controller = new RootFoldersController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({
          path: updateDir,
          name: 'Root Test Updated',
          mediaType: 'movies' as const,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
        badRequest() {},
      },
    } as never)

    assert.equal(result.name, 'Root Test Updated')
    assert.equal(result.path, updateDir)
    assert.equal(result.mediaType, 'movies')

    // Verify in database
    await toUpdate.refresh()
    assert.equal(toUpdate.name, 'Root Test Updated')

    await toUpdate.delete()
    try {
      await fs.rm(updateDir, { recursive: true })
    } catch {
      // Ignore
    }
  })

  test('update returns notFound for non-existent root folder', async ({ assert }) => {
    const controller = new RootFoldersController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        validateUsing: async () => ({
          path: tempDir,
          name: 'Whatever',
        }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  test('update returns badRequest for non-existent path', async ({ assert }) => {
    const toUpdate = await RootFolderFactory.create({
      name: 'Root Test Bad Update',
      path: tempDir,
      mediaType: 'music',
    })

    const controller = new RootFoldersController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: toUpdate.id },
      request: {
        validateUsing: async () => ({
          path: '/non/existent/update/path',
          name: 'Root Test Bad Path Update',
        }),
      },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(badRequestResult, 'error')

    await toUpdate.delete()
  })

  // ---- destroy ----

  test('destroy deletes a root folder', async ({ assert }) => {
    const toDelete = await RootFolderFactory.create({
      name: 'Root Test Delete Me',
      path: '/media/root-test-delete',
      mediaType: 'books',
    })

    const controller = new RootFoldersController()
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

    const deleted = await RootFolder.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent root folder', async ({ assert }) => {
    const controller = new RootFoldersController()
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

  // ---- scan ----

  test('scan returns notFound for non-existent root folder', async ({ assert }) => {
    const controller = new RootFoldersController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.scan({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        accepted() {},
        conflict() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- scanStatus ----

  test('scanStatus returns notFound for non-existent root folder', async ({ assert }) => {
    const controller = new RootFoldersController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.scanStatus({
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

  test('scanStatus returns status for existing root folder', async ({ assert }) => {
    const controller = new RootFoldersController()
    let result: Record<string, unknown> = {}

    await controller.scanStatus({
      params: { id: folder1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.property(result, 'rootFolderId')
    assert.property(result, 'status')
    assert.property(result, 'isScanning')
    assert.property(result, 'lastScannedAt')
    assert.equal(result.rootFolderId, folder1.id)
  })

  // ---- scanAll ----

  test('scanAll returns accepted or conflict', async ({ assert }) => {
    const controller = new RootFoldersController()
    let acceptedResult: Record<string, unknown> = {}
    let conflictResult: Record<string, unknown> = {}

    await controller.scanAll({
      response: {
        accepted(data: unknown) {
          acceptedResult = data as Record<string, unknown>
        },
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
      },
    } as never)

    // Either accepted or conflict depending on scan state
    const hasAccepted = Object.keys(acceptedResult).length > 0
    const hasConflict = Object.keys(conflictResult).length > 0
    assert.isTrue(hasAccepted || hasConflict)

    if (hasAccepted) {
      assert.property(acceptedResult, 'message')
    }
    if (hasConflict) {
      assert.property(conflictResult, 'error')
    }
  })
})
