/*
|--------------------------------------------------------------------------
| Health state
|--------------------------------------------------------------------------
|
| The health monitor's published result, in a module with no imports so the
| Inertia middleware can read it for every page without pulling the probes,
| models and notification services into its type graph (doing so made the
| app-wide HttpContext types collapse to `never`). The monitor writes here;
| everything else only reads.
|
*/

export type HealthStatus = 'ok' | 'warning' | 'error'

const MEDIA_FOLDER_LABELS: Record<string, string> = {
  movies: 'Movies folder',
  tv: 'TV folder',
  music: 'Music folder',
  books: 'Books folder',
}

/** How a root folder is named to someone who may not see its path. */
export function mediaFolderLabel(mediaType: string): string {
  return MEDIA_FOLDER_LABELS[mediaType] ?? 'A root folder'
}
/** `starting` until the first run has finished. */
export type HealthLevel = HealthStatus | 'starting'

export interface HealthCheck {
  /** Stable key: database | rootFolders | downloadClients. */
  name: string
  label: string
  status: HealthStatus
  message: string
  /** When this check entered its current status (ISO). */
  since: string
}

export interface ClientHealth {
  id: string
  name: string
  type: string
  status: 'ok' | 'error'
  message: string
  latencyMs: number | null
  since: string
}

export interface FolderHealth {
  id: string
  path: string
  mediaType: string
  status: HealthStatus
  message: string
  freeBytes: number | null
}

export interface HealthResult {
  status: HealthStatus
  checkedAt: string
  durationMs: number
  checks: HealthCheck[]
  downloadClients: ClientHealth[]
  rootFolders: FolderHealth[]
  /** Free space summed over the distinct filesystems holding root folders. */
  freeBytes: number | null
}

export interface FailedTask {
  id: string
  name: string
  type: string
  lastError: string | null
  lastRunAt: string | null
}

/** A cache older than this means the monitor loop itself has stopped. */
export const HEALTH_STALE_MS = 5 * 60_000

export class HealthState {
  /** The last completed run, or null before the first one finishes. */
  result: HealthResult | null = null
  /** Enabled scheduled tasks whose last run failed. */
  failedTasks: FailedTask[] = []
  /** A run is in progress. */
  running = false

  constructor(private readonly now: () => number = Date.now) {}

  get level(): HealthLevel {
    return this.result?.status ?? 'starting'
  }

  /** True when the loop has stopped reporting (it should run every minute). */
  isStale(): boolean {
    if (!this.result) return false
    return this.now() - Date.parse(this.result.checkedAt) > HEALTH_STALE_MS
  }
}

export const healthState = new HealthState()
