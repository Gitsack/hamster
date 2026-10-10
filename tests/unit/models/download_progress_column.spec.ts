import { test } from '@japa/runner'
import Download from '#models/download'

/**
 * progress is decimal(5,2), which the pg driver returns as a string. Base UI's
 * progress bar ignores a non-number value and draws the indicator at full
 * width, so a download at "61.00" showed a full bar under a "61%" label.
 */
test.group('Download progress column | consume', () => {
  const consume = Download.$getColumn('progress')!.consume!
  const row = {} as never

  test('turns the driver string into a number', ({ assert }) => {
    assert.strictEqual(consume('61.00', 'progress', row), 61)
    assert.strictEqual(consume('0.50', 'progress', row), 0.5)
  })

  test('keeps numbers and maps null to zero', ({ assert }) => {
    assert.strictEqual(consume(42, 'progress', row), 42)
    assert.strictEqual(consume(null, 'progress', row), 0)
  })
})
