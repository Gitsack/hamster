import { test } from '@japa/runner'
import { NotificationService } from '../../../app/services/notifications/notification_service.js'

const service = new NotificationService()

test.group('NotificationService | createPayload', () => {
  test('creates grab event payload', ({ assert }) => {
    const payload = service.createPayload('grab', {
      mediaTitle: 'The Matrix',
      releaseTitle: 'The.Matrix.1999.1080p.BluRay',
      indexer: 'NZBgeek',
      mediaType: 'movies',
    })
    assert.equal(payload.title, 'Grabbed: The Matrix')
    assert.include(payload.message, 'The.Matrix.1999.1080p.BluRay')
    assert.include(payload.message, 'NZBgeek')
    assert.equal(payload.mediaType, 'movies')
  })

  test('creates grab payload with defaults for missing data', ({ assert }) => {
    const payload = service.createPayload('grab', {
      mediaTitle: 'The Matrix',
    })
    assert.include(payload.message, 'Unknown release')
    assert.include(payload.message, 'Unknown indexer')
  })

  test('creates download.completed event payload', ({ assert }) => {
    const payload = service.createPayload('download.completed', {
      mediaTitle: 'The Matrix',
      releaseTitle: 'The.Matrix.1999.1080p',
    })
    assert.equal(payload.title, 'Download Complete: The Matrix')
    assert.include(payload.message, 'finished downloading')
  })

  test('creates import.completed event payload', ({ assert }) => {
    const payload = service.createPayload('import.completed', {
      mediaTitle: 'The Matrix',
      quality: '1080p BluRay',
    })
    assert.equal(payload.title, 'Imported: The Matrix')
    assert.include(payload.message, '1080p BluRay')
  })

  test('creates import.failed event payload', ({ assert }) => {
    const payload = service.createPayload('import.failed', {
      mediaTitle: 'The Matrix',
      errorMessage: 'Disk full',
    })
    assert.equal(payload.title, 'Import Failed: The Matrix')
    assert.equal(payload.message, 'Disk full')
  })

  test('creates upgrade event payload', ({ assert }) => {
    const payload = service.createPayload('upgrade', {
      mediaTitle: 'The Matrix',
      quality: 'Bluray 1080p',
    })
    assert.equal(payload.title, 'Upgraded: The Matrix')
    assert.include(payload.message, 'Bluray 1080p')
  })

  test('creates health.issue event payload', ({ assert }) => {
    const payload = service.createPayload('health.issue', {
      errorMessage: 'Download client unreachable',
    })
    assert.equal(payload.title, 'Health Issue Detected')
    assert.equal(payload.message, 'Download client unreachable')
  })

  test('creates health.restored event payload', ({ assert }) => {
    const payload = service.createPayload('health.restored', {
      errorMessage: 'Download client is back online',
    })
    assert.equal(payload.title, 'Health Restored')
    assert.equal(payload.message, 'Download client is back online')
  })

  test('creates default payload for unknown event', ({ assert }) => {
    const payload = service.createPayload('rename' as any, {
      mediaTitle: 'Some Media',
    })
    assert.include(payload.title, 'rename')
    assert.equal(payload.message, 'Some Media')
  })

  test('includes imageUrl from data', ({ assert }) => {
    const payload = service.createPayload('grab', {
      mediaTitle: 'Movie',
      imageUrl: 'https://example.com/poster.jpg',
    })
    assert.equal(payload.imageUrl, 'https://example.com/poster.jpg')
  })

  test('includes mediaType from data', ({ assert }) => {
    const payload = service.createPayload('grab', {
      mediaTitle: 'Album',
      mediaType: 'music',
    })
    assert.equal(payload.mediaType, 'music')
  })
})
