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
  stuck: { count: 0, titles: [] as string[] },
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
    // The only indexer is switched off: counted as off, and flagged.
    expect(screen.getByText(/1 off/)).toBeInTheDocument()
    expect(screen.getByText('Services need attention:')).toBeInTheDocument()
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
