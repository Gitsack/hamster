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

const DEFAULT_TASKS: DefaultTask[] = [
  { name: 'Download Monitor', type: 'download_monitor', intervalMinutes: 1, enabled: true },
  {
    name: 'Completed Downloads Scanner',
    type: 'completed_scanner',
    intervalMinutes: 5,
    enabled: true,
  },
  { name: 'Requested Items Search', type: 'requested_search', intervalMinutes: 60, enabled: true },
  { name: 'RSS Sync', type: 'rss_sync', intervalMinutes: 15, enabled: true },
  { name: 'Backup', type: 'backup', intervalMinutes: 1440, enabled: true },
  { name: 'Blacklist Cleanup', type: 'cleanup', intervalMinutes: 1440, enabled: true },
]

class TaskScheduler {
  private runners = new Map<TaskType, TaskRunner>()
  private timers = new Map<TaskType, NodeJS.Timeout>()
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

    // Load all tasks and start them
    const tasks = await ScheduledTask.query().where('enabled', true)
    for (const task of tasks) {
      this.scheduleTask(task)
    }

    console.log(`[TaskScheduler] Started ${tasks.length} scheduled tasks`)
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    for (const [type, timer] of this.timers) {
      clearInterval(timer)
      const runner = this.runners.get(type)
      if (runner) {
        runner.stop()
      }
    }
    this.timers.clear()
    this.started = false
    console.log('[TaskScheduler] All tasks stopped')
  }

  /**
   * Schedule a single task based on its DB configuration
   */
  private scheduleTask(task: ScheduledTask) {
    const runner = this.runners.get(task.type)
    if (!runner) {
      console.log(`[TaskScheduler] No runner registered for task type: ${task.type}`)
      return
    }

    // Clear any existing timer for this task type
    const existingTimer = this.timers.get(task.type)
    if (existingTimer) {
      clearInterval(existingTimer)
    }

    const intervalMs = task.intervalMinutes * 60 * 1000

    // Schedule the task
    const timer = setInterval(() => {
      this.executeTask(task.type).catch((err) => {
        console.error(`[TaskScheduler] Error executing ${task.type}:`, err)
      })
    }, intervalMs)

    this.timers.set(task.type, timer)

    // Run immediately if next_run_at is in the past or null
    if (!task.nextRunAt || task.nextRunAt <= DateTime.now()) {
      // Slight delay to avoid thundering herd at startup
      const delay = this.getStartupDelay(task.type)
      setTimeout(() => {
        this.executeTask(task.type).catch((err) => {
          console.error(`[TaskScheduler] Error executing ${task.type} on startup:`, err)
        })
      }, delay)
    }
  }

  /**
   * Get a staggered startup delay to avoid all tasks running at once
   */
  private getStartupDelay(type: TaskType): number {
    const delays: Record<string, number> = {
      download_monitor: 5000,
      completed_scanner: 10000,
      requested_search: 20000,
      rss_sync: 30000,
      cleanup: 45000,
      backup: 60000,
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

    if (runner.running) {
      return
    }

    const task = await ScheduledTask.query().where('type', type).first()
    if (!task || !task.enabled) {
      return
    }

    const startTime = Date.now()
    task.lastRunAt = DateTime.now()
    await task.save()

    try {
      await runner.run()
    } catch (err) {
      console.error(`[TaskScheduler] Task ${type} failed:`, err)
    } finally {
      const duration = Date.now() - startTime
      task.lastDurationMs = duration
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

    if (runner.running) {
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

    // Reschedule: clear existing timer
    const existingTimer = this.timers.get(task.type)
    if (existingTimer) {
      clearInterval(existingTimer)
      this.timers.delete(task.type)
    }

    // Restart if enabled
    if (task.enabled) {
      this.scheduleTask(task)
    }

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
