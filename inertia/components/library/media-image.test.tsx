import { render, screen, fireEvent } from '@testing-library/react'
import { MediaImage } from './media-image'

// Mock HugeiconsIcon to render a simple element with the icon name
vi.mock('@hugeicons/react', () => ({
  HugeiconsIcon: ({ icon, className }: { icon: { name?: string }; className?: string }) => (
    <svg data-testid="fallback-icon" className={className} aria-label={icon?.name ?? 'icon'} />
  ),
}))

describe('MediaImage', () => {
  it('renders an img when src is provided', () => {
    render(<MediaImage src="/poster.jpg" alt="Movie poster" mediaType="movies" />)
    const img = screen.getByRole('img', { name: 'Movie poster' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/poster.jpg')
  })

  it('renders with lazy loading', () => {
    render(<MediaImage src="/poster.jpg" alt="Poster" mediaType="movies" />)
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy')
  })

  it('renders fallback icon when src is null', () => {
    render(<MediaImage src={null} alt="No poster" mediaType="movies" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('fallback-icon')).toBeInTheDocument()
  })

  it('renders fallback icon when src is undefined', () => {
    render(<MediaImage src={undefined} alt="No poster" mediaType="music" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('fallback-icon')).toBeInTheDocument()
  })

  it('renders fallback icon on image error', () => {
    render(<MediaImage src="/broken.jpg" alt="Broken" mediaType="tv" />)
    const img = screen.getByRole('img')

    fireEvent.error(img)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('fallback-icon')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<MediaImage src="/poster.jpg" alt="Poster" mediaType="movies" className="rounded-lg" />)
    expect(screen.getByRole('img').className).toContain('rounded-lg')
  })

  it('applies custom iconClassName to fallback', () => {
    render(
      <MediaImage src={null} alt="No poster" mediaType="books" iconClassName="h-24 w-24" />
    )
    const icon = screen.getByTestId('fallback-icon')
    expect(icon).toHaveClass('h-24', 'w-24')
  })

  it('renders for all media types without error', () => {
    const mediaTypes = ['music', 'movies', 'tv', 'books', 'album'] as const
    for (const mediaType of mediaTypes) {
      const { unmount } = render(
        <MediaImage src={null} alt={`${mediaType} fallback`} mediaType={mediaType} />
      )
      expect(screen.getByTestId('fallback-icon')).toBeInTheDocument()
      unmount()
    }
  })
})
