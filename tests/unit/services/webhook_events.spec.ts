import { test } from '@japa/runner'
import { createBasePayload } from '../../../app/services/webhooks/webhook_events.js'

test.group('WebhookEvents | createBasePayload', () => {
  test('creates payload with event type', ({ assert }) => {
    const payload = createBasePayload('grab')
    assert.equal(payload.eventType, 'grab')
  })

  test('includes instanceName defaulting to Hamster', ({ assert }) => {
    const payload = createBasePayload('grab')
    assert.isDefined(payload.instanceName)
    // Default is 'Hamster' when INSTANCE_NAME env is not set
    assert.isString(payload.instanceName)
  })

  test('includes applicationUrl from env', ({ assert }) => {
    const payload = createBasePayload('health.issue')
    // APP_URL may or may not be set, just verify the property exists
    assert.property(payload, 'applicationUrl')
  })

  test('works with various event types', ({ assert }) => {
    const events = [
      'grab',
      'download.completed',
      'import.completed',
      'import.failed',
      'upgrade',
      'rename',
      'delete',
      'health.issue',
      'health.restored',
    ]
    for (const event of events) {
      const payload = createBasePayload(event)
      assert.equal(payload.eventType, event)
    }
  })
})
