import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Library from './index'

// Mock Inertia
vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  router: { visit: vi.fn() },
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
  usePage: () => ({ props: {} }),
}))

// Mock layout
vi.mock('@/components/layout', () => ({
  AppLayout: ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => (
    <div>
      {actions && <div data-testid="layout-actions">{actions}</div>}
      {children}
    </div>
  ),
}))

// Mock Hugeicons
vi.mock('@hugeicons/react', () => ({
  HugeiconsIcon: ({ className }: { className?: string }) => (
    <svg data-testid="icon" className={className} />
  ),
}))

vi.mock('@hugeicons/core-free-icons', () => {
  const m = (name: string) => ({ name })
  return {
    Add01Icon: m('Add01Icon'),
    Search01Icon: m('Search01Icon'),
    GridIcon: m('GridIcon'),
    Menu01Icon: m('Menu01Icon'),
    SortingIcon: m('SortingIcon'),
    MusicNote01Icon: m('MusicNote01Icon'),
    Film01Icon: m('Film01Icon'),
    Tv01Icon: m('Tv01Icon'),
    Book01Icon: m('Book01Icon'),
    MoreVerticalIcon: m('MoreVerticalIcon'),
    Delete02Icon: m('Delete02Icon'),
    EyeIcon: m('EyeIcon'),
    CheckmarkCircle02Icon: m('CheckmarkCircle02Icon'),
    Download01Icon: m('Download01Icon'),
    Clock01Icon: m('Clock01Icon'),
    FolderSearchIcon: m('FolderSearchIcon'),
  }
})

// Mock sonner
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

// Mock operation tracker
vi.mock('@/hooks/use_operation_tracker', () => ({
  useOperationTrackerContext: () => ({ runBulk: vi.fn() }),
}))

// Mock media status badge
vi.mock('@/components/library/media-status-badge', () => ({
  MediaStatusBadge: () => null,
  getMediaItemStatus: () => ({ status: 'none', progress: 0 }),
}))

// Track fetch calls
let fetchMock: ReturnType<typeof vi.fn>

const settingsResponse = (enabledTypes: string[]) => ({
  ok: true,
  json: () => Promise.resolve({ enabledMediaTypes: enabledTypes }),
})

const moviesResponse = (movies: any[] = []) => ({
  ok: true,
  json: () => Promise.resolve(movies),
})

const queueResponse = (queue: any[] = []) => ({
  ok: true,
  json: () => Promise.resolve(queue),
})

const emptyOkResponse = () => ({
  ok: true,
  json: () => Promise.resolve([]),
})

function setupFetchMock(options: {
  enabledTypes?: string[]
  movies?: any[]
  artists?: any[]
  tvShows?: any[]
  authors?: any[]
  queue?: any[]
} = {}) {
  const {
    enabledTypes = ['movies'],
    movies = [],
    artists = [],
    tvShows = [],
    authors = [],
    queue = [],
  } = options

  fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/v1/settings') return Promise.resolve(settingsResponse(enabledTypes))
    if (url === '/api/v1/queue') return Promise.resolve(queueResponse(queue))
    if (url === '/api/v1/movies') return Promise.resolve(moviesResponse(movies))
    if (url === '/api/v1/artists') return Promise.resolve(moviesResponse(artists))
    if (url === '/api/v1/tvshows') return Promise.resolve(moviesResponse(tvShows))
    if (url === '/api/v1/authors') return Promise.resolve(moviesResponse(authors))
    return Promise.resolve(emptyOkResponse())
  })
  global.fetch = fetchMock
}

beforeEach(() => {
  // Reset URL search params
  window.history.replaceState({}, '', '/')
  setupFetchMock()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Library', () => {
  describe('initial loading', () => {
    it('renders the page title', async () => {
      render(<Library />)
      expect(document.querySelector('title')?.textContent).toBe('Library')
    })

    it('shows loading skeletons initially', () => {
      render(<Library />)
      // Skeleton cards are rendered during loading
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('fetches settings on mount', async () => {
      render(<Library />)
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/settings')
      })
    })

    it('fetches queue and movies data on mount', async () => {
      render(<Library />)
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/queue')
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/movies')
      })
    })
  })

  describe('tab rendering', () => {
    it('renders tabs based on enabled media types from settings', async () => {
      setupFetchMock({ enabledTypes: ['movies', 'tv', 'music'] })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Movies')).toBeInTheDocument()
        expect(screen.getByText('TV Shows')).toBeInTheDocument()
        expect(screen.getByText('Music')).toBeInTheDocument()
      })
    })

    it('always includes Missing tab', async () => {
      setupFetchMock({ enabledTypes: ['movies'] })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Missing')).toBeInTheDocument()
      })
    })

    it('switches tab when clicked', async () => {
      const user = userEvent.setup()
      setupFetchMock({ enabledTypes: ['movies', 'music'] })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Music')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Music'))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/artists')
      })
    })
  })

  describe('movies content', () => {
    const sampleMovies = [
      { id: 1, title: 'Inception', year: 2010, posterUrl: null, tmdbId: 'tt123', requested: true, hasFile: true, status: 'Released', runtime: 148, rating: 8.8, overview: null },
      { id: 2, title: 'Avatar', year: 2009, posterUrl: null, tmdbId: 'tt456', requested: true, hasFile: false, status: 'Released', runtime: 162, rating: 7.9, overview: null },
      { id: 3, title: 'Blade Runner', year: 1982, posterUrl: null, tmdbId: 'tt789', requested: false, hasFile: false, status: 'Released', runtime: 117, rating: 8.1, overview: null },
    ]

    it('displays movie titles after loading', async () => {
      setupFetchMock({ movies: sampleMovies })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Inception')).toBeInTheDocument()
        expect(screen.getByText('Avatar')).toBeInTheDocument()
        expect(screen.getByText('Blade Runner')).toBeInTheDocument()
      })
    })

    it('shows total count in stats bar', async () => {
      setupFetchMock({ movies: sampleMovies })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText(/Showing 3 of 3 movies/)).toBeInTheDocument()
      })
    })
  })

  describe('search filtering', () => {
    const sampleMovies = [
      { id: 1, title: 'Inception', year: 2010, posterUrl: null, tmdbId: 'tt1', requested: true, hasFile: true, status: 'Released', runtime: 148, rating: 8.8, overview: null },
      { id: 2, title: 'Interstellar', year: 2014, posterUrl: null, tmdbId: 'tt2', requested: true, hasFile: true, status: 'Released', runtime: 169, rating: 8.7, overview: null },
      { id: 3, title: 'The Matrix', year: 1999, posterUrl: null, tmdbId: 'tt3', requested: true, hasFile: true, status: 'Released', runtime: 136, rating: 8.7, overview: null },
    ]

    it('filters items by search query', async () => {
      const user = userEvent.setup()
      setupFetchMock({ movies: sampleMovies })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Inception')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Filter movies...')
      await user.type(input, 'Inter')

      expect(screen.getByText('Interstellar')).toBeInTheDocument()
      expect(screen.queryByText('Inception')).not.toBeInTheDocument()
      expect(screen.queryByText('The Matrix')).not.toBeInTheDocument()
    })

    it('shows filtered count in stats bar', async () => {
      const user = userEvent.setup()
      setupFetchMock({ movies: sampleMovies })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Inception')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Filter movies...')
      await user.type(input, 'In')

      expect(screen.getByText(/Showing 2 of 3 movies/)).toBeInTheDocument()
    })

    it('shows empty state when no items match search', async () => {
      const user = userEvent.setup()
      setupFetchMock({ movies: sampleMovies })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Inception')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Filter movies...')
      await user.type(input, 'zzzznotfound')

      expect(screen.getByText('No items found')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument()
    })
  })

  describe('empty library state', () => {
    it('shows empty state message when no movies exist', async () => {
      setupFetchMock({ movies: [] })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Your movies library is empty')).toBeInTheDocument()
      })
    })

    it('shows add button in empty state', async () => {
      setupFetchMock({ movies: [] })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText(/Add Movie/)).toBeInTheDocument()
      })
    })
  })

  describe('view mode toggle', () => {
    const sampleMovies = [
      { id: 1, title: 'Inception', year: 2010, posterUrl: null, tmdbId: 'tt1', requested: true, hasFile: true, status: 'Released', runtime: 148, rating: 8.8, overview: null },
    ]

    it('defaults to grid view', async () => {
      setupFetchMock({ movies: sampleMovies })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Inception')).toBeInTheDocument()
      })

      // Grid view is rendered (grid has aspect-[2/3] containers)
      const gridContainer = document.querySelector('.grid')
      expect(gridContainer).toBeInTheDocument()
    })

    it('switches to list view when list button is clicked', async () => {
      const user = userEvent.setup()
      setupFetchMock({ movies: sampleMovies })
      render(<Library />)

      await waitFor(() => {
        expect(screen.getByText('Inception')).toBeInTheDocument()
      })

      // There are two view mode buttons (grid and list). The list button is the second one
      // in the view mode toggle group
      const buttons = document.querySelectorAll('.rounded-l-none')
      expect(buttons.length).toBe(1)
      await user.click(buttons[0] as HTMLElement)

      // After switching, the content should still show the movie
      expect(screen.getByText('Inception')).toBeInTheDocument()
    })
  })

  describe('sort options', () => {
    it('shows sort dropdown button', async () => {
      render(<Library />)
      // The sort button has text "Sort"
      await waitFor(() => {
        expect(screen.getByText('Sort')).toBeInTheDocument()
      })
    })
  })

  describe('scan library button', () => {
    it('shows scan library button', async () => {
      render(<Library />)
      await waitFor(() => {
        expect(screen.getByText('Scan Library')).toBeInTheDocument()
      })
    })
  })

  describe('add button', () => {
    it('renders an Add button in the header', () => {
      render(<Library />)
      expect(screen.getByText('Add')).toBeInTheDocument()
    })
  })
})
