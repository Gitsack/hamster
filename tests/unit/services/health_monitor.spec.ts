import { test } from '@japa/runner'
import {
  HealthMonitor,
  withTimeout,
  worstStatus,
  type HealthNotifier,
  type HealthProbes,
  type HealthStatus,
  type ProbeOutcome,
} from '#services/system/health_monitor'

type ClientDetails = NonNullable<Awaited<ReturnType<HealthProbes['downloadClients']>>['details']>

/** Probes whose answers the test sets between runs. */
function fakeProbes() {
  const state = {
    database: { status: 'ok', message: 'Connected (1 ms)' } as ProbeOutcome,
    clients: 'ok' as HealthStatus,
    calls: 0,
  }
  const probes: HealthProbes = {
    async database() {
      state.calls++
      return state.database
    },
    async rootFolders() {
      return {
        status: 'ok',
        message: '1 folder readable',
        details: {
          folders: [
            {
              id: 'f1',
              path: '/media/movies',
              mediaType: 'movies',
              status: 'ok',
              message: 'Readable',
              freeBytes: 1024,
            },
          ],
          freeBytes: 1024,
        },
      }
    },
    async downloadClients() {
      const details: ClientDetails = [
        {
          id: 'c1',
          name: 'SABnzbd',
          type: 'sabnzbd',
          status: state.clients === 'ok' ? 'ok' : 'error',
          message: state.clients === 'ok' ? 'Reachable' : 'ECONNREFUSED',
          latencyMs: state.clients === 'ok' ? 12 : null,
        },
      ]
      return {
        status: state.clients,
        message: state.clients === 'ok' ? '1 client reachable' : 'Unreachable — SABnzbd',
        details,
      }
    },
    async failedTasks() {
      return []
    },
  }
  return { state, probes }
}

function recordingNotifier() {
  const sent: string[] = []
  const notifier: HealthNotifier = {
    async issue({ level, source }) {
      sent.push(`issue:${source}:${level}`)
    },
    async restored({ source }) {
      sent.push(`restored:${source}`)
    },
  }
  return { sent, notifier }
}

test.group('HealthMonitor', () => {
  test('is "starting" with no result until the first run finishes', async ({ assert }) => {
    const { probes } = fakeProbes()
    const monitor = new HealthMonitor({ probes, notify: false })
    assert.isNull(monitor.result)
    assert.equal(monitor.level, 'starting')
    assert.isFalse(monitor.isStale())

    const result = await monitor.run()
    assert.equal(result.status, 'ok')
    assert.equal(monitor.level, 'ok')
    assert.deepEqual(
      result.checks.map((c) => c.name),
      ['database', 'rootFolders', 'downloadClients']
    )
    assert.equal(result.freeBytes, 1024)
    assert.equal(result.downloadClients[0].latencyMs, 12)
  })

  test('notifies on transitions only, not on every run', async ({ assert }) => {
    const { state, probes } = fakeProbes()
    const { sent, notifier } = recordingNotifier()
    const monitor = new HealthMonitor({ probes, notifier, notify: true })

    await monitor.run()
    assert.deepEqual(sent, [])

    state.clients = 'error'
    await monitor.run()
    await monitor.run()
    await monitor.run()
    assert.deepEqual(sent, ['issue:downloadClients:error'])

    state.clients = 'warning'
    await monitor.run()
    assert.deepEqual(sent, ['issue:downloadClients:error', 'issue:downloadClients:warning'])

    state.clients = 'ok'
    await monitor.run()
    await monitor.run()
    assert.deepEqual(sent, [
      'issue:downloadClients:error',
      'issue:downloadClients:warning',
      'restored:downloadClients',
    ])
  })

  test('reports a problem already present at boot once', async ({ assert }) => {
    const { state, probes } = fakeProbes()
    const { sent, notifier } = recordingNotifier()
    state.database = { status: 'error', message: 'ECONNREFUSED' }
    const monitor = new HealthMonitor({ probes, notifier, notify: true })

    await monitor.run()
    await monitor.run()
    assert.deepEqual(sent, ['issue:database:error'])
  })

  test('sends nothing when notifications are off (dev server)', async ({ assert }) => {
    const { state, probes } = fakeProbes()
    const { sent, notifier } = recordingNotifier()
    const monitor = new HealthMonitor({ probes, notifier, notify: false })
    state.clients = 'error'
    await monitor.run()
    assert.deepEqual(sent, [])
    assert.equal(monitor.level, 'error')
  })

  test('keeps "since" while the status holds and moves it on a change', async ({ assert }) => {
    const { state, probes } = fakeProbes()
    let now = Date.parse('2026-09-27T10:00:00Z')
    const monitor = new HealthMonitor({ probes, notify: false, now: () => now })

    state.clients = 'error'
    const first = await monitor.run()
    now += 60_000
    const second = await monitor.run()
    assert.equal(second.downloadClients[0].since, first.downloadClients[0].since)
    assert.equal(second.checks[2].since, '2026-09-27T10:00:00.000Z')

    state.clients = 'ok'
    now += 60_000
    const third = await monitor.run()
    assert.equal(third.checks[2].since, '2026-09-27T10:02:00.000Z')
  })

  test('concurrent callers share one run', async ({ assert }) => {
    const { state, probes } = fakeProbes()
    const monitor = new HealthMonitor({ probes, notify: false })
    const [a, b] = await Promise.all([monitor.run(), monitor.run()])
    assert.strictEqual(a, b)
    assert.equal(state.calls, 1)
    assert.isFalse(monitor.running)
    assert.isTrue(monitor.requestCheck())
    assert.isTrue(monitor.running)
    assert.isFalse(monitor.requestCheck())
    await monitor.run()
    assert.equal(state.calls, 2)
  })

  test('a probe that throws becomes an error check instead of breaking the run', async ({
    assert,
  }) => {
    const { probes } = fakeProbes()
    probes.rootFolders = async () => {
      throw new Error('EIO')
    }
    const monitor = new HealthMonitor({ probes, notify: false })
    const result = await monitor.run()
    const folders = result.checks.find((c) => c.name === 'rootFolders')!
    assert.equal(folders.status, 'error')
    assert.equal(folders.message, 'EIO')
    assert.equal(result.status, 'error')
  })

  test('marks the cache stale when the loop stops reporting', async ({ assert }) => {
    const { probes } = fakeProbes()
    let now = Date.parse('2026-09-27T10:00:00Z')
    const monitor = new HealthMonitor({ probes, notify: false, now: () => now })
    await monitor.run()
    now += 4 * 60_000
    assert.isFalse(monitor.isStale())
    now += 2 * 60_000
    assert.isTrue(monitor.isStale())
  })

  test('collects failed tasks with each run and on request', async ({ assert }) => {
    const { probes } = fakeProbes()
    let failed = [{ id: 't1', name: 'Backup', type: 'backup', lastError: 'boom', lastRunAt: null }]
    probes.failedTasks = async () => failed
    const monitor = new HealthMonitor({ probes, notify: false })
    await monitor.run()
    assert.lengthOf(monitor.failedTasks, 1)
    failed = []
    await monitor.refreshFailedTasks()
    assert.lengthOf(monitor.failedTasks, 0)
  })

  test('the default probes answer against the test database', async ({ assert }) => {
    const monitor = new HealthMonitor({ notify: false })
    const result = await monitor.run()
    const database = result.checks.find((c) => c.name === 'database')!
    assert.oneOf(database.status, ['ok', 'warning'])
    assert.match(database.message, /\d+ ms/)
  }).timeout(60_000)
})

test.group('health helpers', () => {
  test('withTimeout rejects a promise that never settles', async ({ assert }) => {
    await assert.rejects(
      () => withTimeout(new Promise(() => {}), 20, 'The probe'),
      'The probe did not answer within 0.02s'
    )
    assert.equal(await withTimeout(Promise.resolve(5), 20, 'x'), 5)
  })

  test('worstStatus ranks error over warning over ok', ({ assert }) => {
    assert.equal(worstStatus([]), 'ok')
    assert.equal(worstStatus(['ok', 'warning']), 'warning')
    assert.equal(worstStatus(['warning', 'error', 'ok']), 'error')
  })
})
