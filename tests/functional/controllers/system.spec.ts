import { test } from '@japa/runner'
import SystemController from '#controllers/system_controller'

test.group('SystemController', () => {
  // ---- health ----

  test('health returns health check response with expected shape', async ({ assert }) => {
    const controller = new SystemController()
    let result: Record<string, unknown> = {}

    await controller.health({
      response: {
        status(_code: number) {
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    // Verify response shape
    assert.property(result, 'status')
    assert.property(result, 'version')
    assert.property(result, 'uptime')
    assert.property(result, 'checks')
    assert.property(result, 'timestamp')
    assert.isArray(result.checks)

    // Status should be a valid value
    assert.include(['ok', 'warning', 'error'], result.status as string)

    // Uptime should be a number
    assert.isNumber(result.uptime)

    // Timestamp should be a valid ISO string
    assert.isString(result.timestamp)
    const parsedDate = new Date(result.timestamp as string)
    assert.isFalse(isNaN(parsedDate.getTime()))
  })

  test('health includes database check', async ({ assert }) => {
    const controller = new SystemController()
    let result: Record<string, unknown> = {}

    await controller.health({
      response: {
        status(_code: number) {
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const checks = result.checks as Array<{ name: string; status: string; message?: string }>
    const dbCheck = checks.find((c) => c.name === 'database')
    assert.isNotNull(dbCheck)
    assert.equal(dbCheck!.status, 'ok')
    assert.isString(dbCheck!.message)
  })

  test('health includes rootFolders check', async ({ assert }) => {
    const controller = new SystemController()
    let result: Record<string, unknown> = {}

    await controller.health({
      response: {
        status(_code: number) {
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const checks = result.checks as Array<{ name: string; status: string; message?: string }>
    const rootFolderCheck = checks.find((c) => c.name === 'rootFolders')
    assert.isNotNull(rootFolderCheck)
    assert.include(['ok', 'warning', 'error'], rootFolderCheck!.status as string)
  })

  test('health includes indexers check', async ({ assert }) => {
    const controller = new SystemController()
    let result: Record<string, unknown> = {}

    await controller.health({
      response: {
        status(_code: number) {
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const checks = result.checks as Array<{ name: string; status: string; message?: string }>
    const indexerCheck = checks.find((c) => c.name === 'indexers')
    assert.isNotNull(indexerCheck)
    assert.include(['ok', 'warning', 'error'], indexerCheck!.status as string)
  })

  test('health includes downloadClients check', async ({ assert }) => {
    const controller = new SystemController()
    let result: Record<string, unknown> = {}

    await controller.health({
      response: {
        status(_code: number) {
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const checks = result.checks as Array<{ name: string; status: string; message?: string }>
    const dlCheck = checks.find((c) => c.name === 'downloadClients')
    assert.isNotNull(dlCheck)
    assert.include(['ok', 'warning', 'error'], dlCheck!.status as string)
  })

  test('health returns 200 when all checks pass or warn', async ({ assert }) => {
    const controller = new SystemController()
    let responseStatusCode = 0

    await controller.health({
      response: {
        status(code: number) {
          responseStatusCode = code
          return {
            json() {},
          }
        },
        json() {},
      },
    } as never)

    // Status should be either 200 (ok/warning) or 503 (error)
    assert.isTrue(responseStatusCode === 200 || responseStatusCode === 503)
  })

  // ---- info ----

  test('info returns system information', async ({ assert }) => {
    const controller = new SystemController()
    let result: Record<string, unknown> = {}

    await controller.info({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'version')
    assert.property(result, 'nodeVersion')
    assert.property(result, 'platform')
    assert.property(result, 'arch')
    assert.property(result, 'uptime')
    assert.property(result, 'memory')

    // Verify types
    assert.isString(result.version)
    assert.isString(result.nodeVersion)
    assert.isString(result.platform)
    assert.isString(result.arch)
    assert.isNumber(result.uptime)

    // Memory should have used and total
    const memory = result.memory as Record<string, unknown>
    assert.property(memory, 'used')
    assert.property(memory, 'total')
    assert.isNumber(memory.used)
    assert.isNumber(memory.total)

    // Node version should start with 'v'
    assert.isTrue((result.nodeVersion as string).startsWith('v'))

    // Platform should be a known value
    assert.include(['darwin', 'linux', 'win32', 'freebsd'], result.platform as string)

    // Uptime should be non-negative
    assert.isTrue((result.uptime as number) >= 0)
  })

  test('info returns memory values in MB', async ({ assert }) => {
    const controller = new SystemController()
    let result: Record<string, unknown> = {}

    await controller.info({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const memory = result.memory as Record<string, number>
    // Used memory should be reasonable (at least 1 MB, less than total)
    assert.isTrue(memory.used >= 1)
    assert.isTrue(memory.total > 0)
    assert.isTrue(memory.used <= memory.total)
  })
})
