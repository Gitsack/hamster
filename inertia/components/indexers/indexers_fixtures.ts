import type { Indexer, ProwlarrConfig, ProwlarrStatus } from './indexers_api'

/** Canned Indexers API for tests and stories. */

export const INDEXERS_FIXTURE: Indexer[] = [
  {
    id: 'ix-1',
    name: 'NZBgeek',
    url: 'https://api.nzbgeek.info',
    apiKey: 'geek-key',
    categories: [3000, 3010],
    enabled: true,
    priority: 25,
  },
  {
    id: 'ix-2',
    name: 'DrunkenSlug',
    url: 'https://drunkenslug.com/',
    apiKey: 'slug-key',
    categories: [],
    enabled: false,
    priority: 25,
  },
]

export const PROWLARR_FIXTURE: ProwlarrConfig = {
  configured: true,
  id: 'pw-1',
  url: 'http://prowlarr:9696',
  apiKey: 'prowlarr-key',
  syncCategories: [3000, 3010, 3040],
  enabled: true,
}

export const PROWLARR_UNCONFIGURED: ProwlarrConfig = {
  configured: false,
  url: '',
  apiKey: '',
  syncCategories: [],
  enabled: false,
}

export const PROWLARR_STATUS_FIXTURE: ProwlarrStatus = {
  configured: true,
  enabled: true,
  reachable: true,
  indexers: { total: 15, enabled: 14, usenet: 11, torrent: 3 },
  error: null,
  checkedAt: '2026-09-27T12:04:00.000Z',
}

interface StubOptions {
  indexers?: Indexer[] | { status: number }
  prowlarr?: ProwlarrConfig
  status?: ProwlarrStatus
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * A fetch that answers the Indexers page's requests. Writes echo their body
 * back (with the id from the URL) so the page can merge the answer.
 */
export function indexersFetchStub(options: StubOptions = {}) {
  const indexers = options.indexers ?? INDEXERS_FIXTURE
  const prowlarr = options.prowlarr ?? PROWLARR_FIXTURE
  const status = options.status ?? PROWLARR_STATUS_FIXTURE

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined

    if (url === '/api/v1/indexers' && method === 'GET') {
      if (!Array.isArray(indexers)) return new Response('boom', { status: indexers.status })
      return json(indexers)
    }
    if (url === '/api/v1/indexers' && method === 'POST') return json({ id: 'ix-new', ...body }, 201)
    if (url === '/api/v1/indexers/test') return json({ success: true })
    const match = url.match(/^\/api\/v1\/indexers\/([^/]+)$/)
    if (match && method === 'PUT') return json({ id: match[1], ...body })
    if (match && method === 'DELETE') return new Response(null, { status: 204 })

    if (url === '/api/v1/prowlarr' && method === 'GET') return json(prowlarr)
    if (url === '/api/v1/prowlarr' && method === 'PUT') {
      return json({ ...prowlarr, configured: true, ...body })
    }
    if (url === '/api/v1/prowlarr/status') return json(status)
    if (url === '/api/v1/prowlarr/test') return json({ success: true, version: '1.24.3' })

    return new Response('not found', { status: 404 })
  }
}
