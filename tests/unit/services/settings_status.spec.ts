import { test } from '@japa/runner'
import { HealthState, HEALTH_STALE_MS, type HealthResult } from '#services/system/health_state'
import { failingSettingsAreas } from '#services/system/settings_status'

const NOW = Date.parse('2026-09-27T12:00:00Z')

function result(patch: Partial<HealthResult> = {}): HealthResult {
  return {
    status: 'ok',
    checkedAt: new Date(NOW).toISOString(),
    durationMs: 5,
    checks: [
      { name: 'database', label: 'Database', status: 'ok', message: 'Connected', since: '' },
      { name: 'rootFolders', label: 'Root folders', status: 'ok', message: 'ok', since: '' },
      {
        name: 'downloadClients',
        label: 'Download clients',
        status: 'ok',
        message: 'ok',
        since: '',
      },
    ],
    downloadClients: [],
    rootFolders: [],
    freeBytes: null,
    ...patch,
  }
}

function stateWith(res: HealthResult | null, now = NOW) {
  const state = new HealthState(() => now)
  state.result = res
  return state
}

function failCheck(res: HealthResult, name: string): HealthResult {
  return {
    ...res,
    status: 'error',
    checks: res.checks.map((c) => (c.name === name ? { ...c, status: 'error' as const } : c)),
  }
}

test.group('failingSettingsAreas', () => {
  test('nothing fails before the first run or while all is well', ({ assert }) => {
    assert.deepEqual(failingSettingsAreas(stateWith(null)), [])
    assert.deepEqual(failingSettingsAreas(stateWith(result())), [])
  })

  test('maps each failing check to its settings page', ({ assert }) => {
    assert.deepEqual(failingSettingsAreas(stateWith(failCheck(result(), 'rootFolders'))), ['media'])
    assert.deepEqual(failingSettingsAreas(stateWith(failCheck(result(), 'downloadClients'))), [
      'download-clients',
    ])
    assert.deepEqual(failingSettingsAreas(stateWith(failCheck(result(), 'database'))), ['system'])
  })

  test('one client down out of two is still a failing client', ({ assert }) => {
    const res = result({
      status: 'warning',
      checks: result().checks.map((c) =>
        c.name === 'downloadClients' ? { ...c, status: 'warning' as const } : c
      ),
      downloadClients: [
        {
          id: 'a',
          name: 'SAB',
          type: 'sabnzbd',
          status: 'error',
          message: 'DNS',
          latencyMs: null,
          since: '',
        },
        {
          id: 'b',
          name: 'qBit',
          type: 'qbittorrent',
          status: 'ok',
          message: 'ok',
          latencyMs: 3,
          since: '',
        },
      ],
    })
    assert.deepEqual(failingSettingsAreas(stateWith(res)), ['download-clients'])
  })

  test('a folder low on space is a warning, not a failure', ({ assert }) => {
    const res = result({
      status: 'warning',
      rootFolders: [
        {
          id: 'f',
          path: '/m',
          mediaType: 'movies',
          status: 'warning',
          message: 'Low space',
          freeBytes: 1,
        },
      ],
    })
    assert.deepEqual(failingSettingsAreas(stateWith(res)), [])
  })

  test('failed tasks and a stale cache belong to System', ({ assert }) => {
    const withTask = stateWith(result())
    withTask.failedTasks = [
      { id: 't', name: 'Backup', type: 'backup', lastError: 'boom', lastRunAt: null },
    ]
    assert.deepEqual(failingSettingsAreas(withTask), ['system'])

    const stale = stateWith(result(), NOW + HEALTH_STALE_MS + 1)
    assert.deepEqual(failingSettingsAreas(stale), ['system'])
  })
})
