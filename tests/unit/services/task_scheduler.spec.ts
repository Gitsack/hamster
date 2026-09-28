import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ScheduledTask from '#models/scheduled_task'
import { taskScheduler } from '#services/tasks/task_scheduler'

test.group('task_scheduler', () => {
  test('a task started twice back to back runs once', async ({ assert, cleanup }) => {
    const existing = await ScheduledTask.findBy('type', 'cleanup')
    const task =
      existing ??
      (await ScheduledTask.create({
        name: 'Blacklist Cleanup',
        type: 'cleanup',
        intervalMinutes: 1440,
        enabled: true,
        nextRunAt: DateTime.now(),
      }))
    const saved = { enabled: task.enabled, nextRunAt: task.nextRunAt }
    task.enabled = true
    await task.save()
    cleanup(async () => {
      if (!existing) return task.delete()
      Object.assign(task, saved)
      await task.save()
    })

    let runs = 0
    taskScheduler.register('cleanup', {
      start() {},
      stop() {},
      async run() {
        runs++
      },
      get running() {
        return false
      },
    })

    // The second call arrives while the first is still loading its row.
    await Promise.all([taskScheduler.executeTask('cleanup'), taskScheduler.executeTask('cleanup')])
    assert.equal(runs, 1)

    // Once finished, it can run again.
    await taskScheduler.executeTask('cleanup')
    assert.equal(runs, 2)
  })
})
