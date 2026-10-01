import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaSettings } from './media-settings'
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

describe('MediaSettings', () => {
  it('shows each type with its folder, its space and what is wrong with it', async () => {
    vi.stubGlobal('fetch', vi.fn(libraryFetchStub()))
    render(<MediaSettings />)

    const types = section('Media types')
    await within(types).findByText('/media/movies')
    expect(within(types).getByText('1.2 TB free')).toBeInTheDocument()
    expect(within(types).getByText('Low space')).toBeInTheDocument()
    expect(within(types).getByText('Unreachable')).toBeInTheDocument()
    expect(within(types).getByText(/Check the mount/)).toBeInTheDocument()
    // Books is off: its switch is off and it has no folder verdict.
    expect(within(types).getByRole('switch', { name: 'Manage books' })).not.toBeChecked()
  })

  it('holds Movies and TV off without a TMDB key, and offers the key instead', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        libraryFetchStub({
          settings: { ...SETTINGS_FIXTURE, hasTmdbApiKey: false, enabledMediaTypes: ['music'] },
        })
      )
    )
    render(<MediaSettings />)

    const types = section('Media types')
    const movies = await within(types).findByRole('switch', { name: 'Manage movies' })
    expect(movies).toHaveAttribute('data-disabled')
    expect(within(types).getAllByText('Needs TMDB key')).toHaveLength(2)

    await userEvent.click(within(types).getAllByRole('button', { name: 'Add key' })[0])
    expect(await screen.findByRole('dialog', { name: 'Add TMDB API key' })).toBeInTheDocument()
  })

  it('switches a type on through the media-type endpoint alone', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<MediaSettings />)

    const books = await within(section('Media types')).findByRole('switch', {
      name: 'Manage books',
    })
    await userEvent.click(books)

    await waitFor(() => expect(books).toBeChecked())
    expect(writes(fetchMock)).toEqual([
      {
        url: '/api/v1/settings/media-type',
        method: 'POST',
        body: { mediaType: 'books', enabled: true },
      },
    ])
  })

  it('collapses each type to the path it writes, and saves edits from the save bar', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<MediaSettings />)

    const naming = section('File organization')
    expect(
      await within(naming).findByText('Arrival (2016)/Arrival (2016) - Bluray-1080p')
    ).toBeInTheDocument()

    await userEvent.click(within(naming).getByRole('button', { name: /^Movies/ }))
    const file = await within(naming).findByLabelText('Movie file format')
    fireEvent.change(file, { target: { value: '{title} [{quality}]' } })

    const bar = await screen.findByRole('region', { name: 'Unsaved changes' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument()
    )
    expect(writes(fetchMock)).toEqual([
      {
        url: '/api/v1/settings/naming-patterns',
        method: 'PUT',
        body: {
          mediaType: 'movies',
          patterns: { movieFolder: '{title} ({year})', movieFile: '{title} [{quality}]' },
        },
      },
    ])
  })

  it('puts a refused pattern’s reason under its field and keeps the edit', async () => {
    vi.stubGlobal('fetch', vi.fn(libraryFetchStub()))
    render(<MediaSettings />)

    const naming = section('File organization')
    await userEvent.click(await within(naming).findByRole('button', { name: /^Movies/ }))
    fireEvent.change(await within(naming).findByLabelText('Movie file format'), {
      target: { value: '{title} {nope}' },
    })
    const bar = await screen.findByRole('region', { name: 'Unsaved changes' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Save' }))

    expect(await within(bar).findByRole('alert')).toHaveTextContent('Unknown variable: {nope}')
    expect(within(naming).getAllByText('Unknown variable: {nope}').length).toBeGreaterThan(0)
    expect(within(naming).getByLabelText('Movie file format')).toHaveValue('{title} {nope}')
  })

  it('refuses a track limit outside 1–100 before saving anything', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<MediaSettings />)

    const input = await screen.findByLabelText('Leave files alone up to')
    fireEvent.change(input, { target: { value: '400' } })
    expect(await screen.findByText('Enter a whole number from 1 to 100.')).toBeInTheDocument()

    const bar = screen.getByRole('region', { name: 'Unsaved changes' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Save' }))
    expect(await within(bar).findByRole('alert')).toHaveTextContent('from 1 to 100')
    expect(writes(fetchMock)).toEqual([])

    fireEvent.change(input, { target: { value: '30' } })
    await userEvent.click(within(bar).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        {
          url: '/api/v1/settings/subtitle-pruning',
          method: 'PUT',
          body: { enabled: true, maxTracks: 30, keepLanguages: ['en', 'de'] },
        },
      ])
    )
  })

  it('shares one hardware setting, sending only the transcoding block', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<MediaSettings />)

    const hardware = section('Hardware acceleration')
    expect(await within(hardware).findByText('Quick Sync · VAAPI (ICQ)')).toBeInTheDocument()
    expect(within(hardware).getByText('Uses: Intel Quick Sync.')).toBeInTheDocument()
    await userEvent.click(within(hardware).getByRole('switch', { name: 'Decode while streaming' }))

    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        {
          url: '/api/v1/settings/playback',
          method: 'PUT',
          body: {
            transcoding: {
              useHardwareAcceleration: false,
              hardwareAccelType: 'auto',
              vaapiDevice: '/dev/dri/renderD128',
              useForVersions: true,
              encoderPreset: 'balanced',
            },
          },
        },
      ])
    )
  })

  it('shows a failed load in the section, with a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(libraryFetchStub({ failing: ['/api/v1/rootfolders'] })))
    render(<MediaSettings />)

    const types = section('Media types')
    expect(await within(types).findByRole('alert')).toHaveTextContent(
      'Root folders could not be loaded: Something broke'
    )
    expect(within(types).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    // The rest of the page is unaffected.
    expect(
      await within(section('Hardware acceleration')).findByText('Quick Sync · VAAPI (ICQ)')
    ).toBeInTheDocument()
  })
})
