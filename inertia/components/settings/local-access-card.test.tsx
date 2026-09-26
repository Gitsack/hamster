import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalAccessCard } from '@/components/settings/local-access-card'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function mockFetch(getBody: Record<string, unknown>) {
  const put = vi.fn()
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      put(JSON.parse(init.body as string))
      return { ok: true, json: async () => ({ options: JSON.parse(init.body as string) }) }
    }
    return { ok: true, json: async () => getBody }
  })
  vi.stubGlobal('fetch', fetchMock)
  return { put }
}

describe('LocalAccessCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the stored setting once loaded', async () => {
    mockFetch({ options: { enabled: true }, requestIsLocal: true })
    render(<LocalAccessCard />)

    expect(await screen.findByRole('switch')).toBeChecked()
  })

  it('says when the current browser counts as local', async () => {
    mockFetch({ options: { enabled: false }, requestIsLocal: true })
    render(<LocalAccessCard />)

    expect(await screen.findByText('This browser counts as local.')).toBeInTheDocument()
  })

  it('says when the current browser would still have to sign in', async () => {
    mockFetch({ options: { enabled: true }, requestIsLocal: false })
    render(<LocalAccessCard />)

    expect(await screen.findByText(/does not count as local/)).toBeInTheDocument()
  })

  it('saves when switched on', async () => {
    const { put } = mockFetch({ options: { enabled: false }, requestIsLocal: true })
    render(<LocalAccessCard />)

    await userEvent.click(await screen.findByRole('switch'))

    await waitFor(() => expect(put).toHaveBeenCalledWith({ enabled: true }))
  })
})
