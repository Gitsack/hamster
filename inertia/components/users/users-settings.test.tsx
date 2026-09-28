import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsersSettings } from './users-settings'
import { usersFetchStub } from './users_fixtures'
import { addedOn, displayName, sortUsers } from './users_api'
import { USERS_FIXTURE } from './users_fixtures'

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') },
}))

function rowFor(name: string) {
  return screen.getByRole('button', { name }).closest('[data-slot="entity-row"]') as HTMLElement
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

describe('users_api', () => {
  it('falls back to the email for an account without a name', () => {
    expect(displayName({ fullName: null, email: 'a@b' })).toBe('a@b')
    expect(displayName({ fullName: '  ', email: 'a@b' })).toBe('a@b')
  })

  it('lists administrators first, then by name', () => {
    expect(sortUsers(USERS_FIXTURE).map((u) => u.id)).toEqual(['u-me', 'u-guest', 'u-kid'])
  })

  it('dates an account', () => {
    expect(addedOn('not a date')).toBeNull()
    expect(addedOn('2025-03-01T10:00:00.000Z')).toMatch(/^added /)
  })
})

describe('UsersSettings', () => {
  it('puts the sign-in policy first, then the accounts', async () => {
    vi.stubGlobal('fetch', vi.fn(usersFetchStub()))
    const { container } = render(<UsersSettings currentUserId="u-me" />)

    expect(screen.getByRole('heading', { level: 2, name: 'Users & access' })).toBeInTheDocument()
    const sections = Array.from(container.querySelectorAll('section')).map((s) => s.id)
    expect(sections).toEqual(['sign-in', 'accounts'])
    await screen.findByRole('button', { name: 'Martin' })
    expect(container.querySelector('table')).toBeNull()
  })

  it('reads each account as a row: role, you, email and when it was added', async () => {
    vi.stubGlobal('fetch', vi.fn(usersFetchStub()))
    render(<UsersSettings currentUserId="u-me" />)

    const me = await waitFor(() => rowFor('Martin'))
    expect(within(me).getByText('Admin')).toBeInTheDocument()
    expect(within(me).getByText('you')).toBeInTheDocument()
    expect(within(me).getByText('martin@home.lan')).toBeInTheDocument()
    // No name: the email is the name, and is not repeated.
    const guest = rowFor('guest@home.lan')
    expect(within(guest).getAllByText('guest@home.lan')).toHaveLength(1)
    expect(screen.getByText('3 accounts · 1 administrator')).toBeInTheDocument()
  })

  it('keeps Edit, Reset password and Delete in the row menu, without Delete for yourself', async () => {
    vi.stubGlobal('fetch', vi.fn(usersFetchStub()))
    render(<UsersSettings currentUserId="u-me" />)

    await waitFor(() => rowFor('Kid'))
    await userEvent.click(within(rowFor('Kid')).getByRole('button', { name: 'More actions' }))
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Reset password' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')

    await userEvent.click(within(rowFor('Martin')).getByRole('button', { name: 'More actions' }))
    await screen.findAllByRole('menuitem', { name: 'Edit' })
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('deletes an account only after the AlertDialog confirms', async () => {
    const fetchMock = vi.fn(usersFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<UsersSettings currentUserId="u-me" />)

    await waitFor(() => rowFor('Kid'))
    await userEvent.click(within(rowFor('Kid')).getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Delete Kid?')).toBeInTheDocument()
    expect(writes(fetchMock)).toEqual([])

    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        { url: '/api/v1/users/u-kid', method: 'DELETE', body: undefined },
      ])
    )
  })

  it('resets a password through a single-field dialog', async () => {
    const fetchMock = vi.fn(usersFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<UsersSettings currentUserId="u-me" />)

    await waitFor(() => rowFor('Kid'))
    await userEvent.click(within(rowFor('Kid')).getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Reset password' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reset password' })

    await userEvent.type(within(dialog).getByLabelText('New password'), 'short')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('At least 8 characters.')
    expect(writes(fetchMock)).toEqual([])

    await userEvent.type(within(dialog).getByLabelText('New password'), 'enough1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }))
    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        {
          url: '/api/v1/users/u-kid/reset-password',
          method: 'POST',
          body: { newPassword: 'shortenough1' },
        },
      ])
    )
  })

  it('creates an account from a Sheet', async () => {
    const fetchMock = vi.fn(usersFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<UsersSettings currentUserId="u-me" />)

    await waitFor(() => rowFor('Kid'))
    await userEvent.click(screen.getByRole('button', { name: 'Add user' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add user' })

    await userEvent.type(within(sheet).getByLabelText('Full name'), 'Grandma')
    await userEvent.type(within(sheet).getByLabelText('Email'), 'gran@home.lan')
    await userEvent.type(within(sheet).getByLabelText('Password'), 'knitting99')
    await userEvent.click(within(sheet).getByRole('switch', { name: 'Administrator' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        {
          url: '/api/v1/users',
          method: 'POST',
          body: {
            fullName: 'Grandma',
            email: 'gran@home.lan',
            password: 'knitting99',
            isAdmin: true,
          },
        },
      ])
    )
  })

  it('offers no Delete in the editor for your own account', async () => {
    vi.stubGlobal('fetch', vi.fn(usersFetchStub()))
    render(<UsersSettings currentUserId="u-me" />)

    await waitFor(() => rowFor('Martin'))
    await userEvent.click(screen.getByRole('button', { name: 'Martin' }))
    const sheet = await screen.findByRole('dialog', { name: 'Martin' })
    expect(within(sheet).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('shows a failed account load inline with a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(usersFetchStub({ users: { status: 403 } })))
    render(<UsersSettings currentUserId="u-me" />)

    const accounts = screen.getByRole('heading', { name: 'Accounts', level: 3 }).closest('section')!
    expect(await within(accounts).findByRole('alert')).toHaveTextContent(
      'Accounts could not be loaded: HTTP 403'
    )
  })
})
