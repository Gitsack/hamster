import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscoverySettings } from './discovery-settings'
import { SETTINGS_FIXTURE, libraryFetchStub } from './library_fixtures'

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function section(name: string) {
  return screen.getByRole('heading', { name, level: 3 }).closest('section') as HTMLElement
}

function writes(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method && init.method !== 'GET')
    .map(([url, init]) => ({
      url: String(url),
      method: init.method,
      body: init.body ? JSON.parse(init.body) : undefined,
    }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DiscoverySettings', () => {
  it('shows credentials as set or missing, never their values', async () => {
    vi.stubGlobal('fetch', vi.fn(libraryFetchStub()))
    render(<DiscoverySettings />)

    const credentials = section('Credentials')
    expect(await within(credentials).findByText('TMDB API key')).toBeInTheDocument()
    expect(within(credentials).getAllByText('Set')).toHaveLength(2)
    expect(within(credentials).getByRole('button', { name: 'Replace TMDB API key' })).toBeVisible()
  })

  it('sends only the recommendation block when a source is switched', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<DiscoverySettings />)

    const sources = section('Sources')
    await within(sources).findByText('Simkl trending')
    const [, simkl] = within(sources).getAllByRole('switch')
    await userEvent.click(simkl)

    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        {
          url: '/api/v1/settings',
          method: 'PUT',
          body: {
            recommendationSettings: {
              ...SETTINGS_FIXTURE.recommendationSettings,
              simklEnabled: false,
            },
          },
        },
      ])
    )
  })

  it('keeps two quick switches from undoing each other', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<DiscoverySettings />)

    const sources = section('Sources')
    await within(sources).findByText('Simkl trending')
    const [, simkl, personalised] = within(sources).getAllByRole('switch')
    await userEvent.click(simkl)
    await userEvent.click(personalised)

    await waitFor(() => expect(writes(fetchMock)).toHaveLength(2))
    expect(writes(fetchMock)[1].body.recommendationSettings).toMatchObject({
      simklEnabled: false,
      personalizedEnabled: false,
    })
  })

  it('writes JustWatch to both places the server reads it from', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<DiscoverySettings />)

    const sources = section('Sources')
    await within(sources).findByText('JustWatch')
    await userEvent.click(within(sources).getAllByRole('switch')[0])

    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1))
    expect(writes(fetchMock)[0].body).toEqual({
      recommendationSettings: {
        ...SETTINGS_FIXTURE.recommendationSettings,
        justwatchEnabled: false,
      },
      justwatchEnabled: false,
    })
  })

  it('disables the lane count while personalised lanes are off, rather than hiding it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        libraryFetchStub({
          settings: {
            ...SETTINGS_FIXTURE,
            recommendationSettings: {
              ...SETTINGS_FIXTURE.recommendationSettings,
              personalizedEnabled: false,
            },
          },
        })
      )
    )
    render(<DiscoverySettings />)

    const sources = section('Sources')
    const lanes = await within(sources).findByLabelText('Personalised lanes shown')
    expect(lanes).toHaveAttribute('data-disabled')
  })

  it('lists the chosen streaming services', async () => {
    vi.stubGlobal('fetch', vi.fn(libraryFetchStub()))
    render(<DiscoverySettings />)

    const streaming = section('Your streaming services')
    expect(await within(streaming).findByText('Netflix')).toBeInTheDocument()
    expect(within(streaming).getByText('Disney Plus')).toBeInTheDocument()
    expect(within(streaming).queryByText('WOW')).not.toBeInTheDocument()
  })

  it('without a TMDB key, says what streaming services need instead of vanishing', async () => {
    const fetchMock = vi.fn(
      libraryFetchStub({ settings: { ...SETTINGS_FIXTURE, hasTmdbApiKey: false } })
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<DiscoverySettings />)

    const streaming = section('Your streaming services')
    expect(await within(streaming).findByText('Needs TMDB key')).toBeInTheDocument()
    expect(within(streaming).getByRole('button', { name: 'Choose services' })).toBeDisabled()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('watch-providers'))).toBe(
      false
    )

    await userEvent.click(within(streaming).getByRole('button', { name: 'Add key' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add TMDB API key' })
    await userEvent.type(
      within(dialog).getByLabelText('TMDB API key'),
      '0123456789abcdef0123456789abcdef'
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(streaming).findByText('Netflix')).toBeInTheDocument()
    expect(writes(fetchMock)).toEqual([
      {
        url: '/api/v1/settings',
        method: 'PUT',
        body: { tmdbApiKey: '0123456789abcdef0123456789abcdef' },
      },
    ])
  })

  it('catches a v4 token pasted where the v3 key belongs', async () => {
    const fetchMock = vi.fn(
      libraryFetchStub({ settings: { ...SETTINGS_FIXTURE, hasTmdbApiKey: false } })
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<DiscoverySettings />)

    const credentials = section('Credentials')
    await userEvent.click(
      await within(credentials).findByRole('button', { name: 'Add TMDB API key' })
    )
    const dialog = await screen.findByRole('dialog', { name: 'Add TMDB API key' })
    await userEvent.type(within(dialog).getByLabelText('TMDB API key'), 'eyJhbGciOiJIUzI1NiJ9.abc')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('v4 read access token')
    expect(writes(fetchMock)).toEqual([])
  })
})
