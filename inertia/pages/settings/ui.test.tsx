import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UISettings from './ui'

vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  usePage: () => ({
    props: {
      user: { id: '1', fullName: 'Test User', email: 'test@example.com', isAdmin: true },
      version: '1.2.3',
    },
  }),
}))

vi.mock('@/components/layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

describe('UISettings', () => {
  beforeEach(async () => {
    const { toast } = await import('sonner')
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders account section with email and display name', () => {
    render(<UISettings />)
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com')
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Display Name')).toHaveValue('Test User')
  })

  it('shows admin badge when user is admin', () => {
    render(<UISettings />)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('shows version', () => {
    render(<UISettings />)
    expect(screen.getByText('Hamster v1.2.3')).toBeInTheDocument()
  })

  it('renders change password section', () => {
    render(<UISettings />)
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument()
  })

  it('profile save calls fetch to /api/v1/user/profile', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    render(<UISettings />)
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/user/profile',
        expect.objectContaining({ method: 'PUT' })
      )
    })
    expect(toast.success).toHaveBeenCalledWith('Profile updated')
  })

  it('shows error when password fields are empty', async () => {
    const user = userEvent.setup()
    render(<UISettings />)
    await user.click(screen.getByRole('button', { name: 'Change Password' }))
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('Please fill in all password fields')
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<UISettings />)
    await user.type(screen.getByLabelText('Current Password'), 'oldpass123')
    await user.type(screen.getByLabelText('New Password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm New Password'), 'different1')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('New passwords do not match')
  })

  it('shows error when new password is too short', async () => {
    const user = userEvent.setup()
    render(<UISettings />)
    await user.type(screen.getByLabelText('Current Password'), 'oldpass123')
    await user.type(screen.getByLabelText('New Password'), 'short')
    await user.type(screen.getByLabelText('Confirm New Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('Password must be at least 8 characters')
  })

  it('password change calls fetch to /api/v1/user/password', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    render(<UISettings />)
    await user.type(screen.getByLabelText('Current Password'), 'oldpass123')
    await user.type(screen.getByLabelText('New Password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/user/password',
        expect.objectContaining({ method: 'PUT' })
      )
    })
    expect(toast.success).toHaveBeenCalledWith('Password changed')
  })
})
