import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPassword from './reset_password'

const mockPost = vi.fn()
let mockProcessing = false
let mockFlash: { success?: string } = {}

vi.mock('@inertiajs/react', () => ({
  Head: ({ title }: { title: string }) => <title>{title}</title>,
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
  usePage: () => ({ props: { flash: mockFlash } }),
  useForm: (initial: any) => ({
    data: { ...initial },
    setData: vi.fn(),
    post: mockPost,
    processing: mockProcessing,
  }),
}))

// Mock HamsterLogo
vi.mock('@/components/icons/hamster-logo', () => ({
  HamsterLogo: () => <div data-testid="hamster-logo" />,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockProcessing = false
  mockFlash = {}
})

describe('ResetPassword', () => {
  const defaultProps = {
    token: 'test-token-123',
  }

  describe('rendering', () => {
    it('renders the page title', () => {
      render(<ResetPassword {...defaultProps} />)
      expect(document.querySelector('title')?.textContent).toBe('Reset Password')
    })

    it('renders the heading', () => {
      render(<ResetPassword {...defaultProps} />)
      expect(screen.getByText('Reset your password')).toBeInTheDocument()
    })

    it('renders description text', () => {
      render(<ResetPassword {...defaultProps} />)
      expect(screen.getByText('Enter your new password below.')).toBeInTheDocument()
    })

    it('renders password input field', () => {
      render(<ResetPassword {...defaultProps} />)
      expect(screen.getByLabelText('New Password')).toBeInTheDocument()
    })

    it('renders password confirmation input field', () => {
      render(<ResetPassword {...defaultProps} />)
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    })

    it('renders submit button with correct text', () => {
      render(<ResetPassword {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument()
    })

    it('renders sign in link', () => {
      render(<ResetPassword {...defaultProps} />)
      const signInLink = screen.getByText('Sign in')
      expect(signInLink).toBeInTheDocument()
      expect(signInLink.closest('a')).toHaveAttribute('href', '/login')
    })

    it('renders the hamster logo', () => {
      render(<ResetPassword {...defaultProps} />)
      expect(screen.getByTestId('hamster-logo')).toBeInTheDocument()
    })
  })

  describe('form submission', () => {
    it('renders a submit button that triggers form submission', () => {
      render(<ResetPassword {...defaultProps} />)
      const button = screen.getByRole('button', { name: 'Reset Password' })
      expect(button).toHaveAttribute('type', 'submit')
    })

    it('button is inside a form element', () => {
      render(<ResetPassword {...defaultProps} />)
      const button = screen.getByRole('button', { name: 'Reset Password' })
      expect(button.closest('form')).toBeInTheDocument()
    })
  })

  describe('processing state', () => {
    it('shows "Resetting..." when processing', () => {
      mockProcessing = true
      render(<ResetPassword {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Resetting...' })).toBeInTheDocument()
    })

    it('disables button when processing', () => {
      mockProcessing = true
      render(<ResetPassword {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Resetting...' })).toBeDisabled()
    })
  })

  describe('validation errors', () => {
    it('displays password error', () => {
      render(
        <ResetPassword
          {...defaultProps}
          errors={{ password: 'Password must be at least 8 characters' }}
        />
      )
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })

    it('displays password confirmation error', () => {
      render(
        <ResetPassword
          {...defaultProps}
          errors={{ passwordConfirmation: 'Passwords do not match' }}
        />
      )
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })

    it('displays both errors simultaneously', () => {
      render(
        <ResetPassword
          {...defaultProps}
          errors={{
            password: 'Too short',
            passwordConfirmation: 'Does not match',
          }}
        />
      )
      expect(screen.getByText('Too short')).toBeInTheDocument()
      expect(screen.getByText('Does not match')).toBeInTheDocument()
    })
  })

  describe('token error', () => {
    it('displays token error from errors prop', () => {
      render(
        <ResetPassword
          {...defaultProps}
          errors={{ token: 'Token has expired' }}
        />
      )
      expect(screen.getByText(/Token has expired/)).toBeInTheDocument()
    })

    it('displays error from error prop', () => {
      render(<ResetPassword {...defaultProps} error="Invalid or expired reset link" />)
      expect(screen.getByText(/Invalid or expired reset link/)).toBeInTheDocument()
    })

    it('hides the form when error prop is set', () => {
      render(<ResetPassword {...defaultProps} error="Invalid token" />)
      expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reset Password' })).not.toBeInTheDocument()
    })

    it('shows "Request a new link" link when token error is displayed', () => {
      render(<ResetPassword {...defaultProps} error="Token expired" />)
      const link = screen.getByText('Request a new link')
      expect(link.closest('a')).toHaveAttribute('href', '/forgot-password')
    })

    it('still shows sign in link when token error is displayed', () => {
      render(<ResetPassword {...defaultProps} error="Token expired" />)
      expect(screen.getByText('Sign in')).toBeInTheDocument()
    })
  })

  describe('flash messages', () => {
    it('displays flash success message', () => {
      mockFlash = { success: 'Your password has been reset successfully!' }
      render(<ResetPassword {...defaultProps} />)
      expect(screen.getByText('Your password has been reset successfully!')).toBeInTheDocument()
    })

    it('does not show flash area when no flash message', () => {
      mockFlash = {}
      render(<ResetPassword {...defaultProps} />)
      expect(
        screen.queryByText('Your password has been reset successfully!')
      ).not.toBeInTheDocument()
    })
  })
})
