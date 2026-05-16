import { libraryScannerService } from '#services/media/library_scanner_service'
import logger from '@adonisjs/core/services/logger'

/**
 * Periodic library reconciliation task.
 *
 * Walks every configured root folder (movies/tv/music/books) and reconciles
 * files on disk against library entries. For each file:
 *  - existing MovieFile/EpisodeFile/etc record → no-op
 *  - new file matching an existing library entry → links file, sets hasFile=true
 *  - new file with no library entry → creates one (TMDB/OpenLibrary lookup)
 *
 * This is the path that catches:
 *  - Library entries marked "Requested" whose files are already on disk
 *    (e.g. user copied them in manually or they pre-existed)
 *  - Files moved between root folders
 *  - Files renamed outside Hamster
 *
 * The work is delegated to libraryScannerService.scanAllRootFolders() which
 * already handles per-media-type routing and concurrency control. We only
 * provide the TaskRunner interface and a single-flight guard.
 */
class LibraryScanTask {
  private isRunning = false

  get running(): boolean {
    return this.isRunning
  }

  start(_interval: number): void {
    // No-op: TaskScheduler drives execution
  }

  stop(): void {
    // No-op: TaskScheduler drives execution
  }

  async run(): Promise<void> {
    if (this.isRunning) {
      logger.debug('LibraryScan: already running, skipping')
      return
    }
    this.isRunning = true
    try {
      logger.info('LibraryScan: starting full library reconciliation')
      const results = await libraryScannerService.scanAllRootFolders()

      const totals = results.reduce(
        (acc, r) => {
          acc.filesFound += r.filesFound
          acc.entitiesCreated += r.entitiesCreated
          acc.entitiesUpdated += r.entitiesUpdated
          acc.unmatched += r.unmatchedFiles
          acc.errors += r.errors.length
          return acc
        },
        { filesFound: 0, entitiesCreated: 0, entitiesUpdated: 0, unmatched: 0, errors: 0 }
      )

      logger.info(
        {
          roots: results.length,
          ...totals,
        },
        'LibraryScan: reconciliation complete'
      )
    } catch (err) {
      logger.error({ err }, 'LibraryScan: failed')
    } finally {
      this.isRunning = false
    }
  }
}

export const libraryScanTask = new LibraryScanTask()
