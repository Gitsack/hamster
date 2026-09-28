import type { BackupList, HealthSummary, ScheduledTask, SystemInfo } from './system_api'

/**
 * Canned API answers for the System page's stories and tests: one client
 * down, one folder short on space, and a backup task that keeps failing.
 */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const minutesAhead = (m: number) => new Date(Date.now() + m * 60_000).toISOString()

export const HEALTH_FIXTURE: HealthSummary = {
  level: 'error',
  checkedAt: minutesAgo(0.4),
  stale: false,
  checking: false,
  checks: [
    {
      name: 'database',
      label: 'Database',
      status: 'ok',
      message: 'Connected (3 ms)',
      since: minutesAgo(600),
    },
    {
      name: 'rootFolders',
      label: 'Root folders',
      status: 'warning',
      message: '/media/books: Low space (6 GB free)',
      since: minutesAgo(90),
    },
    {
      name: 'downloadClients',
      label: 'Download clients',
      status: 'warning',
      message: 'Unreachable — SABnzbd: getaddrinfo ENOTFOUND sabnzbd',
      since: minutesAgo(185),
    },
  ],
  downloadClients: [
    {
      id: 'c1',
      name: 'SABnzbd',
      type: 'sabnzbd',
      status: 'error',
      message: 'getaddrinfo ENOTFOUND sabnzbd',
      latencyMs: null,
      since: minutesAgo(185),
    },
    {
      id: 'c2',
      name: 'qBittorrent',
      type: 'qbittorrent',
      status: 'ok',
      message: 'Reachable',
      latencyMs: 41,
      since: minutesAgo(600),
    },
  ],
  rootFolders: [
    {
      id: 'f1',
      path: '/media/movies',
      mediaType: 'movies',
      status: 'ok',
      message: 'Readable',
      freeBytes: 1.2 * 1024 ** 4,
    },
    {
      id: 'f2',
      path: '/media/tv',
      mediaType: 'tv',
      status: 'ok',
      message: 'Readable',
      freeBytes: 1.2 * 1024 ** 4,
    },
    {
      id: 'f3',
      path: '/media/books',
      mediaType: 'books',
      status: 'warning',
      message: 'Low space (6 GB free)',
      freeBytes: 6 * 1024 ** 3,
    },
  ],
  freeBytes: 1.2 * 1024 ** 4 + 6 * 1024 ** 3,
  failedTasks: [
    {
      id: 't-backup',
      name: 'Backup',
      type: 'backup',
      lastError: "EACCES: permission denied, mkdir '/config'",
      lastRunAt: minutesAgo(200),
    },
  ],
}

export const TASKS_FIXTURE: ScheduledTask[] = [
  {
    id: 't-dl',
    name: 'Download Monitor',
    type: 'download_monitor',
    intervalMinutes: 1,
    enabled: true,
    isRunning: false,
    lastRunAt: minutesAgo(0.5),
    nextRunAt: minutesAhead(0.5),
    lastDurationMs: 420,
    lastStatus: 'success',
    lastError: null,
  },
  {
    id: 't-backup',
    name: 'Backup',
    type: 'backup',
    intervalMinutes: 1440,
    enabled: true,
    isRunning: false,
    lastRunAt: minutesAgo(200),
    nextRunAt: minutesAhead(1240),
    lastDurationMs: 35,
    lastStatus: 'failed',
    lastError: "EACCES: permission denied, mkdir '/config'",
  },
  {
    id: 't-lib',
    name: 'Library Scan',
    type: 'library_scan',
    intervalMinutes: 240,
    enabled: true,
    isRunning: true,
    lastRunAt: minutesAgo(3),
    nextRunAt: minutesAhead(237),
    lastDurationMs: 712_000,
    lastStatus: 'success',
    lastError: null,
  },
  {
    id: 't-clean',
    name: 'Blacklist Cleanup',
    type: 'cleanup',
    intervalMinutes: 1440,
    enabled: true,
    isRunning: false,
    lastRunAt: minutesAgo(600),
    nextRunAt: minutesAhead(840),
    lastDurationMs: 180,
    lastStatus: 'success',
    lastError: null,
  },
  {
    id: 't-rss',
    name: 'RSS Sync',
    type: 'rss_sync',
    intervalMinutes: 15,
    enabled: false,
    isRunning: false,
    lastRunAt: minutesAgo(3000),
    nextRunAt: minutesAhead(15),
    lastDurationMs: 5100,
    lastStatus: 'success',
    lastError: null,
  },
]

export const BACKUPS_FIXTURE: BackupList = {
  backups: [
    {
      name: 'hamster_2026-09-26_03-00-00.sql.gz',
      size: 48.2 * 1024 ** 2,
      createdAt: minutesAgo(1300),
    },
    {
      name: 'hamster_2026-09-25_03-00-00.sql.gz',
      size: 47.9 * 1024 ** 2,
      createdAt: minutesAgo(2740),
    },
  ],
  directory: '/app/tmp/backups',
  retention: 5,
  running: false,
}

export const INFO_FIXTURE: SystemInfo = {
  version: '1.37.0',
  nodeVersion: 'v22.11.0',
  platform: 'linux',
  arch: 'x64',
  uptime: 3 * 86400 + 4 * 3600 + 120,
  memory: { used: 312, total: 15_872 },
}

/** GET fixtures by URL; writes succeed after a short delay and echo. */
export function systemFetchStub(overrides: { health?: HealthSummary } = {}) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'
    if (method !== 'GET') {
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (method === 'DELETE') return new Response(null, { status: 204 })
      if (url.endsWith('/health/check')) return Response.json({ started: true }, { status: 202 })
      if (/\/system\/tasks\/[^/]+$/.test(url)) {
        const id = url.split('/').pop()
        const current = TASKS_FIXTURE.find((t) => t.id === id)
        return Response.json({ task: { ...current, ...JSON.parse(String(init?.body ?? '{}')) } })
      }
      return Response.json({ message: 'ok' })
    }
    if (url.includes('/system/health-summary'))
      return Response.json(overrides.health ?? HEALTH_FIXTURE)
    if (url.includes('/system/tasks')) return Response.json({ tasks: TASKS_FIXTURE })
    if (url.includes('/system/backup')) return Response.json(BACKUPS_FIXTURE)
    if (url.includes('/system/info')) return Response.json(INFO_FIXTURE)
    return new Response('Not found', { status: 404, statusText: 'Not Found' })
  }
}
