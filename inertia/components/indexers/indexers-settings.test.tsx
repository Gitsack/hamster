import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IndexersSettings } from './indexers-settings'
import {
  INDEXERS_FIXTURE,
  PROWLARR_STATUS_FIXTURE,
  PROWLARR_UNCONFIGURED,
  indexersFetchStub,
} from './indexers_fixtures'
import { displayUrl, prowlarrIndexerLine, prowlarrState, validateIndexer } from './indexers_api'

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') },
}))

function section(name: string) {
  return screen.getByRole('heading', { name, level: 3 }).closest('section') as HTMLElement
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
})

describe('indexers_api', () => {
  it('drops the scheme and trailing slash from a URL', () => {
    expect(displayUrl('https://drunkenslug.com/')).toBe('drunkenslug.com')
    expect(displayUrl('http://prowlarr:9696')).toBe('prowlarr:9696')
  })

  it('reads the Prowlarr count as indexers, protocols and what is off', () => {
    expect(prowlarrIndexerLine(PROWLARR_STATUS_FIXTURE)).toBe(
      '14 indexers · 11 usenet, 3 torrent · 1 off in Prowlarr'
    )
    expect(
      prowlarrIndexerLine({
        ...PROWLARR_STATUS_FIXTURE,
        indexers: { total: 1, enabled: 1, usenet: 1, torrent: 0 },
      })
    ).toBe('1 indexer')
    expect(prowlarrIndexerLine(null)).toBeNull()
  })

  it('works out the Prowlarr badge', () => {
    expect(prowlarrState({ enabled: false }, null)).toBe('paused')
    expect(prowlarrState({ enabled: true }, null)).toBe('checking')
    expect(prowlarrState({ enabled: true }, { ...PROWLARR_STATUS_FIXTURE, reachable: false })).toBe(
      'unreachable'
    )
    expect(
      prowlarrState(
        { enabled: true },
        { ...PROWLARR_STATUS_FIXTURE, indexers: { total: 2, enabled: 0, usenet: 0, torrent: 0 } }
      )
    ).toBe('empty')
    expect(prowlarrState({ enabled: true }, PROWLARR_STATUS_FIXTURE)).toBe('reachable')
  })

  it('validates the indexer editor in sentence case', () => {
    expect(validateIndexer({ name: '', url: 'ftp://x', apiKey: '' })).toEqual({
      name: 'Give it a name to tell it apart in search results.',
      url: 'Start with http:// or https://.',
      apiKey: 'The API key is required.',
    })
    expect(validateIndexer({ name: 'a', url: 'https://x.y', apiKey: 'k' })).toEqual({})
  })
})

describe('IndexersSettings', () => {
  it('has #prowlarr and #direct sections under an in-content header with Add indexer', async () => {
    vi.stubGlobal('fetch', vi.fn(indexersFetchStub()))
    const { container } = render(<IndexersSettings />)

    expect(screen.getByRole('heading', { level: 2, name: 'Indexers' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add indexer' })).toBeInTheDocument()
    expect(container.querySelector('section#prowlarr')).not.toBeNull()
    expect(container.querySelector('section#direct')).not.toBeNull()
    await screen.findByText('NZBgeek')
    // No tables anywhere: rows only.
    expect(container.querySelector('table')).toBeNull()
  })

  it('shows Prowlarr reachability and how many indexers it searches', async () => {
    vi.stubGlobal('fetch', vi.fn(indexersFetchStub()))
    render(<IndexersSettings />)

    const prowlarr = section('Prowlarr')
    expect(await within(prowlarr).findByText('Reachable')).toBeInTheDocument()
    expect(
      within(prowlarr).getByText('14 indexers · 11 usenet, 3 torrent · 1 off in Prowlarr')
    ).toBeInTheDocument()
    expect(within(prowlarr).getByText('prowlarr:9696')).toBeInTheDocument()
  })

  it('names why Prowlarr is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        indexersFetchStub({
          status: {
            ...PROWLARR_STATUS_FIXTURE,
            reachable: false,
            indexers: null,
            error: 'Invalid API key',
          },
        })
      )
    )
    render(<IndexersSettings />)

    const prowlarr = section('Prowlarr')
    expect(await within(prowlarr).findByText('Unreachable')).toBeInTheDocument()
    expect(within(prowlarr).getByText('Invalid API key')).toBeInTheDocument()
  })

  it('offers Connect when Prowlarr is not set up, and opens its editor', async () => {
    vi.stubGlobal('fetch', vi.fn(indexersFetchStub({ prowlarr: PROWLARR_UNCONFIGURED })))
    render(<IndexersSettings />)

    const prowlarr = section('Prowlarr')
    await userEvent.click(await within(prowlarr).findByRole('button', { name: 'Connect' }))
    expect(await screen.findByRole('dialog', { name: 'Connect Prowlarr' })).toBeInTheDocument()
  })

  it('switches a direct indexer on with its full record, inline', async () => {
    const fetchMock = vi.fn(indexersFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<IndexersSettings />)

    const toggle = await screen.findByRole('switch', { name: 'Search DrunkenSlug' })
    expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)

    await waitFor(() => expect(toggle).toBeChecked())
    const { id: _id, ...rest } = INDEXERS_FIXTURE[1]
    expect(writes(fetchMock)).toEqual([
      { url: '/api/v1/indexers/ix-2', method: 'PUT', body: { ...rest, enabled: true } },
    ])
  })

  it('deletes an indexer only after the AlertDialog confirms', async () => {
    const fetchMock = vi.fn(indexersFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<IndexersSettings />)

    await screen.findByText('NZBgeek')
    const row = screen.getByText('NZBgeek').closest('[data-slot="entity-row"]') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Delete NZBgeek?')).toBeInTheDocument()
    expect(writes(fetchMock)).toEqual([])

    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        { url: '/api/v1/indexers/ix-1', method: 'DELETE', body: undefined },
      ])
    )
  })

  it('adds an indexer from a Sheet, checking the fields first', async () => {
    const fetchMock = vi.fn(indexersFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<IndexersSettings />)

    await screen.findByText('NZBgeek')
    await userEvent.click(screen.getByRole('button', { name: 'Add indexer' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add indexer' })

    await userEvent.click(within(sheet).getByRole('button', { name: 'Add' }))
    expect(within(sheet).getByText('The API key is required.')).toBeInTheDocument()
    expect(writes(fetchMock)).toEqual([])

    await userEvent.type(within(sheet).getByLabelText('Name'), 'Tabula')
    await userEvent.type(within(sheet).getByLabelText('URL'), 'https://tabula.example')
    await userEvent.type(within(sheet).getByLabelText('API key'), 'abc')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        {
          url: '/api/v1/indexers',
          method: 'POST',
          body: { name: 'Tabula', url: 'https://tabula.example', apiKey: 'abc', enabled: true },
        },
      ])
    )
  })

  it('shows a failed load inline with its HTTP status and a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(indexersFetchStub({ indexers: { status: 502 } })))
    render(<IndexersSettings />)

    const direct = section('Direct indexers')
    expect(await within(direct).findByRole('alert')).toHaveTextContent(
      'Indexers could not be loaded: HTTP 502'
    )
    expect(within(direct).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('says so when nothing at all would be searched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(indexersFetchStub({ prowlarr: PROWLARR_UNCONFIGURED, indexers: [] }))
    )
    render(<IndexersSettings />)

    expect(
      await screen.findByText('Nothing is searched: connect Prowlarr or switch an indexer on.')
    ).toBeInTheDocument()
  })
})
