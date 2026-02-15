import { test } from '@japa/runner'
import { CacheService, CACHE_TTL } from '../../../app/services/cache/cache_service.js'

test.group('CacheService | set and get', () => {
  test('stores and retrieves a string value', ({ assert }) => {
    const cache = new CacheService()
    cache.set('key1', 'hello', 10_000)
    assert.equal(cache.get<string>('key1'), 'hello')
  })

  test('stores and retrieves an object value', ({ assert }) => {
    const cache = new CacheService()
    const obj = { name: 'test', count: 42 }
    cache.set('obj', obj, 10_000)
    assert.deepEqual(cache.get('obj'), obj)
  })

  test('stores and retrieves a numeric value', ({ assert }) => {
    const cache = new CacheService()
    cache.set('num', 123, 10_000)
    assert.equal(cache.get<number>('num'), 123)
  })

  test('stores and retrieves a boolean value', ({ assert }) => {
    const cache = new CacheService()
    cache.set('flag', true, 10_000)
    assert.isTrue(cache.get<boolean>('flag'))
  })

  test('returns undefined for non-existent key', ({ assert }) => {
    const cache = new CacheService()
    assert.isUndefined(cache.get('nonexistent'))
  })

  test('overwrites existing value with same key', ({ assert }) => {
    const cache = new CacheService()
    cache.set('key', 'first', 10_000)
    cache.set('key', 'second', 10_000)
    assert.equal(cache.get<string>('key'), 'second')
  })

  test('stores null as a value (but get returns it as undefined-like)', ({ assert }) => {
    const cache = new CacheService()
    cache.set('nullkey', null, 10_000)
    // null is stored, get returns it
    assert.isNull(cache.get('nullkey'))
  })
})

test.group('CacheService | TTL expiration', () => {
  test('returns undefined for expired entries', ({ assert }) => {
    const cache = new CacheService()
    // Set with a negative TTL so expiresAt is in the past
    cache.set('expired', 'value', -1)
    assert.isUndefined(cache.get('expired'))
  })

  test('entry is available before TTL expires', ({ assert }) => {
    const cache = new CacheService()
    cache.set('alive', 'value', 60_000)
    assert.equal(cache.get<string>('alive'), 'value')
  })

  test('expired entry is removed from store on get', ({ assert }) => {
    const cache = new CacheService()
    cache.set('temp', 'value', -1)
    // First get should find it expired and delete it
    cache.get('temp')
    assert.equal(cache.size, 0)
  })
})

test.group('CacheService | has', () => {
  test('returns true for existing non-expired key', ({ assert }) => {
    const cache = new CacheService()
    cache.set('exists', 'value', 10_000)
    assert.isTrue(cache.has('exists'))
  })

  test('returns false for non-existent key', ({ assert }) => {
    const cache = new CacheService()
    assert.isFalse(cache.has('missing'))
  })

  test('returns false for expired key', ({ assert }) => {
    const cache = new CacheService()
    cache.set('expired', 'value', -1)
    assert.isFalse(cache.has('expired'))
  })
})

test.group('CacheService | delete', () => {
  test('removes an existing key', ({ assert }) => {
    const cache = new CacheService()
    cache.set('key', 'value', 10_000)
    const result = cache.delete('key')
    assert.isTrue(result)
    assert.isUndefined(cache.get('key'))
  })

  test('returns false when deleting non-existent key', ({ assert }) => {
    const cache = new CacheService()
    const result = cache.delete('nonexistent')
    assert.isFalse(result)
  })

  test('does not affect other keys', ({ assert }) => {
    const cache = new CacheService()
    cache.set('a', 1, 10_000)
    cache.set('b', 2, 10_000)
    cache.delete('a')
    assert.equal(cache.get<number>('b'), 2)
  })
})

test.group('CacheService | clear', () => {
  test('removes all entries', ({ assert }) => {
    const cache = new CacheService()
    cache.set('a', 1, 10_000)
    cache.set('b', 2, 10_000)
    cache.set('c', 3, 10_000)
    cache.clear()
    assert.equal(cache.size, 0)
    assert.isUndefined(cache.get('a'))
    assert.isUndefined(cache.get('b'))
    assert.isUndefined(cache.get('c'))
  })

  test('clear on empty cache does not throw', ({ assert }) => {
    const cache = new CacheService()
    cache.clear()
    assert.equal(cache.size, 0)
  })
})

test.group('CacheService | size', () => {
  test('returns 0 for empty cache', ({ assert }) => {
    const cache = new CacheService()
    assert.equal(cache.size, 0)
  })

  test('returns correct count after adding entries', ({ assert }) => {
    const cache = new CacheService()
    cache.set('a', 1, 10_000)
    cache.set('b', 2, 10_000)
    assert.equal(cache.size, 2)
  })

  test('does not increase when overwriting same key', ({ assert }) => {
    const cache = new CacheService()
    cache.set('key', 1, 10_000)
    cache.set('key', 2, 10_000)
    assert.equal(cache.size, 1)
  })

  test('decreases after delete', ({ assert }) => {
    const cache = new CacheService()
    cache.set('a', 1, 10_000)
    cache.set('b', 2, 10_000)
    cache.delete('a')
    assert.equal(cache.size, 1)
  })
})

test.group('CacheService | getOrSet', () => {
  test('calls factory and caches result when key does not exist', async ({ assert }) => {
    const cache = new CacheService()
    let factoryCalled = 0
    const result = await cache.getOrSet('key', 10_000, async () => {
      factoryCalled++
      return 'computed'
    })
    assert.equal(result, 'computed')
    assert.equal(factoryCalled, 1)
    assert.equal(cache.get<string>('key'), 'computed')
  })

  test('returns cached value without calling factory', async ({ assert }) => {
    const cache = new CacheService()
    cache.set('key', 'existing', 10_000)
    let factoryCalled = 0
    const result = await cache.getOrSet('key', 10_000, async () => {
      factoryCalled++
      return 'new-value'
    })
    assert.equal(result, 'existing')
    assert.equal(factoryCalled, 0)
  })

  test('calls factory when cached value has expired', async ({ assert }) => {
    const cache = new CacheService()
    cache.set('key', 'old', -1) // Expires immediately (negative TTL)
    const result = await cache.getOrSet('key', 10_000, async () => 'fresh')
    assert.equal(result, 'fresh')
  })

  test('caches factory result with provided TTL', async ({ assert }) => {
    const cache = new CacheService()
    await cache.getOrSet('key', 60_000, async () => 'value')
    // Should still be available
    assert.equal(cache.get<string>('key'), 'value')
  })

  test('handles async factory that returns an object', async ({ assert }) => {
    const cache = new CacheService()
    const result = await cache.getOrSet('data', 10_000, async () => ({
      items: [1, 2, 3],
      total: 3,
    }))
    assert.deepEqual(result, { items: [1, 2, 3], total: 3 })
  })
})

test.group('CacheService | CACHE_TTL constants', () => {
  test('METADATA is 1 hour in milliseconds', ({ assert }) => {
    assert.equal(CACHE_TTL.METADATA, 3_600_000)
  })

  test('SHORT is 5 minutes in milliseconds', ({ assert }) => {
    assert.equal(CACHE_TTL.SHORT, 300_000)
  })

  test('VERY_SHORT is 30 seconds in milliseconds', ({ assert }) => {
    assert.equal(CACHE_TTL.VERY_SHORT, 30_000)
  })
})
