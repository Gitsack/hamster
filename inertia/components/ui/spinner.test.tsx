import { render, screen } from '@testing-library/react'
import { Spinner } from './spinner'

describe('Spinner', () => {
  it('renders with role="status"', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has aria-label="Loading"', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading')
  })

  it('applies custom className', () => {
    render(<Spinner className="size-8" />)
    const spinner = screen.getByRole('status')
    expect(spinner).toHaveClass('size-8')
  })

  it('has the animate-spin class for animation', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toHaveClass('animate-spin')
  })
})
