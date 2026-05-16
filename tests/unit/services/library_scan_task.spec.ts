import { test } from '@japa/runner'
import { libraryScanTask } from '#services/tasks/library_scan_task'

test.group('LibraryScanTask | TaskRunner interface', () => {
  test('exposes running getter', ({ assert }) => {
    assert.isFalse(libraryScanTask.running)
  })

  test('start/stop are no-ops without throwing', ({ assert }) => {
    libraryScanTask.start(240)
    libraryScanTask.stop()
    assert.isFalse(libraryScanTask.running)
  })

  test('single-flight: second concurrent run returns immediately', async ({ assert }) => {
    // Both runs return without error. The second is a no-op via the
    // isRunning guard. With no root folders configured the first run
    // also finishes near-instantly, but the lock still serializes them.
    const [a, b] = await Promise.all([libraryScanTask.run(), libraryScanTask.run()])
    assert.isUndefined(a)
    assert.isUndefined(b)
    assert.isFalse(libraryScanTask.running)
  })
})
