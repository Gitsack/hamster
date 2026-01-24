import { downloadManager } from '#services/download_clients/download_manager'

/**
 * Background task that periodically checks download clients for completed downloads
 * and triggers the import process automatically.
 */
class DownloadMonitorTask {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null
  private intervalSeconds = 15 // Check every 15 seconds by default

  /**
   * Start the periodic monitoring task
   */
  start(intervalSeconds = 15) {
    if (this.intervalId) {
      this.stop()
    }

    this.intervalSeconds = intervalSeconds
    console.log(`[DownloadMonitor] Starting download monitoring every ${intervalSeconds} seconds`)

    // Run immediately on start
    this.run().catch(console.error)

    // Then run periodically
    this.intervalId = setInterval(() => this.run().catch(console.error), intervalSeconds * 1000)
  }

  /**
   * Stop the periodic monitoring task
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[DownloadMonitor] Stopped download monitoring')
    }
  }

  /**
   * Run a single check for completed downloads
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      return // Skip if already running
    }

    this.isRunning = true

    try {
      await downloadManager.refreshQueue()
    } catch (error) {
      console.error('[DownloadMonitor] Error refreshing queue:', error)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Check if the task is currently running
   */
  get running() {
    return this.isRunning
  }

  /**
   * Get the current interval in seconds
   */
  get interval() {
    return this.intervalSeconds
  }
}

export const downloadMonitorTask = new DownloadMonitorTask()
