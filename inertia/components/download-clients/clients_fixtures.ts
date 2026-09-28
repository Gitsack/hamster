import type { HealthSummary } from '@/components/system/system_api'
import { DEFAULT_DRAFT, type DownloadClient } from './clients'

/** Canned Download clients API for tests and stories. */

export const CLIENTS_FIXTURE: DownloadClient[] = [
  {
    ...DEFAULT_DRAFT,
    id: 'dc-1',
    name: 'SABnzbd',
    type: 'sabnzbd',
    host: 'sabnzbd',
    port: 8080,
    apiKey: 'sab-key',
    category: 'hamster',
    remotePath: '/downloads/complete',
    localPath: '/mnt/downloads/complete',
  },
  {
    ...DEFAULT_DRAFT,
    id: 'dc-2',
    name: 'qBittorrent',
    type: 'qbittorrent',
    host: 'qbittorrent',
    port: 8081,
    username: 'admin',
    password: 'secret',
    addPaused: true,
  },
  {
    ...DEFAULT_DRAFT,
    id: 'dc-3',
    name: 'NZBGet',
    type: 'nzbget',
    host: 'nzbget',
    port: 6789,
    username: 'nzbget',
    remotePath: '/data/complete',
  },
  {
    ...DEFAULT_DRAFT,
    id: 'dc-4',
    name: 'Transmission',
    type: 'transmission',
    host: 'transmission',
    port: 9091,
    enabled: false,
  },
]

export const CLIENTS_HEALTH_FIXTURE: HealthSummary = {
  level: 'warning',
  checkedAt: '2026-09-27T12:04:00.000Z',
  stale: false,
  checking: false,
  checks: [],
  downloadClients: [
    {
      id: 'dc-1',
      name: 'SABnzbd',
      type: 'sabnzbd',
      status: 'ok',
      message: 'Reachable',
      latencyMs: 18,
      since: '2026-09-27T09:00:00.000Z',
    },
    {
      id: 'dc-2',
      name: 'qBittorrent',
      type: 'qbittorrent',
      status: 'error',
      message: 'getaddrinfo ENOTFOUND qbittorrent',
      latencyMs: null,
      since: '2026-09-27T11:40:00.000Z',
    },
    {
      id: 'dc-3',
      name: 'NZBGet',
      type: 'nzbget',
      status: 'ok',
      message: 'Reachable',
      latencyMs: 25,
      since: '2026-09-27T09:00:00.000Z',
    },
  ],
  rootFolders: [],
  freeBytes: null,
  failedTasks: [],
}

interface StubOptions {
  clients?: DownloadClient[] | { status: number }
  health?: HealthSummary | { status: number }
  test?: {
    success: boolean
    version?: string
    error?: string
    remotePath?: string
    pathAccessible?: boolean
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** A fetch that answers the Download clients page. Writes echo their body back. */
export function clientsFetchStub(options: StubOptions = {}) {
  const clients = options.clients ?? CLIENTS_FIXTURE
  const health = options.health ?? CLIENTS_HEALTH_FIXTURE
  const test = options.test ?? { success: true, version: '4.3.3' }

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined

    if (url === '/api/v1/downloadclients' && method === 'GET') {
      if (!Array.isArray(clients)) return new Response('boom', { status: clients.status })
      return json(clients)
    }
    if (url === '/api/v1/downloadclients' && method === 'POST') {
      return json({ id: 'dc-new', ...body }, 201)
    }
    if (url === '/api/v1/downloadclients/test') return json(test)
    const match = url.match(/^\/api\/v1\/downloadclients\/([^/]+)$/)
    if (match && method === 'PUT') return json({ id: match[1], ...body })
    if (match && method === 'DELETE') return new Response(null, { status: 204 })

    if (url === '/api/v1/system/health-summary') {
      if ('status' in health && typeof health.status === 'number') {
        return new Response('boom', { status: health.status })
      }
      return json(health)
    }
    if (url === '/api/v1/system/health/check') return json({ started: true, checking: true }, 202)

    return new Response('not found', { status: 404 })
  }
}
