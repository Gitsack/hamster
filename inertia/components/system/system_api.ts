/**
 * Settings → System: the shapes the page reads and the pure helpers that turn
 * them into words. Tested directly (system_api.test.ts).
 */

export type HealthStatus = 'ok' | 'warning' | 'error'
export type HealthLevel = HealthStatus | 'starting'

export interface HealthCheck {
  name: string
  label: string
  status: HealthStatus
  message: string
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

export interface FailedTask {
  id: string
  name: string
  type: string
  lastError: string | null
  lastRunAt: string | null
}

/** GET /api/v1/system/health-summary */
export interface HealthSummary {
  level: HealthLevel
  checkedAt: string | null
  /** The monitor stopped reporting; the verdict is out of date. */
  stale: boolean
  /** A run is in progress right now. */
  checking: boolean
  checks: HealthCheck[]
  downloadClients: ClientHealth[]
  rootFolders: FolderHealth[]
  freeBytes: number | null
  failedTasks: FailedTask[]
}

/** GET /api/v1/system/tasks */
export interface ScheduledTask {
  id: string
  name: string
  type: string
  intervalMinutes: number
  enabled: boolean
  isRunning: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  lastDurationMs: number | null
  lastStatus: 'success' | 'failed' | string | null
  lastError: string | null
}

export interface BackupInfo {
  name: string
  size: number
  createdAt: string
}

/** GET /api/v1/system/backup */
export interface BackupList {
  backups: BackupInfo[]
  directory?: string
  retention?: number
  running?: boolean
}

/** GET /api/v1/system/info */
export interface SystemInfo {
  version: string
  nodeVersion: string
  platform: string
  arch: string
  uptime: number
  memory: { used: number; total: number }
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** The server's own words for a failure, else "HTTP 500 · Internal Server Error". */
export async function responseError(response: Response): Promise<string> {
  try {
    const data = await response.clone().json()
    // Vine validation failures come back as { errors: [{ message }] }.
    const message =
      data?.error?.message ?? data?.error ?? data?.errors?.[0]?.message ?? data?.message
    if (typeof message === 'string' && message) return message
  } catch {
    // Not JSON.
  }
  const text = response.statusText?.trim()
  return text ? `HTTP ${response.status} · ${text}` : `HTTP ${response.status}`
}

export async function getJson<T>(url: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new Error('Hamster did not answer. Check that it is still running.')
  }
  if (!response.ok) throw new Error(await responseError(response))
  return (await response.json()) as T
}

/** POST/PUT/DELETE; resolves with the parsed body (or null when there is none). */
export async function send<T = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown
): Promise<T | null> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Hamster did not answer. Check that it is still running.')
  }
  if (!response.ok) throw new Error(await responseError(response))
  if (response.status === 204) return null
  return (await response.json().catch(() => null)) as T | null
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** "every minute", "every 15 min", "every 4 h", "daily", "every 2 d". */
export function formatInterval(minutes: number): string {
  if (minutes === 1) return 'every minute'
  if (minutes < 60) return `every ${minutes} min`
  if (minutes === 1440) return 'daily'
  if (minutes % 1440 === 0) return `every ${minutes / 1440} d`
  if (minutes % 60 === 0) return minutes === 60 ? 'hourly' : `every ${minutes / 60} h`
  const hours = Math.floor(minutes / 60)
  return `every ${hours} h ${minutes % 60} min`
}

/** "340 ms", "4.2 s", "3m 12s", "1h 4m". */
export function formatDuration(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || ms < 0) return null
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** "in 4m", "in 3h", "due now". */
export function timeUntil(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.floor((then - now) / 1000)
  if (seconds < 60) return 'due now'
  if (seconds < 3600) return `in ${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `in ${Math.floor(seconds / 3600)}h`
  return `in ${Math.floor(seconds / 86400)}d`
}

/** Byte counts for disks and backups: "312 KB", "48.2 MB", "1.2 TB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unit]}`
}

/** "3d 4h", "4h 12m", "12m", "40s". Two units at most. */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${Math.max(0, Math.floor(seconds))}s`
}

/** "v1.37.0 · up 3d 4h · Node 22 · linux/x64 · RSS 312 MB". */
export function aboutLine(info: SystemInfo): string {
  const node = info.nodeVersion.replace(/^v/, '').split('.')[0]
  return [
    `v${info.version}`,
    `up ${formatUptime(info.uptime)}`,
    `Node ${node}`,
    `${info.platform}/${info.arch}`,
    `RSS ${info.memory.used} MB`,
  ].join(' · ')
}

/** "12:04" — the clock time of a check, for "checked 12:04". */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * The seeded "Blacklist Cleanup" task also prunes history and both delivery
 * logs now; show what it does. Operator-renamed tasks keep their own name.
 */
export function taskDisplayName(task: Pick<ScheduledTask, 'name' | 'type'>): string {
  if (task.type === 'cleanup' && task.name === 'Blacklist Cleanup') return 'Cleanup'
  return task.name
}

export const TASK_DESCRIPTIONS: Record<string, string> = {
  cleanup: 'Expired blacklist entries, old history and delivery logs',
}

export type TaskState = 'running' | 'failed' | 'ok' | 'never' | 'disabled'

export function taskState(task: ScheduledTask): TaskState {
  if (task.isRunning) return 'running'
  if (!task.enabled) return 'disabled'
  if (task.lastStatus === 'failed') return 'failed'
  if (!task.lastRunAt) return 'never'
  return 'ok'
}

/** Failed first, then running, then the rest by name. Disabled tasks sink. */
export function sortTasks(tasks: readonly ScheduledTask[]): ScheduledTask[] {
  const rank: Record<TaskState, number> = { failed: 0, running: 1, ok: 2, never: 2, disabled: 3 }
  return [...tasks].sort(
    (a, b) =>
      rank[taskState(a)] - rank[taskState(b)] ||
      taskDisplayName(a).localeCompare(taskDisplayName(b))
  )
}

/** "hamster_2026-09-27_03-00-00.sql.gz" was written at 03:00:00 UTC on that day. */
export function backupDate(backup: BackupInfo): Date | null {
  const match = /^hamster_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/.exec(backup.name)
  if (match) {
    const date = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`)
    if (!Number.isNaN(date.getTime())) return date
  }
  const created = new Date(backup.createdAt)
  return Number.isNaN(created.getTime()) ? null : created
}

/** The word the restore dialog asks the operator to type. */
export const RESTORE_CONFIRM_WORD = 'restore'
