import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WatchlistPage from '@/pages/watchlist/index'
import { SkippedSheet } from '@/components/dashboard/skipped-sheet'
import { WatchlistButton } from './watchlist-button'

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

const openMoviePreview = vi.fn()
vi.mock('@/contexts/media_preview_context', () => ({
  useMediaPreview: () => ({ openMoviePreview, openTvShowPreview: vi.fn() }),
}))

const item = (over: Record<string, unknown>) => ({
  key: 'movie:1',
  mediaType: 'movie',
  externalId: '1',
  title: 'Heat',
  year: 1995,
  posterUrl: null,
  genres: ['Crime'],
  createdAt: '2026-09-27T12:00:00.000Z',
  ...over,
})

let saved = false
let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  saved = false
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const ok = (body: unknown) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
    if (init?.method === 'DELETE' || init?.method === 'PUT') return ok({})
    if (url === '/api/v1/watchlist') return ok({ items: [item({})] })
    if (url === '/api/v1/watchlist/movie/1') return ok({ saved })
    if (url === '/api/v1/for-you/lists/skipped')
      return ok({ items: [item({ key: 'movie:2', externalId: '2', title: 'Ronin' })] })
    if (url === '/api/v1/watch-providers/batch') return ok({ providers: {} })
    return ok({})
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const called = (url: string, method: string) =>
  fetchMock.mock.calls.some(([u, init]) => u === url && init?.method === method)

describe('WatchlistPage', () => {
  it('lists saved titles, opens one, and removes one', async () => {
    render(<WatchlistPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Heat' }))
    expect(openMoviePreview).toHaveBeenCalledWith('1')
    await userEvent.click(screen.getByRole('button', { name: 'Remove Heat from the watchlist' }))
    await waitFor(() => expect(called('/api/v1/watchlist/movie/1', 'DELETE')).toBe(true))
    expect(screen.queryByText('Heat')).not.toBeInTheDocument()
  })
})

describe('SkippedSheet', () => {
  it('brings a skipped title back', async () => {
    const onChanged = vi.fn()
    render(<SkippedSheet open onOpenChange={() => {}} onChanged={onChanged} />)
    expect(await screen.findByText('Ronin')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Bring back' }))
    await waitFor(() => expect(called('/api/v1/for-you/feedback/movie/2', 'DELETE')).toBe(true))
    expect(onChanged).toHaveBeenCalled()
  })
})

describe('WatchlistButton', () => {
  it('adds a title with its details, then takes it off', async () => {
    render(
      <WatchlistButton
        item={{ mediaType: 'movie', tmdbId: '1', title: 'Heat', year: 1995, genres: ['Crime'] }}
      />
    )
    const button = await screen.findByRole('button', { name: 'Add to watchlist' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    await waitFor(() => expect(called('/api/v1/watchlist/movie/1', 'PUT')).toBe(true))
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(put[1].body)).toMatchObject({ title: 'Heat', year: 1995, genres: ['Crime'] })
    const on = await screen.findByRole('button', { name: /On your watchlist/ })
    expect(on).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(on).toBeEnabled())
    await userEvent.click(on)
    await waitFor(() => expect(called('/api/v1/watchlist/movie/1', 'DELETE')).toBe(true))
  })
})
