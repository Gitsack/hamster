import fs from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import RootFolder from '#models/root_folder'
import DownloadClient from '#models/download_client'
import ScheduledTask from '#models/scheduled_task'
import { sabnzbdService } from '#services/download_clients/sabnzbd_service'
import { nzbgetService } from '#services/download_clients/nzbget_service'
import { qbittorrentService } from '#services/download_clients/qbittorrent_service'
import { transmissionService } from '#services/download_clients/transmission_service'
import { delugeService } from '#services/download_clients/deluge_service'
import { eventEmitter } from '#services/events/event_emitter'
import {
  HealthState,
  healthState,
  type ClientHealth,
  type FailedTask,
  type FolderHealth,
  type HealthCheck,
  type HealthLevel,
  type HealthResult,
  type HealthStatus,
} from '#services/system/health_state'

/*
|--------------------------------------------------------------------------
| Health monitor
|--------------------------------------------------------------------------
|
| One process-wide loop probes the database, the root folders and the
| download clients every minute and keeps the last result in memory. Every
| reader — /health, the dashboard, the sidebar dot, Settings → System — reads
| that cache and nothing else, so no request ever waits on a live probe. That
| matters because a download client behind a VPN container can hang until
| its timeout, and a stale network mount can hang fs calls indefinitely.
|
| Health notifications fire on transitions only (ok → problem, problem → ok),
| tracked here for the life of the process. They used to be tracked on the
| controller, which Adonis builds fresh for every request, so every Docker
| healthcheck against a failing service re-sent the same alert.
|
*/

export type {
  HealthStatus,
  HealthLevel,
  HealthCheck,
  ClientHealth,
  FolderHealth,
  HealthResult,
  FailedTask,
} from '#services/system/health_state'
export { HEALTH_STALE_MS } from '#services/system/health_state'

/** What a probe reports; the monitor adds labels and `since`. */
export interface ProbeOutcome<T = undefined> {
  status: HealthStatus
  message: string
  details?: T
}

type ClientProbe = Omit<ClientHealth, 'since'>
interface FolderProbe {
  folders: FolderHealth[]
  freeBytes: number | null
}

export interface HealthProbes {
  database(): Promise<ProbeOutcome>
  rootFolders(): Promise<ProbeOutcome<FolderProbe>>
  downloadClients(): Promise<ProbeOutcome<ClientProbe[]>>
  failedTasks(): Promise<FailedTask[]>
}

export interface HealthNotifier {
  issue(data: { level: 'warning' | 'error'; source: string; message: string }): Promise<void>
  restored(data: { source: string; message: string }): Promise<void>
}

export interface HealthMonitorOptions {
  intervalMs?: number
  /** Delay before the first run after start(). */
  initialDelayMs?: number
  probes?: Partial<HealthProbes>
  notifier?: HealthNotifier
  /**
   * Send health.issue / health.restored. Production only by default: a dev
   * server on the host sees the Docker network differently (service names do
   * not resolve) and would page the operator about outages that are not real.
   */
  notify?: boolean
  now?: () => number
  /** Where results are published. The app-wide singleton uses `healthState`. */
  state?: HealthState
}

export const HEALTH_INTERVAL_MS = 60_000
const DB_TIMEOUT_MS = 5_000
const FS_TIMEOUT_MS = 5_000
/** The client services abort their own requests at 10s; this is the backstop. */
const CLIENT_TIMEOUT_MS = 12_000
/** No single run may hold the loop longer than this. */
const RUN_TIMEOUT_MS = 45_000
const LOW_SPACE_BYTES = 10 * 1024 ** 3

const CHECK_LABELS: Record<string, string> = {
  database: 'Database',
  rootFolders: 'Root folders',
  downloadClients: 'Download clients',
}

class TimeoutError extends Error {}

/** Reject after `ms`. The underlying work may keep running; the caller moves on. */
export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${what} did not answer within ${ms / 1000}s`)),
      ms
    )
    timer.unref?.()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

const RANK: Record<HealthStatus, number> = { ok: 0, warning: 1, error: 2 }

export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>((worst, s) => (RANK[s] > RANK[worst] ? s : worst), 'ok')
}

function formatGb(bytes: number): string {
  return `${Math.round(bytes / 1024 ** 3)} GB`
}

// ---------------------------------------------------------------------------
// Default probes
// ---------------------------------------------------------------------------

async function probeDatabase(): Promise<ProbeOutcome> {
  const start = Date.now()
  try {
    await withTimeout(db.rawQuery('SELECT 1'), DB_TIMEOUT_MS, 'The database')
    const latency = Date.now() - start
    return {
      status: latency > 1000 ? 'warning' : 'ok',
      message: latency > 1000 ? `Slow to answer (${latency} ms)` : `Connected (${latency} ms)`,
    }
  } catch (error) {
    return { status: 'error', message: errorMessage(error, 'Connection failed') }
  }
}

async function probeRootFolders(): Promise<ProbeOutcome<FolderProbe>> {
  let rows: RootFolder[]
  try {
    rows = await withTimeout(RootFolder.all(), DB_TIMEOUT_MS, 'The database')
  } catch (error) {
    return {
      status: 'error',
      message: `Could not list root folders: ${errorMessage(error, 'query failed')}`,
      details: { folders: [], freeBytes: null },
    }
  }

  if (rows.length === 0) {
    return {
      status: 'warning',
      message: 'No root folders configured',
      details: { folders: [], freeBytes: null },
    }
  }

  // Folders on the same filesystem share their free space; count it once.
  const freeByDevice = new Map<string, number>()

  const folders = await Promise.all(
    rows.map(async (folder): Promise<FolderHealth> => {
      const base = { id: folder.id, path: folder.path, mediaType: folder.mediaType }
      try {
        await withTimeout(fs.access(folder.path), FS_TIMEOUT_MS, folder.path)
      } catch (error) {
        return {
          ...base,
          status: 'error',
          message:
            error instanceof TimeoutError
              ? 'Not responding — network storage may be unmounted'
              : 'Not accessible',
          freeBytes: null,
        }
      }

      let freeBytes: number | null = folder.freeSpaceBytes
      try {
        const [stat, statfs] = await withTimeout(
          Promise.all([fs.stat(folder.path), fs.statfs(folder.path)]),
          FS_TIMEOUT_MS,
          folder.path
        )
        freeBytes = Number(statfs.bavail) * Number(statfs.bsize)
        freeByDevice.set(String(stat.dev), freeBytes)
      } catch {
        // Keep the last value the library scan recorded.
      }

      if (freeBytes !== null && freeBytes < LOW_SPACE_BYTES) {
        return {
          ...base,
          status: 'warning',
          message: `Low space (${formatGb(freeBytes)} free)`,
          freeBytes,
        }
      }
      return { ...base, status: 'ok', message: 'Readable', freeBytes }
    })
  )

  const problems = folders.filter((f) => f.status !== 'ok')
  const status = worstStatus(folders.map((f) => f.status))
  const message =
    problems.length === 0
      ? `${folders.length} ${folders.length === 1 ? 'folder' : 'folders'} readable`
      : problems.map((f) => `${f.path}: ${f.message}`).join('; ')

  const freeBytes =
    freeByDevice.size > 0 ? [...freeByDevice.values()].reduce((sum, n) => sum + n, 0) : null

  return { status, message, details: { folders, freeBytes } }
}

async function testClient(client: DownloadClient): Promise<{ success: boolean; error?: string }> {
  const settings = client.settings ?? {}
  const config = {
    host: settings.host || 'localhost',
    port: settings.port || 8080,
    useSsl: settings.useSsl,
    apiKey: settings.apiKey || '',
    username: settings.username,
    password: settings.password,
    category: settings.category,
    urlBase: settings.urlBase,
  }

  switch (client.type) {
    case 'sabnzbd':
      return sabnzbdService.testConnection(config)
    case 'nzbget':
      return nzbgetService.testConnection(config)
    case 'qbittorrent':
      return qbittorrentService.testConnection(config)
    case 'transmission':
      return transmissionService.testConnection(config)
    case 'deluge':
      return delugeService.testConnection({
        host: config.host,
        port: settings.port || 8112,
        password: config.password || '',
        useSsl: config.useSsl,
      })
    default:
      return { success: false, error: `Hamster cannot talk to ${client.type} clients` }
  }
}

async function probeDownloadClients(): Promise<ProbeOutcome<ClientProbe[]>> {
  let clients: DownloadClient[]
  try {
    clients = await withTimeout(
      DownloadClient.query().where('enabled', true).orderBy('priority', 'asc'),
      DB_TIMEOUT_MS,
      'The database'
    )
  } catch (error) {
    return {
      status: 'error',
      message: `Could not list download clients: ${errorMessage(error, 'query failed')}`,
      details: [],
    }
  }

  if (clients.length === 0) {
    return { status: 'warning', message: 'No download client enabled', details: [] }
  }

  const results = await Promise.all(
    clients.map(async (client): Promise<ClientProbe> => {
      const base = { id: client.id, name: client.name, type: client.type }
      const start = Date.now()
      try {
        const result = await withTimeout(testClient(client), CLIENT_TIMEOUT_MS, client.name)
        if (result.success) {
          return { ...base, status: 'ok', message: 'Reachable', latencyMs: Date.now() - start }
        }
        return {
          ...base,
          status: 'error',
          message: result.error || 'Connection failed',
          latencyMs: null,
        }
      } catch (error) {
        return {
          ...base,
          status: 'error',
          message: errorMessage(error, 'Connection failed'),
          latencyMs: null,
        }
      }
    })
  )

  const failed = results.filter((r) => r.status === 'error')
  if (failed.length === 0) {
    return {
      status: 'ok',
      message: `${results.length} ${results.length === 1 ? 'client' : 'clients'} reachable`,
      details: results,
    }
  }
  const names = failed.map((r) => `${r.name}: ${r.message}`).join('; ')
  return {
    // One client down while another still takes grabs is a warning; none left is an error.
    status: failed.length === results.length ? 'error' : 'warning',
    message: `Unreachable — ${names}`,
    details: results,
  }
}

async function probeFailedTasks(): Promise<FailedTask[]> {
  const rows = await withTimeout(
    ScheduledTask.query().where('enabled', true).where('lastStatus', 'failed').orderBy('name'),
    DB_TIMEOUT_MS,
    'The database'
  )
  return rows.map((task) => ({
    id: task.id,
    name: task.name,
    type: task.type,
    lastError: task.lastError,
    lastRunAt: task.lastRunAt?.toISO() ?? null,
  }))
}

const DEFAULT_PROBES: HealthProbes = {
  database: probeDatabase,
  rootFolders: probeRootFolders,
  downloadClients: probeDownloadClients,
  failedTasks: probeFailedTasks,
}

const DEFAULT_NOTIFIER: HealthNotifier = {
  issue: (data) => eventEmitter.emitHealthIssue(data),
  restored: (data) => eventEmitter.emitHealthRestored(data),
}

// ---------------------------------------------------------------------------
// The monitor
// ---------------------------------------------------------------------------

export class HealthMonitor {
  private readonly intervalMs: number
  private readonly initialDelayMs: number
  private readonly probes: HealthProbes
  private readonly notifier: HealthNotifier
  private readonly notify: boolean
  private readonly now: () => number

  private readonly state: HealthState
  /** Status and entry time per check, and per client, across runs. */
  private previous = new Map<string, { status: HealthStatus; since: string }>()
  private inFlight: Promise<HealthResult> | null = null
  private timer: NodeJS.Timeout | null = null
  private kickoff: NodeJS.Timeout | null = null

  constructor(options: HealthMonitorOptions = {}) {
    this.intervalMs = options.intervalMs ?? HEALTH_INTERVAL_MS
    this.initialDelayMs = options.initialDelayMs ?? 1_000
    this.probes = { ...DEFAULT_PROBES, ...options.probes }
    this.notifier = options.notifier ?? DEFAULT_NOTIFIER
    this.notify = options.notify ?? app.inProduction
    this.now = options.now ?? Date.now
    this.state = options.state ?? new HealthState(this.now)
  }

  /** The last completed run, or null before the first one finishes. */
  get result(): HealthResult | null {
    return this.state.result
  }

  get failedTasks(): FailedTask[] {
    return this.state.failedTasks
  }

  get running(): boolean {
    return this.state.running
  }

  get level(): HealthLevel {
    return this.state.level
  }

  /** True when the loop has stopped reporting (it should run every minute). */
  isStale(): boolean {
    return this.state.isStale()
  }

  start() {
    if (this.timer || this.kickoff) return
    // The first run comes quickly so /health leaves "starting" within Docker's
    // start period; after that, once a minute.
    this.kickoff = setTimeout(() => {
      this.kickoff = null
      void this.run()
      this.timer = setInterval(() => void this.run(), this.intervalMs)
      this.timer.unref?.()
    }, this.initialDelayMs)
    this.kickoff.unref?.()
  }

  stop() {
    if (this.kickoff) clearTimeout(this.kickoff)
    if (this.timer) clearInterval(this.timer)
    this.kickoff = null
    this.timer = null
  }

  /**
   * Run the checks now. Concurrent callers share one run, so a Re-check click
   * during the scheduled run never probes the clients twice. Never rejects.
   */
  run(): Promise<HealthResult> {
    if (this.inFlight) return this.inFlight
    this.state.running = true
    this.inFlight = this.execute().finally(() => {
      this.inFlight = null
      this.state.running = false
    })
    return this.inFlight
  }

  /** Start a run without waiting for it. Returns false when one is already going. */
  requestCheck(): boolean {
    if (this.inFlight) return false
    void this.run()
    return true
  }

  /**
   * Re-read which tasks last failed. The scheduler calls this after every run
   * so the sidebar and dashboard do not wait up to a minute to clear.
   */
  async refreshFailedTasks(): Promise<void> {
    try {
      this.state.failedTasks = await this.probes.failedTasks()
    } catch (error) {
      console.error('[HealthMonitor] Could not read task results:', error)
    }
  }

  private async execute(): Promise<HealthResult> {
    const started = this.now()
    let outcome: [
      ProbeOutcome,
      ProbeOutcome<FolderProbe>,
      ProbeOutcome<ClientProbe[]>,
      FailedTask[] | null,
    ]
    try {
      outcome = await withTimeout(
        Promise.all([
          this.safe(() => this.probes.database(), 'Database check failed'),
          this.safe(() => this.probes.rootFolders(), 'Root folder check failed'),
          this.safe(() => this.probes.downloadClients(), 'Download client check failed'),
          this.probes.failedTasks().catch(() => null),
        ]),
        RUN_TIMEOUT_MS,
        'The health check'
      )
    } catch (error) {
      const message = errorMessage(error, 'The health check did not finish')
      const stalled: ProbeOutcome<never> = { status: 'error', message }
      outcome = [stalled, stalled, stalled, null]
    }

    const [database, rootFolders, downloadClients, failedTasks] = outcome
    if (failedTasks) this.state.failedTasks = failedTasks

    const checkedAt = new Date(this.now()).toISOString()
    const checks: HealthCheck[] = (
      [
        ['database', database],
        ['rootFolders', rootFolders],
        ['downloadClients', downloadClients],
      ] as const
    ).map(([name, probe]) => ({
      name,
      label: CHECK_LABELS[name],
      status: probe.status,
      message: probe.message,
      since: this.track(name, probe.status, checkedAt),
    }))

    const clients: ClientHealth[] = (downloadClients.details ?? []).map((client) => ({
      ...client,
      since: this.track(`client:${client.id}`, client.status, checkedAt),
    }))

    const result: HealthResult = {
      status: worstStatus(checks.map((c) => c.status)),
      checkedAt,
      durationMs: this.now() - started,
      checks,
      downloadClients: clients,
      rootFolders: rootFolders.details?.folders ?? [],
      freeBytes: rootFolders.details?.freeBytes ?? null,
    }

    const before = this.state.result
    this.state.result = result
    this.announce(before, result)
    return result
  }

  private async safe<T>(probe: () => Promise<ProbeOutcome<T>>, fallback: string) {
    try {
      return await probe()
    } catch (error) {
      return { status: 'error', message: errorMessage(error, fallback) } as ProbeOutcome<T>
    }
  }

  /** Record `status` for `key` and return when it entered that status. */
  private track(key: string, status: HealthStatus, at: string): string {
    const prior = this.previous.get(key)
    if (prior && prior.status === status) return prior.since
    this.previous.set(key, { status, since: at })
    return at
  }

  /**
   * Notify on transitions. The first run counts: a problem already present at
   * boot is reported once, as it was before the monitor existed.
   */
  private announce(before: HealthResult | null, after: HealthResult) {
    if (!this.notify) return
    for (const check of after.checks) {
      const prior = before?.checks.find((c) => c.name === check.name)?.status
      if (check.status !== 'ok' && prior !== check.status) {
        this.notifier
          .issue({ level: check.status, source: check.name, message: check.message })
          .catch((err) => console.error('[HealthMonitor] Failed to send health issue:', err))
      } else if (check.status === 'ok' && prior && prior !== 'ok') {
        this.notifier
          .restored({ source: check.name, message: check.message })
          .catch((err) => console.error('[HealthMonitor] Failed to send health restored:', err))
      }
    }
  }
}

export const healthMonitor = new HealthMonitor({ state: healthState })
