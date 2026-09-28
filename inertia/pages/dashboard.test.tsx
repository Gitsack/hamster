import { render, screen } from '@testing-library/react'
import Dashboard from './dashboard'

vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// The deck fetches on its own and has its own tests.
vi.mock('@/components/dashboard/for-you-deck', () => ({
  ForYouDeck: () => <section data-testid="for-you-deck" />,
}))

const mockQueue = vi.fn(() => [] as any[])
vi.mock('@/hooks/use_active_downloads', () => ({
  useActiveDownloads: () => ({ queue: mockQueue() }),
}))

const healthy = {
  level: 'ok' as const,
  checkedAt: new Date().toISOString(),
  canManage: true,
  configLoaded: true,
  downloadClients: [
    {
      id: 'c1',
      name: 'SABnzbd',
      type: 'sabnzbd',
      enabled: true,
      status: 'ok' as const,
      message: null,
      since: null,
    },
  ],
  indexers: { enabled: 14, total: 14 },
  rootFolders: { total: 4, problems: [] },
  freeBytes: 1.2 * 1024 ** 4,
  database: null,
  failedTasks: [],
  backup: { lastRunAt: new Date(Date.now() - 3 * 3600_000).toISOString(), lastStatus: 'success' },
  failedDeliveries: 0,
}

const defaultProps = {
  stats: { movies: 42, tvShows: 15, episodes: 320, artists: 8, albums: 25, authors: 5, books: 30 },
  missing: { movies: 3, episodes: 10, albums: 2, books: 1 },
  activeDownloadCount: 0,
  stuck: { count: 0, titles: [] as string[] },
  recentAdditions: [] as any[],
  health: healthy,
}

afterEach(() => mockQueue.mockReset().mockImplementation(() => []))

describe('Dashboard', () => {
  it('leads with the For you deck', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByTestId('for-you-deck')).toBeInTheDocument()
  })

  it('shows what is on disk, with the owned album count', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('320')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText(/15 shows/)).toBeInTheDocument()
    expect(screen.getByText(/8 artists/)).toBeInTheDocument()
    expect(screen.getByText(/5 authors/)).toBeInTheDocument()
  })

  it('shows what is still wanted next to each shelf, linking to the wanted list', () => {
    render(<Dashboard {...defaultProps} />)
    const wanted = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/library?tab=missing')
    expect(wanted.map((a) => a.textContent)).toEqual([
      '3 wanted',
      '10 wanted',
      '2 wanted',
      '1 wanted',
    ])
  })

  it('leaves out the wanted count and bar when nothing is missing', () => {
    render(
      <Dashboard {...defaultProps} missing={{ movies: 0, episodes: 0, albums: 0, books: 0 }} />
    )
    expect(screen.queryByText(/wanted/)).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /on disk/ })).not.toBeInTheDocument()
  })

  it('flags titles that are stuck, naming them', () => {
    render(
      <Dashboard
        {...defaultProps}
        stuck={{ count: 4, titles: ['Heat', 'Matlock S02E16', 'Ronin'] }}
      />
    )
    const link = screen.getByText(/titles are stuck/).closest('a')
    expect(link).toHaveAttribute('href', '/library?tab=missing')
    expect(screen.getByText(/Heat, Matlock S02E16, Ronin and 1 more/)).toBeInTheDocument()
  })

  it('stays quiet when nothing is stuck — routine failures are not counted', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.queryByText(/stuck/)).not.toBeInTheDocument()
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument()
  })

  it('lists active downloads from the shared queue', () => {
    mockQueue.mockImplementation(() => [
      { id: 'q1', title: 'Some.Release.2024', status: 'downloading', progress: 41.6 },
    ])
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('Some.Release.2024')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('sums up healthy services in one quiet line', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('Services ready:')).toBeInTheDocument()
    expect(screen.getByText('SABnzbd')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('1.2 TB')).toBeInTheDocument()
    expect(screen.getByText(/backup/)).toHaveTextContent('backup 3h ago')
    expect(screen.queryByText('Fix')).not.toBeInTheDocument()
  })

  it('points at settings when no services are configured', () => {
    render(
      <Dashboard
        {...defaultProps}
        health={{ ...healthy, downloadClients: [], indexers: { enabled: 0, total: 0 } }}
      />
    )
    expect(screen.getByText(/No download client/)).toBeInTheDocument()
    expect(screen.getByText(/No indexer/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Fix: No download client/)).toHaveAttribute(
      'href',
      '/settings/download-clients'
    )
    expect(screen.getByLabelText(/Fix: No indexer/)).toHaveAttribute('href', '/settings/indexers')
  })

  it('names an unreachable client from the health cache, with its error, age and a fix link', () => {
    render(
      <Dashboard
        {...defaultProps}
        health={{
          ...healthy,
          level: 'error',
          downloadClients: [
            {
              ...healthy.downloadClients[0],
              status: 'error',
              message: 'getaddrinfo ENOTFOUND sabnzbd',
              since: new Date(Date.now() - 2 * 3600_000).toISOString(),
            },
          ],
        }}
      />
    )
    expect(screen.getByText(/SABnzbd unreachable/)).toBeInTheDocument()
    expect(screen.getByText('getaddrinfo ENOTFOUND sabnzbd')).toBeInTheDocument()
    expect(screen.getByText(/· 2h/)).toBeInTheDocument()
    expect(screen.getByLabelText('Fix: SABnzbd unreachable')).toHaveAttribute(
      'href',
      '/settings/download-clients'
    )
    expect(screen.getByText('Services need attention:')).toBeInTheDocument()
  })

  it('lists failed tasks, folder problems and failed deliveries with their fix links', () => {
    render(
      <Dashboard
        {...defaultProps}
        health={{
          ...healthy,
          rootFolders: {
            total: 4,
            problems: [{ label: '/media/books', status: 'error', message: 'Not accessible' }],
          },
          failedTasks: [
            {
              id: 't1',
              name: 'Backup',
              lastError: 'spawn pg_dump ENOENT',
              lastRunAt: new Date().toISOString(),
            },
          ],
          failedDeliveries: 2,
        }}
      />
    )
    expect(screen.getByLabelText('Fix: Backup failed')).toHaveAttribute(
      'href',
      '/settings/system#tasks'
    )
    expect(screen.getByText('spawn pg_dump ENOENT')).toBeInTheDocument()
    expect(screen.getByLabelText('Fix: /media/books: not accessible')).toBeInTheDocument()
    expect(screen.getByLabelText('Fix: 2 notifications failed to send in 24h')).toHaveAttribute(
      'href',
      '/settings/notifications#deliveries'
    )
  })

  it('shows problems without fix links to someone who cannot change settings', () => {
    render(
      <Dashboard
        {...defaultProps}
        health={{
          ...healthy,
          canManage: false,
          indexers: { enabled: 0, total: 3 },
        }}
      />
    )
    expect(screen.getByText('Every indexer is switched off')).toBeInTheDocument()
    expect(screen.queryByText('Fix')).not.toBeInTheDocument()
  })

  it('says it is still checking right after a restart instead of guessing', () => {
    render(
      <Dashboard {...defaultProps} health={{ ...healthy, level: 'starting', checkedAt: null }} />
    )
    expect(screen.getByText('Checking services:')).toBeInTheDocument()
    expect(screen.getByText(/checking…/)).toBeInTheDocument()
  })

  it('does not claim nothing is configured when its own queries failed', () => {
    render(
      <Dashboard
        {...defaultProps}
        health={{
          ...healthy,
          configLoaded: false,
          downloadClients: [],
          indexers: { enabled: 0, total: 0 },
        }}
      />
    )
    expect(screen.queryByText(/No download client/)).not.toBeInTheDocument()
    expect(screen.queryByText(/No indexer/)).not.toBeInTheDocument()
  })

  it('shows recently imported titles', () => {
    render(
      <Dashboard
        {...defaultProps}
        recentAdditions={[
          {
            id: '1',
            title: 'Test Movie',
            type: 'movie',
            imageUrl: null,
            addedAt: new Date().toISOString(),
            year: 2024,
            subtitle: null,
          },
        ]}
      />
    )
    expect(screen.getByText('Test Movie').closest('a')).toHaveAttribute('href', '/movie/1')
  })
})
