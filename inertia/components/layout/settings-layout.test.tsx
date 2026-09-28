import { render, screen, within } from '@testing-library/react'
import { SettingsLayout } from './settings-layout'
import { PageHeader } from '@/components/settings/page-header'

const page = vi.hoisted(() => ({
  url: '/settings',
  props: {} as Record<string, unknown>,
}))

vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => page,
}))

vi.mock('./app-layout', () => ({
  AppLayout: ({ children, headerPrefix }: any) => (
    <div>
      <header data-testid="app-header">{headerPrefix}</header>
      {children}
    </div>
  ),
}))

function renderAt(url: string, props: Record<string, unknown>) {
  page.url = url
  page.props = props
  return render(
    <SettingsLayout>
      <PageHeader title="Page" />
    </SettingsLayout>
  )
}

const admin = { user: { isAdmin: true } }

describe('SettingsLayout', () => {
  it('names the page in the header on phones, with a way back to the list', () => {
    renderAt('/settings/notifications', admin)
    const header = screen.getByTestId('app-header')
    expect(within(header).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings'
    )
    const h1 = within(header).getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Notifications')
    expect(h1).toHaveTextContent('Settings')
    expect(document.title).toBe('Notifications')
  })

  it('hides the page header h2 below md, where the h1 already names the page', () => {
    renderAt('/settings/notifications', admin)
    expect(screen.getByRole('heading', { level: 2, name: 'Page' })).toHaveClass('max-md:sr-only')
  })

  it('renders no nav of its own; the app sidebar lists the settings pages', () => {
    renderAt('/settings/indexers', admin)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('gives non-admins no back link', () => {
    renderAt('/settings/profile', { user: { isAdmin: false } })
    const header = screen.getByTestId('app-header')
    expect(within(header).queryByRole('link')).not.toBeInTheDocument()
    expect(within(header).getByRole('heading', { level: 1 })).toHaveTextContent('Profile')
  })
})
