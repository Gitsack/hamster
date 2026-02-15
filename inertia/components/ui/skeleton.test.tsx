import { render, screen } from '@testing-library/react'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('renders a div', () => {
    render(<Skeleton data-testid="skeleton" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton.tagName).toBe('DIV')
  })

  it('has data-slot="skeleton"', () => {
    render(<Skeleton data-testid="skeleton" />)
    expect(screen.getByTestId('skeleton')).toHaveAttribute('data-slot', 'skeleton')
  })

  it('applies default animation classes', () => {
    render(<Skeleton data-testid="skeleton" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton.className).toContain('animate-pulse')
    expect(skeleton.className).toContain('rounded-md')
  })

  it('applies custom className', () => {
    render(<Skeleton data-testid="skeleton" className="h-4 w-32" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton.className).toContain('h-4')
    expect(skeleton.className).toContain('w-32')
  })

  it('passes through additional HTML attributes', () => {
    render(<Skeleton data-testid="skeleton" aria-label="Loading content" />)
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-label', 'Loading content')
  })

  it('renders children when provided', () => {
    render(
      <Skeleton data-testid="skeleton">
        <span>Loading...</span>
      </Skeleton>
    )
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
