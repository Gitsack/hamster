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

vi.mock('@hugeicons/react', () => ({
  HugeiconsIcon: ({ className }: { className?: string }) => (
    <svg data-testid="icon" className={className} />
  ),
}))

vi.mock('@hugeicons/core-free-icons', () => ({
  Film01Icon: { name: 'Film01Icon' },
  Tv01Icon: { name: 'Tv01Icon' },
  MusicNote01Icon: { name: 'MusicNote01Icon' },
  Book01Icon: { name: 'Book01Icon' },
  Download04Icon: { name: 'Download04Icon' },
  CheckmarkCircle01Icon: { name: 'CheckmarkCircle01Icon' },
  Cancel01Icon: { name: 'Cancel01Icon' },
  ArrowDown01Icon: { name: 'ArrowDown01Icon' },
}))

const defaultProps = {
  stats: {
    movies: 42,
    tvShows: 15,
    episodes: 320,
    artists: 8,
    albums: 25,
    authors: 5,
    books: 30,
  },
  missing: {
    movies: 3,
    episodes: 10,
    albums: 2,
    books: 1,
  },
  activeDownloadCount: 0,
  recentAdditions: [] as any[],
  health: {
    downloadClients: [] as any[],
    indexers: [] as any[],
  },
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Dashboard', () => {
  it('renders all 4 stat cards with correct values', () => {
    render(<Dashboard {...defaultProps} />)
    // Stat card titles appear in stat cards and also in Missing section,
    // so use getAllByText for names that appear multiple times
    const movieElements = screen.getAllByText('Movies')
    expect(movieElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('TV Shows')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders stat card subtitles', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('320 episodes')).toBeInTheDocument()
    expect(screen.getByText('8 artists')).toBeInTheDocument()
    expect(screen.getByText('5 authors')).toBeInTheDocument()
  })

  it('shows empty state when no recent additions', () => {
    render(<Dashboard {...defaultProps} />)
    expect(
      screen.getByText('No items in your library yet. Start by adding some media!')
    ).toBeInTheDocument()
  })

  it('shows recent additions when provided', () => {
    const props = {
      ...defaultProps,
      recentAdditions: [
        {
          id: '1',
          title: 'Test Movie',
          type: 'movie' as const,
          imageUrl: null,
          addedAt: new Date().toISOString(),
          year: 2024,
          subtitle: null,
        },
      ],
    }
    render(<Dashboard {...props} />)
    expect(screen.getByText('Test Movie')).toBeInTheDocument()
  })

  it('shows missing counts', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('3 missing')).toBeInTheDocument()
    expect(screen.getByText('10 missing')).toBeInTheDocument()
    expect(screen.getByText('2 missing')).toBeInTheDocument()
    expect(screen.getByText('1 missing')).toBeInTheDocument()
  })

  it('shows empty states for health when no clients/indexers configured', () => {
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByText('No download clients configured')).toBeInTheDocument()
    expect(screen.getByText('No indexers configured')).toBeInTheDocument()
  })

  it('shows health status with clients and indexers', () => {
    const props = {
      ...defaultProps,
      health: {
        downloadClients: [{ id: '1', name: 'SABnzbd', type: 'sabnzbd', enabled: true }],
        indexers: [{ id: '2', name: 'NZBgeek', type: 'newznab', enabled: true }],
      },
    }
    render(<Dashboard {...props} />)
    expect(screen.getByText('SABnzbd')).toBeInTheDocument()
    expect(screen.getByText('NZBgeek')).toBeInTheDocument()
    // Both clients and indexers show "1 of 1 enabled"
    const enabledTexts = screen.getAllByText('1 of 1 enabled')
    expect(enabledTexts.length).toBe(2)
  })
})
