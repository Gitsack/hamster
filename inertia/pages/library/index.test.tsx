import { render, screen } from '@testing-library/react'
import Library from './index'

vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { visit: vi.fn() },
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
  Add01Icon: { name: 'Add01Icon' },
  Search01Icon: { name: 'Search01Icon' },
  GridIcon: { name: 'GridIcon' },
  Menu01Icon: { name: 'Menu01Icon' },
  SortingIcon: { name: 'SortingIcon' },
  MusicNote01Icon: { name: 'MusicNote01Icon' },
  Film01Icon: { name: 'Film01Icon' },
  Tv01Icon: { name: 'Tv01Icon' },
  Book01Icon: { name: 'Book01Icon' },
  MoreVerticalIcon: { name: 'MoreVerticalIcon' },
  Delete02Icon: { name: 'Delete02Icon' },
  EyeIcon: { name: 'EyeIcon' },
  CheckmarkCircle02Icon: { name: 'CheckmarkCircle02Icon' },
  Download01Icon: { name: 'Download01Icon' },
  Clock01Icon: { name: 'Clock01Icon' },
  FolderSearchIcon: { name: 'FolderSearchIcon' },
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/hooks/use_operation_tracker', () => ({
  useOperationTrackerContext: () => ({
    operations: [],
    isRunning: false,
  }),
}))

vi.mock('@/components/library/media-status-badge', () => ({
  MediaStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="media-status-badge">{status}</span>
  ),
  getMediaItemStatus: () => 'downloaded' as const,
}))

beforeEach(() => {
  // Return proper data shapes for each API call
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ enabledMediaTypes: ['movies'] }),
        })
      }
      // All other endpoints return empty arrays
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Library', () => {
  it('renders without crashing', () => {
    render(<Library />)
    expect(screen.getByText('Movies')).toBeInTheDocument()
  })

  it('shows the default Movies tab', () => {
    render(<Library />)
    expect(screen.getByText('Movies')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<Library />)
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
