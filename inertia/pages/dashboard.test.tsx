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

const defaultProps = {
  stats: { movies: 42, tvShows: 15, episodes: 320, artists: 8, albums: 25, authors: 5, books: 30 },
  missing: { movies: 3, episodes: 10, albums: 2, books: 1 },
  activeDownloadCount: 0,
  failedLastDay: 0,
  recentAdditions: [] as any[],
  health: { downloadClients: [] as any[], indexers: [] as any[] },
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
    expect(screen.getByText('15 shows')).toBeInTheDocument()
    expect(screen.getByText('8 artists')).toBeInTheDocument()
    expect(screen.getByText('5 authors')).toBeInTheDocument()
  })

  it('shows missing counts', () => {
    render(<Dashboard {...defaultProps} />)
    for (const n of ['3', '10', '2', '1']) expect(screen.getByText(n)).toBeInTheDocument()
  })

  it('flags failures from the last day and links to history', () => {
    render(<Dashboard {...defaultProps} failedLastDay={12} />)
    const link = screen.getByText(/failed in the last 24h/).closest('a')
    expect(link).toHaveAttribute('href', '/activity/history')
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('says so when nothing failed', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('No failures in the last 24h')).toBeInTheDocument()
  })

  it('lists active downloads from the shared queue', () => {
    mockQueue.mockImplementation(() => [
      { id: 'q1', title: 'Some.Release.2024', status: 'downloading', progress: 41.6 },
    ])
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('Some.Release.2024')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('points at settings when no services are configured', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText(/No download client/)).toBeInTheDocument()
    expect(screen.getByText(/No indexer/)).toBeInTheDocument()
  })

  it('lists configured services', () => {
    render(
      <Dashboard
        {...defaultProps}
        health={{
          downloadClients: [{ id: '1', name: 'SABnzbd', type: 'sabnzbd', enabled: true }],
          indexers: [{ id: '2', name: 'NZBgeek', type: 'newznab', enabled: false }],
        }}
      />
    )
    expect(screen.getByText('SABnzbd')).toBeInTheDocument()
    expect(screen.getByText('NZBgeek')).toBeInTheDocument()
    expect(screen.getByText('disabled')).toBeInTheDocument()
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
