import { test } from '@japa/runner'
import FilesystemController from '#controllers/filesystem_controller'
import os from 'node:os'
import path from 'node:path'

test.group('FilesystemController', () => {
  // ---- browse ----

  test('browse returns root directories when no path given on unix', async ({ assert }) => {
    if (process.platform === 'win32') return

    const controller = new FilesystemController()
    let result: Record<string, unknown> = {}

    await controller.browse({
      request: {
        input: () => '',
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        forbidden() {},
        badRequest() {},
      },
    } as never)

    assert.equal(result.path, '/')
    assert.isNull(result.parent)
    assert.isArray(result.directories)
  })

  test('browse returns directories for a valid path', async ({ assert }) => {
    const controller = new FilesystemController()
    let result: Record<string, unknown> = {}
    const testPath = os.tmpdir()

    await controller.browse({
      request: {
        input: () => testPath,
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        forbidden() {},
        badRequest() {},
      },
    } as never)

    assert.equal(result.path, path.resolve(testPath))
    assert.isArray(result.directories)
    assert.isNotNull(result.parent)
  })

  test('browse returns badRequest for non-directory path', async ({ assert }) => {
    const controller = new FilesystemController()
    let badRequestResult: Record<string, unknown> = {}

    // /dev/null is a file, not a directory (on unix)
    if (process.platform === 'win32') return

    await controller.browse({
      request: {
        input: () => '/dev/null',
      },
      response: {
        json() {},
        forbidden() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Path is not a directory')
  })

  test('browse returns badRequest for non-existent path', async ({ assert }) => {
    const controller = new FilesystemController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.browse({
      request: {
        input: () => '/nonexistent/path/that/does/not/exist',
      },
      response: {
        json() {},
        forbidden() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Cannot access path')
  })

  test('browse returns forbidden for path with null byte', async ({ assert }) => {
    const controller = new FilesystemController()
    let forbiddenResult: Record<string, unknown> = {}

    await controller.browse({
      request: {
        input: () => '/tmp/\0malicious',
      },
      response: {
        json() {},
        forbidden(data: unknown) {
          forbiddenResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(forbiddenResult.error, 'Invalid path')
  })

  test('browse filters out hidden directories', async ({ assert }) => {
    const controller = new FilesystemController()
    let result: Record<string, unknown> = {}

    await controller.browse({
      request: {
        input: () => os.homedir(),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        forbidden() {},
        badRequest() {},
      },
    } as never)

    const directories = result.directories as Array<{ name: string }>
    for (const dir of directories) {
      assert.isFalse(dir.name.startsWith('.'))
    }
  })

  // ---- quickPaths ----

  test('quickPaths returns array of quick access paths', async ({ assert }) => {
    const controller = new FilesystemController()
    let result: Record<string, unknown> = {}

    await controller.quickPaths({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'paths')
    const paths = result.paths as Array<{ name: string; path: string; isDirectory: boolean }>
    assert.isArray(paths)

    // Should always include Home
    const homeEntry = paths.find((p) => p.name === 'Home')
    assert.isNotNull(homeEntry)
    assert.equal(homeEntry!.path, os.homedir())
    assert.isTrue(homeEntry!.isDirectory)

    // On unix, should include Root
    if (process.platform !== 'win32') {
      const rootEntry = paths.find((p) => p.name === 'Root')
      assert.isNotNull(rootEntry)
      assert.equal(rootEntry!.path, '/')
    }
  })

  // ---- checkPath ----

  test('checkPath returns exists true for valid directory', async ({ assert }) => {
    const controller = new FilesystemController()
    let result: Record<string, unknown> = {}

    await controller.checkPath({
      request: {
        input: () => os.tmpdir(),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
        forbidden() {},
      },
    } as never)

    assert.isTrue(result.exists as boolean)
    assert.isTrue(result.isDirectory as boolean)
    assert.isString(result.path)
  })

  test('checkPath returns exists false for non-existent path', async ({ assert }) => {
    const controller = new FilesystemController()
    let result: Record<string, unknown> = {}

    await controller.checkPath({
      request: {
        input: () => '/nonexistent/path/that/does/not/exist',
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
        forbidden() {},
      },
    } as never)

    assert.isFalse(result.exists as boolean)
    assert.isFalse(result.isDirectory as boolean)
  })

  test('checkPath returns badRequest when path is empty', async ({ assert }) => {
    const controller = new FilesystemController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.checkPath({
      request: {
        input: () => '',
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        forbidden() {},
      },
    } as never)

    assert.equal(badRequestResult.error, 'Path is required')
  })

  test('checkPath returns forbidden for path with null byte', async ({ assert }) => {
    const controller = new FilesystemController()
    let forbiddenResult: Record<string, unknown> = {}

    await controller.checkPath({
      request: {
        input: () => '/tmp/\0bad',
      },
      response: {
        json() {},
        badRequest() {},
        forbidden(data: unknown) {
          forbiddenResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(forbiddenResult.error, 'Invalid path')
  })
})
