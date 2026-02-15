import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SimilarLane } from './similar-lane'

// Mock child components and hooks
const mockOpenMoviePreview = vi.fn()
const mockOpenTvShowPreview = vi.fn()
const mockRouterVisit = vi.fn()

vi.mock('@inertiajs/react', () => ({
  router: { visit: (...args: unknown[]) => mockRouterVisit(...args) },
}))

vi.mock('@/contexts/media_preview_context', () => ({
  useMediaPreview: () => ({
    openMoviePreview: mockOpenMoviePreview,
    openTvShowPreview: mockOpenTvShowPreview,
  }),
}))

vi.mock('@/hooks/use_visible_watch_providers', () => ({
  useVisibleWatchProviders: () => ({ providers: {}, loadingIds: new Set(), observerRef: () => () => {} }),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}))

vi.mock('@/components/library/media-teaser', () => ({
  MediaTeaser: ({
    title,
    onClick,
    tmdbId,
    status,
  }: {
    title: string
    onClick?: () => void
    tmdbId: string
    status: string
  }) => (
    <button data-testid={`teaser-${tmdbId}`} data-status={status} onClick={onClick}>
      {title}
    </button>
  ),
}))

const similarMovies = {
  results: [
    {
      tmdbId: '100',
      title: 'Similar Movie A',
      year: 2023,
      posterUrl: '/poster-a.jpg',
      genres: ['Action'],
      inLibrary: false,
      rating: 7.5,
    },
    {
      tmdbId: '200',
      title: 'Similar Movie B',
      year: 2024,
      posterUrl: '/poster-b.jpg',
      genres: ['Drama'],
      inLibrary: true,
      libraryId: 42,
      rating: 8.0,
    },
  ],
}

const similarShows = {
  results: [
    {
      tmdbId: '300',
      title: 'Similar Show A',
      year: 2022,
      posterUrl: null,
      genres: ['Comedy'],
      inLibrary: false,
    },
  ],
}

function mockFetchSuccess(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(data),
  })
}

function mockFetchFailure() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

describe('SimilarLane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when tmdbId is null', () => {
    const { container } = render(
      <SimilarLane mediaType="movies" tmdbId={null} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows loading skeletons while fetching', () => {
    // Never resolve the fetch so it stays in loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))

    render(<SimilarLane mediaType="movies" tmdbId="123" />)
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders nothing when fetch returns empty results', async () => {
    mockFetchSuccess({ results: [] })

    const { container } = render(
      <SimilarLane mediaType="movies" tmdbId="123" />
    )

    await waitFor(() => {
      expect(container.querySelector('[data-testid="skeleton"]')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('Similar Movies')).not.toBeInTheDocument()
  })

  it('renders nothing when fetch fails', async () => {
    mockFetchFailure()

    const { container } = render(
      <SimilarLane mediaType="movies" tmdbId="123" />
    )

    await waitFor(() => {
      expect(container.querySelector('[data-testid="skeleton"]')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('Similar Movies')).not.toBeInTheDocument()
  })

  it('renders similar movies with correct heading', async () => {
    mockFetchSuccess(similarMovies)

    render(<SimilarLane mediaType="movies" tmdbId="123" />)

    await waitFor(() => {
      expect(screen.getByText('Similar Movies')).toBeInTheDocument()
    })
    expect(screen.getByText('Similar Movie A')).toBeInTheDocument()
    expect(screen.getByText('Similar Movie B')).toBeInTheDocument()
  })

  it('renders similar shows with correct heading', async () => {
    mockFetchSuccess(similarShows)

    render(<SimilarLane mediaType="tv" tmdbId="456" />)

    await waitFor(() => {
      expect(screen.getByText('Similar Shows')).toBeInTheDocument()
    })
    expect(screen.getByText('Similar Show A')).toBeInTheDocument()
  })

  it('fetches from correct endpoint when mediaId is provided (movies)', async () => {
    mockFetchSuccess(similarMovies)

    render(<SimilarLane mediaType="movies" mediaId={10} tmdbId="123" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/movies/10/similar')
    })
  })

  it('fetches from correct endpoint when mediaId is not provided (movies)', async () => {
    mockFetchSuccess(similarMovies)

    render(<SimilarLane mediaType="movies" tmdbId="123" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/movies/similar?tmdbId=123')
    })
  })

  it('fetches from correct endpoint when mediaId is provided (tv)', async () => {
    mockFetchSuccess(similarShows)

    render(<SimilarLane mediaType="tv" mediaId={20} tmdbId="456" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/tvshows/20/similar')
    })
  })

  it('fetches from correct endpoint when mediaId is not provided (tv)', async () => {
    mockFetchSuccess(similarShows)

    render(<SimilarLane mediaType="tv" tmdbId="456" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/tvshows/similar?tmdbId=456')
    })
  })

  it('navigates to library page when clicking an item that is in library (movie)', async () => {
    const user = userEvent.setup()
    mockFetchSuccess(similarMovies)

    render(<SimilarLane mediaType="movies" tmdbId="123" />)

    await waitFor(() => {
      expect(screen.getByText('Similar Movie B')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Similar Movie B'))
    expect(mockRouterVisit).toHaveBeenCalledWith('/movie/42')
  })

  it('opens movie preview when clicking an item not in library', async () => {
    const user = userEvent.setup()
    mockFetchSuccess(similarMovies)

    render(<SimilarLane mediaType="movies" tmdbId="123" />)

    await waitFor(() => {
      expect(screen.getByText('Similar Movie A')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Similar Movie A'))
    expect(mockOpenMoviePreview).toHaveBeenCalledWith('100')
  })

  it('opens tv show preview when clicking a tv item not in library', async () => {
    const user = userEvent.setup()
    mockFetchSuccess(similarShows)

    render(<SimilarLane mediaType="tv" tmdbId="456" />)

    await waitFor(() => {
      expect(screen.getByText('Similar Show A')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Similar Show A'))
    expect(mockOpenTvShowPreview).toHaveBeenCalledWith('300')
  })

  it('passes correct status to MediaTeaser for library items', async () => {
    mockFetchSuccess(similarMovies)

    render(<SimilarLane mediaType="movies" tmdbId="123" />)

    await waitFor(() => {
      expect(screen.getByTestId('teaser-200')).toBeInTheDocument()
    })

    expect(screen.getByTestId('teaser-200')).toHaveAttribute('data-status', 'downloaded')
    expect(screen.getByTestId('teaser-100')).toHaveAttribute('data-status', 'none')
  })

  it('navigates to tvshow library page when clicking a tv item in library', async () => {
    const user = userEvent.setup()
    const tvInLibrary = {
      results: [
        {
          tmdbId: '500',
          title: 'Library Show',
          year: 2025,
          inLibrary: true,
          libraryId: 99,
        },
      ],
    }
    mockFetchSuccess(tvInLibrary)

    render(<SimilarLane mediaType="tv" tmdbId="456" />)

    await waitFor(() => {
      expect(screen.getByText('Library Show')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Library Show'))
    expect(mockRouterVisit).toHaveBeenCalledWith('/tvshow/99')
  })
})
