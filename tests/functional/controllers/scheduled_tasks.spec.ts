import { test } from '@japa/runner'
import ScheduledTasksController from '#controllers/scheduled_tasks_controller'
import { taskScheduler } from '#services/tasks/task_scheduler'

test.group('ScheduledTasksController', () => {
  // ---- index ----

  test('index returns list of scheduled tasks', async ({ assert }) => {
    const controller = new ScheduledTasksController()
    let result: Record<string, unknown> = {}

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'tasks')
    assert.isArray(result.tasks)
  })

  test('index returns tasks with expected shape', async ({ assert }) => {
    const controller = new ScheduledTasksController()
    let result: Record<string, unknown> = {}

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const tasks = result.tasks as any[]
    if (tasks.length > 0) {
      const task = tasks[0]
      assert.property(task, 'id')
      assert.property(task, 'name')
      assert.property(task, 'type')
      assert.property(task, 'intervalMinutes')
      assert.property(task, 'enabled')
      assert.property(task, 'isRunning')
      assert.property(task, 'lastRunAt')
      assert.property(task, 'nextRunAt')
      assert.property(task, 'lastDurationMs')
    }
  })

  // ---- update ----

  test('update returns 422 for invalid intervalMinutes (too low)', async ({ assert }) => {
    const controller = new ScheduledTasksController()
    let statusCode = 0
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: 'some-task' },
      request: {
        only: () => ({ intervalMinutes: 0, enabled: undefined }),
      },
      response: {
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json() {},
      },
    } as never)

    assert.equal(statusCode, 422)
    const error = result.error as Record<string, string>
    assert.equal(error.code, 'VALIDATION_ERROR')
  })

  test('update returns 422 for invalid intervalMinutes (too high)', async ({ assert }) => {
    const controller = new ScheduledTasksController()
    let statusCode = 0
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: 'some-task' },
      request: {
        only: () => ({ intervalMinutes: 99999, enabled: undefined }),
      },
      response: {
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json() {},
      },
    } as never)

    assert.equal(statusCode, 422)
    const error = result.error as Record<string, string>
    assert.equal(error.code, 'VALIDATION_ERROR')
  })

  test('update returns 422 for non-number intervalMinutes', async ({ assert }) => {
    const controller = new ScheduledTasksController()
    let statusCode = 0
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: 'some-task' },
      request: {
        only: () => ({ intervalMinutes: 'abc', enabled: undefined }),
      },
      response: {
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json() {},
      },
    } as never)

    assert.equal(statusCode, 422)
  })

  test('update returns 404 for non-existent task', async ({ assert }) => {
    const controller = new ScheduledTasksController()
    let statusCode = 0
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: 'non-existent-task-id' },
      request: {
        only: () => ({ intervalMinutes: undefined, enabled: true }),
      },
      response: {
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json() {},
      },
    } as never)

    assert.equal(statusCode, 404)
    const error = result.error as Record<string, string>
    assert.equal(error.code, 'NOT_FOUND')
  })

  // ---- run ----

  test('run returns 404 for non-existent task', async ({ assert }) => {
    const controller = new ScheduledTasksController()
    let statusCode = 0
    let result: Record<string, unknown> = {}

    await controller.run({
      params: { id: 'non-existent-task-id' },
      response: {
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    // Should be 404 since the task doesn't exist
    assert.equal(statusCode, 404)
    const error = result.error as Record<string, string>
    assert.equal(error.code, 'NOT_FOUND')
  })

  test('run with valid task returns success or conflict', async ({ assert }) => {
    // Get existing tasks to try running one
    const tasks = await taskScheduler.getAllTasks()
    if (tasks.length === 0) {
      // Skip if no tasks registered
      return
    }

    const taskId = tasks[0].id
    const controller = new ScheduledTasksController()
    let statusCode = 0
    let result: Record<string, unknown> = {}

    await controller.run({
      params: { id: taskId },
      response: {
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    // Either success (200) or conflict (409 if already running)
    assert.isTrue(statusCode === 0 || statusCode === 409)
    if (statusCode === 0) {
      assert.property(result, 'message')
    } else {
      assert.property(result, 'error')
    }
  })
})
