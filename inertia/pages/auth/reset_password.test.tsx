import { render, screen, fireEvent } from '@testing-library/react'
import ResetPassword from './reset_password'

const mockPost = vi.fn()
let mockFlash: Record<string, string> = {}

vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => ({
    props: { flash: mockFlash },
  }),
  useForm: (defaults: any) => ({
    data: { ...defaults },
    setData: vi.fn(),
    post: mockPost,
    processing: false,
  }),
}))

vi.mock('@/components/icons/hamster-logo', () => ({
  HamsterLogo: () => <div data-testid="hamster-logo" />,
}))

describe('ResetPassword', () => {
  beforeEach(() => {
    mockPost.mockClear()
    mockFlash = {}
  })

  it('renders form fields when no error', () => {
    render(<ResetPassword token="abc123" />)
    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument()
  })

  it('hides form when error prop is present', () => {
    render(<ResetPassword token="abc123" error="Token has expired" />)
    expect(screen.getByText('Token has expired')).toBeInTheDocument()
    expect(screen.getByText('Request a new link')).toHaveAttribute('href', '/forgot-password')
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
  })

  it('shows token error message but keeps form visible', () => {
    render(<ResetPassword token="abc123" errors={{ token: 'Invalid token' }} />)
    expect(screen.getByText('Invalid token')).toBeInTheDocument()
    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
  })

  it('shows field validation errors', () => {
    render(
      <ResetPassword
        token="abc123"
        errors={{
          password: 'Password is too short',
          passwordConfirmation: 'Passwords do not match',
        }}
      />
    )
    expect(screen.getByText('Password is too short')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('shows flash success message', () => {
    mockFlash = { success: 'Password has been reset' }
    render(<ResetPassword token="abc123" />)
    expect(screen.getByText('Password has been reset')).toBeInTheDocument()
  })

  it('has Sign in link', () => {
    render(<ResetPassword token="abc123" />)
    expect(screen.getByText('Sign in')).toHaveAttribute('href', '/login')
  })

  it('submits form with post to /reset-password', () => {
    render(<ResetPassword token="abc123" />)
    const form = document.querySelector('form')!
    fireEvent.submit(form)
    expect(mockPost).toHaveBeenCalledWith('/reset-password')
  })
})
