import { useEffect } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import ActivityPage from './index'

const page = { url: '/activity', props: { tab: 'queue' } as Record<string, unknown> }
const replace = vi.fn()

vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  usePage: () => page,
  router: { replace: (...args: unknown[]) => replace(...args) },
}))

vi.mock('@/components/layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Each tab fetches on its own and has its own tests; here they only report what they were given.
const mounts = { queue: 0, imports: 0, history: 0 }
function useCountMount(tab: keyof typeof mounts) {
  useEffect(() => {
    mounts[tab]++
  }, [tab])
}
vi.mock('@/components/activity/queue-tab', () => ({
  QueueTab: () => {
    useCountMount('queue')
    return <div data-testid="queue-tab" />
  },
}))
vi.mock('@/components/activity/imports-tab', () => ({
  ImportsTab: ({ clientParam }: { clientParam: string | null }) => {
    useCountMount('imports')
    return <div data-testid="imports-tab">client:{clientParam ?? 'none'}</div>
  },
}))
vi.mock('@/components/activity/history-tab', () => ({
  HistoryTab: ({ eventFilter }: { eventFilter: string }) => {
    useCountMount('history')
    return <div data-testid="history-tab">event:{eventFilter}</div>
  },
}))

const counts = vi.fn(() => null as any)
vi.mock('@/hooks/use_active_downloads', async () => {
  const actual = await vi.importActual<any>('@/contexts/active_downloads_context')
  return {
    attentionCount: actual.attentionCount,
    useActiveDownloads: () => ({ counts: counts(), refreshCounts: async () => {} }),
  }
})

beforeEach(() => {
  page.url = '/activity'
  page.props = { tab: 'queue' }
  replace.mockReset()
  counts.mockReset().mockImplementation(() => null)
  mounts.queue = mounts.imports = mounts.history = 0
})

describe('Activity page', () => {
  it('opens on the tab the server rendered and passes the URL filter down', () => {
    page.url = '/activity/history?event=failures'
    page.props = { tab: 'history' }
    render(<ActivityPage />)

    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('history-tab')).toHaveTextContent('event:failures')
    // Tabs that were never opened do not mount, so they do not fetch.
    expect(screen.queryByTestId('queue-tab')).not.toBeInTheDocument()
  })

  it('switches tabs client-side onto their own URL', () => {
    render(<ActivityPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Imports' }))

    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/activity/imports',
        preserveState: true,
        preserveScroll: true,
      })
    )
    expect(screen.getByTestId('imports-tab')).toBeInTheDocument()
  })

  it('keeps a visited tab mounted instead of rebuilding it', () => {
    render(<ActivityPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Queue' }))

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Queue' }))

    expect(screen.getByTestId('queue-tab')).toBeInTheDocument()
    expect(mounts.queue).toBe(1)
    expect(mounts.history).toBe(1)
  })

  it('reads ?client= for the Imports browser', () => {
    page.url = '/activity/imports?client=7'
    page.props = { tab: 'imports' }
    render(<ActivityPage />)
    expect(screen.getByTestId('imports-tab')).toHaveTextContent('client:7')
  })

  it('badges the Queue tab in destructive ink when something needs attention', () => {
    counts.mockImplementation(() => ({
      active: 2,
      failed: 1,
      importing: 1,
      stuckImporting: 1,
      unmatchedPending: 3,
    }))
    render(<ActivityPage />)

    const queue = screen.getByRole('tab', { name: /Queue/ })
    expect(queue).toHaveTextContent('4')
    expect(queue).toHaveTextContent('2 items need attention')
    expect(screen.getByRole('tab', { name: /Imports/ })).toHaveTextContent('3')
  })
})
