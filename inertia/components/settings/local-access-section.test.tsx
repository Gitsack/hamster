import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  LocalAccessSection,
  type LocalAccessAccount,
} from '@/components/settings/local-access-section'

const admin: LocalAccessAccount = { id: 'a1', fullName: 'Martin', email: 'm@x', isAdmin: true }
const kid: LocalAccessAccount = { id: 'k1', fullName: 'Kid', email: 'k@x', isAdmin: false }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(getBody: Record<string, unknown>, putStatus = 200) {
  const put = vi.fn()
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(init.body as string)
      put(body)
      if (putStatus !== 200) return json({ error: 'Pick an existing account' }, putStatus)
      return json({ options: body })
    }
    return json(getBody)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { put, fetchMock }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LocalAccessSection', () => {
  it('is the #sign-in section and shows the stored setting once loaded', async () => {
    mockFetch({ options: { enabled: true, userId: null } })
    const { container } = render(<LocalAccessSection users={[admin]} />)

    expect(container.querySelector('section#sign-in')).not.toBeNull()
    expect(await screen.findByRole('switch')).toBeChecked()
  })

  it('saves when switched on, keeping the chosen account', async () => {
    const { put } = mockFetch({ options: { enabled: false, userId: 'k1' } })
    render(<LocalAccessSection users={[admin, kid]} />)

    await userEvent.click(await screen.findByRole('switch'))

    await waitFor(() => expect(put).toHaveBeenCalledWith({ enabled: true, userId: 'k1' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('reverts the switch and says why when the save is refused', async () => {
    mockFetch({ options: { enabled: false, userId: null } }, 422)
    render(<LocalAccessSection users={[admin]} />)

    const toggle = await screen.findByRole('switch')
    await userEvent.click(toggle)

    expect(await screen.findByText('Pick an existing account')).toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('offers no account choice when there is only one account', async () => {
    mockFetch({ options: { enabled: true, userId: null } })
    render(<LocalAccessSection users={[admin]} />)

    await screen.findByRole('switch')
    expect(screen.queryByText('Local visitors use')).not.toBeInTheDocument()
  })

  it('waits for the account list before offering a choice', async () => {
    mockFetch({ options: { enabled: true, userId: null } })
    render(<LocalAccessSection users={null} />)

    await screen.findByRole('switch')
    expect(screen.queryByText('Local visitors use')).not.toBeInTheDocument()
  })

  it('shows the chosen account by name', async () => {
    mockFetch({ options: { enabled: true, userId: 'k1' } })
    render(<LocalAccessSection users={[admin, kid]} />)

    expect(await screen.findByText('Local visitors use')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('Kid')
  })

  it('defaults to the first administrator', async () => {
    mockFetch({ options: { enabled: true } })
    render(<LocalAccessSection users={[admin, kid]} />)

    expect(await screen.findByRole('combobox')).toHaveTextContent('First administrator')
  })

  it('shows a failed load inline with a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500, statusText: 'Internal Server Error' }))
    )
    render(<LocalAccessSection users={[admin]} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in settings could not be loaded: HTTP 500'
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
