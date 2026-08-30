import { renderHook, act, waitFor } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { useMediaPreview, MediaPreviewProvider } from './media_preview_context'

const mockFetch = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@inertiajs/react', () => ({
  router: {
    visit: vi.fn(),
  },
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/hooks/use_active_downloads', () => ({
  useActiveDownloads: () => ({ getForMovie: () => null, getForTvShow: () => new Map() }),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}))

vi.mock('@/components/ui/spinner', () => ({
  Spinner: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className} />
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/library/media-status-badge', () => ({
  MediaStatusBadge: () => <div data-testid="media-status-badge" />,
  getMediaItemStatus: (item: { hasFile?: boolean; requested?: boolean }) => ({
    status: item.hasFile ? 'downloaded' : item.requested ? 'requested' : 'none',
    progress: 0,
  }),
}))

vi.mock('@/components/library/cast-lane', () => ({
  CastLane: ({ cast }: { cast?: { id: number }[] }) =>
    cast?.length ? <div data-testid="cast-lane" /> : null,
}))

vi.mock('@/components/media-gallery', () => ({
  MediaGallery: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="media-gallery">{children}</div>
  ),
}))

vi.mock('@/components/add-media-dialog', () => ({
  AddMediaDialog: () => <div data-testid="add-media-dialog" />,
}))

vi.mock('@/components/season-picker-dialog', () => ({
  SeasonPickerDialog: () => <div data-testid="season-picker-dialog" />,
}))

vi.mock('@hugeicons/react', () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}))

vi.mock('@hugeicons/core-free-icons', () => ({
  Add01Icon: 'Add01Icon',
  ViewIcon: 'ViewIcon',
  StarIcon: 'StarIcon',
  Time01Icon: 'Time01Icon',
  Calendar03Icon: 'Calendar03Icon',
  InformationCircleIcon: 'InformationCircleIcon',
  Tv01Icon: 'Tv01Icon',
  Refresh01Icon: 'Refresh01Icon',
  LinkSquare02Icon: 'LinkSquare02Icon',
}))

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  // Fallback for the root-folder and quality-profile lookups the sheet makes after the
  // preview request settles; queued once-values still take precedence.
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/rootfolders')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 'rf1', path: '/media/movies', mediaType: 'movies' }],
      })
    }
    if (typeof url === 'string' && url.includes('/qualityprofiles')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 'qp1', name: 'HD-1080p', mediaType: 'movies' }],
      })
    }
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useMediaPreview', () => {
  it('throws when used outside of MediaPreviewProvider', () => {
    expect(() => {
      renderHook(() => useMediaPreview())
    }).toThrow('useMediaPreview must be used within a MediaPreviewProvider')
  })

  it('returns context value when used within MediaPreviewProvider', () => {
    const { result } = renderHook(() => useMediaPreview(), {
      wrapper: ({ children }) => <MediaPreviewProvider>{children}</MediaPreviewProvider>,
    })

    expect(result.current).toBeDefined()
    expect(typeof result.current.openMoviePreview).toBe('function')
    expect(typeof result.current.openTvShowPreview).toBe('function')
  })
})

describe('MediaPreviewProvider', () => {
  it('renders children', () => {
    render(
      <MediaPreviewProvider>
        <div data-testid="child">Hello</div>
      </MediaPreviewProvider>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('does not show sheet initially', () => {
    render(
      <MediaPreviewProvider>
        <div>Content</div>
      </MediaPreviewProvider>
    )

    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument()
  })
})

describe('openMoviePreview', () => {
  it('fetches movie details and opens sheet', async () => {
    const movieData = {
      tmdbId: '123',
      title: 'Test Movie',
      year: 2024,
      overview: 'A great movie',
      rating: 8.5,
      votes: 1000,
      genres: ['Action', 'Drama'],
      inLibrary: false,
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => movieData,
    })

    function TestComponent() {
      const { openMoviePreview } = useMediaPreview()
      return <button onClick={() => openMoviePreview('123')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('Test Movie')).toBeInTheDocument()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/movies/preview?tmdbId=123')
  })

  it('shows loading skeletons while fetching', async () => {
    let resolvePromise: (value: unknown) => void
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    mockFetch.mockReturnValueOnce(fetchPromise)

    function TestComponent() {
      const { openMoviePreview } = useMediaPreview()
      return <button onClick={() => openMoviePreview('123')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    })

    // Resolve the fetch to clean up
    await act(async () => {
      resolvePromise!({
        ok: true,
        json: async () => ({
          tmdbId: '123',
          title: 'Test Movie',
          inLibrary: false,
        }),
      })
    })
  })

  it('keeps the sheet open with a retry when the fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    function TestComponent() {
      const { openMoviePreview } = useMediaPreview()
      return <button onClick={() => openMoviePreview('123')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('Could not reach TMDB for movie details.')).toBeInTheDocument()
    })

    // The diagnostic surface stays up and names what was attempted.
    expect(screen.getByTestId('sheet')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
    expect(screen.getByText('/api/v1/movies/preview?tmdbId=123')).toBeInTheDocument()
  })

  it('reports the status code on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    function TestComponent() {
      const { openMoviePreview } = useMediaPreview()
      return <button onClick={() => openMoviePreview('123')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(
        screen.getByText('TMDB did not return details for this movie (HTTP 500).')
      ).toBeInTheDocument()
    })
  })

  it('displays movie details with genres', async () => {
    const movieData = {
      tmdbId: '123',
      title: 'Test Movie',
      year: 2024,
      overview: 'A great movie overview',
      genres: ['Action', 'Drama'],
      rating: 8.5,
      votes: 1000,
      runtime: 120,
      status: 'Released',
      inLibrary: false,
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => movieData,
    })

    function TestComponent() {
      const { openMoviePreview } = useMediaPreview()
      return <button onClick={() => openMoviePreview('123')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('Test Movie')).toBeInTheDocument()
    })

    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('A great movie overview')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('120 min')).toBeInTheDocument()
    expect(screen.getByText('Released')).toBeInTheDocument()
  })

  it('shows "Add to Library" button when movie is not in library', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tmdbId: '123',
        title: 'Test Movie',
        inLibrary: false,
      }),
    })

    function TestComponent() {
      const { openMoviePreview } = useMediaPreview()
      return <button onClick={() => openMoviePreview('123')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('Add to Library')).toBeInTheDocument()
    })
  })

  it('shows "View in Library" button when movie is in library', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tmdbId: '123',
        title: 'Test Movie',
        inLibrary: true,
        libraryId: 42,
      }),
    })

    function TestComponent() {
      const { openMoviePreview } = useMediaPreview()
      return <button onClick={() => openMoviePreview('123')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('View in Library')).toBeInTheDocument()
    })
  })
})

describe('openTvShowPreview', () => {
  it('fetches tv show details and opens sheet', async () => {
    const tvData = {
      tmdbId: '456',
      title: 'Test Show',
      year: 2023,
      overview: 'A great show',
      seasonCount: 3,
      genres: ['Comedy'],
      inLibrary: false,
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => tvData,
    })

    function TestComponent() {
      const { openTvShowPreview } = useMediaPreview()
      return <button onClick={() => openTvShowPreview('456')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('Test Show')).toBeInTheDocument()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/tvshows/preview?tmdbId=456')
  })

  it('keeps the sheet open with a retry when the tv fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    function TestComponent() {
      const { openTvShowPreview } = useMediaPreview()
      return <button onClick={() => openTvShowPreview('456')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('Could not reach TMDB for show details.')).toBeInTheDocument()
    })
  })

  it('reports the status code on a non-ok tv show response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    function TestComponent() {
      const { openTvShowPreview } = useMediaPreview()
      return <button onClick={() => openTvShowPreview('456')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(
        screen.getByText('TMDB did not return details for this show (HTTP 404).')
      ).toBeInTheDocument()
    })
  })

  it('displays tv show details with season count', async () => {
    const tvData = {
      tmdbId: '456',
      title: 'Test Show',
      year: 2023,
      overview: 'Great show overview',
      seasonCount: 3,
      genres: ['Comedy', 'Sci-Fi'],
      rating: 9.0,
      votes: 5000,
      status: 'Returning Series',
      networks: ['HBO'],
      inLibrary: false,
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => tvData,
    })

    function TestComponent() {
      const { openTvShowPreview } = useMediaPreview()
      return <button onClick={() => openTvShowPreview('456')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('Test Show')).toBeInTheDocument()
    })

    expect(screen.getByText('Comedy')).toBeInTheDocument()
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
    expect(screen.getByText('Great show overview')).toBeInTheDocument()
    expect(screen.getByText('3 Seasons')).toBeInTheDocument()
    expect(screen.getByText('Returning Series')).toBeInTheDocument()
    expect(screen.getByText('Network: HBO')).toBeInTheDocument()
  })

  it('shows singular "Season" for season count of 1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tmdbId: '456',
        title: 'Mini Series',
        seasonCount: 1,
        inLibrary: false,
      }),
    })

    function TestComponent() {
      const { openTvShowPreview } = useMediaPreview()
      return <button onClick={() => openTvShowPreview('456')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('1 Season')).toBeInTheDocument()
    })
  })

  it('shows "View in Library" button when tv show is in library', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tmdbId: '456',
        title: 'Test Show',
        inLibrary: true,
        libraryId: 99,
      }),
    })

    function TestComponent() {
      const { openTvShowPreview } = useMediaPreview()
      return <button onClick={() => openTvShowPreview('456')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('View in Library')).toBeInTheDocument()
    })
  })

  it('shows the season-picker action when the tv show is not in library', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tmdbId: '456',
        title: 'Test Show',
        inLibrary: false,
      }),
    })

    function TestComponent() {
      const { openTvShowPreview } = useMediaPreview()
      return <button onClick={() => openTvShowPreview('456')}>Open</button>
    }

    const user = userEvent.setup()

    render(
      <MediaPreviewProvider>
        <TestComponent />
      </MediaPreviewProvider>
    )

    await user.click(screen.getByText('Open'))

    await waitFor(() => {
      expect(screen.getByText('Choose seasons')).toBeInTheDocument()
    })
  })
})

describe('quickAdd', () => {
  beforeEach(() => {
    // The sonner mock is module-level, so its calls survive between tests.
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  function mockConfig({
    rootFolders,
    qualityProfiles,
    post,
  }: {
    rootFolders?: unknown[]
    qualityProfiles?: unknown[]
    post?: { ok: boolean; body: unknown }
  } = {}) {
    mockFetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (url.includes('/rootfolders')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            rootFolders ?? [
              { id: 'rf1', path: '/media/movies', mediaType: 'movies' },
              { id: 'rf2', path: '/media/tv', mediaType: 'tv' },
            ],
        })
      }
      if (url.includes('/qualityprofiles')) {
        return Promise.resolve({
          ok: true,
          json: async () =>
            qualityProfiles ?? [
              { id: 'qp1', name: 'Movies HD', mediaType: 'movies' },
              { id: 'qp2', name: 'Shows HD', mediaType: 'tv' },
            ],
        })
      }
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: post?.ok ?? true,
          json: async () => post?.body ?? { id: 77 },
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
  }

  function renderQuickAdd() {
    return renderHook(() => useMediaPreview(), {
      wrapper: ({ children }) => <MediaPreviewProvider>{children}</MediaPreviewProvider>,
    })
  }

  it('posts a movie to the default profile and root folder for its type', async () => {
    mockConfig()
    const { result } = renderQuickAdd()

    let outcome
    await act(async () => {
      outcome = await result.current.quickAdd({
        type: 'movie',
        tmdbId: '100',
        title: 'Sicario',
        year: 2015,
      })
    })

    expect(outcome).toEqual({ added: true, libraryId: 77 })
    const [url, init] = mockFetch.mock.calls.find(([u]) => u === '/api/v1/movies')!
    expect(url).toBe('/api/v1/movies')
    expect(JSON.parse(init.body)).toEqual({
      tmdbId: '100',
      title: 'Sicario',
      year: 2015,
      qualityProfileId: 'qp1',
      rootFolderId: 'rf1',
      requested: true,
      searchOnAdd: true,
    })
  })

  it('names the destination in the toast, since no dialog stated it first', async () => {
    mockConfig()
    const { result } = renderQuickAdd()

    await act(async () => {
      await result.current.quickAdd({ type: 'movie', tmdbId: '100', title: 'Sicario' })
    })

    expect(toast.success).toHaveBeenCalledWith('Sicario added — Movies HD in /media/movies')
  })

  it('sends a show to the tv profile and tv root folder', async () => {
    mockConfig()
    const { result } = renderQuickAdd()

    await act(async () => {
      await result.current.quickAdd({ type: 'tv', tmdbId: '300', title: 'Severance' })
    })

    const [, init] = mockFetch.mock.calls.find(([u]) => u === '/api/v1/tvshows')!
    expect(JSON.parse(init.body)).toMatchObject({
      qualityProfileId: 'qp2',
      rootFolderId: 'rf2',
    })
  })

  it('refuses and says so when the media type has no root folder', async () => {
    mockConfig({ rootFolders: [{ id: 'rf1', path: '/media/movies', mediaType: 'movies' }] })
    const { result } = renderQuickAdd()

    let outcome
    await act(async () => {
      outcome = await result.current.quickAdd({ type: 'tv', tmdbId: '300', title: 'Severance' })
    })

    expect(outcome).toEqual({ added: false })
    expect(toast.error).toHaveBeenCalledWith(
      'No root folder configured for TV shows. Add one in Settings first.'
    )
    expect(mockFetch.mock.calls.some(([u]) => u === '/api/v1/tvshows')).toBe(false)
  })

  it('refuses when the media type has no quality profile', async () => {
    mockConfig({ qualityProfiles: [{ id: 'qp2', name: 'Shows HD', mediaType: 'tv' }] })
    const { result } = renderQuickAdd()

    let outcome
    await act(async () => {
      outcome = await result.current.quickAdd({ type: 'movie', tmdbId: '100', title: 'Sicario' })
    })

    expect(outcome).toEqual({ added: false })
    expect(toast.error).toHaveBeenCalledWith(
      'No quality profile configured for movies. Add one in Settings first.'
    )
  })

  it('reports a rejected add without claiming it landed', async () => {
    mockConfig({ post: { ok: false, body: { error: 'Movie already exists' } } })
    const { result } = renderQuickAdd()

    let outcome
    await act(async () => {
      outcome = await result.current.quickAdd({ type: 'movie', tmdbId: '100', title: 'Sicario' })
    })

    expect(outcome).toEqual({ added: false })
    expect(toast.error).toHaveBeenCalledWith('Movie already exists')
    expect(toast.success).not.toHaveBeenCalled()
  })
})
