import { test } from '@japa/runner'

// Replicate shouldTrigger logic for pure function testing without DB
function shouldTrigger(
  webhook: {
    enabled: boolean
    onGrab: boolean
    onDownloadComplete: boolean
    onImportComplete: boolean
    onImportFailed: boolean
    onUpgrade: boolean
    onRename: boolean
    onDelete: boolean
    onHealthIssue: boolean
    onHealthRestored: boolean
    events: string[]
  },
  event: string
): boolean {
  if (!webhook.enabled) return false

  switch (event) {
    case 'grab':
      return webhook.onGrab
    case 'download.completed':
      return webhook.onDownloadComplete
    case 'import.completed':
      return webhook.onImportComplete
    case 'import.failed':
      return webhook.onImportFailed
    case 'upgrade':
      return webhook.onUpgrade
    case 'rename':
      return webhook.onRename
    case 'delete':
      return webhook.onDelete
    case 'health.issue':
      return webhook.onHealthIssue
    case 'health.restored':
      return webhook.onHealthRestored
    default:
      return webhook.events.includes(event)
  }
}

function createWebhook(overrides: Partial<Parameters<typeof shouldTrigger>[0]> = {}) {
  return {
    enabled: true,
    onGrab: false,
    onDownloadComplete: false,
    onImportComplete: false,
    onImportFailed: false,
    onUpgrade: false,
    onRename: false,
    onDelete: false,
    onHealthIssue: false,
    onHealthRestored: false,
    events: [],
    ...overrides,
  }
}

test.group('Webhook | shouldTrigger', () => {
  test('returns false when webhook is disabled', ({ assert }) => {
    const webhook = createWebhook({ enabled: false, onGrab: true })
    assert.isFalse(shouldTrigger(webhook, 'grab'))
  })

  test('triggers on grab when onGrab is true', ({ assert }) => {
    const webhook = createWebhook({ onGrab: true })
    assert.isTrue(shouldTrigger(webhook, 'grab'))
  })

  test('does not trigger on grab when onGrab is false', ({ assert }) => {
    const webhook = createWebhook({ onGrab: false })
    assert.isFalse(shouldTrigger(webhook, 'grab'))
  })

  test('triggers on download.completed when onDownloadComplete is true', ({ assert }) => {
    const webhook = createWebhook({ onDownloadComplete: true })
    assert.isTrue(shouldTrigger(webhook, 'download.completed'))
  })

  test('triggers on import.completed when onImportComplete is true', ({ assert }) => {
    const webhook = createWebhook({ onImportComplete: true })
    assert.isTrue(shouldTrigger(webhook, 'import.completed'))
  })

  test('triggers on import.failed when onImportFailed is true', ({ assert }) => {
    const webhook = createWebhook({ onImportFailed: true })
    assert.isTrue(shouldTrigger(webhook, 'import.failed'))
  })

  test('triggers on upgrade when onUpgrade is true', ({ assert }) => {
    const webhook = createWebhook({ onUpgrade: true })
    assert.isTrue(shouldTrigger(webhook, 'upgrade'))
  })

  test('triggers on rename when onRename is true', ({ assert }) => {
    const webhook = createWebhook({ onRename: true })
    assert.isTrue(shouldTrigger(webhook, 'rename'))
  })

  test('triggers on delete when onDelete is true', ({ assert }) => {
    const webhook = createWebhook({ onDelete: true })
    assert.isTrue(shouldTrigger(webhook, 'delete'))
  })

  test('triggers on health.issue when onHealthIssue is true', ({ assert }) => {
    const webhook = createWebhook({ onHealthIssue: true })
    assert.isTrue(shouldTrigger(webhook, 'health.issue'))
  })

  test('triggers on health.restored when onHealthRestored is true', ({ assert }) => {
    const webhook = createWebhook({ onHealthRestored: true })
    assert.isTrue(shouldTrigger(webhook, 'health.restored'))
  })

  test('unknown event falls back to events array', ({ assert }) => {
    const webhook = createWebhook({ events: ['custom.event'] })
    assert.isTrue(shouldTrigger(webhook, 'custom.event'))
  })

  test('unknown event not in events array returns false', ({ assert }) => {
    const webhook = createWebhook({ events: ['custom.event'] })
    assert.isFalse(shouldTrigger(webhook, 'other.event'))
  })

  test('all toggles enabled triggers all known events', ({ assert }) => {
    const webhook = createWebhook({
      onGrab: true,
      onDownloadComplete: true,
      onImportComplete: true,
      onImportFailed: true,
      onUpgrade: true,
      onRename: true,
      onDelete: true,
      onHealthIssue: true,
      onHealthRestored: true,
    })

    assert.isTrue(shouldTrigger(webhook, 'grab'))
    assert.isTrue(shouldTrigger(webhook, 'download.completed'))
    assert.isTrue(shouldTrigger(webhook, 'import.completed'))
    assert.isTrue(shouldTrigger(webhook, 'import.failed'))
    assert.isTrue(shouldTrigger(webhook, 'upgrade'))
    assert.isTrue(shouldTrigger(webhook, 'rename'))
    assert.isTrue(shouldTrigger(webhook, 'delete'))
    assert.isTrue(shouldTrigger(webhook, 'health.issue'))
    assert.isTrue(shouldTrigger(webhook, 'health.restored'))
  })
})
