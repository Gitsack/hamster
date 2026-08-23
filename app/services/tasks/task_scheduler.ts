import ScheduledTask, { type TaskType } from '#models/scheduled_task'
import { DateTime } from 'luxon'

interface TaskRunner {
  start(interval: number): void
  stop(): void
  run(): Promise<any>
  readonly running: boolean
}

interface DefaultTask {
  name: string
  type: TaskType
  intervalMinutes: number
  enabled: boolean
}

// How often to check whether any task has come due. Short enough that a task is
// never late by more than this, cheap enough to run forever (one indexed query).
const TICK_INTERVAL_MS = 30_000

const DEFAULT_TASKS: DefaultTask[] = [
  { name: 'Download Monitor', type: 'download_monitor', intervalMinutes: 1, enabled: true },
  {
    name: 'Completed Downloads Scanner',
    type: 'completed_scanner',
    intervalMinutes: 5,
    enabled: true,
  },
  { name: 'Folder Scanner', type: 'folder_scan', intervalMinutes: 10, enabled: true },
  {
    name: 'Stuck Import Recovery',
    type: 'stuck_import_recovery',
    intervalMinutes: 15,
    enabled: true,
  },
  // Walks library root folders to reconcile files-on-disk against library
  // entries. Catches files placed in the library outside Hamster's import
  // pipeline (manual copy, pre-existing media, files renamed externally).
  // 4 hours is a balance: long enough that walking 50k files is not a hot
  // path, short enough that "Requested" badges clear within a working day.
  { name: 'Library Scan', type: 'library_scan', intervalMinutes: 240, enabled: true },
  { name: 'Requested Items Search', type: 'requested_search', intervalMinutes: 60, enabled: true },
  { name: 'RSS Sync', type: 'rss_sync', intervalMinutes: 15, enabled: true },
  { name: 'Backup', type: 'backup', intervalMinutes: 1440, enabled: true },
  { name: 'Blacklist Cleanup', type: 'cleanup', intervalMinutes: 1440, enabled: true },
  { name: 'Refresh Metadata', type: 'refresh_metadata', intervalMinutes: 720, enabled: true },
]

class TaskScheduler {
  private runners = new Map<TaskType, TaskRunner>()

  // Tasks currently executing, claimed by this scheduler rather than trusting
  // each runner's own `running` flag.
  private inFlight = new Set<TaskType>()
  private ticker: NodeJS.Timeout | null = null
  private startupDone = false
  private started = false

  /**
   * Register a task runner for a given task type
   */
  register(type: TaskType, runner: TaskRunner) {
    this.runners.set(type, runner)
  }

  /**
   * Initialize default tasks in the database and start scheduling
   */
  async start() {
    if (this.started) return
    this.started = true

    console.log('[TaskScheduler] Initializing scheduled tasks...')

    // Upsert default tasks
    for (const def of DEFAULT_TASKS) {
      const existing = await ScheduledTask.query().where('type', def.type).first()
      if (!existing) {
        await ScheduledTask.create({
          name: def.name,
          type: def.type,
          intervalMinutes: def.intervalMinutes,
          enabled: def.enabled,
          nextRunAt: DateTime.now().plus({ minutes: 1 }),
        })
        console.log(`[TaskScheduler] Created default task: ${def.name}`)
      }
    }

    // A single ticker drives every task off its persisted nextRunAt.
    this.ticker = setInterval(() => {
      this.tick().catch((err) => console.error('[TaskScheduler] Tick failed:', err))
    }, TICK_INTERVAL_MS)

    await this.tick()

    const count = await ScheduledTask.query().where('enabled', true)
    console.log(`[TaskScheduler] Started, polling ${count.length} scheduled tasks`)
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    if (this.ticker) {
      clearInterval(this.ticker)
      this.ticker = null
    }
    for (const runner of this.runners.values()) {
      runner.stop()
    }
    this.startupDone = false
    this.started = false
    console.log('[TaskScheduler] All tasks stopped')
  }

  /**
   * Poll every task's due-ness against the clock.
   *
   * This replaces a per-task `setInterval(intervalMinutes)`. That armed each
   * timer from the moment of scheduling rather than from the task's stored
   * nextRunAt, so every process restart pushed the next run a full interval into
   * the future. Any task whose interval exceeded the time between restarts —
   * hourly search, 4-hourly library scan, 12-hourly metadata refresh — could
   * therefore never run at all. Ticking against persisted state is restart-safe
   * and self-correcting.
   */
  private async tick() {
    let tasks: ScheduledTask[]
    try {
      tasks = await ScheduledTask.query().where('enabled', true)
    } catch (err) {
      console.error('[TaskScheduler] Failed to load tasks for tick:', err)
      return
    }

    const now = DateTime.now()

    for (const task of tasks) {
      if (!this.runners.has(task.type)) continue
      if (task.nextRunAt && task.nextRunAt > now) continue
      if (this.inFlight.has(task.type)) continue

      // Stagger the first run of each type so a cold start does not fire
      // everything into the indexers at once.
      const delay = this.startupDone ? 0 : this.getStartupDelay(task.type)
      setTimeout(() => {
        this.executeTask(task.type).catch((err) => {
          console.error(`[TaskScheduler] Error executing ${task.type}:`, err)
        })
      }, delay)
    }

    this.startupDone = true
  }

  /**
   * Get a staggered startup delay to avoid all tasks running at once
   */
  private getStartupDelay(type: TaskType): number {
    const delays: Record<string, number> = {
      download_monitor: 5000,
      completed_scanner: 10000,
      folder_scan: 15000,
      stuck_import_recovery: 18000,
      library_scan: 90000,
      requested_search: 20000,
      rss_sync: 30000,
      cleanup: 45000,
      backup: 60000,
      refresh_metadata: 75000,
    }
    return delays[type] || 15000
  }

  /**
   * Execute a task and update its DB record
   */
  async executeTask(type: TaskType): Promise<void> {
    const runner = this.runners.get(type)
    if (!runner) {
      console.error(`[TaskScheduler] No runner for task type: ${type}`)
      return
    }

    // Not all runners report `running` honestly — a few hardcode it to false —
    // so the scheduler keeps its own claim. Without this a long task (library
    // scan runs for ~12 minutes) could be started again while still running.
    if (runner.running || this.inFlight.has(type)) {
      console.warn(`[TaskScheduler] Task ${type} is still running, skipping this tick`)
      return
    }

    const task = await ScheduledTask.query().where('type', type).first()
    if (!task || !task.enabled) {
      return
    }

    this.inFlight.add(type)

    const startTime = Date.now()
    task.lastRunAt = DateTime.now()
    // Schedule the next run up front. Doing it only in the `finally` meant a
    // crash or restart mid-run left nextRunAt permanently in the past, so the
    // task fired on every subsequent tick.
    task.nextRunAt = DateTime.now().plus({ minutes: task.intervalMinutes })
    await task.save()

    let status = 'success'
    let error: string | null = null

    try {
      const result = await runner.run()
      // Several runners report per-item errors instead of throwing. A task that
      // fails every run for a recoverable reason must not look like a success.
      const errors = (result as { errors?: unknown } | undefined)?.errors
      if (Array.isArray(errors) && errors.length > 0) {
        status = 'failed'
        error = errors.slice(0, 5).map(String).join('; ')
      }
    } catch (err) {
      console.error(`[TaskScheduler] Task ${type} failed:`, err)
      status = 'failed'
      error = err instanceof Error ? err.message : String(err)
    } finally {
      this.inFlight.delete(type)
      const duration = Date.now() - startTime
      task.lastDurationMs = duration
      task.lastStatus = status
      task.lastError = error ? error.slice(0, 2000) : null
      // Recompute from the end of the run so a task that takes longer than its
      // interval does not immediately re-fire.
      task.nextRunAt = DateTime.now().plus({ minutes: task.intervalMinutes })
      await task.save()
    }
  }

  /**
   * Trigger an immediate run of a task (for manual triggers via API)
   */
  async triggerTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    const task = await ScheduledTask.find(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    const runner = this.runners.get(task.type)
    if (!runner) {
      return { success: false, error: `No runner registered for task type: ${task.type}` }
    }

    // Same claim check as executeTask, so a manual trigger cannot start a second
    // copy of a task that is already running. executeTask re-checks anyway; this
    // exists to give the caller a real error instead of a silent no-op.
    if (runner.running || this.inFlight.has(task.type)) {
      return { success: false, error: 'Task is already running' }
    }

    // Run in background
    this.executeTask(task.type).catch((err) => {
      console.error(`[TaskScheduler] Manual trigger of ${task.type} failed:`, err)
    })

    return { success: true }
  }

  /**
   * Update a task's configuration and reschedule
   */
  async updateTask(
    taskId: string,
    updates: { intervalMinutes?: number; enabled?: boolean }
  ): Promise<ScheduledTask | null> {
    const task = await ScheduledTask.find(taskId)
    if (!task) return null

    if (updates.intervalMinutes !== undefined) {
      task.intervalMinutes = updates.intervalMinutes
    }

    if (updates.enabled !== undefined) {
      task.enabled = updates.enabled
    }

    task.nextRunAt = DateTime.now().plus({ minutes: task.intervalMinutes })
    await task.save()

    // No rescheduling needed: the ticker reads nextRunAt and enabled from the
    // row on every pass, so saving is all it takes to take effect.
    return task
  }

  /**
   * Get all scheduled tasks with their current status
   */
  async getAllTasks(): Promise<Array<ScheduledTask & { isRunning: boolean }>> {
    const tasks = await ScheduledTask.query().orderBy('name', 'asc')
    return tasks.map((task) => {
      const runner = this.runners.get(task.type)
      return Object.assign(task, { isRunning: runner?.running ?? false })
    })
  }
}

export const taskScheduler = new TaskScheduler()
