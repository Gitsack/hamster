import { render, screen, fireEvent } from '@testing-library/react'
import { Film01Icon } from '@hugeicons/core-free-icons'
import { MediaListRow } from './media-list-row'

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@hugeicons/react', () => ({
  HugeiconsIcon: ({ className }: { className?: string }) => (
    <svg data-testid="fallback-icon" className={className} />
  ),
}))

describe('MediaListRow', () => {
  it('renders artwork, title and subtitle', () => {
    render(
      <MediaListRow
        icon={Film01Icon}
        imageUrl="/poster.jpg"
        title="Blade Runner"
        subtitle="1982 · 117 min"
      />
    )

    expect(screen.getByRole('heading', { name: 'Blade Runner' })).toBeInTheDocument()
    expect(screen.getByText('1982 · 117 min')).toBeInTheDocument()
    expect(screen.getByRole('presentation')).toHaveAttribute('src', '/poster.jpg')
  })

  it('falls back to the media icon when the artwork fails to load', () => {
    render(<MediaListRow icon={Film01Icon} imageUrl="/broken.jpg" title="Blade Runner" />)

    fireEvent.error(screen.getByRole('presentation'))

    expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
    expect(screen.getByTestId('fallback-icon')).toBeInTheDocument()
  })

  it('reports image failures so a page can share the state with its grid', () => {
    const onImageError = vi.fn()
    render(
      <MediaListRow
        icon={Film01Icon}
        imageUrl="/broken.jpg"
        title="Blade Runner"
        onImageError={onImageError}
      />
    )

    fireEvent.error(screen.getByRole('presentation'))
    expect(onImageError).toHaveBeenCalled()
  })

  it('links the artwork and the title when href is given', () => {
    render(<MediaListRow icon={Film01Icon} title="Blade Runner" href="/movie/7" />)

    const links = screen.getAllByRole('link', { hidden: true })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', '/movie/7')
  })

  it('activates on click and on Enter when onActivate is given', () => {
    const onActivate = vi.fn()
    render(<MediaListRow icon={Film01Icon} title="Blade Runner" onActivate={onActivate} />)

    const row = screen.getByRole('heading', { name: 'Blade Runner' }).closest('[data-slot="card"]')!
    fireEvent.click(row)
    fireEvent.keyDown(row, { key: 'Enter' })

    expect(onActivate).toHaveBeenCalledTimes(2)
  })

  it('renders actions and the expanded panel', () => {
    render(
      <MediaListRow
        icon={Film01Icon}
        title="Blade Runner"
        actions={<button>Add</button>}
        expanded={<p>Track list</p>}
      />
    )

    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.getByText('Track list')).toBeInTheDocument()
  })
})
