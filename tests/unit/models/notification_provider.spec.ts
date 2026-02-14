import { test } from '@japa/runner'

type NotificationEvent =
  | 'grab'
  | 'download.completed'
  | 'import.completed'
  | 'import.failed'
  | 'upgrade'
  | 'rename'
  | 'delete'
  | 'health.issue'
  | 'health.restored'

type MediaType = 'music' | 'movies' | 'tv' | 'books'

// Replicate shouldNotify logic for pure function testing without DB
function shouldNotify(
  provider: {
    enabled: boolean
    includeMusic: boolean
    includeMovies: boolean
    includeTv: boolean
    includeBooks: boolean
    onGrab: boolean
    onDownloadComplete: boolean
    onImportComplete: boolean
    onImportFailed: boolean
    onUpgrade: boolean
    onRename: boolean
    onDelete: boolean
    onHealthIssue: boolean
    onHealthRestored: boolean
  },
  event: NotificationEvent,
  mediaType?: MediaType
): boolean {
  if (!provider.enabled) return false

  // Check media type filter
  if (mediaType) {
    switch (mediaType) {
      case 'music':
        if (!provider.includeMusic) return false
        break
      case 'movies':
        if (!provider.includeMovies) return false
        break
      case 'tv':
        if (!provider.includeTv) return false
        break
      case 'books':
        if (!provider.includeBooks) return false
        break
    }
  }

  switch (event) {
    case 'grab':
      return provider.onGrab
    case 'download.completed':
      return provider.onDownloadComplete
    case 'import.completed':
      return provider.onImportComplete
    case 'import.failed':
      return provider.onImportFailed
    case 'upgrade':
      return provider.onUpgrade
    case 'rename':
      return provider.onRename
    case 'delete':
      return provider.onDelete
    case 'health.issue':
      return provider.onHealthIssue
    case 'health.restored':
      return provider.onHealthRestored
    default:
      return false
  }
}

function createProvider(overrides: Partial<Parameters<typeof shouldNotify>[0]> = {}) {
  return {
    enabled: true,
    includeMusic: true,
    includeMovies: true,
    includeTv: true,
    includeBooks: true,
    onGrab: false,
    onDownloadComplete: false,
    onImportComplete: false,
    onImportFailed: false,
    onUpgrade: false,
    onRename: false,
    onDelete: false,
    onHealthIssue: false,
    onHealthRestored: false,
    ...overrides,
  }
}

test.group('NotificationProvider | shouldNotify - basic', () => {
  test('returns false when provider is disabled', ({ assert }) => {
    const provider = createProvider({ enabled: false, onGrab: true })
    assert.isFalse(shouldNotify(provider, 'grab'))
  })

  test('returns true for grab when onGrab is true', ({ assert }) => {
    const provider = createProvider({ onGrab: true })
    assert.isTrue(shouldNotify(provider, 'grab'))
  })

  test('returns false for grab when onGrab is false', ({ assert }) => {
    const provider = createProvider({ onGrab: false })
    assert.isFalse(shouldNotify(provider, 'grab'))
  })

  test('returns true for download.completed', ({ assert }) => {
    const provider = createProvider({ onDownloadComplete: true })
    assert.isTrue(shouldNotify(provider, 'download.completed'))
  })

  test('returns true for import.completed', ({ assert }) => {
    const provider = createProvider({ onImportComplete: true })
    assert.isTrue(shouldNotify(provider, 'import.completed'))
  })

  test('returns true for import.failed', ({ assert }) => {
    const provider = createProvider({ onImportFailed: true })
    assert.isTrue(shouldNotify(provider, 'import.failed'))
  })

  test('returns true for upgrade', ({ assert }) => {
    const provider = createProvider({ onUpgrade: true })
    assert.isTrue(shouldNotify(provider, 'upgrade'))
  })

  test('returns true for rename', ({ assert }) => {
    const provider = createProvider({ onRename: true })
    assert.isTrue(shouldNotify(provider, 'rename'))
  })

  test('returns true for delete', ({ assert }) => {
    const provider = createProvider({ onDelete: true })
    assert.isTrue(shouldNotify(provider, 'delete'))
  })

  test('returns true for health.issue', ({ assert }) => {
    const provider = createProvider({ onHealthIssue: true })
    assert.isTrue(shouldNotify(provider, 'health.issue'))
  })

  test('returns true for health.restored', ({ assert }) => {
    const provider = createProvider({ onHealthRestored: true })
    assert.isTrue(shouldNotify(provider, 'health.restored'))
  })

  test('returns false for unknown event', ({ assert }) => {
    const provider = createProvider({ onGrab: true })
    assert.isFalse(shouldNotify(provider, 'unknown.event' as NotificationEvent))
  })
})

test.group('NotificationProvider | shouldNotify - media type filtering', () => {
  test('allows notification without media type filter', ({ assert }) => {
    const provider = createProvider({ onGrab: true })
    assert.isTrue(shouldNotify(provider, 'grab'))
  })

  test('allows notification when media type is included', ({ assert }) => {
    const provider = createProvider({ onGrab: true, includeMovies: true })
    assert.isTrue(shouldNotify(provider, 'grab', 'movies'))
  })

  test('blocks notification when movies not included', ({ assert }) => {
    const provider = createProvider({ onGrab: true, includeMovies: false })
    assert.isFalse(shouldNotify(provider, 'grab', 'movies'))
  })

  test('blocks notification when music not included', ({ assert }) => {
    const provider = createProvider({ onGrab: true, includeMusic: false })
    assert.isFalse(shouldNotify(provider, 'grab', 'music'))
  })

  test('blocks notification when tv not included', ({ assert }) => {
    const provider = createProvider({ onGrab: true, includeTv: false })
    assert.isFalse(shouldNotify(provider, 'grab', 'tv'))
  })

  test('blocks notification when books not included', ({ assert }) => {
    const provider = createProvider({ onGrab: true, includeBooks: false })
    assert.isFalse(shouldNotify(provider, 'grab', 'books'))
  })

  test('health events work without media type', ({ assert }) => {
    const provider = createProvider({
      onHealthIssue: true,
      includeMovies: false,
      includeMusic: false,
      includeTv: false,
      includeBooks: false,
    })
    // Health events typically have no media type
    assert.isTrue(shouldNotify(provider, 'health.issue'))
  })

  test('selective media type filtering works', ({ assert }) => {
    const provider = createProvider({
      onGrab: true,
      includeMovies: true,
      includeMusic: false,
      includeTv: true,
      includeBooks: false,
    })
    assert.isTrue(shouldNotify(provider, 'grab', 'movies'))
    assert.isFalse(shouldNotify(provider, 'grab', 'music'))
    assert.isTrue(shouldNotify(provider, 'grab', 'tv'))
    assert.isFalse(shouldNotify(provider, 'grab', 'books'))
  })
})
