/*
|--------------------------------------------------------------------------
| Background Tasks
|--------------------------------------------------------------------------
|
| This file starts background tasks when the application boots.
|
*/

import { requestedSearchTask } from '#services/tasks/requested_search_task'
import { downloadMonitorTask } from '#services/tasks/download_monitor_task'
import { completedDownloadsScanner } from '#services/tasks/completed_downloads_scanner'
import AppSetting from '#models/app_setting'
import { tmdbService } from '#services/metadata/tmdb_service'

// Initialize API keys from database on startup
setTimeout(async () => {
  try {
    const tmdbApiKey = await AppSetting.get<string>('tmdbApiKey', '')
    if (tmdbApiKey) {
      tmdbService.setApiKey(tmdbApiKey)
      console.log('[Startup] TMDB API key loaded from database')
    }
  } catch (error) {
    console.error('[Startup] Failed to load TMDB API key:', error)
  }
}, 2000)

// Start the download monitor task (runs every 15 seconds)
// Delay start by 10 seconds to let the app initialize
setTimeout(() => {
  downloadMonitorTask.start(15)
}, 10000)

// Start the completed downloads scanner (runs every 5 minutes)
// This catches orphaned downloads that completed while the app was down
// Delay start by 15 seconds to let the app initialize and check immediately
setTimeout(() => {
  completedDownloadsScanner.start(5)
}, 15000)

// Start the requested items search task (runs every 60 minutes)
// Searches for albums, movies, and books
// Delay start by 30 seconds to let the app fully initialize
setTimeout(() => {
  requestedSearchTask.start(60)
}, 30000)
