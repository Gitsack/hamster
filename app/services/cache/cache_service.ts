/**
 * Simple TTL-based in-memory cache service.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class CacheService {
  private store = new Map<string, CacheEntry<unknown>>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Periodically clean up expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
    // Allow the process to exit without waiting for cleanup
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Get a cached value. Returns undefined if not found or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }

    return entry.value
  }

  /**
   * Set a value in the cache with a TTL in milliseconds.
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  /**
   * Delete a specific key.
   */
  delete(key: string): boolean {
    return this.store.delete(key)
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Get the number of entries (including expired ones until next cleanup).
   */
  get size(): number {
    return this.store.size
  }

  /**
   * Get or set a cached value. If the key doesn't exist or is expired,
   * the factory function is called to produce the value.
   */
  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== undefined) return cached

    const value = await factory()
    this.set(key, value, ttlMs)
    return value
  }

  /**
   * Remove all expired entries.
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }
}

/** Shared cache instance */
export const cache = new CacheService()

/** Common TTL constants */
export const CACHE_TTL = {
  /** 1 hour - for external metadata API responses */
  METADATA: 60 * 60 * 1000,
  /** 5 minutes - for frequently changing data like quality profiles */
  SHORT: 5 * 60 * 1000,
  /** 30 seconds - for very short-lived data */
  VERY_SHORT: 30 * 1000,
} as const
