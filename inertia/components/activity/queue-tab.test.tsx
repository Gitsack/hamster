import { render, screen, within } from '@testing-library/react'
import { QueueTab, type DownloadRecord } from './queue-tab'

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const mockQueue = vi.fn(() => [] as any[])
vi.mock('@/hooks/use_active_downloads', () => ({
  useActiveDownloads: () => ({
    queue: mockQueue(),
    counts: null,
    refresh: async () => {},
    refreshCounts: async () => {},
  }),
}))

function record(overrides: Partial<DownloadRecord>): DownloadRecord {
  return {
    id: 'd1',
    title: 'Some.Release.2024.1080p',
    status: 'failed',
    size: 2 * 1073741824,
    mediaType: 'movies',
    downloadClient: 'SABnzbd',
    errorMessage: null,
    startedAt: '2026-09-27T10:00:00Z',
    completedAt: null,
    updatedAt: '2026-09-27T10:05:00Z',
    stuck: false,
    ...overrides,
  }
}

function mockHistory(failed: DownloadRecord[], importing: DownloadRecord[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const rows = url.includes('status=failed')
        ? failed
        : url.includes('status=importing')
          ? importing
          : []
      return new Response(JSON.stringify({ data: rows, meta: { total: rows.length } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
  )
}

function renderTab() {
  return render(<QueueTab reloadSignal={0} processing={false} onProcessDownloads={() => {}} />)
}

function section(name: string) {
  return screen.getByRole('heading', { name }).closest('section') as HTMLElement
}

afterEach(() => {
  vi.unstubAllGlobals()
  mockQueue.mockReset().mockImplementation(() => [])
})

describe('QueueTab', () => {
  it('puts failures and stalled imports under Needs attention, with the reason on the row', async () => {
    mockHistory(
      [record({ id: 'f1', title: 'Broken.Release', errorMessage: 'CRC error during unpack' })],
      [
        record({ id: 'i1', title: 'Stalled.Release', status: 'importing', stuck: true }),
        record({ id: 'i2', title: 'Moving.Release', status: 'importing', stuck: false }),
      ]
    )
    renderTab()

    const attention = section('Needs attention')
    expect(await within(attention).findByText('Broken.Release')).toBeInTheDocument()
    expect(within(attention).getByText('CRC error during unpack')).toBeInTheDocument()
    expect(within(attention).getByText('Stalled.Release')).toBeInTheDocument()
    expect(within(attention).getByText('Import stalled')).toBeInTheDocument()
    expect(within(attention).queryByText('Moving.Release')).not.toBeInTheDocument()

    // An import still moving is in progress, not a problem.
    const downloading = section('Downloading')
    expect(within(downloading).getByText('Moving.Release')).toBeInTheDocument()
    expect(within(downloading).getByText('Importing')).toBeInTheDocument()
  })

  it('shows live downloads with their percentage and says when nothing needs attention', async () => {
    mockQueue.mockImplementation(() => [
      {
        id: 'q1',
        externalId: 'x',
        title: 'Active.Release',
        status: 'downloading',
        progress: 42.4,
        size: 1073741824,
        remaining: null,
        eta: 600,
        albumId: null,
        movieId: 'm1',
        tvShowId: null,
        episodeId: null,
        bookId: null,
        downloadClient: 'SABnzbd',
        startedAt: '2026-09-27T10:00:00Z',
      },
    ])
    mockHistory([], [])
    renderTab()

    expect(await screen.findByText('Nothing needs attention.')).toBeInTheDocument()
    const downloading = section('Downloading')
    expect(within(downloading).getByText('Active.Release')).toBeInTheDocument()
    expect(within(downloading).getByText('42%')).toBeInTheDocument()
    expect(within(downloading).getByText('10m left')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel download' })).toBeInTheDocument()
  })

  it('reports a failed fetch inline with the HTTP status and a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 502, statusText: 'Bad Gateway' }))
    )
    renderTab()

    const alert = await within(section('Needs attention')).findByRole('alert')
    expect(alert).toHaveTextContent('HTTP 502 · Bad Gateway')
    expect(within(alert).getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('leads Needs attention with a client the health monitor cannot reach', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = url.includes('health-summary')
          ? {
              downloadClients: [
                {
                  id: 'c1',
                  name: 'SABnzbd',
                  type: 'sabnzbd',
                  status: 'error',
                  message: 'getaddrinfo ENOTFOUND sabnzbd',
                  since: new Date(Date.now() - 3 * 3600_000).toISOString(),
                },
                { id: 'c2', name: 'qBit', type: 'qbittorrent', status: 'ok', message: 'Reachable' },
              ],
            }
          : { data: [], meta: { total: 0 } }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )
    render(<QueueTab reloadSignal={0} processing={false} onProcessDownloads={() => {}} isAdmin />)

    const attention = section('Needs attention')
    expect(await within(attention).findByText('SABnzbd unreachable')).toBeInTheDocument()
    expect(within(attention).getByText('getaddrinfo ENOTFOUND sabnzbd')).toBeInTheDocument()
    expect(within(attention).getByText('down 3h')).toBeInTheDocument()
    expect(within(attention).queryByText(/qBit/)).not.toBeInTheDocument()
    expect(within(attention).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings/download-clients'
    )
  })
})
