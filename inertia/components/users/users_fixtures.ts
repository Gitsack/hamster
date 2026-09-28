import type { UserEntry } from './users_api'

/** Canned Users API for tests and stories. */

export const USERS_FIXTURE: UserEntry[] = [
  {
    id: 'u-kid',
    fullName: 'Kid',
    email: 'kid@home.lan',
    isAdmin: false,
    createdAt: '2025-11-02T10:00:00.000Z',
  },
  {
    id: 'u-me',
    fullName: 'Martin',
    email: 'martin@home.lan',
    isAdmin: true,
    createdAt: '2025-03-01T10:00:00.000Z',
  },
  {
    id: 'u-guest',
    fullName: null,
    email: 'guest@home.lan',
    isAdmin: false,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
]

interface StubOptions {
  users?: UserEntry[] | { status: number }
  localAccess?: { enabled: boolean; userId: string | null }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** A fetch that answers the Users & access page. Writes echo their body back. */
export function usersFetchStub(options: StubOptions = {}) {
  const users = options.users ?? USERS_FIXTURE
  let localAccess = options.localAccess ?? { enabled: true, userId: 'u-kid' }

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined

    if (url === '/api/v1/users' && method === 'GET') {
      if (!Array.isArray(users)) return new Response('boom', { status: users.status })
      return json(users)
    }
    if (url === '/api/v1/users' && method === 'POST') {
      return json({ id: 'u-new', createdAt: new Date().toISOString(), ...body }, 201)
    }
    if (/^\/api\/v1\/users\/[^/]+\/reset-password$/.test(url)) {
      return json({ message: 'Password reset' })
    }
    const match = url.match(/^\/api\/v1\/users\/([^/]+)$/)
    if (match && method === 'PUT') return json({ id: match[1], ...body })
    if (match && method === 'DELETE') return json({ message: 'User deleted' })

    if (url === '/api/v1/settings/local-access') {
      if (method === 'PUT') localAccess = body
      return json({ options: localAccess })
    }

    return new Response('not found', { status: 404 })
  }
}
