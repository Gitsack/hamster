import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UISettings from './ui'

const pageProps: { user: Record<string, unknown>; version: string } = {
  user: { id: '1', fullName: 'Test User', email: 'test@example.com', isAdmin: true },
  version: '1.2.3',
}

const reload = vi.fn()

vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => ({ props: pageProps }),
  router: { reload: (...args: unknown[]) => reload(...args) },
}))

vi.mock('@/components/layout/settings-layout', () => ({
  SettingsLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('sonner', () => {
  const toast = {
    error: vi.fn(),
    success: vi.fn(),
  }
  return { toast }
})

vi.mock('@/components/ui/spinner', () => ({
  Spinner: () => <span data-testid="spinner" />,
}))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Profile settings', () => {
  beforeEach(async () => {
    const { toast } = await import('sonner')
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
    reload.mockClear()
    pageProps.user = { id: '1', fullName: 'Test User', email: 'test@example.com', isAdmin: true }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('has the account, appearance and password sections as anchors', () => {
    const { container } = render(<UISettings />)
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument()
    for (const id of ['account', 'appearance', 'password']) {
      expect(container.querySelector(`section#${id}`)).not.toBeNull()
    }
  })

  it('shows the sign-in address as a readout and the display name as a field', () => {
    render(<UISettings />)
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue('Test User')
  })

  it('names the role', () => {
    render(<UISettings />)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('leaves the version to the sidebar and System → About', () => {
    render(<UISettings />)
    expect(screen.queryByText(/v1\.2\.3/)).not.toBeInTheDocument()
  })

  it('offers the three themes as one radio group', () => {
    render(<UISettings />)
    const group = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument()
  })

  it('saves the display name through the save bar', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn().mockResolvedValue(json({ success: true }))
    vi.stubGlobal('fetch', mockFetch)

    render(<UISettings />)
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument()

    const field = screen.getByLabelText('Display name')
    await user.clear(field)
    await user.type(field, 'New Name')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/user/profile',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ fullName: 'New Name' }) })
      )
    })
    expect(toast.success).toHaveBeenCalledWith('Profile updated')
    expect(reload).toHaveBeenCalledWith({ only: ['user'] })
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument()
    )
  })

  it('renders the change password form', () => {
    render(<UISettings />)
    expect(screen.getByLabelText('Current password')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument()
  })

  it('says which password fields are missing, without a request', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    render(<UISettings />)
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByText('Enter your current password.')).toBeInTheDocument()
    expect(screen.getByText('Enter a new password.')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('flags a confirmation that does not match', async () => {
    const user = userEvent.setup()
    render(<UISettings />)
    await user.type(screen.getByLabelText('Current password'), 'oldpass123')
    await user.type(screen.getByLabelText('New password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm new password'), 'different1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByText('Does not match the new password.')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('flags a new password that is too short', async () => {
    const user = userEvent.setup()
    render(<UISettings />)
    await user.type(screen.getByLabelText('Current password'), 'oldpass123')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByText('At least 8 characters.')).toBeInTheDocument()
  })

  it('changes the password and clears the fields', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn().mockResolvedValue(json({ success: true }))
    vi.stubGlobal('fetch', mockFetch)

    render(<UISettings />)
    await user.type(screen.getByLabelText('Current password'), 'oldpass123')
    await user.type(screen.getByLabelText('New password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/user/password',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ currentPassword: 'oldpass123', newPassword: 'newpass123' }),
        })
      )
    })
    expect(toast.success).toHaveBeenCalledWith('Password changed')
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''))
  })

  it('puts a wrong current password on that field', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ error: 'Current password is incorrect' }, 400))
    )

    render(<UISettings />)
    await user.type(screen.getByLabelText('Current password'), 'wrongpass1')
    await user.type(screen.getByLabelText('New password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('replaces the password form with a sign-in note when let in by local access', () => {
    pageProps.user = { ...pageProps.user, autoSignedIn: true }
    render(<UISettings />)
    expect(screen.getByText('Signed in by local access')).toBeInTheDocument()
    expect(screen.getByText('Sign in with a password to change it.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
  })
})
