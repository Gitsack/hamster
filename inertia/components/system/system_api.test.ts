import {
  aboutLine,
  backupDate,
  formatBytes,
  formatDuration,
  formatInterval,
  formatUptime,
  responseError,
  sortTasks,
  taskDisplayName,
  taskState,
  timeUntil,
  type ScheduledTask,
} from './system_api'

function task(overrides: Partial<ScheduledTask>): ScheduledTask {
  return {
    id: 't',
    name: 'Task',
    type: 'rss_sync',
    intervalMinutes: 15,
    enabled: true,
    isRunning: false,
    lastRunAt: '2026-09-27T10:00:00Z',
    nextRunAt: '2026-09-27T10:15:00Z',
    lastDurationMs: 1200,
    lastStatus: 'success',
    lastError: null,
    ...overrides,
  }
}

describe('system_api', () => {
  it('words intervals the way an operator says them', () => {
    expect(formatInterval(1)).toBe('every minute')
    expect(formatInterval(15)).toBe('every 15 min')
    expect(formatInterval(60)).toBe('hourly')
    expect(formatInterval(240)).toBe('every 4 h')
    expect(formatInterval(1440)).toBe('daily')
    expect(formatInterval(2880)).toBe('every 2 d')
    expect(formatInterval(90)).toBe('every 1 h 30 min')
  })

  it('formats durations, uptime and byte counts compactly', () => {
    expect(formatDuration(340)).toBe('340 ms')
    expect(formatDuration(4210)).toBe('4.2 s')
    expect(formatDuration(192_000)).toBe('3m 12s')
    expect(formatDuration(null)).toBeNull()
    expect(formatUptime(3 * 86400 + 4 * 3600 + 60)).toBe('3d 4h')
    expect(formatUptime(125)).toBe('2m')
    expect(formatUptime(12)).toBe('12s')
    expect(formatBytes(1.2 * 1024 ** 4)).toBe('1.2 TB')
    expect(formatBytes(312 * 1024)).toBe('312 KB')
    expect(formatBytes(null)).toBe('—')
  })

  it('says when the next run is due', () => {
    const now = Date.parse('2026-09-27T10:00:00Z')
    expect(timeUntil('2026-09-27T10:04:00Z', now)).toBe('in 4m')
    expect(timeUntil('2026-09-27T13:00:00Z', now)).toBe('in 3h')
    expect(timeUntil('2026-09-27T09:59:00Z', now)).toBe('due now')
  })

  it('builds the About line', () => {
    expect(
      aboutLine({
        version: '1.37.0',
        nodeVersion: 'v22.11.0',
        platform: 'linux',
        arch: 'x64',
        uptime: 3 * 86400 + 4 * 3600,
        memory: { used: 312, total: 16000 },
      })
    ).toBe('v1.37.0 · up 3d 4h · Node 22 · linux/x64 · RSS 312 MB')
  })

  it('puts failed tasks first, running next and disabled last', () => {
    const sorted = sortTasks([
      task({ id: 'off', name: 'A off', enabled: false }),
      task({ id: 'ok', name: 'B ok' }),
      task({ id: 'run', name: 'C running', isRunning: true }),
      task({ id: 'fail', name: 'D failed', lastStatus: 'failed', lastError: 'boom' }),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['fail', 'run', 'ok', 'off'])
    expect(taskState(task({ lastRunAt: null, lastStatus: null }))).toBe('never')
  })

  it('names the seeded cleanup task for what it does now', () => {
    expect(taskDisplayName({ name: 'Blacklist Cleanup', type: 'cleanup' })).toBe('Cleanup')
    expect(taskDisplayName({ name: 'My cleanup', type: 'cleanup' })).toBe('My cleanup')
  })

  it('reads a backup date from its file name, not the file system', () => {
    const date = backupDate({
      name: 'hamster_2026-09-27_03-00-00.sql.gz',
      size: 1,
      createdAt: '1970-01-01T00:00:00.000Z',
    })
    expect(date?.toISOString()).toBe('2026-09-27T03:00:00.000Z')
  })

  it("prefers the server's own error message", async () => {
    const json = new Response(JSON.stringify({ error: { code: 'X', message: 'Task not found' } }), {
      status: 404,
    })
    expect(await responseError(json)).toBe('Task not found')
    const plain = new Response('nope', { status: 502, statusText: 'Bad Gateway' })
    expect(await responseError(plain)).toBe('HTTP 502 · Bad Gateway')
  })
})
