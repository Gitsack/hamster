import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from './switch'

describe('Switch', () => {
  it('renders a switch', () => {
    render(<Switch />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('has data-slot="switch"', () => {
    render(<Switch />)
    expect(screen.getByRole('switch')).toHaveAttribute('data-slot', 'switch')
  })

  it('is unchecked by default', () => {
    render(<Switch />)
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('can be checked by default', () => {
    render(<Switch defaultChecked />)
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('toggles when clicked', async () => {
    const user = userEvent.setup()
    render(<Switch />)

    const switchEl = screen.getByRole('switch')
    expect(switchEl).not.toBeChecked()

    await user.click(switchEl)
    expect(switchEl).toBeChecked()

    await user.click(switchEl)
    expect(switchEl).not.toBeChecked()
  })

  it('calls onCheckedChange when toggled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Switch onCheckedChange={handleChange} />)

    await user.click(screen.getByRole('switch'))
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true, expect.anything())
  })

  it('can be disabled', () => {
    render(<Switch disabled />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Switch disabled onCheckedChange={handleChange} />)

    await user.click(screen.getByRole('switch'))
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Switch className="my-custom-class" />)
    expect(screen.getByRole('switch').className).toContain('my-custom-class')
  })

  it('renders a thumb element', () => {
    render(<Switch />)
    const thumb = screen.getByRole('switch').querySelector('[data-slot="switch-thumb"]')
    expect(thumb).toBeInTheDocument()
  })
})
