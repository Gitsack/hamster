import { DateTime } from 'luxon'
import { forYouPools } from '#services/recommendations/for_you_pools'

const LOG_PREFIX = '[ForYouRefresh]'

/**
 * Rebuilds every user's For you deck ahead of time, so the dashboard never
 * waits on TMDB. Runs once after startup and then at midnight (local time);
 * pools that run low in between are topped up as they are used.
 */
class ForYouRefreshTask {
  private isRunning = false

  /** Pools are in the database, but the first run after a deploy uses the new code. */
  readonly runOnStartup = true

  start(_intervalMinutes?: number) {
    // No-op: TaskScheduler handles the interval
  }

  stop() {
    // No-op: TaskScheduler handles stopping
  }

  get running() {
    return this.isRunning
  }

  /**
   * A daily interval lands on midnight rather than drifting with each run and
   * restart; any other interval set in Settings is taken as it is.
   */
  nextRunAt(intervalMinutes: number): DateTime {
    if (intervalMinutes % 1440 !== 0) return DateTime.now().plus({ minutes: intervalMinutes })
    return DateTime.now()
      .plus({ days: intervalMinutes / 1440 })
      .startOf('day')
  }

  async run(): Promise<{ errors: string[] }> {
    if (this.isRunning) return { errors: [] }
    this.isRunning = true
    try {
      const { built, errors } = await forYouPools.refreshAll()
      console.log(`${LOG_PREFIX} Built ${built} suggestion pools`)
      return { errors }
    } finally {
      this.isRunning = false
    }
  }
}

export const forYouRefreshTask = new ForYouRefreshTask()
