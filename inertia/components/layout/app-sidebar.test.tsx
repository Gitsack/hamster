import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/contexts/theme_context'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'

const page = vi.hoisted(() => ({
  url: '/dashboard',
  props: {} as Record<string, unknown>,
}))

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, method: _method, as: _as, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => page,
}))

vi.mock('@/hooks/use_active_downloads', () => ({
  useActivityCounts: () => null,
  attentionCount: () => 0,
}))

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  document.documentElement.classList.remove('dark')
  try {
    window.localStorage.clear()
  } catch {
    // Storage unavailable: nothing was stored.
  }
})

function renderSidebar(url: string, props: Record<string, unknown>) {
  page.url = url
  page.props = { version: '1.37.0', ...props }
  return render(
    <ThemeProvider>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </ThemeProvider>
  )
}

const admin = { user: { email: 'a@example.com', isAdmin: true } }

describe('AppSidebar', () => {
  it('has the six main items and Settings, and nothing else', () => {
    renderSidebar('/dashboard', admin)
    const labels = screen
      .getAllByRole('link')
      .map((link) => link.textContent?.trim())
      .filter(Boolean)
    expect(labels).toEqual([
      'HamsterMedia Library',
      'Dashboard',
      'Library',
      'Watchlist',
      'Calendar',
      'Search',
      'Activity',
      'Settings',
      'v1.37.0',
    ])
  })

  it('links Settings to /settings from the app nav', () => {
    renderSidebar('/dashboard', admin)
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })

  it('swaps to the settings nav inside settings, grouped, with one current page', () => {
    renderSidebar('/settings/indexers', admin)
    const nav = screen.getByRole('navigation', { name: 'Settings' })
    for (const label of ['Library', 'Downloading', 'Connect', 'System', 'You']) {
      expect(
        within(nav).getByText(label, { selector: '[data-sidebar="group-label"]' })
      ).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/settings')
    expect(within(nav).getByRole('link', { name: 'Indexers' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(nav).getAllByRole('link', { current: 'page' })).toHaveLength(1)
    // The app nav and the footer Settings entry give way to it.
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('marks the Overview current on /settings', () => {
    renderSidebar('/settings', admin)
    const nav = screen.getByRole('navigation', { name: 'Settings' })
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('leads Back to the last page outside settings', () => {
    renderSidebar('/activity/history?event=failures', admin).unmount()
    renderSidebar('/settings/notifications#deliveries', admin)
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/activity/history?event=failures'
    )
  })

  it('puts a destructive dot on each failing settings page', () => {
    renderSidebar('/settings/indexers', {
      ...admin,
      systemHealth: { healthLevel: 'error', failedTasks: 0, failing: ['download-clients'] },
    })
    const nav = screen.getByRole('navigation', { name: 'Settings' })
    const item = within(nav).getByRole('link', { name: 'Download clients' }).closest('li')!
    expect(
      within(item).getAllByRole('img', { name: 'Download clients needs attention' }).length
    ).toBeGreaterThan(0)
    const indexers = within(nav).getByRole('link', { name: 'Indexers' }).closest('li')!
    expect(within(indexers).queryByRole('img')).not.toBeInTheDocument()
  })

  it('keeps the app nav for non-admins on Profile', () => {
    renderSidebar('/settings/profile', { user: { email: 'u@example.com', isAdmin: false } })
    expect(screen.queryByRole('navigation', { name: 'Settings' })).not.toBeInTheDocument()
    const settings = screen.getByRole('link', { name: 'Settings' })
    expect(settings).toHaveAttribute('data-active', 'true')
  })

  it('shows Settings to non-admins too, but the version stays plain text', () => {
    renderSidebar('/dashboard', { user: { email: 'u@example.com', isAdmin: false } })
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'v1.37.0' })).not.toBeInTheDocument()
    expect(screen.getByText('v1.37.0')).toBeInTheDocument()
  })

  it('links the version to About for admins', () => {
    renderSidebar('/dashboard', admin)
    expect(screen.getByRole('link', { name: 'v1.37.0' })).toHaveAttribute(
      'href',
      '/settings/system#about'
    )
  })

  it('puts a destructive dot on Settings while any area is failing', () => {
    renderSidebar('/dashboard', {
      ...admin,
      systemHealth: {
        healthLevel: 'error',
        failedTasks: 1,
        failing: ['download-clients', 'system'],
      },
    })
    const item = screen.getByRole('link', { name: 'Settings' }).closest('li')!
    const dots = within(item).getAllByRole('img', {
      name: 'Settings needs attention: Download clients, System',
    })
    expect(dots.length).toBeGreaterThan(0)
  })

  it('shows no dot while everything is fine', () => {
    renderSidebar('/dashboard', {
      ...admin,
      systemHealth: { healthLevel: 'ok', failedTasks: 0, failing: [] },
    })
    const item = screen.getByRole('link', { name: 'Settings' }).closest('li')!
    expect(within(item).queryByRole('img')).not.toBeInTheDocument()
  })

  it('offers Profile and the theme in the user menu', async () => {
    const user = userEvent.setup()
    renderSidebar('/dashboard', admin)
    await user.click(screen.getByRole('button', { name: /a@example\.com/ }))
    expect(await screen.findByRole('menuitem', { name: 'Profile' })).toBeInTheDocument()
    const dark = screen.getByRole('menuitemradio', { name: 'Dark' })
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await user.click(dark)
    expect(dark).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('menuitem', { name: /Log out/ })).toBeInTheDocument()
  })
})
