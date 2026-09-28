import type { SettingsOverview } from './settings_overview'

/** A fixed clock for stories and tests: 2026-09-27 12:00 UTC. */
export const OVERVIEW_NOW = Date.parse('2026-09-27T12:00:00Z')

const hoursAgo = (h: number) => new Date(OVERVIEW_NOW - h * 3_600_000).toISOString()

/** Everything configured and healthy. */
export const OVERVIEW_OK: SettingsOverview = {
  media: { enabledTypes: ['movies', 'tv', 'music', 'books'], folders: 4, folderProblems: [] },
  quality: { profiles: 6, customFormats: 12 },
  discovery: {
    hasTmdbKey: true,
    needsTmdbKey: true,
    sources: ['JustWatch', 'Simkl trending'],
  },
  indexers: {
    prowlarr: { configured: true, enabled: true, lastSyncedAt: hoursAgo(0.07) },
    direct: { enabled: 1, total: 1 },
  },
  downloadClients: [
    { id: 'c1', name: 'SABnzbd', enabled: true, status: 'ok', message: null },
    { id: 'c2', name: 'qBittorrent', enabled: false, status: 'unknown', message: null },
  ],
  notifications: { targets: 5, enabled: 5, failedDeliveries24h: 0 },
  users: { total: 3, admins: 1, localAccess: true },
  system: {
    level: 'ok',
    stale: false,
    databaseError: null,
    failedTasks: 0,
    backup: { lastRunAt: hoursAgo(3), lastStatus: 'success', enabled: true },
  },
}

/** A bad day: a folder gone, SABnzbd unreachable, deliveries and a task failing. */
export const OVERVIEW_FAILING: SettingsOverview = {
  ...OVERVIEW_OK,
  media: {
    enabledTypes: ['movies', 'tv', 'music', 'books'],
    folders: 4,
    folderProblems: [{ path: '/media/music', status: 'error', message: 'Not accessible' }],
  },
  discovery: { hasTmdbKey: false, needsTmdbKey: true, sources: ['JustWatch'] },
  downloadClients: [
    {
      id: 'c1',
      name: 'SABnzbd',
      enabled: true,
      status: 'error',
      message: 'getaddrinfo EAI_AGAIN sabnzbd',
    },
  ],
  notifications: { targets: 5, enabled: 4, failedDeliveries24h: 2 },
  system: {
    level: 'error',
    stale: false,
    databaseError: null,
    failedTasks: 1,
    backup: { lastRunAt: hoursAgo(26), lastStatus: 'failed', enabled: true },
  },
}
