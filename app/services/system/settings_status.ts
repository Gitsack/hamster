/*
|--------------------------------------------------------------------------
| Settings status
|--------------------------------------------------------------------------
|
| Which settings areas are failing right now, from the health monitor's
| memory cache. Feeds the destructive dots on the sidebar's Settings item and
| on the settings rail, so it must stay free of queries: it runs for every
| admin page load. Kept import-light for the same reason as health_state.
|
*/

import type { HealthState } from '#services/system/health_state'

/** Matches `statusKey` in the frontend's SETTINGS_NAV. */
export type SettingsStatusKey = 'media' | 'download-clients' | 'system'

export function failingSettingsAreas(state: HealthState): SettingsStatusKey[] {
  const failing = new Set<SettingsStatusKey>()
  const result = state.result
  const checks = result?.checks ?? []
  const isError = (name: string) => checks.some((c) => c.name === name && c.status === 'error')

  // Per item as well as per check: one unreachable client out of two only
  // makes the check a warning, but that client is still down.
  if (isError('rootFolders') || result?.rootFolders.some((f) => f.status === 'error')) {
    failing.add('media')
  }
  if (isError('downloadClients') || result?.downloadClients.some((c) => c.status === 'error')) {
    failing.add('download-clients')
  }
  // A stale cache means the monitor loop itself stopped; that is System's problem.
  if (isError('database') || state.isStale() || state.failedTasks.length > 0) {
    failing.add('system')
  }

  return [...failing]
}
