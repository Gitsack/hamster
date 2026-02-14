import type { HttpContext } from '@adonisjs/core/http'
import { taskScheduler } from '#services/tasks/task_scheduler'

export default class ScheduledTasksController {
  /**
   * List all scheduled tasks with their current status
   */
  async index({ response }: HttpContext) {
    const tasks = await taskScheduler.getAllTasks()

    return response.json({
      tasks: tasks.map((task) => ({
        id: task.id,
        name: task.name,
        type: task.type,
        intervalMinutes: task.intervalMinutes,
        enabled: task.enabled,
        isRunning: task.isRunning,
        lastRunAt: task.lastRunAt?.toISO() || null,
        nextRunAt: task.nextRunAt?.toISO() || null,
        lastDurationMs: task.lastDurationMs,
      })),
    })
  }

  /**
   * Update a scheduled task (interval, enable/disable)
   */
  async update({ params, request, response }: HttpContext) {
    const { intervalMinutes, enabled } = request.only(['intervalMinutes', 'enabled'])

    // Validate interval
    if (intervalMinutes !== undefined) {
      if (typeof intervalMinutes !== 'number' || intervalMinutes < 1 || intervalMinutes > 43200) {
        return response.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'intervalMinutes must be between 1 and 43200',
          },
        })
      }
    }

    const task = await taskScheduler.updateTask(params.id, { intervalMinutes, enabled })

    if (!task) {
      return response.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      })
    }

    const tasks = await taskScheduler.getAllTasks()
    const updatedTask = tasks.find((t) => t.id === task.id)

    return response.json({
      task: {
        id: task.id,
        name: task.name,
        type: task.type,
        intervalMinutes: task.intervalMinutes,
        enabled: task.enabled,
        isRunning: updatedTask?.isRunning || false,
        lastRunAt: task.lastRunAt?.toISO() || null,
        nextRunAt: task.nextRunAt?.toISO() || null,
        lastDurationMs: task.lastDurationMs,
      },
    })
  }

  /**
   * Trigger an immediate run of a task
   */
  async run({ params, response }: HttpContext) {
    const result = await taskScheduler.triggerTask(params.id)

    if (!result.success) {
      return response.status(result.error === 'Task not found' ? 404 : 409).json({
        error: {
          code: result.error === 'Task not found' ? 'NOT_FOUND' : 'CONFLICT',
          message: result.error,
        },
      })
    }

    return response.json({ message: 'Task triggered successfully' })
  }
}
