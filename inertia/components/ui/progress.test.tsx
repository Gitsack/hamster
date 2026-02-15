import { render, screen } from '@testing-library/react'
import { Progress } from './progress'

describe('Progress', () => {
  it('renders a progressbar', () => {
    render(<Progress value={50} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('has data-slot="progress"', () => {
    render(<Progress value={50} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-slot', 'progress')
  })

  it('renders with a value', () => {
    render(<Progress value={75} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '75')
  })

  it('renders with zero value', () => {
    render(<Progress value={0} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '0')
  })

  it('renders with full value', () => {
    render(<Progress value={100} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '100')
  })

  it('renders track and indicator elements', () => {
    render(<Progress value={50} />)
    const track = screen.getByRole('progressbar').querySelector('[data-slot="progress-track"]')
    const indicator = screen.getByRole('progressbar').querySelector(
      '[data-slot="progress-indicator"]'
    )
    expect(track).toBeInTheDocument()
    expect(indicator).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Progress value={50} className="my-custom-class" />)
    expect(screen.getByRole('progressbar').className).toContain('my-custom-class')
  })

  it('renders without value (indeterminate)', () => {
    render(<Progress />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
