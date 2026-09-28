import { render, screen, within } from '@testing-library/react'
import { SettingsOverviewList } from './settings-overview'
import { OVERVIEW_FAILING, OVERVIEW_NOW, OVERVIEW_OK } from './settings_overview_fixtures'

const reload = vi.hoisted(() => vi.fn())

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { reload },
}))

describe('SettingsOverviewList', () => {
  it('lists every settings page with its status line', () => {
    render(
      <SettingsOverviewList overview={OVERVIEW_OK} email="me@example.com" now={OVERVIEW_NOW} />
    )
    const indexers = screen.getByRole('link', { name: /Indexers/ })
    expect(indexers).toHaveAttribute('href', '/settings/indexers')
    expect(indexers).toHaveTextContent('Prowlarr · synced 4m ago')
    expect(screen.getByRole('link', { name: /Profile/ })).toHaveTextContent('me@example.com')
    expect(screen.getAllByRole('link')).toHaveLength(9)
  })

  it('marks failing rows for sight and for screen readers', () => {
    render(<SettingsOverviewList overview={OVERVIEW_FAILING} now={OVERVIEW_NOW} />)
    const clients = screen.getByRole('link', { name: /Download clients/ })
    expect(clients).toHaveAttribute('data-tone', 'error')
    expect(within(clients).getByText('Failing:')).toHaveClass('sr-only')
    expect(screen.getByRole('link', { name: /Discovery/ })).toHaveAttribute('data-tone', 'warning')
    expect(screen.getByRole('link', { name: /Quality/ })).toHaveAttribute('data-tone', 'ok')
  })

  it('still navigates when the status could not be loaded, and offers a retry', () => {
    render(<SettingsOverviewList overview={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Status could not be loaded')
    screen.getByRole('button', { name: 'Retry' }).click()
    expect(reload).toHaveBeenCalledWith({ only: ['overview'] })
    expect(screen.getAllByRole('link')).toHaveLength(9)
  })
})
