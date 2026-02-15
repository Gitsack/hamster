import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaTeaser } from './media-teaser'

// Mock HugeiconsIcon
vi.mock('@hugeicons/react', () => ({
  HugeiconsIcon: ({ icon, className }: { icon: { name?: string }; className?: string }) => (
    <svg data-testid="media-icon" className={className} aria-label={icon?.name ?? 'icon'} />
  ),
}))

// Mock CardStatusBadge since it has complex dependencies
vi.mock('@/components/library/media-status-badge', () => ({
  CardStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}))

const defaultProps = {
  tmdbId: '12345',
  title: 'Test Movie',
  year: 2024,
  posterUrl: '/poster.jpg',
  genres: ['Action', 'Drama'],
  mediaType: 'movie' as const,
  status: 'none' as const,
}

describe('MediaTeaser', () => {
  it('renders title and year', () => {
    render(<MediaTeaser {...defaultProps} />)
    expect(screen.getByText('Test Movie')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
  })

  it('handles click', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<MediaTeaser {...defaultProps} onClick={handleClick} />)

    await user.click(screen.getByText('Test Movie'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows genre badge', () => {
    render(<MediaTeaser {...defaultProps} />)
    // First genre is displayed in uppercase
    expect(screen.getByText('ACTION')).toBeInTheDocument()
  })

  it('does not show genre badge when genres are empty', () => {
    render(<MediaTeaser {...defaultProps} genres={[]} />)
    expect(screen.queryByText('ACTION')).not.toBeInTheDocument()
  })

  it('does not show genre badge when genres are undefined', () => {
    render(<MediaTeaser {...defaultProps} genres={undefined} />)
    expect(screen.queryByText('ACTION')).not.toBeInTheDocument()
  })

  it('shows poster image when posterUrl is provided', () => {
    render(<MediaTeaser {...defaultProps} />)
    const img = screen.getByRole('img', { name: 'Test Movie' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/poster.jpg')
  })

  it('shows fallback icon when posterUrl is null', () => {
    render(<MediaTeaser {...defaultProps} posterUrl={null} />)
    expect(screen.queryByRole('img', { name: 'Test Movie' })).not.toBeInTheDocument()
    expect(screen.getByTestId('media-icon')).toBeInTheDocument()
  })

  it('shows fallback icon on image error', () => {
    render(<MediaTeaser {...defaultProps} />)
    const img = screen.getByRole('img', { name: 'Test Movie' })

    fireEvent.error(img)

    expect(screen.queryByRole('img', { name: 'Test Movie' })).not.toBeInTheDocument()
    expect(screen.getByTestId('media-icon')).toBeInTheDocument()
  })

  it('renders status badge', () => {
    render(<MediaTeaser {...defaultProps} status="downloaded" />)
    expect(screen.getByTestId('status-badge')).toHaveTextContent('downloaded')
  })

  it('renders without year', () => {
    render(<MediaTeaser {...defaultProps} year={undefined} />)
    expect(screen.getByText('Test Movie')).toBeInTheDocument()
    expect(screen.queryByText('2024')).not.toBeInTheDocument()
  })

  it('renders streaming provider logos', () => {
    const providers = [
      { id: 1, name: 'Netflix', logoUrl: '/netflix.png' },
      { id: 2, name: 'Disney+', logoUrl: '/disney.png' },
    ]
    render(<MediaTeaser {...defaultProps} streamingProviders={providers} />)
    expect(screen.getByAltText('Netflix')).toBeInTheDocument()
    expect(screen.getByAltText('Disney+')).toBeInTheDocument()
  })

  it('limits visible streaming providers and shows count for extras', () => {
    const providers = [
      { id: 1, name: 'Netflix', logoUrl: '/netflix.png' },
      { id: 2, name: 'Disney+', logoUrl: '/disney.png' },
      { id: 3, name: 'HBO', logoUrl: '/hbo.png' },
      { id: 4, name: 'Hulu', logoUrl: '/hulu.png' },
      { id: 5, name: 'Amazon', logoUrl: '/amazon.png' },
    ]
    render(<MediaTeaser {...defaultProps} streamingProviders={providers} />)
    // Only 3 are shown
    expect(screen.getByAltText('Netflix')).toBeInTheDocument()
    expect(screen.getByAltText('Disney+')).toBeInTheDocument()
    expect(screen.getByAltText('HBO')).toBeInTheDocument()
    expect(screen.queryByAltText('Hulu')).not.toBeInTheDocument()
    // Extra count shown
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})
