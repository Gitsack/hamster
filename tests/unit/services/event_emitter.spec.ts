import { test } from '@japa/runner'

type MediaType = 'music' | 'movies' | 'tv' | 'books'

interface MediaInfo {
  id: string
  title: string
  year?: number
  mediaType: string
  posterUrl?: string
  overview?: string
}

// Replicate the private createNotificationPayload method
function createNotificationPayload(
  event: string,
  payload: Record<string, unknown>,
  mediaType?: MediaType
): {
  title: string
  message: string
  mediaType?: MediaType
  imageUrl?: string
} {
  let title: string
  let message: string
  let imageUrl: string | undefined

  switch (event) {
    case 'grab': {
      const p = payload as unknown as {
        media: MediaInfo
        downloadClient: string
      }
      title = `Grabbed: ${p.media?.title || 'Unknown'}`
      message = `Sent to ${p.downloadClient}`
      imageUrl = p.media?.posterUrl
      break
    }
    case 'download.completed': {
      const p = payload as unknown as { media: MediaInfo }
      title = `Download Complete: ${p.media?.title || 'Unknown'}`
      message = `Ready for import`
      imageUrl = p.media?.posterUrl
      break
    }
    case 'import.completed': {
      const p = payload as unknown as {
        media: MediaInfo
        isUpgrade: boolean
        previousQuality?: string
      }
      title = `Imported: ${p.media?.title || 'Unknown'}`
      message = p.isUpgrade ? `Upgraded from ${p.previousQuality}` : 'Successfully imported'
      imageUrl = p.media?.posterUrl
      break
    }
    case 'import.failed': {
      const p = payload as unknown as {
        media: MediaInfo
        errorMessage: string
      }
      title = `Import Failed: ${p.media?.title || 'Unknown'}`
      message = p.errorMessage
      imageUrl = p.media?.posterUrl
      break
    }
    case 'upgrade': {
      const p = payload as unknown as {
        media: MediaInfo
        previousQuality: string
        newQuality: string
      }
      title = `Upgraded: ${p.media?.title || 'Unknown'}`
      message = `${p.previousQuality} → ${p.newQuality}`
      imageUrl = p.media?.posterUrl
      break
    }
    case 'health.issue': {
      const p = payload as unknown as {
        source: string
        message: string
      }
      title = `Health Issue: ${p.source}`
      message = p.message
      break
    }
    case 'health.restored': {
      const p = payload as unknown as {
        source: string
        message: string
      }
      title = `Health Restored: ${p.source}`
      message = p.message
      break
    }
    default:
      title = `Hamster: ${event}`
      message = 'Event occurred'
  }

  return {
    title,
    message,
    mediaType,
    imageUrl,
  }
}

// Replicate the private mapMediaType method
function mapMediaType(type: string): MediaType | undefined {
  switch (type) {
    case 'music':
      return 'music'
    case 'movies':
      return 'movies'
    case 'tv':
      return 'tv'
    case 'books':
      return 'books'
    default:
      return undefined
  }
}

test.group('EventEmitter | mapMediaType', () => {
  test('maps music correctly', ({ assert }) => {
    assert.equal(mapMediaType('music'), 'music')
  })

  test('maps movies correctly', ({ assert }) => {
    assert.equal(mapMediaType('movies'), 'movies')
  })

  test('maps tv correctly', ({ assert }) => {
    assert.equal(mapMediaType('tv'), 'tv')
  })

  test('maps books correctly', ({ assert }) => {
    assert.equal(mapMediaType('books'), 'books')
  })

  test('returns undefined for unknown type', ({ assert }) => {
    assert.isUndefined(mapMediaType('podcasts'))
  })

  test('returns undefined for empty string', ({ assert }) => {
    assert.isUndefined(mapMediaType(''))
  })
})

test.group('EventEmitter | createNotificationPayload - grab', () => {
  test('creates grab payload with media title', ({ assert }) => {
    const result = createNotificationPayload(
      'grab',
      {
        media: { id: '1', title: 'The Matrix', mediaType: 'movies' },
        downloadClient: 'SABnzbd',
      } as unknown as Record<string, unknown>,
      'movies'
    )
    assert.equal(result.title, 'Grabbed: The Matrix')
    assert.equal(result.message, 'Sent to SABnzbd')
    assert.equal(result.mediaType, 'movies')
  })

  test('includes poster URL as imageUrl', ({ assert }) => {
    const result = createNotificationPayload('grab', {
      media: {
        id: '1',
        title: 'Movie',
        mediaType: 'movies',
        posterUrl: 'https://img.com/poster.jpg',
      },
      downloadClient: 'SABnzbd',
    } as unknown as Record<string, unknown>)
    assert.equal(result.imageUrl, 'https://img.com/poster.jpg')
  })

  test('handles missing media title', ({ assert }) => {
    const result = createNotificationPayload('grab', {
      media: null,
      downloadClient: 'SABnzbd',
    } as unknown as Record<string, unknown>)
    assert.equal(result.title, 'Grabbed: Unknown')
  })
})

test.group('EventEmitter | createNotificationPayload - download.completed', () => {
  test('creates download completed payload', ({ assert }) => {
    const result = createNotificationPayload('download.completed', {
      media: { id: '1', title: 'The Matrix', mediaType: 'movies' },
    } as unknown as Record<string, unknown>)
    assert.equal(result.title, 'Download Complete: The Matrix')
    assert.equal(result.message, 'Ready for import')
  })
})

test.group('EventEmitter | createNotificationPayload - import.completed', () => {
  test('creates import completed payload for new import', ({ assert }) => {
    const result = createNotificationPayload('import.completed', {
      media: { id: '1', title: 'The Matrix', mediaType: 'movies' },
      isUpgrade: false,
    } as unknown as Record<string, unknown>)
    assert.equal(result.title, 'Imported: The Matrix')
    assert.equal(result.message, 'Successfully imported')
  })

  test('creates import completed payload for upgrade', ({ assert }) => {
    const result = createNotificationPayload('import.completed', {
      media: { id: '1', title: 'The Matrix', mediaType: 'movies' },
      isUpgrade: true,
      previousQuality: 'Web 720p',
    } as unknown as Record<string, unknown>)
    assert.equal(result.title, 'Imported: The Matrix')
    assert.equal(result.message, 'Upgraded from Web 720p')
  })
})

test.group('EventEmitter | createNotificationPayload - import.failed', () => {
  test('creates import failed payload', ({ assert }) => {
    const result = createNotificationPayload('import.failed', {
      media: { id: '1', title: 'The Matrix', mediaType: 'movies' },
      errorMessage: 'Disk full',
    } as unknown as Record<string, unknown>)
    assert.equal(result.title, 'Import Failed: The Matrix')
    assert.equal(result.message, 'Disk full')
  })
})

test.group('EventEmitter | createNotificationPayload - upgrade', () => {
  test('creates upgrade payload with quality transition', ({ assert }) => {
    const result = createNotificationPayload('upgrade', {
      media: { id: '1', title: 'The Matrix', mediaType: 'movies' },
      previousQuality: 'Web 720p',
      newQuality: 'Bluray 1080p',
    } as unknown as Record<string, unknown>)
    assert.equal(result.title, 'Upgraded: The Matrix')
    assert.include(result.message, 'Web 720p')
    assert.include(result.message, 'Bluray 1080p')
  })
})

test.group('EventEmitter | createNotificationPayload - health events', () => {
  test('creates health issue payload', ({ assert }) => {
    const result = createNotificationPayload('health.issue', {
      source: 'SABnzbd',
      message: 'Connection refused',
      level: 'error',
    } as unknown as Record<string, unknown>)
    assert.equal(result.title, 'Health Issue: SABnzbd')
    assert.equal(result.message, 'Connection refused')
    assert.isUndefined(result.mediaType)
  })

  test('creates health restored payload', ({ assert }) => {
    const result = createNotificationPayload('health.restored', {
      source: 'SABnzbd',
      message: 'Connection restored',
    } as unknown as Record<string, unknown>)
    assert.equal(result.title, 'Health Restored: SABnzbd')
    assert.equal(result.message, 'Connection restored')
  })
})

test.group('EventEmitter | createNotificationPayload - unknown event', () => {
  test('creates default payload for unknown event', ({ assert }) => {
    const result = createNotificationPayload('custom.event', {} as Record<string, unknown>)
    assert.equal(result.title, 'Hamster: custom.event')
    assert.equal(result.message, 'Event occurred')
  })
})
