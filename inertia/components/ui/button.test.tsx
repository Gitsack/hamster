import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    await user.click(screen.getByRole('button', { name: 'Click me' }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('can be disabled', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDisabled()
  })

  it('does not fire click events when disabled', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Button disabled onClick={handleClick}>
        Click me
      </Button>
    )

    await user.click(screen.getByRole('button', { name: 'Click me' }))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('applies variant classes', () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).toHaveAttribute('data-variant', 'destructive')
    expect(button.className).toContain('bg-destructive')

    rerender(<Button variant="outline">Outline</Button>)
    const outlineButton = screen.getByRole('button', { name: 'Outline' })
    expect(outlineButton).toHaveAttribute('data-variant', 'outline')

    rerender(<Button variant="ghost">Ghost</Button>)
    const ghostButton = screen.getByRole('button', { name: 'Ghost' })
    expect(ghostButton).toHaveAttribute('data-variant', 'ghost')
  })

  it('applies size classes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-size', 'sm')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-size', 'lg')

    rerender(<Button size="icon">Icon</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-size', 'icon')
  })

  it('uses default variant and size when none specified', () => {
    render(<Button>Default</Button>)
    const button = screen.getByRole('button', { name: 'Default' })
    expect(button).toHaveAttribute('data-variant', 'default')
    expect(button).toHaveAttribute('data-size', 'default')
  })

  it('has data-slot="button"', () => {
    render(<Button>Slotted</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-slot', 'button')
  })

  it('renders as child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Link Button' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })
})
