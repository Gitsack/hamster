import { ago, overviewLine, type SettingsOverview } from './settings_overview'
import { OVERVIEW_FAILING, OVERVIEW_NOW, OVERVIEW_OK } from './settings_overview_fixtures'

const line = (id: Parameters<typeof overviewLine>[0], overview: SettingsOverview = OVERVIEW_OK) =>
  overviewLine(id, overview, { now: OVERVIEW_NOW, email: 'me@example.com' })

function withOverview(patch: Partial<SettingsOverview>): SettingsOverview {
  return { ...OVERVIEW_OK, ...patch }
}

describe('ago', () => {
  it('reads as a short age', () => {
    expect(ago(new Date(OVERVIEW_NOW - 30_000).toISOString(), OVERVIEW_NOW)).toBe('just now')
    expect(ago(new Date(OVERVIEW_NOW - 4 * 60_000).toISOString(), OVERVIEW_NOW)).toBe('4m ago')
    expect(ago(new Date(OVERVIEW_NOW - 3 * 3_600_000).toISOString(), OVERVIEW_NOW)).toBe('3h ago')
    expect(ago(new Date(OVERVIEW_NOW - 2 * 86_400_000).toISOString(), OVERVIEW_NOW)).toBe('2d ago')
    expect(ago(null, OVERVIEW_NOW)).toBeNull()
    expect(ago('nonsense', OVERVIEW_NOW)).toBeNull()
  })
})

describe('overviewLine, all healthy', () => {
  it('states facts quietly', () => {
    expect(line('media')).toEqual({ text: '4 types · 4 folders', tone: 'ok' })
    expect(line('quality')).toEqual({ text: '6 profiles · 12 custom formats', tone: 'ok' })
    expect(line('discovery')).toEqual({
      text: 'TMDB key set · JustWatch, Simkl trending',
      tone: 'ok',
    })
    expect(line('indexers')).toEqual({
      text: 'Prowlarr · synced 4m ago · 1 direct indexer',
      tone: 'ok',
    })
    expect(line('download-clients')).toEqual({ text: 'SABnzbd · 1 off', tone: 'ok' })
    expect(line('notifications')).toEqual({ text: '5 targets', tone: 'ok' })
    expect(line('users')).toEqual({
      text: '3 accounts · 1 admin · local access on',
      tone: 'ok',
    })
    expect(line('system')).toEqual({ text: 'Backup 3h ago', tone: 'ok' })
    expect(line('profile')).toEqual({ text: 'me@example.com', tone: 'ok' })
  })
})

describe('overviewLine, failing', () => {
  it('turns destructive where something is down', () => {
    expect(line('media', OVERVIEW_FAILING)).toEqual({
      text: '4 types · 4 folders · 1 folder unreachable',
      tone: 'error',
    })
    expect(line('download-clients', OVERVIEW_FAILING)).toEqual({
      text: 'SABnzbd unreachable: getaddrinfo EAI_AGAIN sabnzbd',
      tone: 'error',
    })
    expect(line('notifications', OVERVIEW_FAILING)).toEqual({
      text: '5 targets · 1 off · 2 failed deliveries (24h)',
      tone: 'error',
    })
  })

  it('does not count a failed backup twice', () => {
    expect(line('system', OVERVIEW_FAILING)).toEqual({ text: 'Last backup failed', tone: 'error' })
    const two = withOverview({
      system: { ...OVERVIEW_FAILING.system, failedTasks: 3 },
    })
    expect(line('system', two)?.text).toBe('Last backup failed · 2 other tasks failed')
  })

  it('names other failed tasks when the backup is fine', () => {
    const overview = withOverview({ system: { ...OVERVIEW_OK.system, failedTasks: 1 } })
    expect(line('system', overview)).toEqual({
      text: 'Backup 3h ago · 1 task failed',
      tone: 'error',
    })
  })

  it('leads with a database failure or a stopped monitor', () => {
    const db = withOverview({ system: { ...OVERVIEW_OK.system, databaseError: 'ECONNREFUSED' } })
    expect(line('system', db)).toEqual({ text: 'Database: ECONNREFUSED', tone: 'error' })
    const stale = withOverview({ system: { ...OVERVIEW_OK.system, stale: true } })
    expect(line('system', stale)?.tone).toBe('error')
  })

  it('says when the first health check has not landed yet', () => {
    const starting = withOverview({ system: { ...OVERVIEW_OK.system, level: 'starting' } })
    expect(line('system', starting)?.text).toBe('Backup 3h ago · checking…')
  })

  it('counts the rest of several unreachable clients', () => {
    const overview = withOverview({
      downloadClients: [
        { id: 'a', name: 'SABnzbd', enabled: true, status: 'error', message: null },
        { id: 'b', name: 'NZBGet', enabled: true, status: 'error', message: 'timeout' },
      ],
    })
    expect(line('download-clients', overview)?.text).toBe('SABnzbd unreachable · +1 more')
  })
})

describe('overviewLine, not configured', () => {
  it('warns about gaps that stop Hamster working', () => {
    expect(
      line('media', withOverview({ media: { enabledTypes: [], folders: 0, folderProblems: [] } }))
    ).toEqual({ text: 'No media types switched on', tone: 'warning' })
    expect(
      line(
        'media',
        withOverview({ media: { enabledTypes: ['movies'], folders: 0, folderProblems: [] } })
      )
    ).toEqual({ text: '1 type · no root folders', tone: 'warning' })
    expect(line('quality', withOverview({ quality: { profiles: 0, customFormats: 0 } }))).toEqual({
      text: 'No quality profiles',
      tone: 'warning',
    })
    expect(line('download-clients', withOverview({ downloadClients: [] }))).toEqual({
      text: 'No download client',
      tone: 'warning',
    })
    expect(
      line(
        'indexers',
        withOverview({
          indexers: {
            prowlarr: { configured: false, enabled: false, lastSyncedAt: null },
            direct: { enabled: 0, total: 0 },
          },
        })
      )
    ).toEqual({ text: 'No indexers', tone: 'warning' })
  })

  it('warns about a missing TMDB key only when movies or TV need it', () => {
    expect(line('discovery', OVERVIEW_FAILING)).toEqual({
      text: 'Needs TMDB key · JustWatch',
      tone: 'warning',
    })
    const musicOnly = withOverview({
      discovery: { hasTmdbKey: false, needsTmdbKey: false, sources: [] },
    })
    expect(line('discovery', musicOnly)).toEqual({ text: 'No sources on', tone: 'ok' })
  })

  it('reports low space as a warning, not a failure', () => {
    const overview = withOverview({
      media: {
        enabledTypes: ['movies'],
        folders: 1,
        folderProblems: [{ path: '/m', status: 'warning', message: 'Low space (4 GB free)' }],
      },
    })
    expect(line('media', overview)).toEqual({
      text: '1 type · 1 folder · 1 folder low on space',
      tone: 'warning',
    })
  })

  it('leaves Profile blank without an email', () => {
    expect(overviewLine('profile', OVERVIEW_OK, {})).toBeNull()
  })
})
