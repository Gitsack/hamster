import { render, screen, fireEvent } from '@testing-library/react'
import Login from './login'

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

describe('Login', () => {
  beforeEach(() => {
    mockPost.mockClear()
    mockFlash = {}
  })

  it('renders form elements', () => {
    render(<Login />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows navigation links', () => {
    render(<Login />)
    expect(screen.getByText('Forgot your password?')).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByText('Create one')).toHaveAttribute('href', '/register')
  })

  it('displays validation errors when errors prop provided', () => {
    render(<Login errors={{ email: 'Email is required', password: 'Password is required' }} />)
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  it('displays flash success message', () => {
    mockFlash = { success: 'Password reset successfully' }
    render(<Login />)
    expect(screen.getByText('Password reset successfully')).toBeInTheDocument()
  })

  it('submits form with post to /login', () => {
    render(<Login />)
    const form = document.querySelector('form')!
    fireEvent.submit(form)
    expect(mockPost).toHaveBeenCalledWith('/login')
  })
})
