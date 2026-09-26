import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalAccessCard, type LocalAccessAccount } from '@/components/settings/local-access-card'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const admin: LocalAccessAccount = { id: 'a1', fullName: 'Martin', email: 'm@x', isAdmin: true }
const kid: LocalAccessAccount = { id: 'k1', fullName: 'Kid', email: 'k@x', isAdmin: false }

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
    mockFetch({ options: { enabled: true, userId: null } })
    render(<LocalAccessCard users={[admin]} />)

    expect(await screen.findByRole('switch')).toBeChecked()
  })

  it('saves when switched on, keeping the chosen account', async () => {
    const { put } = mockFetch({ options: { enabled: false, userId: 'k1' } })
    render(<LocalAccessCard users={[admin, kid]} />)

    await userEvent.click(await screen.findByRole('switch'))

    await waitFor(() => expect(put).toHaveBeenCalledWith({ enabled: true, userId: 'k1' }))
  })

  it('offers no account choice when there is only one account', async () => {
    mockFetch({ options: { enabled: true, userId: null } })
    render(<LocalAccessCard users={[admin]} />)

    await screen.findByRole('switch')
    expect(screen.queryByText('Local visitors use')).not.toBeInTheDocument()
  })

  it('shows the chosen account by name', async () => {
    mockFetch({ options: { enabled: true, userId: 'k1' } })
    render(<LocalAccessCard users={[admin, kid]} />)

    expect(await screen.findByText('Local visitors use')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('Kid')
  })

  it('defaults to the first administrator', async () => {
    mockFetch({ options: { enabled: true } })
    render(<LocalAccessCard users={[admin, kid]} />)

    expect(await screen.findByRole('combobox')).toHaveTextContent('First administrator')
  })
})
