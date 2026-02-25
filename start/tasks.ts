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
import { rssSyncTask } from '#services/tasks/rss_sync_task'
import { refreshMetadataTask } from '#services/tasks/refresh_metadata_task'
import { backupService } from '#services/backup/backup_service'
import { blacklistService } from '#services/blacklist/blacklist_service'
import { taskScheduler } from '#services/tasks/task_scheduler'
import AppSetting from '#models/app_setting'
import { tmdbService } from '#services/metadata/tmdb_service'
import { traktService } from '#services/metadata/trakt_service'
import { justwatchService } from '#services/metadata/justwatch_service'

// Initialize API keys from database on startup
setTimeout(async () => {
  try {
    const tmdbApiKey = await AppSetting.get<string>('tmdbApiKey', '')
    if (tmdbApiKey) {
      tmdbService.setApiKey(tmdbApiKey)
      console.log('[Startup] TMDB API key loaded from database')
    }

    const traktClientId = await AppSetting.get<string>('traktClientId', '')
    if (traktClientId) {
      traktService.setClientId(traktClientId)
      console.log('[Startup] Trakt client ID loaded from database')
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
taskScheduler.register('requested_search', requestedSearchTask)
taskScheduler.register('rss_sync', rssSyncTask)
taskScheduler.register('backup', backupService)
taskScheduler.register('refresh_metadata', refreshMetadataTask)
taskScheduler.register('cleanup', {
  start() {},
  stop() {},
  async run() {
    await blacklistService.cleanupExpired()
  },
  get running() {
    return false
  },
})

// Start the task scheduler after a brief delay to let the app initialize
setTimeout(async () => {
  try {
    await taskScheduler.start()
  } catch (error) {
    console.error('[TaskScheduler] Failed to start:', error)
  }
}, 5000)
