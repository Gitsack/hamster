import os from 'node:os'
import type { HttpContext } from '@adonisjs/core/http'
import { appVersion } from '#services/system/app_info'
import { healthMonitor, HEALTH_STALE_MS, type HealthMonitor } from '#services/system/health_monitor'
import {
  mediaFolderLabel,
  type FolderHealth,
  type HealthCheck,
} from '#services/system/health_state'

/**
 * The root-folder check names each failing folder by its path. For someone who
 * may not see paths, say the same thing with the folder's media label instead.
 */
function redactCheck(check: HealthCheck, folders: FolderHealth[]): HealthCheck {
  if (check.name !== 'rootFolders') return check
  const problems = folders.filter((f) => f.status !== 'ok')
  if (problems.length === 0) return check
  return {
    ...check,
    message: problems.map((f) => `${mediaFolderLabel(f.mediaType)}: ${f.message}`).join('; '),
  }
}

/**
 * What any signed-in user may read about health: the verdict and the problems,
 * without infrastructure detail. Admins additionally get folder paths and the
 * failed tasks, which are theirs to fix.
 */
export function buildHealthSummary(monitor: HealthMonitor, isAdmin: boolean) {
  const result = monitor.result
  return {
    level: monitor.level,
    checkedAt: result?.checkedAt ?? null,
    stale: monitor.isStale(),
    checking: monitor.running,
    checks: isAdmin
      ? (result?.checks ?? [])
      : (result?.checks ?? []).map((check) => redactCheck(check, result?.rootFolders ?? [])),
    downloadClients: (result?.downloadClients ?? []).map((client) => ({
      id: client.id,
      name: client.name,
      type: client.type,
      status: client.status,
      message: client.message,
      latencyMs: client.latencyMs,
      since: client.since,
    })),
    rootFolders: isAdmin ? (result?.rootFolders ?? []) : [],
    freeBytes: result?.freeBytes ?? null,
    failedTasks: isAdmin ? monitor.failedTasks : [],
  }
}

export type HealthSummary = ReturnType<typeof buildHealthSummary>

export default class SystemController {
  constructor(private monitor: HealthMonitor = healthMonitor) {}

  /**
   * Liveness for Docker and load balancers, read from the monitor's cache.
   *
   * The status code answers "is this container working?", not "is every
   * service it talks to up?":
   * - 200 `starting` before the first check has finished (the container has
   *   only just booted — failing here would mark it unhealthy for nothing);
   * - 503 when the database is down, or when the monitor has stopped
   *   reporting (the process is wedged) — restarting can help with both;
   * - 200 otherwise, with the verdict in the body. A download client being
   *   down is not fixed by restarting Hamster, so it no longer marks the
   *   container unhealthy. `?strict=1` restores 503 on any error for
   *   external monitors that want it.
   */
  async health({ request, response }: HttpContext) {
    const result = this.monitor.result
    const base = {
      version: appVersion,
      uptime: Math.floor(process.uptime()),
    }

    if (!result) {
      return response.status(200).json({
        status: 'starting',
        ...base,
        checks: [],
        timestamp: new Date().toISOString(),
      })
    }

    const stale = this.monitor.isStale()
    const checks = result.checks.map(({ name, status, message }) => ({ name, status, message }))
    if (stale) {
      checks.push({
        name: 'monitor',
        status: 'error',
        message: `No health check has finished since ${result.checkedAt} (expected every minute; stale after ${HEALTH_STALE_MS / 60_000} min)`,
      })
    }

    const status = stale ? 'error' : result.status
    const databaseDown = result.checks.some((c) => c.name === 'database' && c.status === 'error')
    const strict = ['1', 'true'].includes(String(request.input('strict', '')).toLowerCase())
    const unhealthy = stale || databaseDown || (strict && status === 'error')

    return response.status(unhealthy ? 503 : 200).json({
      status,
      ...base,
      checks,
      timestamp: result.checkedAt,
    })
  }

  /**
   * The cached health verdict for the UI: dashboard, Activity, Settings →
   * System. Never probes anything.
   */
  async healthSummary({ auth, response }: HttpContext) {
    return response.json(buildHealthSummary(this.monitor, Boolean(auth.user?.isAdmin)))
  }

  /**
   * Start a health run in the background. The request returns at once; the
   * page polls the summary until `checkedAt` moves.
   */
  async recheck({ response }: HttpContext) {
    const started = this.monitor.requestCheck()
    return response.status(202).json({ started, checking: true })
  }

  /**
   * Get system info
   */
  async info({ response }: HttpContext) {
    const uptime = Math.floor(process.uptime())

    return response.json({
      version: appVersion,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime,
      memory: {
        used: Math.round(process.memoryUsage().rss / 1024 / 1024),
        total: Math.round(os.totalmem() / 1024 / 1024),
      },
    })
  }
}
