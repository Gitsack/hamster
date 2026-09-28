import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  SubtitlePruningSection,
  parseMaxTracks,
  useSubtitlePruning,
} from '@/components/settings/subtitle-pruning-section'

const options = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  maxTracks: 20,
  keepLanguages: ['en', 'de'],
  ...overrides,
})

function mockFetch(getBody: Record<string, unknown>) {
  const put = vi.fn()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(init.body as string)
        put(body)
        return new Response(JSON.stringify({ options: body }), { status: 200 })
      }
      return new Response(JSON.stringify(getBody), { status: 200 })
    })
  )
  return { put }
}

/** The section as Settings → Media composes it: the track limit is the page's draft. */
function Harness() {
  const state = useSubtitlePruning()
  const [maxTracks, setMaxTracks] = useState('20')
  return (
    <SubtitlePruningSection state={state} maxTracks={maxTracks} onMaxTracksChange={setMaxTracks} />
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SubtitlePruningSection', () => {
  it('shows the stored policy once loaded', async () => {
    mockFetch({ options: options(), ffmpegAvailable: true })
    render(<Harness />)

    expect(await screen.findByText('English')).toBeInTheDocument()
    expect(screen.getByText('German')).toBeInTheDocument()
    expect(screen.getByLabelText('Leave files alone up to')).toHaveValue(20)
  })

  it('warns when ffmpeg is missing, because the policy silently will not run', async () => {
    mockFetch({ options: options(), ffmpegAvailable: false })
    render(<Harness />)

    expect(await screen.findByText(/ffmpeg isn't available/)).toBeInTheDocument()
  })

  it('says nothing about ffmpeg when it is present', async () => {
    mockFetch({ options: options(), ffmpegAvailable: true })
    render(<Harness />)

    await screen.findByText('English')
    expect(screen.queryByText(/ffmpeg isn't available/)).not.toBeInTheDocument()
  })

  it('saves as soon as the policy is switched on', async () => {
    const { put } = mockFetch({ options: options({ enabled: false }), ffmpegAvailable: true })
    render(<Harness />)

    await screen.findByText('Trim surplus subtitle tracks')
    await userEvent.click(screen.getByRole('switch'))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
    )
  })

  it('adds a searched language to the keep list', async () => {
    const { put } = mockFetch({ options: options({ keepLanguages: [] }), ffmpegAvailable: true })
    render(<Harness />)

    await userEvent.type(await screen.findByPlaceholderText('Add a language…'), 'germ')
    await userEvent.click(screen.getByRole('button', { name: /German/ }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.objectContaining({ keepLanguages: ['de'] }))
    )
  })

  it('removes a language from the keep list', async () => {
    const { put } = mockFetch({ options: options(), ffmpegAvailable: true })
    render(<Harness />)

    await userEvent.click(await screen.findByLabelText('Stop keeping German'))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.objectContaining({ keepLanguages: ['en'] }))
    )
  })

  it('keeps a quick switch and a language change from undoing each other', async () => {
    const { put } = mockFetch({ options: options({ enabled: false }), ffmpegAvailable: true })
    render(<Harness />)

    await screen.findByText('Trim surplus subtitle tracks')
    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByLabelText('Stop keeping German'))

    await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
    expect(put).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, keepLanguages: ['en'] })
    )
  })

  it('explains the fallback when no language is named', async () => {
    mockFetch({ options: options({ keepLanguages: [] }), ffmpegAvailable: true })
    render(<Harness />)

    expect(await screen.findByText(/first 20 tracks in file order are kept/)).toBeInTheDocument()
  })

  it('never saves the typed track limit on its own', async () => {
    const { put } = mockFetch({ options: options(), ffmpegAvailable: true })
    render(<Harness />)

    const input = await screen.findByLabelText('Leave files alone up to')
    await userEvent.clear(input)
    await userEvent.type(input, '30')
    await userEvent.tab()

    expect(input).toHaveValue(30)
    expect(put).not.toHaveBeenCalled()
  })
})

describe('parseMaxTracks', () => {
  it('accepts whole numbers from 1 to 100 only', () => {
    expect(parseMaxTracks('20')).toBe(20)
    expect(parseMaxTracks(' 100 ')).toBe(100)
    expect(parseMaxTracks('0')).toBeNull()
    expect(parseMaxTracks('101')).toBeNull()
    expect(parseMaxTracks('2.5')).toBeNull()
    expect(parseMaxTracks('')).toBeNull()
  })
})
