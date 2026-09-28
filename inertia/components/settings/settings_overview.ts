import type { HealthLevel } from '@/components/system/system_api'
import type { SettingsItemId } from './settings_nav'

/** What SettingsController sends to /settings; mirrors its `SettingsOverview`. */
export interface SettingsOverview {
  media: {
    enabledTypes: string[]
    folders: number
    folderProblems: { path: string; status: 'warning' | 'error'; message: string }[]
  }
  quality: { profiles: number; customFormats: number }
  discovery: { hasTmdbKey: boolean; needsTmdbKey: boolean; sources: string[] }
  indexers: {
    prowlarr: { configured: boolean; enabled: boolean; lastSyncedAt: string | null }
    direct: { enabled: number; total: number }
  }
  downloadClients: {
    id: string
    name: string
    enabled: boolean
    status: 'ok' | 'error' | 'unknown'
    message: string | null
  }[]
  notifications: { targets: number; enabled: number; failedDeliveries24h: number }
  users: { total: number; admins: number; localAccess: boolean }
  system: {
    level: HealthLevel
    stale: boolean
    databaseError: string | null
    failedTasks: number
    backup: { lastRunAt: string | null; lastStatus: string | null; enabled: boolean } | null
  }
}

export type OverviewTone = 'ok' | 'warning' | 'error'

export interface OverviewLine {
  text: string
  tone: OverviewTone
}

/** "1 folder", "3 folders". */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "now", "4m ago", "3h ago", "2d ago". */
export function ago(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const seconds = Math.max(0, Math.floor((now - then) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const ok = (text: string): OverviewLine => ({ text, tone: 'ok' })
const warning = (text: string): OverviewLine => ({ text, tone: 'warning' })
const error = (text: string): OverviewLine => ({ text, tone: 'error' })

function mediaLine({ media }: SettingsOverview): OverviewLine {
  const types = media.enabledTypes.length
  if (types === 0) return warning('No media types switched on')
  const base = [
    count(types, 'type'),
    media.folders === 0 ? 'no root folders' : count(media.folders, 'folder'),
  ]
  const unreachable = media.folderProblems.filter((f) => f.status === 'error').length
  const lowSpace = media.folderProblems.filter((f) => f.status === 'warning').length
  if (unreachable > 0) {
    return error([...base, `${count(unreachable, 'folder')} unreachable`].join(' · '))
  }
  if (lowSpace > 0)
    return warning([...base, `${count(lowSpace, 'folder')} low on space`].join(' · '))
  if (media.folders === 0) return warning(base.join(' · '))
  return ok(base.join(' · '))
}

function qualityLine({ quality }: SettingsOverview): OverviewLine {
  if (quality.profiles === 0) return warning('No quality profiles')
  return ok(
    [count(quality.profiles, 'profile'), count(quality.customFormats, 'custom format')].join(' · ')
  )
}

function discoveryLine({ discovery }: SettingsOverview): OverviewLine {
  const sources = discovery.sources.length > 0 ? discovery.sources.join(', ') : 'No sources on'
  if (!discovery.hasTmdbKey && discovery.needsTmdbKey) {
    return warning(`Needs TMDB key · ${sources}`)
  }
  return ok(discovery.hasTmdbKey ? `TMDB key set · ${sources}` : sources)
}

function indexersLine({ indexers }: SettingsOverview, now: number): OverviewLine {
  const { prowlarr, direct } = indexers
  const parts: string[] = []
  if (prowlarr.configured) {
    if (prowlarr.enabled) {
      const synced = ago(prowlarr.lastSyncedAt, now)
      parts.push(synced ? `Prowlarr · synced ${synced}` : 'Prowlarr')
    } else {
      parts.push('Prowlarr off')
    }
  }
  if (direct.total > 0) {
    parts.push(
      direct.enabled === direct.total
        ? count(direct.total, 'direct indexer')
        : `${direct.enabled} of ${direct.total} direct indexers on`
    )
  }
  if (!prowlarr.enabled && direct.enabled === 0) {
    return warning(parts.length > 0 ? `${parts.join(' · ')} · nothing to search` : 'No indexers')
  }
  return ok(parts.join(' · '))
}

function downloadClientsLine({ downloadClients }: SettingsOverview): OverviewLine {
  const enabled = downloadClients.filter((c) => c.enabled)
  if (downloadClients.length === 0) return warning('No download client')
  if (enabled.length === 0) return warning(`${count(downloadClients.length, 'client')}, all off`)

  const down = enabled.filter((c) => c.status === 'error')
  if (down.length > 0) {
    const [first] = down
    const more = down.length > 1 ? ` · +${down.length - 1} more` : ''
    return error(`${first.name} unreachable${first.message ? `: ${first.message}` : ''}${more}`)
  }
  const off = downloadClients.length - enabled.length
  const names = enabled.map((c) => c.name).join(' · ')
  return ok(off > 0 ? `${names} · ${off} off` : names)
}

function notificationsLine({ notifications }: SettingsOverview): OverviewLine {
  if (notifications.targets === 0) return ok('No targets')
  const parts = [count(notifications.targets, 'target')]
  const off = notifications.targets - notifications.enabled
  if (off > 0) parts.push(`${off} off`)
  if (notifications.failedDeliveries24h > 0) {
    parts.push(
      `${count(notifications.failedDeliveries24h, 'failed delivery', 'failed deliveries')} (24h)`
    )
    return error(parts.join(' · '))
  }
  return ok(parts.join(' · '))
}

function usersLine({ users }: SettingsOverview): OverviewLine {
  return ok(
    [
      count(users.total, 'account'),
      count(users.admins, 'admin'),
      users.localAccess ? 'local access on' : null,
    ]
      .filter(Boolean)
      .join(' · ')
  )
}

function systemLine({ system }: SettingsOverview, now: number): OverviewLine {
  if (system.databaseError) return error(`Database: ${system.databaseError}`)
  if (system.stale) return error('Health checks have stopped')

  const backup = system.backup
  // An enabled backup task that failed is already one of the failed tasks.
  const backupFailed = Boolean(backup?.enabled && backup.lastStatus === 'failed')
  let backupText: string
  if (!backup) backupText = 'No backup task'
  else if (!backup.enabled) backupText = 'Backups off'
  else if (backupFailed) backupText = 'Last backup failed'
  else backupText = backup.lastRunAt ? `Backup ${ago(backup.lastRunAt, now)}` : 'No backup yet'

  const otherFailed = Math.max(0, system.failedTasks - (backupFailed ? 1 : 0))
  const parts = [backupText]
  if (otherFailed > 0) {
    parts.push(`${count(otherFailed, backupFailed ? 'other task' : 'task')} failed`)
  }
  if (system.level === 'starting') parts.push('checking…')

  if (otherFailed > 0 || backupFailed) return error(parts.join(' · '))
  return ok(parts.join(' · '))
}

/**
 * The status line under one Overview row. Facts only — counts, names, ages —
 * and destructive when that area is failing.
 */
export function overviewLine(
  id: SettingsItemId,
  overview: SettingsOverview,
  context: { email?: string | null; now?: number } = {}
): OverviewLine | null {
  const now = context.now ?? Date.now()
  switch (id) {
    case 'media':
      return mediaLine(overview)
    case 'quality':
      return qualityLine(overview)
    case 'discovery':
      return discoveryLine(overview)
    case 'indexers':
      return indexersLine(overview, now)
    case 'download-clients':
      return downloadClientsLine(overview)
    case 'notifications':
      return notificationsLine(overview)
    case 'users':
      return usersLine(overview)
    case 'system':
      return systemLine(overview, now)
    case 'profile':
      return context.email ? ok(context.email) : null
  }
}
