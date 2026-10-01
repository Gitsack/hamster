import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForYouDeck, type ForYouCard } from './for-you-deck'

const mockVisit = vi.fn()
vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { visit: (...args: unknown[]) => mockVisit(...args) },
}))

vi.mock('@/contexts/media_preview_context', () => ({
  useMediaPreview: () => ({ openMoviePreview: vi.fn(), openTvShowPreview: vi.fn() }),
}))

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast }))

const card = (over: Partial<ForYouCard>): ForYouCard => ({
  key: 'movie:1',
  mediaType: 'movie',
  externalId: '1',
  title: 'Heat',
  year: 1995,
  subtitle: null,
  overview: 'A heist.',
  posterUrl: null,
  backdropUrl: null,
  rating: 8.3,
  genres: ['Crime'],
  reason: 'Because you rated Thief 9/10',
  score: 1,
  ...over,
})

const deck = (cards: ForYouCard[], types: string[] | null = null) => ({
  preferences: { types },
  cards,
  signals: {
    sources: [
      { id: 'simkl', label: 'Simkl', state: 'active', detail: '120 Simkl ratings' },
      { id: 'media-server', label: 'Jellyfin / Emby', state: 'off', detail: null },
    ],
    requests: 0,
    library: 10,
  },
  requestDefaults: {
    movie: { qualityProfileId: 'qp', rootFolderId: 'rf' },
    tv: { qualityProfileId: 'qp2', rootFolderId: 'rf2' },
    album: { qualityProfileId: 'qp3', rootFolderId: 'rf3' },
  },
})

let fetchMock: ReturnType<typeof vi.fn>
function mockFetch(cards: ForYouCard[], types: string[] | null = null) {
  fetchMock = vi.fn((url: string) => {
    if (url === '/api/v1/watch-providers/batch')
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            providers: {
              '1': [{ id: 8, name: 'Netflix', logoUrl: '/netflix.png' }],
              '2': [
                { id: 8, name: 'Netflix', logoUrl: '/netflix.png' },
                { id: 337, name: 'Disney Plus', logoUrl: '/disney.png' },
              ],
            },
          }),
      })
    if (url.startsWith('/api/v1/watch-providers/links?')) {
      const id = new URLSearchParams(url.split('?')[1]).get('tmdbId')
      const links =
        id === '1'
          ? [
              {
                id: 8,
                name: 'Netflix',
                logoUrl: '/netflix.png',
                url: 'https://www.netflix.com/title/1',
                direct: true,
              },
            ]
          : [
              {
                id: 8,
                name: 'Netflix',
                logoUrl: '/netflix.png',
                url: 'https://www.netflix.com/title/2',
                direct: true,
              },
              {
                id: 337,
                name: 'Disney Plus',
                logoUrl: '/disney.png',
                url: 'https://www.themoviedb.org/movie/2/watch',
                direct: false,
              },
            ]
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ links }) })
    }
    if (url.startsWith('/api/v1/for-you/extras/'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            key: null,
            cast: [
              { name: 'Al Pacino', character: 'Vincent Hanna', photo: null },
              { name: 'Robert De Niro', character: 'Neil McCauley', photo: null },
            ],
          }),
      })
    if (url.startsWith('/api/v1/for-you') && !url.includes('feedback'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(deck(cards, types)),
      })
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'new' }) })
  })
  vi.stubGlobal('fetch', fetchMock)
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }))
})
afterEach(() => vi.unstubAllGlobals())

const calls = (url: string) => fetchMock.mock.calls.filter(([u]) => u === url)

/** Past the start stage, as a user would. */
const start = async () =>
  userEvent.click(await screen.findByRole('button', { name: /Start matching/ }))

describe('ForYouDeck', () => {
  it('waits on a start stage, and arrow keys do nothing until it is passed', async () => {
    mockFetch([card({}), card({ key: 'movie:2', externalId: '2', title: 'Ronin' })])
    render(<ForYouDeck />)
    expect(await screen.findByText(/picks ready/)).toBeInTheDocument()
    expect(screen.queryByText('Heat')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(calls('/api/v1/movies')).toHaveLength(0)
    await start()
    expect(await screen.findByText('Heat')).toBeInTheDocument()
  })

  it('shows the top card with why it was picked', async () => {
    mockFetch([card({})])
    render(<ForYouDeck />)
    await start()
    expect(await screen.findByText('Heat')).toBeInTheDocument()
    expect(screen.getByText('Because you rated Thief 9/10')).toBeInTheDocument()
    expect(screen.getByText(/120 Simkl ratings/)).toBeInTheDocument()
  })

  it('skips to the next card and records the skip', async () => {
    mockFetch([card({}), card({ key: 'movie:2', externalId: '2', title: 'Ronin' })])
    render(<ForYouDeck />)
    await start()
    await screen.findByText('Heat')
    await userEvent.click(screen.getByRole('button', { name: /^Skip(?!ped)/ }))
    expect(await screen.findByText('Ronin')).toBeInTheDocument()
    const [, init] = calls('/api/v1/for-you/feedback')[0]
    expect(JSON.parse(init.body)).toMatchObject({
      mediaType: 'movie',
      externalId: '1',
      action: 'skipped',
    })
  })

  it('saves a card with the up arrow, without requesting it', async () => {
    mockFetch([card({}), card({ key: 'movie:2', externalId: '2', title: 'Ronin' })])
    render(<ForYouDeck />)
    await start()
    await screen.findByText('Heat')
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(await screen.findByText('Ronin')).toBeInTheDocument()
    await waitFor(() => expect(calls('/api/v1/for-you/feedback')).toHaveLength(1))
    expect(JSON.parse(calls('/api/v1/for-you/feedback')[0][1].body)).toMatchObject({
      externalId: '1',
      action: 'interested',
    })
    expect(calls('/api/v1/movies')).toHaveLength(0)
  })

  it('counts a skip as interested once the title was opened on a streaming service', async () => {
    mockFetch([card({ key: 'movie:opened' })])
    render(<ForYouDeck />)
    await start()
    const link = await screen.findByRole('link', { name: 'Watch on Netflix' })
    link.addEventListener('click', (e) => e.preventDefault())
    await userEvent.click(link)
    await userEvent.click(screen.getByRole('button', { name: /^Skip(?!ped)/ }))
    await waitFor(() => expect(calls('/api/v1/for-you/feedback')).toHaveLength(1))
    expect(JSON.parse(calls('/api/v1/for-you/feedback')[0][1].body)).toMatchObject({
      action: 'interested',
    })
  })

  it('requests a movie with the default profile when the right arrow is pressed', async () => {
    mockFetch([card({})])
    render(<ForYouDeck />)
    await start()
    await screen.findByText('Heat')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(calls('/api/v1/movies')).toHaveLength(1))
    expect(JSON.parse(calls('/api/v1/movies')[0][1].body)).toMatchObject({
      tmdbId: '1',
      qualityProfileId: 'qp',
      rootFolderId: 'rf',
      requested: true,
    })
    await waitFor(() => expect(calls('/api/v1/for-you/feedback')).toHaveLength(1))
  })

  it('requests only season 1 of a show', async () => {
    mockFetch([card({ key: 'tv:9', mediaType: 'tv', externalId: '9', title: 'The Wire' })])
    render(<ForYouDeck />)
    await start()
    await userEvent.click(await screen.findByRole('button', { name: /^Request/ }))
    await waitFor(() => expect(calls('/api/v1/tvshows')).toHaveLength(1))
    expect(JSON.parse(calls('/api/v1/tvshows')[0][1].body).selectedSeasons).toEqual([1])
    // The button just says Request; the confirmation says what was queued.
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('season 1 requested'),
        expect.anything()
      )
    )
  })

  it('requests an album by flipping its existing row', async () => {
    mockFetch([card({ key: 'album:a1', mediaType: 'album', externalId: 'a1', title: 'Kid A' })])
    render(<ForYouDeck />)
    await start()
    await userEvent.click(await screen.findByRole('button', { name: /^Request/ }))
    await waitFor(() => expect(calls('/api/v1/albums/a1')).toHaveLength(1))
    expect(calls('/api/v1/albums/a1')[0][1].method).toBe('PUT')
  })

  it('shows the main cast under a film', async () => {
    mockFetch([card({})])
    render(<ForYouDeck />)
    await start()
    expect(await screen.findByText('Al Pacino')).toBeInTheDocument()
    expect(screen.getByText('Neil McCauley')).toBeInTheDocument()
  })

  const mixed = () => [
    card({}),
    card({ key: 'tv:9', mediaType: 'tv', externalId: '9', title: 'The Wire' }),
    card({ key: 'book:b1', mediaType: 'book', externalId: 'b1', title: 'Dune' }),
  ]

  it('shows several types together and remembers the choice', async () => {
    mockFetch(mixed())
    render(<ForYouDeck />)
    await start()
    await userEvent.click(screen.getByRole('button', { name: /^TV/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Books/ }))
    expect(screen.getByRole('button', { name: /^TV/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Books/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'false')
    // Movies are out: the first card is the show.
    expect(await screen.findByText('The Wire')).toBeInTheDocument()
    expect(screen.queryByText('Heat')).not.toBeInTheDocument()
    const saves = calls('/api/v1/for-you/preferences')
    expect(JSON.parse(saves.at(-1)![1].body)).toEqual({ types: ['tv', 'book'] })
  })

  it('opens on the saved choice', async () => {
    mockFetch(mixed(), ['book'])
    render(<ForYouDeck />)
    await start()
    expect(await screen.findByText('Dune')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Books/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the type icon when a card has no cover', async () => {
    mockFetch([card({ key: 'book:b1', mediaType: 'book', externalId: 'b1', title: 'Dune' })])
    const { container } = render(<ForYouDeck />)
    await start()
    await screen.findByText('Dune')
    expect(container.querySelector('[aria-roledescription="recommendation"] img')).toBeNull()
    expect(
      container.querySelector('[aria-roledescription="recommendation"] svg[aria-hidden="true"]')
    ).not.toBeNull()
  })

  it('requests an album by a new artist through the add-album endpoint', async () => {
    mockFetch([
      card({
        key: 'album:new:ar1',
        mediaType: 'album',
        externalId: 'new:ar1',
        title: 'Discovery',
        albumRef: { artistMbid: 'ar1', releaseGroupMbid: 'rg1' },
      }),
    ])
    render(<ForYouDeck />)
    await start()
    await userEvent.click(await screen.findByRole('button', { name: /^Request/ }))
    await waitFor(() => expect(calls('/api/v1/albums')).toHaveLength(1))
    expect(JSON.parse(calls('/api/v1/albums')[0][1].body)).toMatchObject({
      musicbrainzId: 'rg1',
      artistMusicbrainzId: 'ar1',
      qualityProfileId: 'qp3',
      rootFolderId: 'rf3',
      requested: true,
    })
  })

  it('shows where a film streams on its poster', async () => {
    mockFetch([card({})])
    render(<ForYouDeck />)
    await start()
    expect(await screen.findByAltText('Netflix')).toBeInTheDocument()
  })

  it('opens the title on its one streaming service', async () => {
    mockFetch([card({})])
    render(<ForYouDeck />)
    await start()
    const link = await screen.findByRole('link', { name: 'Watch on Netflix' })
    expect(link).toHaveAttribute('href', 'https://www.netflix.com/title/1')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('offers a menu when the title streams on several services', async () => {
    mockFetch([card({ key: 'movie:2', externalId: '2' })])
    render(<ForYouDeck />)
    await start()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Watch on Netflix, Disney Plus' })
    )
    expect(await screen.findByRole('menuitem', { name: /Disney Plus/ })).toHaveAttribute(
      'href',
      'https://www.themoviedb.org/movie/2/watch'
    )
    expect(screen.getByRole('menuitem', { name: /Netflix/ })).toHaveAttribute(
      'href',
      'https://www.netflix.com/title/2'
    )
  })

  it('switches what the deck is about and remembers it', async () => {
    mockFetch([card({})])
    render(<ForYouDeck />)
    await start()
    await userEvent.click(screen.getByRole('combobox', { name: 'What to show' }))
    await userEvent.click(await screen.findByRole('option', { name: /Classics/ }))
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => u === '/api/v1/for-you?mode=classics')).toBe(true)
    )
    expect(JSON.parse(calls('/api/v1/for-you/preferences').at(-1)![1].body)).toEqual({
      mode: 'classics',
    })
  })

  it('says when the deck is used up', async () => {
    mockFetch([])
    render(<ForYouDeck />)
    expect(await screen.findByText("You're through the deck")).toBeInTheDocument()
  })
  it('asks for more when the deck runs low, without bringing back what was used', async () => {
    const heat = card({})
    const ronin = card({ key: 'movie:2', externalId: '2', title: 'Ronin' })
    const thief = card({ key: 'movie:3', externalId: '3', title: 'Thief' })
    mockFetch([heat, ronin])
    const firstLoad = fetchMock.getMockImplementation()!
    let deckLoads = 0
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/v1/for-you') && !url.includes('/for-you/') && ++deckLoads > 1)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(deck([heat, ronin, thief])),
        })
      return firstLoad(url, init)
    })
    render(<ForYouDeck />)
    // Two cards is below the top-up mark: the deck asks again and keeps the new one.
    // "2 picks ready" renders first, so wait for the end state rather than
    // asserting on the first heading — that raced the top-up.
    const heading = await screen.findByText(/picks ready/)
    await waitFor(() => expect(heading).toHaveTextContent('3 picks ready'))
    // Still below the mark at three, it asks once more; that answer repeats
    // Heat and Ronin, and neither comes back.
    await waitFor(() => expect(deckLoads).toBe(3))
    expect(heading).toHaveTextContent('3 picks ready')
  })
})
