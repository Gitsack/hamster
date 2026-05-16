import fs from 'node:fs/promises'
import Download from '#models/download'
import DownloadClient from '#models/download_client'
import { downloadManager } from '#services/download_clients/download_manager'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { mapPath } from '#utils/host_mapping'

/**
 * Pattern fragments that identify transient/recoverable import failures.
 * These usually indicate the file or storage was temporarily unavailable
 * (mount not ready, network blip, scan/lock collision) — worth retrying.
 *
 * Errors NOT on this list (e.g. "Unknown media type", "Quality lower than
 * existing", "Permission denied") are considered terminal and never retried
 * automatically — the user should fix configuration or use manual retry.
 */
const TRANSIENT_ERROR_PATTERNS: RegExp[] = [
  /not accessible/i,
  /not responding/i,
  /unresponsive/i,
  /not mounted/i,
  /\bnot\b.*\bmounted\b/i,
  /timeout/i,
  /timed out/i,
  /eagain/i,
  /econnreset/i,
  /econnrefused/i,
  /ehostunreach/i,
  /enetunreach/i,
  /etimedout/i,
  /enotconn/i,
  /ebusy/i,
  /\bestale\b/i,
  /temporarily unavailable/i,
  /resource busy/i,
  /file not found/i,
  /enoent/i,
]

/**
 * How long a download may sit in 'importing' before being considered stuck.
 * Must be safely larger than DownloadManager's in-process 2-minute window.
 */
const STUCK_IMPORTING_THRESHOLD_MINUTES = 10

/**
 * Failed downloads must be at least this old before we consider a retry.
 * Avoids fighting with other workers that just marked the row failed.
 */
const FAILED_RETRY_DELAY_MINUTES = 2

/**
 * Hard ceiling on automatic retries per download.
 * Coordinated with DownloadManager.MAX_IMPORT_ATTEMPTS (3) so this task
 * does not exceed that ceiling — DownloadManager itself enforces the cap.
 */
const MAX_AUTOMATIC_RETRIES = 3

export interface StuckRecoveryResults {
  stuckFound: number
  failedRetryable: number
  retried: number
  permanentFailures: number
  errors: string[]
}

/**
 * Periodic task that finds downloads that completed on the client side but
 * never reached the library, and either retries the import (transient
 * failures) or marks them as needing user attention (terminal failures).
 *
 * Handles three failure modes:
 *  1. `status='importing'` and stale: import process crashed / hung — retrigger
 *  2. `status='failed'` with transient error: storage was offline — retrigger
 *  3. `status='completed' OR 'failed'` but media not in library: rare, surfaced
 *     to logs for manual inspection (we don't auto-import to avoid duplicates)
 */
class StuckImportRecoveryTask {
  private isRunning = false

  /** TaskRunner interface */
  get running(): boolean {
    return this.isRunning
  }

  start(_interval: number): void {
    // No-op: TaskScheduler drives execution
  }

  stop(): void {
    // No-op: TaskScheduler drives execution
  }

  async run(): Promise<StuckRecoveryResults> {
    if (this.isRunning) {
      logger.debug('StuckImportRecovery: already running, skipping')
      return { stuckFound: 0, failedRetryable: 0, retried: 0, permanentFailures: 0, errors: [] }
    }
    this.isRunning = true
    const results: StuckRecoveryResults = {
      stuckFound: 0,
      failedRetryable: 0,
      retried: 0,
      permanentFailures: 0,
      errors: [],
    }

    try {
      const stuck = await this.findStuckImporting()
      results.stuckFound = stuck.length
      for (const d of stuck) {
        try {
          if (await this.retryDownload(d)) results.retried++
        } catch (err) {
          results.errors.push(this.formatError(d, err))
        }
      }

      const retryable = await this.findRetryableFailures()
      results.failedRetryable = retryable.length
      for (const d of retryable) {
        try {
          if (await this.retryDownload(d)) results.retried++
        } catch (err) {
          results.errors.push(this.formatError(d, err))
        }
      }

      const permanent = await this.findPermanentFailures()
      results.permanentFailures = permanent.length

      if (results.stuckFound || results.failedRetryable || results.retried) {
        logger.info(
          {
            stuck: results.stuckFound,
            retryable: results.failedRetryable,
            retried: results.retried,
            permanent: results.permanentFailures,
          },
          'StuckImportRecovery: scan complete'
        )
      }
    } finally {
      this.isRunning = false
    }

    return results
  }

  /**
   * Find downloads stuck in 'importing' state for too long.
   * These are downloads where the import process was started but never finished
   * (server crashed, process killed, I/O hung).
   */
  async findStuckImporting(): Promise<Download[]> {
    const threshold = DateTime.now().minus({ minutes: STUCK_IMPORTING_THRESHOLD_MINUTES })
    return Download.query()
      .where('status', 'importing')
      .where((q) => q.where('completedAt', '<', threshold.toSQL()!).orWhereNull('completedAt'))
      .where((q) => q.where('updatedAt', '<', threshold.toSQL()!).orWhereNull('updatedAt'))
  }

  /**
   * Find downloads that failed import but the failure looks transient
   * (storage was offline, path missing, etc).
   */
  async findRetryableFailures(): Promise<Download[]> {
    const threshold = DateTime.now().minus({ minutes: FAILED_RETRY_DELAY_MINUTES })
    const failed = await Download.query()
      .where('status', 'failed')
      .where('updatedAt', '<', threshold.toSQL()!)
      .whereNotNull('errorMessage')
      .whereNotNull('outputPath')

    return failed.filter((d) => this.isTransientError(d.errorMessage))
  }

  /**
   * Find failed downloads with terminal errors (config issues, unknown media,
   * etc). We don't auto-retry these but surface them in the result count so
   * dashboards can show "needs attention".
   */
  async findPermanentFailures(): Promise<Download[]> {
    const failed = await Download.query().where('status', 'failed').whereNotNull('errorMessage')

    return failed.filter((d) => !this.isTransientError(d.errorMessage))
  }

  /**
   * Returns true if an error message looks transient and worth retrying.
   * Public for tests.
   */
  isTransientError(message: string | null | undefined): boolean {
    if (!message) return false
    return TRANSIENT_ERROR_PATTERNS.some((p) => p.test(message))
  }

  /**
   * Attempt to retry a single download's import.
   * Re-applies remote path mapping in case settings changed, verifies the
   * path is now accessible, and routes to DownloadManager.retryImport().
   * Returns true if a retry was actually attempted.
   */
  private async retryDownload(download: Download): Promise<boolean> {
    if (!download.outputPath) {
      logger.warn(
        { downloadId: download.id, title: download.title },
        'StuckImportRecovery: skipping — no outputPath'
      )
      return false
    }

    // Refresh remote path mapping in case the client config changed since
    // the download record was created.
    if (download.downloadClientId) {
      const client = await DownloadClient.find(download.downloadClientId)
      if (client?.settings?.remotePath && client?.settings?.localPath) {
        const remote = client.settings.remotePath
        const local = client.settings.localPath
        if (download.outputPath.startsWith(remote)) {
          download.outputPath = download.outputPath.replace(remote, local)
          await download.save()
        }
      }
    }

    // Verify the path is now reachable before paying for an import attempt.
    // mapPath() translates the DB-stored Docker path to the local-runtime
    // path when SERVICE_PATH_MAP is set; no-op otherwise.
    const reachable = await this.isPathReachable(mapPath(download.outputPath))
    if (!reachable) {
      logger.debug(
        { downloadId: download.id, path: download.outputPath },
        'StuckImportRecovery: path still unreachable, leaving for next tick'
      )
      // Don't bump retry count — the file isn't there yet, this isn't a real attempt.
      return false
    }

    // Reset attempt bookkeeping if we're picking up a 'failed' row that the
    // user (or another retry) may have already counted against the limit.
    // We give it MAX_AUTOMATIC_RETRIES fresh attempts here, then DownloadManager
    // enforces its own per-process ceiling.
    const attemptCount = await this.countPriorAttempts(download)
    if (attemptCount >= MAX_AUTOMATIC_RETRIES) {
      logger.debug(
        { downloadId: download.id, attemptCount },
        'StuckImportRecovery: auto-retry budget exhausted'
      )
      return false
    }

    download.status = 'importing'
    download.completedAt = download.completedAt ?? DateTime.now()
    await download.save()

    logger.info(
      { downloadId: download.id, title: download.title, attempt: attemptCount + 1 },
      'StuckImportRecovery: retrying import'
    )

    // Fire-and-forget — DownloadManager handles its own error reporting via the
    // Download row's status/errorMessage fields.
    downloadManager.retryImport(download).catch((err) => {
      logger.error({ downloadId: download.id, err }, 'StuckImportRecovery: retryImport rejected')
    })

    return true
  }

  /**
   * Returns the number of prior attempts inferred from the row.
   * Currently a heuristic — we don't have a dedicated counter column. A
   * non-null errorMessage means at least one attempt has been made.
   */
  private async countPriorAttempts(download: Download): Promise<number> {
    return download.errorMessage ? 1 : 0
  }

  /** Path-existence check with a short timeout so unmounted NFS doesn't block us */
  private async isPathReachable(p: string, timeoutMs = 3000): Promise<boolean> {
    try {
      await Promise.race([
        fs.access(p),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ])
      return true
    } catch {
      return false
    }
  }

  private formatError(download: Download, err: unknown): string {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return `${download.title}: ${msg}`
  }
}

export const stuckImportRecoveryTask = new StuckImportRecoveryTask()
export { STUCK_IMPORTING_THRESHOLD_MINUTES, FAILED_RETRY_DELAY_MINUTES, TRANSIENT_ERROR_PATTERNS }
