import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchPage from './index'

// Mock Inertia
vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  router: { visit: vi.fn() },
  usePage: () => ({ props: {} }),
}))

// Mock layout
vi.mock('@/components/layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    Search01Icon: m('Search01Icon'),
    Download01Icon: m('Download01Icon'),
    Link01Icon: m('Link01Icon'),
    SortingIcon: m('SortingIcon'),
    Settings02Icon: m('Settings02Icon'),
    ArrowUp01Icon: m('ArrowUp01Icon'),
    ArrowDown01Icon: m('ArrowDown01Icon'),
    MusicNote01Icon: m('MusicNote01Icon'),
    Album01Icon: m('Album01Icon'),
    MusicNoteSquare01Icon: m('MusicNoteSquare01Icon'),
    CheckmarkCircle01Icon: m('CheckmarkCircle01Icon'),
    Globe02Icon: m('Globe02Icon'),
    Add01Icon: m('Add01Icon'),
    MoreVerticalIcon: m('MoreVerticalIcon'),
    Film01Icon: m('Film01Icon'),
    Tv01Icon: m('Tv01Icon'),
    Book01Icon: m('Book01Icon'),
    ArrowRight01Icon: m('ArrowRight01Icon'),
    ArrowLeft01Icon: m('ArrowLeft01Icon'),
    ViewIcon: m('ViewIcon'),
    Cancel01Icon: m('Cancel01Icon'),
  }
})

// Mock sonner
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

// Mock context
vi.mock('@/contexts/media_preview_context', () => ({
  useMediaPreview: () => ({
    openMoviePreview: vi.fn(),
    openTvShowPreview: vi.fn(),
  }),
}))

// Mock hooks
vi.mock('@/hooks/use_visible_watch_providers', () => ({
  useVisibleWatchProviders: () => ({
    watchProviders: {},
    watchProviderLoading: new Set(),
    watchProviderRef: { current: null },
  }),
}))

// Mock components with complex dependencies
vi.mock('@/components/season-picker-dialog', () => ({
  SeasonPickerDialog: () => null,
}))

vi.mock('@/components/add-media-dialog', () => ({
  AddMediaDialog: () => null,
}))

vi.mock('@/components/library/media-status-badge', () => ({
  CardStatusBadge: () => null,
}))

vi.mock('@/components/library/media-teaser', () => ({
  MediaTeaser: () => null,
}))

// Track fetch calls
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  })
  global.fetch = fetchMock
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('SearchPage', () => {
  describe('initial state', () => {
    it('renders search input with placeholder', () => {
      render(<SearchPage initialMode="movies" />)
      expect(screen.getByPlaceholderText(/search for movies/i)).toBeInTheDocument()
    })

    it('renders search button', () => {
      render(<SearchPage initialMode="movies" />)
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('shows initial search prompt for music mode', () => {
      render(<SearchPage initialMode="music" />)
      expect(screen.getByText(/search for artists to get started/i)).toBeInTheDocument()
    })

    it('shows initial search prompt for books mode', () => {
      render(<SearchPage initialMode="books" />)
      expect(screen.getByText(/search for authors to get started/i)).toBeInTheDocument()
    })
  })

  describe('debounced auto-search', () => {
    it('does not search immediately on input change', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchPage initialMode="movies" />)

      const input = screen.getByPlaceholderText(/search for movies/i)
      await user.type(input, 'bat')

      // No search should have been triggered yet (debounce not elapsed)
      const movieSearchCalls = fetchMock.mock.calls.filter(
        (call: [string]) => typeof call[0] === 'string' && call[0].includes('/api/v1/movies/search')
      )
      expect(movieSearchCalls.length).toBe(0)
    })

    it('triggers search after debounce delay', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchPage initialMode="movies" />)

      const input = screen.getByPlaceholderText(/search for movies/i)
      await user.type(input, 'batman')

      // Advance past debounce delay
      act(() => {
        vi.advanceTimersByTime(500)
      })

      await waitFor(() => {
        const movieSearchCalls = fetchMock.mock.calls.filter(
          (call: [string]) =>
            typeof call[0] === 'string' && call[0].includes('/api/v1/movies/search')
        )
        expect(movieSearchCalls.length).toBeGreaterThan(0)
      })
    })

    it('does not auto-search in direct mode', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchPage initialMode="direct" />)

      const input = screen.getByPlaceholderText(/search for releases/i)
      await user.type(input, 'test query')

      act(() => {
        vi.advanceTimersByTime(500)
      })

      const indexerSearchCalls = fetchMock.mock.calls.filter(
        (call: [string]) =>
          typeof call[0] === 'string' && call[0].includes('/api/v1/indexers/search')
      )
      expect(indexerSearchCalls.length).toBe(0)
    })

    it('does not search with less than 2 characters', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchPage initialMode="movies" />)

      const input = screen.getByPlaceholderText(/search for movies/i)
      await user.type(input, 'a')

      act(() => {
        vi.advanceTimersByTime(500)
      })

      const movieSearchCalls = fetchMock.mock.calls.filter(
        (call: [string]) => typeof call[0] === 'string' && call[0].includes('/api/v1/movies/search')
      )
      expect(movieSearchCalls.length).toBe(0)
    })
  })

  describe('keyboard navigation', () => {
    it('allows Enter key to trigger search', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchPage initialMode="movies" />)

      const input = screen.getByPlaceholderText(/search for movies/i)
      await user.type(input, 'batman')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        const movieSearchCalls = fetchMock.mock.calls.filter(
          (call: [string]) =>
            typeof call[0] === 'string' && call[0].includes('/api/v1/movies/search')
        )
        expect(movieSearchCalls.length).toBeGreaterThan(0)
      })
    })
  })

  describe('no results state', () => {
    it('shows no results message after search returns empty', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      render(<SearchPage initialMode="movies" />)

      const input = screen.getByPlaceholderText(/search for movies/i)
      await user.type(input, 'xyznonexistent')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByText('No results found')).toBeInTheDocument()
      })
    })
  })
})
