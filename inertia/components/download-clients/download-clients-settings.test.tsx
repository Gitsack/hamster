import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DownloadClientsSettings } from './download-clients-settings'
import { CLIENTS_FIXTURE, clientsFetchStub } from './clients_fixtures'
import { clientAddress, clientState, validateClient, DEFAULT_DRAFT } from './clients'

const visit = vi.fn()

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { visit: (...args: unknown[]) => visit(...args) },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') },
}))

vi.mock('@/components/folder-browser', () => ({
  FolderBrowser: () => <div data-testid="folder-browser" />,
}))

function rowFor(name: string) {
  return screen
    .getAllByText(name)
    .map((el) => el.closest('[data-slot="entity-row"]'))
    .find(Boolean) as HTMLElement
}

function writes(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method && init.method !== 'GET')
    .map(([url, init]) => ({
      url: String(url),
      method: init.method,
      body: init.body ? JSON.parse(init.body) : undefined,
    }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  visit.mockReset()
})

describe('clients', () => {
  const ok = { status: 'ok' as const, message: 'Reachable', latencyMs: 12, since: '' }
  const down = { status: 'error' as const, message: 'ECONNREFUSED', latencyMs: null, since: '' }
  const mapped = { enabled: true, remotePath: '/dl', localPath: '/mnt/dl' }
  const unmapped = { enabled: true, remotePath: '/dl', localPath: '' }

  it('has no status for a client that is switched off', () => {
    expect(clientState({ ...mapped, enabled: false }, down)).toEqual({ kind: 'off' })
  })

  it('reads reachability from the health cache', () => {
    expect(clientState(mapped, ok)).toEqual({ kind: 'reachable', latencyMs: 12 })
    expect(clientState(mapped, down)).toEqual({ kind: 'unreachable', message: 'ECONNREFUSED' })
    expect(clientState(mapped, undefined)).toEqual({ kind: 'unknown' })
  })

  it('asks for a path mapping when the remote folder was never mapped', () => {
    expect(clientState(unmapped, ok)).toEqual({ kind: 'mapping' })
    // Unreachable still outranks it.
    expect(clientState(unmapped, down).kind).toBe('unreachable')
  })

  it('lets a Test run here outrank the cache', () => {
    expect(clientState(mapped, down, { success: true, message: null, at: 1 }).kind).toBe(
      'reachable'
    )
    expect(clientState(mapped, ok, { success: false, message: 'Bad key', at: 1 })).toEqual({
      kind: 'unreachable',
      message: 'Bad key',
    })
  })

  it('writes the address with its scheme', () => {
    expect(clientAddress({ useSsl: true, host: 'sab', port: 443 })).toBe('https://sab:443')
  })

  it('asks for the credentials each type needs', () => {
    expect(validateClient({ ...DEFAULT_DRAFT, name: 'S', type: 'sabnzbd' }).apiKey).toMatch(
      /API key/
    )
    expect(validateClient({ ...DEFAULT_DRAFT, name: 'N', type: 'nzbget' }).username).toMatch(
      /username/
    )
    expect(validateClient({ ...DEFAULT_DRAFT, name: 'Q', type: 'qbittorrent' })).toEqual({})
    expect(
      validateClient({ ...DEFAULT_DRAFT, name: 'Q', type: 'qbittorrent', port: NaN }).port
    ).toBeTruthy()
  })
})

describe('DownloadClientsSettings', () => {
  it('puts Add client in the page header and lists clients as rows, not a table', async () => {
    vi.stubGlobal('fetch', vi.fn(clientsFetchStub()))
    const { container } = render(<DownloadClientsSettings />)

    expect(screen.getByRole('heading', { level: 2, name: 'Download clients' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add client' })).toBeInTheDocument()
    await waitFor(() => expect(rowFor('qBittorrent')).toBeTruthy())
    expect(container.querySelector('section#clients')).not.toBeNull()
    expect(container.querySelector('table')).toBeNull()
  })

  it('shows reachability from the health cache, failures first, with the reason', async () => {
    vi.stubGlobal('fetch', vi.fn(clientsFetchStub()))
    render(<DownloadClientsSettings />)

    await waitFor(() => expect(rowFor('qBittorrent')).toBeTruthy())
    const rows = Array.from(document.querySelectorAll('[data-slot="entity-row"]'))
    // Unreachable first, then the unmapped client, then the rest in saved order.
    expect(rows.map((row) => row.querySelector('button')?.textContent)).toEqual([
      'qBittorrent',
      'NZBGet',
      'SABnzbd',
      'Transmission',
    ])

    const qbit = rowFor('qBittorrent')
    expect(within(qbit).getByText('Unreachable')).toBeInTheDocument()
    expect(within(qbit).getByText('getaddrinfo ENOTFOUND qbittorrent')).toBeInTheDocument()
    expect(within(rowFor('NZBGet')).getByText('Needs path mapping')).toBeInTheDocument()
    const sab = rowFor('SABnzbd')
    expect(within(sab).getByText('Reachable')).toBeInTheDocument()
    expect(within(sab).getByText('http://sabnzbd:8080')).toBeInTheDocument()
    expect(within(sab).getByText('category hamster')).toBeInTheDocument()
    // Switched off: no verdict, just the switch.
    const transmission = rowFor('Transmission')
    expect(within(transmission).queryByText('Reachable')).not.toBeInTheDocument()
    expect(within(transmission).getByRole('switch')).not.toBeChecked()

    expect(screen.getByText('4 clients · 1 unreachable', { exact: false })).toBeInTheDocument()
  })

  it('switches a client off with its whole record and asks for a fresh health check', async () => {
    const fetchMock = vi.fn(clientsFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<DownloadClientsSettings />)

    const toggle = await screen.findByRole('switch', { name: 'Send grabs to SABnzbd' })
    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())

    const { id: _id, ...rest } = CLIENTS_FIXTURE[0]
    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        { url: '/api/v1/downloadclients/dc-1', method: 'PUT', body: { ...rest, enabled: false } },
        { url: '/api/v1/system/health/check', method: 'POST', body: undefined },
      ])
    )
  })

  it('links a client with a local path to Activity → Imports', async () => {
    vi.stubGlobal('fetch', vi.fn(clientsFetchStub()))
    render(<DownloadClientsSettings />)

    await waitFor(() => expect(rowFor('SABnzbd')).toBeTruthy())
    await userEvent.click(within(rowFor('SABnzbd')).getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Browse downloads' }))
    expect(visit).toHaveBeenCalledWith('/activity/imports?client=dc-1')

    // No local path: nothing to browse.
    await userEvent.click(
      within(rowFor('qBittorrent')).getByRole('button', { name: 'More actions' })
    )
    expect(screen.queryByRole('menuitem', { name: 'Browse downloads' })).not.toBeInTheDocument()
  })

  it('opens the editor as a Sheet and keeps fields it has no control for', async () => {
    const fetchMock = vi.fn(clientsFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<DownloadClientsSettings />)

    await waitFor(() => expect(rowFor('qBittorrent')).toBeTruthy())
    await userEvent.click(
      within(rowFor('qBittorrent')).getByRole('button', { name: 'qBittorrent' })
    )
    const sheet = await screen.findByRole('dialog', { name: 'qBittorrent' })

    const category = within(sheet).getByLabelText(/Category/)
    await userEvent.type(category, 'movies')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    const { id: _id, ...rest } = CLIENTS_FIXTURE[1]
    await waitFor(() =>
      expect(writes(fetchMock)[0]).toEqual({
        url: '/api/v1/downloadclients/dc-2',
        method: 'PUT',
        body: { ...rest, category: 'movies' },
      })
    )
    // addPaused was never on screen, and still went back as stored.
    expect(writes(fetchMock)[0].body.addPaused).toBe(true)
  })

  it('shows what Test found, including a folder that needs mapping', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        clientsFetchStub({
          test: {
            success: true,
            version: '4.3.3',
            remotePath: '/config/Downloads/complete',
            pathAccessible: false,
          },
        })
      )
    )
    render(<DownloadClientsSettings />)

    await userEvent.click(screen.getByRole('button', { name: 'Add client' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add download client' })
    await userEvent.type(within(sheet).getByLabelText('API key'), 'k')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Test' }))

    expect(await within(sheet).findByText('Connected · v4.3.3')).toBeInTheDocument()
    expect(within(sheet).getByText('Needs path mapping')).toBeInTheDocument()
    expect(within(sheet).getByLabelText(/Remote path \(complete\)/)).toHaveValue(
      '/config/Downloads/complete'
    )
  })

  it('deletes from the Sheet only after the AlertDialog confirms', async () => {
    const fetchMock = vi.fn(clientsFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<DownloadClientsSettings />)

    await waitFor(() => expect(rowFor('NZBGet')).toBeTruthy())
    await userEvent.click(within(rowFor('NZBGet')).getByRole('button', { name: 'NZBGet' }))
    const sheet = await screen.findByRole('dialog', { name: 'NZBGet' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Delete' }))

    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Delete NZBGet?')).toBeInTheDocument()
    expect(writes(fetchMock)).toEqual([])
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(writes(fetchMock)[0]).toEqual({
        url: '/api/v1/downloadclients/dc-3',
        method: 'DELETE',
        body: undefined,
      })
    )
  })

  it('offers an inline Add when there are no clients', async () => {
    vi.stubGlobal('fetch', vi.fn(clientsFetchStub({ clients: [] })))
    render(<DownloadClientsSettings />)

    expect(await screen.findByText(/No download clients yet/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add one' }))
    expect(await screen.findByRole('dialog', { name: 'Add download client' })).toBeInTheDocument()
  })

  it('shows a failed load inline with a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(clientsFetchStub({ clients: { status: 500 } })))
    render(<DownloadClientsSettings />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Download clients could not be loaded: HTTP 500'
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
