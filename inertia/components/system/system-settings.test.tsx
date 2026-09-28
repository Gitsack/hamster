import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SystemSettings } from './system-settings'
import { RestoreDialog } from './backups-section'
import { HEALTH_FIXTURE, systemFetchStub } from './system_fixtures'

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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SystemSettings', () => {
  it('lists health failures first, with the error and how long it has lasted', async () => {
    vi.stubGlobal('fetch', vi.fn(systemFetchStub()))
    render(<SystemSettings />)

    const health = section('Health')
    const rows = await within(health).findAllByRole('link')
    // SABnzbd (error) leads, the low-space folder (warning) follows, healthy rows after.
    expect(rows[0]).toHaveTextContent('SABnzbd')
    expect(rows[1]).toHaveTextContent('/media/books')
    expect(within(health).getByText('getaddrinfo ENOTFOUND sabnzbd')).toBeInTheDocument()
    expect(within(health).getByText('down 3h')).toBeInTheDocument()
    expect(within(health).getByText('Low space')).toBeInTheDocument()
    expect(within(health).getByText(/^Checked/)).toBeInTheDocument()
  })

  it('shows failed tasks first with their error inline, and Run now on every task', async () => {
    vi.stubGlobal('fetch', vi.fn(systemFetchStub()))
    render(<SystemSettings />)

    const tasks = section('Tasks')
    await within(tasks).findByText('Backup')
    const names = within(tasks)
      .getAllByRole('switch')
      .map((s) => s.getAttribute('aria-label'))
    expect(names[0]).toBe('Run Backup on schedule')
    expect(names[1]).toBe('Run Library Scan on schedule')
    expect(names.at(-1)).toBe('Run RSS Sync on schedule')
    expect(within(tasks).getAllByText("EACCES: permission denied, mkdir '/config'")).toHaveLength(1)
    expect(within(tasks).getByText('1 task failed on the last run.')).toBeInTheDocument()
    expect(within(tasks).getByText('Cleanup')).toBeInTheDocument()
    expect(within(tasks).getByRole('button', { name: 'Run Library Scan now' })).toBeDisabled()
  })

  it('starts a background re-check rather than waiting on the probes', async () => {
    const fetchMock = vi.fn(systemFetchStub())
    vi.stubGlobal('fetch', fetchMock)
    render(<SystemSettings />)

    const button = await within(section('Health')).findByRole('button', { name: 'Re-check' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    expect(
      await within(section('Health')).findByRole('button', { name: 'Checking…' })
    ).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/system/health/check',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('says so when the first check has not run yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        systemFetchStub({
          health: {
            ...HEALTH_FIXTURE,
            level: 'starting',
            checkedAt: null,
            checks: [],
            downloadClients: [],
            rootFolders: [],
          },
        })
      )
    )
    render(<SystemSettings />)
    expect(
      await screen.findByText('The first check runs a few seconds after Hamster starts.')
    ).toBeInTheDocument()
  })

  it('lists backups with the schedule and prints the About line', async () => {
    vi.stubGlobal('fetch', vi.fn(systemFetchStub()))
    render(<SystemSettings />)

    const backups = section('Backups')
    expect(
      await within(backups).findByText('hamster_2026-09-26_03-00-00.sql.gz', { exact: false })
    ).toBeInTheDocument()
    expect(within(backups).getByText('Scheduled backup')).toBeInTheDocument()
    expect(within(backups).getByText('/app/tmp/backups')).toBeInTheDocument()
    expect(
      within(backups).getAllByRole('link', { name: /Download the backup/ })[0]
    ).toHaveAttribute('href', '/api/v1/system/backup/hamster_2026-09-26_03-00-00.sql.gz/download')

    expect(
      await within(section('About')).findByText(
        'v1.37.0 · up 3d 4h · Node 22 · linux/x64 · RSS 312 MB'
      )
    ).toBeInTheDocument()
  })

  it('reports a failed load inline with a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 502, statusText: 'Bad Gateway' }))
    )
    render(<SystemSettings />)
    const alert = await within(section('Tasks')).findByRole('alert')
    expect(alert).toHaveTextContent('HTTP 502 · Bad Gateway')
    expect(within(alert).getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})

describe('RestoreDialog', () => {
  const backup = { name: 'hamster_2026-09-26_03-00-00.sql.gz', size: 1, createdAt: '' }

  it('only restores once the word is typed', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ message: 'Restore completed successfully' })
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<RestoreDialog backup={backup} onOpenChange={() => {}} />)

    const restore = screen.getByRole('button', { name: 'Restore' })
    expect(restore).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: 'restor' } })
    expect(restore).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: 'Restore ' } })
    expect(restore).toBeEnabled()
    fireEvent.click(restore)

    expect(await screen.findByText('Database restored')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/system/backup/hamster_2026-09-26_03-00-00.sql.gz/restore',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('keeps the dialog open and says the database was untouched when it fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'RESTORE_FAILED', message: 'canceling statement due to lock timeout' } },
          { status: 500 }
        )
      )
    )
    render(<RestoreDialog backup={backup} onOpenChange={() => {}} />)
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: 'restore' } })
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'canceling statement due to lock timeout The database was left as it was.'
    )
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled()
  })
})
