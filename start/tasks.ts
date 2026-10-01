/*
|--------------------------------------------------------------------------
| Background Tasks
|--------------------------------------------------------------------------
|
| This file starts background tasks when the application boots.
| Tasks are managed by the TaskScheduler which reads configuration
| from the scheduled_tasks database table.
|
*/

import { requestedSearchTask } from '#services/tasks/requested_search_task'
import { downloadMonitorTask } from '#services/tasks/download_monitor_task'
import { completedDownloadsScanner } from '#services/tasks/completed_downloads_scanner'
import { folderScanner } from '#services/tasks/folder_scanner'
import { stuckImportRecoveryTask } from '#services/tasks/stuck_import_recovery_task'
import { libraryScanTask } from '#services/tasks/library_scan_task'
import { rssSyncTask } from '#services/tasks/rss_sync_task'
import { refreshMetadataTask } from '#services/tasks/refresh_metadata_task'
import { forYouRefreshTask } from '#services/tasks/for_you_refresh_task'
import { backupService } from '#services/backup/backup_service'
import { blacklistService } from '#services/blacklist/blacklist_service'
import { historyService } from '#services/history/history_service'
import { notificationService } from '#services/notifications/notification_service'
import { webhookService } from '#services/webhooks/webhook_service'
import { taskScheduler } from '#services/tasks/task_scheduler'
import { mediaVersionService } from '#services/media/media_version_service'
import { healthMonitor } from '#services/system/health_monitor'
import AppSetting from '#models/app_setting'
import { tmdbService } from '#services/metadata/tmdb_service'
import { justwatchService } from '#services/metadata/justwatch_service'

// Initialize API keys from database on startup
setTimeout(async () => {
  try {
    const tmdbApiKey = await AppSetting.get<string>('tmdbApiKey', '')
    if (tmdbApiKey) {
      tmdbService.setApiKey(tmdbApiKey)
      console.log('[Startup] TMDB API key loaded from database')
    }

    const justwatchLocale = await AppSetting.get<string>('justwatchLocale', 'en_US')
    justwatchService.setLocale(justwatchLocale || 'en_US')
    const justwatchEnabled = await AppSetting.get<boolean>('justwatchEnabled', false)
    if (justwatchEnabled) {
      console.log('[Startup] JustWatch enabled with locale:', justwatchLocale || 'en_US')
    }
  } catch (error) {
    console.error('[Startup] Failed to load API keys:', error)
  }
}, 2000)

// Register task runners with the scheduler
taskScheduler.register('download_monitor', downloadMonitorTask)
taskScheduler.register('completed_scanner', {
  start(interval: number) {
    completedDownloadsScanner.start(interval)
  },
  stop() {
    completedDownloadsScanner.stop()
  },
  async run() {
    await completedDownloadsScanner.scan()
  },
  get running() {
    return false
  },
})
taskScheduler.register('folder_scan', folderScanner)
taskScheduler.register('stuck_import_recovery', stuckImportRecoveryTask)
taskScheduler.register('library_scan', libraryScanTask)
taskScheduler.register('requested_search', requestedSearchTask)
taskScheduler.register('rss_sync', rssSyncTask)
taskScheduler.register('backup', backupService)
taskScheduler.register('refresh_metadata', refreshMetadataTask)
taskScheduler.register('for_you_refresh', forYouRefreshTask)
taskScheduler.register('cleanup', {
  start() {},
  stop() {},
  async run() {
    await blacklistService.cleanupExpired()
    await historyService.prune()
    // Delivery logs keep 30 days; each is independent, so one failing never skips the other.
    const results = await Promise.allSettled([
      notificationService.cleanupHistory(),
      webhookService.cleanupHistory(),
    ])
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[Cleanup] Failed to prune delivery history:', result.reason)
      }
    }
  },
  get running() {
    return false
  },
})

// Probe the database, root folders and download clients once a minute into an
// in-memory cache. /health, the dashboard and Settings → System only ever read
// that cache. The first run comes a second after boot, well inside Docker's
// start period, and /health answers 200 "starting" until it lands.
healthMonitor.start()

// Start the task scheduler after a brief delay to let the app initialize
setTimeout(async () => {
  try {
    await taskScheduler.start()
  } catch (error) {
    console.error('[TaskScheduler] Failed to start:', error)
  }
}, 5000)

// Work through queued versions (smaller copies beside a movie or episode).
// The queue lives in the database, so anything left from before a restart
// picks up where it stopped.
setTimeout(() => mediaVersionService.start(), 10000)
