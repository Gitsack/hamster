import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubtitlePruningCard } from '@/components/settings/subtitle-pruning-card'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const options = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  maxTracks: 20,
  keepLanguages: ['en', 'de'],
  ...overrides,
})

function mockFetch(getBody: Record<string, unknown>) {
  const put = vi.fn()
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      put(JSON.parse(init.body as string))
      return { ok: true, json: async () => ({ options: JSON.parse(init.body as string) }) }
    }
    return { ok: true, json: async () => getBody }
  })
  vi.stubGlobal('fetch', fetchMock)
  return { put }
}

describe('SubtitlePruningCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the stored policy once loaded', async () => {
    mockFetch({ options: options(), ffmpegAvailable: true })
    render(<SubtitlePruningCard />)

    expect(await screen.findByText('English')).toBeInTheDocument()
    expect(screen.getByText('German')).toBeInTheDocument()
    expect(screen.getByLabelText('Leave files alone up to')).toHaveValue(20)
  })

  it('warns when ffmpeg is missing, because the policy silently will not run', async () => {
    mockFetch({ options: options(), ffmpegAvailable: false })
    render(<SubtitlePruningCard />)

    expect(await screen.findByText(/ffmpeg is not available/)).toBeInTheDocument()
  })

  it('says nothing about ffmpeg when it is present', async () => {
    mockFetch({ options: options(), ffmpegAvailable: true })
    render(<SubtitlePruningCard />)

    await screen.findByText('English')
    expect(screen.queryByText(/ffmpeg is not available/)).not.toBeInTheDocument()
  })

  it('saves when the policy is switched on', async () => {
    const { put } = mockFetch({ options: options({ enabled: false }), ffmpegAvailable: true })
    render(<SubtitlePruningCard />)

    await screen.findByText('Trim surplus subtitle tracks')
    await userEvent.click(screen.getByRole('switch'))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
    )
  })

  it('adds a searched language to the keep list', async () => {
    const { put } = mockFetch({
      options: options({ keepLanguages: [] }),
      ffmpegAvailable: true,
    })
    render(<SubtitlePruningCard />)

    await userEvent.type(await screen.findByPlaceholderText('Add a language…'), 'germ')
    await userEvent.click(screen.getByRole('button', { name: /German/ }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.objectContaining({ keepLanguages: ['de'] }))
    )
  })

  it('removes a language from the keep list', async () => {
    const { put } = mockFetch({ options: options(), ffmpegAvailable: true })
    render(<SubtitlePruningCard />)

    await userEvent.click(await screen.findByLabelText('Stop keeping German'))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.objectContaining({ keepLanguages: ['en'] }))
    )
  })

  it('explains the fallback when no language is named', async () => {
    mockFetch({ options: options({ keepLanguages: [] }), ffmpegAvailable: true })
    render(<SubtitlePruningCard />)

    expect(await screen.findByText(/first 20 tracks in file order are kept/)).toBeInTheDocument()
  })

  it('clamps an out-of-range track limit on blur', async () => {
    const { put } = mockFetch({ options: options(), ffmpegAvailable: true })
    render(<SubtitlePruningCard />)

    const input = await screen.findByLabelText('Leave files alone up to')
    await userEvent.clear(input)
    await userEvent.type(input, '999')
    await userEvent.tab()

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(expect.objectContaining({ maxTracks: 100 }))
    )
  })
})
