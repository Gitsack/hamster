import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import SystemController from '#controllers/system_controller'
import { HealthMonitor, type HealthProbes } from '#services/system/health_monitor'

const packageVersion = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8')
).version as string

/** A monitor whose probes answer from the given statuses, never touching the network. */
function monitorWith(
  statuses: {
    database?: 'ok' | 'error'
    clients?: 'ok' | 'warning' | 'error'
    folder?: 'ok' | 'error'
  } = {},
  now?: () => number
) {
  const probes: HealthProbes = {
    async database() {
      return statuses.database === 'error'
        ? { status: 'error', message: 'ECONNREFUSED' }
        : { status: 'ok', message: 'Connected (1 ms)' }
    },
    async rootFolders() {
      const folderDown = statuses.folder === 'error'
      return {
        status: folderDown ? 'error' : 'ok',
        message: folderDown ? '/media/movies: Not accessible' : '1 folder readable',
        details: {
          folders: [
            {
              id: 'f1',
              path: '/media/movies',
              mediaType: 'movies',
              status: folderDown ? 'error' : 'ok',
              message: folderDown ? 'Not accessible' : 'Readable',
              freeBytes: folderDown ? null : 5,
            },
          ],
          freeBytes: 5,
        },
      }
    },
    async downloadClients() {
      const status = statuses.clients ?? 'ok'
      return {
        status,
        message: status === 'ok' ? '1 client reachable' : 'Unreachable — SABnzbd: ECONNREFUSED',
        details: [
          {
            id: 'c1',
            name: 'SABnzbd',
            type: 'sabnzbd',
            status: status === 'ok' ? 'ok' : 'error',
            message: status === 'ok' ? 'Reachable' : 'ECONNREFUSED',
            latencyMs: null,
          },
        ],
      }
    },
    async failedTasks() {
      return [{ id: 't1', name: 'Backup', type: 'backup', lastError: 'boom', lastRunAt: null }]
    },
  }
  return new HealthMonitor({ probes, notify: false, now })
}

/** Calls `health` and captures the status code and body. */
async function callHealth(controller: SystemController, qs: Record<string, string> = {}) {
  let code = 0
  let body: Record<string, any> = {}
  await controller.health({
    request: { input: (key: string, fallback: unknown) => qs[key] ?? fallback },
    response: {
      status(c: number) {
        code = c
        return {
          json(data: unknown) {
            body = data as Record<string, any>
          },
        }
      },
    },
  } as never)
  return { code, body }
}

test.group('SystemController', () => {
  // ---- health ----

  test('health answers 200 "starting" before the first check has finished', async ({ assert }) => {
    const { code, body } = await callHealth(new SystemController(monitorWith()))
    assert.equal(code, 200)
    assert.equal(body.status, 'starting')
    assert.deepEqual(body.checks, [])
    assert.equal(body.version, packageVersion)
    assert.isNumber(body.uptime)
    assert.isFalse(Number.isNaN(Date.parse(body.timestamp)))
  })

  test('health reads the cached result without probing', async ({ assert }) => {
    const monitor = monitorWith()
    await monitor.run()
    const { code, body } = await callHealth(new SystemController(monitor))
    assert.equal(code, 200)
    assert.equal(body.status, 'ok')
    assert.deepEqual(
      body.checks.map((c: { name: string }) => c.name),
      ['database', 'rootFolders', 'downloadClients']
    )
    assert.equal(body.timestamp, monitor.result!.checkedAt)
    // The public endpoint keeps its old shape: name, status, message only.
    assert.deepEqual(Object.keys(body.checks[0]).sort(), ['message', 'name', 'status'])
  })

  test('a download client being down stays 200 unless ?strict=1', async ({ assert }) => {
    const monitor = monitorWith({ clients: 'error' })
    await monitor.run()
    const controller = new SystemController(monitor)

    const lenient = await callHealth(controller)
    assert.equal(lenient.code, 200)
    assert.equal(lenient.body.status, 'error')

    const strict = await callHealth(controller, { strict: '1' })
    assert.equal(strict.code, 503)
  })

  test('the database being down answers 503', async ({ assert }) => {
    const monitor = monitorWith({ database: 'error' })
    await monitor.run()
    const { code, body } = await callHealth(new SystemController(monitor))
    assert.equal(code, 503)
    assert.equal(body.status, 'error')
  })

  test('a monitor that stopped reporting answers 503', async ({ assert }) => {
    let now = Date.now()
    const monitor = monitorWith({}, () => now)
    await monitor.run()
    now += 6 * 60_000
    const { code, body } = await callHealth(new SystemController(monitor))
    assert.equal(code, 503)
    assert.equal(body.status, 'error')
    assert.equal(body.checks.at(-1).name, 'monitor')
  })

  // ---- health summary ----

  test('healthSummary gives admins paths and failed tasks, others the verdict only', async ({
    assert,
  }) => {
    const monitor = monitorWith({ clients: 'error' })
    await monitor.run()
    const controller = new SystemController(monitor)

    const read = async (isAdmin: boolean) => {
      let body: Record<string, any> = {}
      await controller.healthSummary({
        auth: { user: { isAdmin } },
        response: {
          json(data: unknown) {
            body = data as Record<string, any>
          },
        },
      } as never)
      return body
    }

    const admin = await read(true)
    assert.equal(admin.level, 'error')
    assert.lengthOf(admin.rootFolders, 1)
    assert.lengthOf(admin.failedTasks, 1)
    assert.equal(admin.downloadClients[0].status, 'error')
    assert.isFalse(admin.stale)

    const user = await read(false)
    assert.equal(user.level, 'error')
    assert.lengthOf(user.rootFolders, 0)
    assert.lengthOf(user.failedTasks, 0)
    assert.equal(user.downloadClients[0].message, 'ECONNREFUSED')
  })

  test('healthSummary names failing folders by label, not path, for non-admins', async ({
    assert,
  }) => {
    const monitor = monitorWith({ folder: 'error' })
    await monitor.run()
    const controller = new SystemController(monitor)

    const read = async (isAdmin: boolean) => {
      let body: Record<string, any> = {}
      await controller.healthSummary({
        auth: { user: { isAdmin } },
        response: {
          json(data: unknown) {
            body = data as Record<string, any>
          },
        },
      } as never)
      return body
    }

    const admin = await read(true)
    const adminCheck = admin.checks.find((c: { name: string }) => c.name === 'rootFolders')
    assert.include(adminCheck.message, '/media/movies')

    const user = await read(false)
    const userCheck = user.checks.find((c: { name: string }) => c.name === 'rootFolders')
    assert.equal(userCheck.status, 'error')
    assert.equal(userCheck.message, 'Movies folder: Not accessible')
    assert.notInclude(JSON.stringify(user), '/media/movies')
  })

  test('recheck starts a run in the background and answers 202 at once', async ({ assert }) => {
    const monitor = monitorWith()
    const controller = new SystemController(monitor)
    let code = 0
    let body: Record<string, any> = {}
    await controller.recheck({
      response: {
        status(c: number) {
          code = c
          return {
            json(data: unknown) {
              body = data as Record<string, any>
            },
          }
        },
      },
    } as never)
    assert.equal(code, 202)
    assert.isTrue(body.started)
    assert.isTrue(monitor.running)
    await monitor.run()
    assert.equal(monitor.level, 'ok')
  })

  // ---- info ----

  test('info returns system information with the package.json version', async ({ assert }) => {
    const controller = new SystemController()
    let result: Record<string, unknown> = {}

    await controller.info({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.version, packageVersion)
    assert.isString(result.nodeVersion)
    assert.isTrue((result.nodeVersion as string).startsWith('v'))
    assert.include(['darwin', 'linux', 'win32', 'freebsd'], result.platform as string)
    assert.isString(result.arch)
    assert.isTrue((result.uptime as number) >= 0)

    const memory = result.memory as Record<string, number>
    assert.isTrue(memory.used >= 1)
    assert.isTrue(memory.total > 0)
    assert.isTrue(memory.used <= memory.total)
  })
})
