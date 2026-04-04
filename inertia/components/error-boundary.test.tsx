import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './error-boundary'

function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>Content rendered successfully</div>
}

describe('ErrorBoundary', () => {
  // Suppress React error boundary console errors during tests
  const originalConsoleError = console.error
  beforeAll(() => {
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : ''
      if (msg.includes('Error: Uncaught') || msg.includes('The above error occurred')) return
      originalConsoleError(...args)
    }
  })
  afterAll(() => {
    console.error = originalConsoleError
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Hello world</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('shows default fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
  })

  it('shows custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error message</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('calls onError callback when an error is caught', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })

  it('resets error state when "Try again" is clicked', async () => {
    const user = userEvent.setup()

    // We need a component that can toggle between throwing and not throwing
    let shouldThrow = true
    function ToggleThrow() {
      if (shouldThrow) throw new Error('Test error')
      return <div>Recovered content</div>
    }

    render(
      <ErrorBoundary>
        <ToggleThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Stop throwing before clicking Try again
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(screen.getByText('Recovered content')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('applies full-page styling when fullPage is true', () => {
    render(
      <ErrorBoundary fullPage>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('min-h-screen')
  })

  it('applies inline styling when fullPage is not set', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    const alert = screen.getByRole('alert')
    expect(alert.className).not.toContain('min-h-screen')
    expect(alert.className).toContain('py-16')
  })
})
