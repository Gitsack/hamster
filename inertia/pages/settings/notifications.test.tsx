import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Notifications from './notifications'

vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/layout/settings-layout', () => ({
  SettingsLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn() },
}))

const events = {
  onGrab: false,
  onDownloadComplete: true,
  onImportComplete: true,
  onImportFailed: true,
  onUpgrade: true,
  onRename: false,
  onDelete: false,
  onHealthIssue: true,
  onHealthRestored: false,
}

const providers = [
  {
    id: 'p1',
    name: 'Phone',
    type: 'ntfy',
    enabled: true,
    settings: { topic: 'hamster', password: '****' },
    ...events,
    includeMusic: true,
    includeMovies: true,
    includeTv: true,
    includeBooks: true,
    lastDelivery: { success: true, status: null, error: null, createdAt: new Date().toISOString() },
  },
]

const webhooks = [
  {
    id: 'w1',
    name: 'Jellyfin refresh',
    url: 'http://jf:8096/Library/Refresh?api_key=****',
    enabled: true,
    method: 'POST',
    headers: null,
    payloadTemplate: null,
    ...events,
    lastDelivery: {
      success: false,
      status: 401,
      error: 'HTTP 401',
      createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    },
  },
]

const types = [
  {
    type: 'ntfy',
    name: 'Ntfy',
    fields: [
      { name: 'topic', label: 'Topic', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'password', required: false },
    ],
  },
  {
    type: 'email',
    name: 'Email',
    fields: [{ name: 'secure', label: 'Use SSL/TLS', type: 'boolean', required: false }],
  },
]

const webhookHistory = [
  {
    id: 'h1',
    webhookId: 'w1',
    eventType: 'import.completed',
    payload: { eventType: 'import.completed' },
    responseStatus: 401,
    responseBody: 'Unauthorized: bad api_key',
    success: false,
    errorMessage: 'HTTP 401',
    createdAt: new Date().toISOString(),
  },
]

const calls: { url: string; method: string; body: any }[] = []

function json(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  calls.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null })
      if (method === 'PUT' && url === '/api/v1/webhooks/w1') {
        return json({ ...webhooks[0], ...JSON.parse(String(init!.body)) })
      }
      if (url === '/api/v1/notifications') return json(providers)
      if (url === '/api/v1/webhooks') return json(webhooks)
      if (url === '/api/v1/notifications/types') return json(types)
      if (url.startsWith('/api/v1/notifications/history')) return json([])
      if (url.startsWith('/api/v1/webhooks/history')) return json(webhookHistory)
      return json({ error: 'unexpected' }, 500)
    })
  )
})

describe('Notifications page', () => {
  it('lists push and webhook targets together, failures first', async () => {
    render(<Notifications />)

    const targets = await screen.findByRole('region', { name: 'Targets' })
    const rows = await within(targets).findAllByRole('button', { name: /Phone|Jellyfin refresh/ })
    expect(rows.map((row) => row.textContent)).toEqual(['Jellyfin refresh', 'Phone'])

    // The failing webhook says why, in the row.
    expect(within(targets).getByText(/HTTP 401 · 3h ago/)).toBeInTheDocument()
    // The event summary includes Download finished.
    expect(within(targets).getAllByText(/Download finished/).length).toBeGreaterThan(0)
  })

  it('shows the cross-target delivery log with the response body on expand', async () => {
    render(<Notifications />)

    const log = await screen.findByRole('region', { name: 'Deliveries' })
    const row = await within(log).findByRole('button', { name: /Jellyfin refresh/ })
    fireEvent.click(row)
    expect(within(log).getByText('Unauthorized: bad api_key')).toBeInTheDocument()
  })

  it('opens a target in a sheet and keeps the masked URL as it is', async () => {
    render(<Notifications />)

    fireEvent.click(await screen.findByRole('button', { name: 'Jellyfin refresh' }))
    const sheet = await screen.findByRole('dialog')
    const url = within(sheet).getByLabelText(/^URL/) as HTMLInputElement
    expect(url.value).toBe('http://jf:8096/Library/Refresh?api_key=****')
    expect(within(sheet).getByText(/Not supported for webhooks yet/)).toBeInTheDocument()

    fireEvent.change(within(sheet).getByLabelText(/^Name/), { target: { value: 'JF' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    const put = calls.find((c) => c.method === 'PUT')!
    expect(put.url).toBe('/api/v1/webhooks/w1')
    expect(put.body).toMatchObject({
      name: 'JF',
      url: 'http://jf:8096/Library/Refresh?api_key=****',
      payloadTemplate: null,
    })
  })

  it('offers every push type the server knows, Ntfy included', async () => {
    render(<Notifications />)
    await screen.findByRole('region', { name: 'Targets' })
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/v1/notifications/types')).toBe(true)
    )

    fireEvent.click(screen.getByRole('button', { name: /Add target/ }))
    expect(await screen.findByRole('menuitem', { name: /Ntfy/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Custom webhook/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Plex/ })).toBeInTheDocument()
  })
})
