import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './input'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('has data-slot="input"', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toHaveAttribute('data-slot', 'input')
  })

  it('handles type prop', () => {
    render(<Input type="password" data-testid="pw" />)
    const input = screen.getByTestId('pw')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('handles email type', () => {
    render(<Input type="email" data-testid="email" />)
    expect(screen.getByTestId('email')).toHaveAttribute('type', 'email')
  })

  it('handles value changes', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'hello')

    expect(handleChange).toHaveBeenCalledTimes(5)
    expect(input).toHaveValue('hello')
  })

  it('can be disabled', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('accepts a placeholder', () => {
    render(<Input placeholder="Enter text..." />)
    expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Input className="my-input-class" />)
    expect(screen.getByRole('textbox')).toHaveClass('my-input-class')
  })

  it('forwards additional props', () => {
    render(<Input aria-label="Search" name="search" />)
    const input = screen.getByRole('textbox', { name: 'Search' })
    expect(input).toHaveAttribute('name', 'search')
  })
})
