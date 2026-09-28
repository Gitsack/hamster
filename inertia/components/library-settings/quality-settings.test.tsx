import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QualitySettings } from './quality-settings'
import { libraryFetchStub } from './library_fixtures'

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

describe('QualitySettings', () => {
  it('scopes the profiles to one type, first enabled by default, with a readout per row', async () => {
    vi.stubGlobal('fetch', vi.fn(libraryFetchStub()))
    const onTypeChange = vi.fn()
    render(<QualitySettings type={null} onTypeChange={onTypeChange} />)

    const profiles = section('Profiles')
    expect(await within(profiles).findByText('HD 1080p')).toBeInTheDocument()
    expect(within(profiles).getByText('Anything watchable')).toBeInTheDocument()
    expect(within(profiles).queryByText('TV 1080p')).not.toBeInTheDocument()
    expect(within(profiles).getByText('cutoff Bluray 1080p')).toBeInTheDocument()
    expect(within(profiles).getByText('2–15 GB')).toBeInTheDocument()

    const switcher = within(profiles).getByRole('group', { name: 'Media type' })
    expect(within(switcher).getByRole('button', { name: /Movies/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(within(switcher).getByRole('button', { name: /TV shows/ }))
    expect(onTypeChange).toHaveBeenCalledWith('tv')
  })

  it('follows ?type= and says when that type is switched off', async () => {
    vi.stubGlobal('fetch', vi.fn(libraryFetchStub()))
    render(<QualitySettings type="books" onTypeChange={vi.fn()} />)

    const profiles = section('Profiles')
    expect(await within(profiles).findByText(/No books profile yet/)).toBeInTheDocument()
    expect(within(profiles).getByText(/switched off in Media/)).toBeInTheDocument()
  })

  it('adds a profile for the type in view', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<QualitySettings type="music" onTypeChange={vi.fn()} />)

    const profiles = section('Profiles')
    await within(profiles).findByText('Lossless')
    await userEvent.click(within(profiles).getByRole('button', { name: 'Add profile' }))

    const sheet = await screen.findByRole('dialog', { name: 'Add music profile' })
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Portable')
    await userEvent.click(within(sheet).getByRole('checkbox', { name: 'FLAC' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add profile' }))

    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1))
    const [write] = writes(fetchMock)
    expect(write).toMatchObject({ url: '/api/v1/qualityprofiles', method: 'POST' })
    expect(write.body).toMatchObject({ name: 'Portable', mediaType: 'music', cutoff: 2 })
    expect(write.body.items.find((i: any) => i.name === 'FLAC').allowed).toBe(false)
    expect(await within(profiles).findByText('Portable')).toBeInTheDocument()
  })

  it('refuses a profile with nothing allowed, inside the sheet', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<QualitySettings type="music" onTypeChange={vi.fn()} />)

    await within(section('Profiles')).findByText('Lossless')
    await userEvent.click(screen.getByRole('button', { name: 'Lossless' }))
    const sheet = await screen.findByRole('dialog', { name: 'Lossless' })
    await userEvent.click(within(sheet).getByRole('checkbox', { name: 'FLAC' }))
    await userEvent.click(within(sheet).getByRole('checkbox', { name: 'ALAC' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Allow at least one quality.')
    expect(writes(fetchMock)).toEqual([])
  })

  it('deletes a profile only after asking', async () => {
    const fetchMock = vi.fn(libraryFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<QualitySettings type="movies" onTypeChange={vi.fn()} />)

    const profiles = section('Profiles')
    await within(profiles).findByText('HD 1080p')
    await userEvent.click(within(profiles).getAllByRole('button', { name: 'More actions' })[0])
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(writes(fetchMock)).toEqual([])

    await userEvent.click(await screen.findByRole('button', { name: 'Delete profile' }))
    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        { url: '/api/v1/qualityprofiles/qp-hd', method: 'DELETE', body: undefined },
      ])
    )
    await waitFor(() => expect(within(profiles).queryByText('HD 1080p')).not.toBeInTheDocument())
  })

  it('lists custom formats as rows with their conditions', async () => {
    vi.stubGlobal('fetch', vi.fn(libraryFetchStub()))
    render(<QualitySettings type="movies" onTypeChange={vi.fn()} />)

    const formats = section('Custom formats')
    expect(await within(formats).findByText('Atmos audio')).toBeInTheDocument()
    expect(within(formats).getByText('Release group is FraMeSToR')).toBeInTheDocument()
  })
})
