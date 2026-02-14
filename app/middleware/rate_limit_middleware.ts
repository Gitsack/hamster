import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * In-memory rate limiter using a Map with IP-based tracking.
 * Entries are automatically cleaned up on access to prevent memory leaks.
 */
const stores = new Map<string, Map<string, RateLimitEntry>>()

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name)
  if (!store) {
    store = new Map()
    stores.set(name, store)
  }
  return store
}

/**
 * Clean up expired entries from a store. Called periodically to prevent
 * unbounded memory growth.
 */
function cleanupStore(store: Map<string, RateLimitEntry>) {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}

// Run cleanup every 5 minutes
setInterval(
  () => {
    for (const store of stores.values()) {
      cleanupStore(store)
    }
  },
  5 * 60 * 1000
).unref()

export interface RateLimitOptions {
  /** Store name to isolate rate limit counters between different route groups */
  store: string
  /** Maximum number of requests allowed in the window */
  maxAttempts: number
  /** Window duration in seconds */
  windowSeconds: number
}

export default class RateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: RateLimitOptions) {
    const { store: storeName, maxAttempts, windowSeconds } = options

    const store = getStore(storeName)
    const key = this.getKey(ctx)
    const now = Date.now()
    const windowMs = windowSeconds * 1000

    let entry = store.get(key)

    // Reset if window has expired
    if (entry && now >= entry.resetAt) {
      store.delete(key)
      entry = undefined
    }

    if (!entry) {
      entry = { count: 0, resetAt: now + windowMs }
      store.set(key, entry)
    }

    entry.count++

    const remaining = Math.max(0, maxAttempts - entry.count)
    const resetAtSeconds = Math.ceil(entry.resetAt / 1000)

    // Set rate limit headers
    ctx.response.header('X-RateLimit-Limit', String(maxAttempts))
    ctx.response.header('X-RateLimit-Remaining', String(remaining))
    ctx.response.header('X-RateLimit-Reset', String(resetAtSeconds))

    if (entry.count > maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      ctx.response.header('Retry-After', String(retryAfter))
      ctx.response.tooManyRequests({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
      })
      return
    }

    return next()
  }

  private getKey(ctx: HttpContext): string {
    // Use authenticated user ID if available, otherwise fall back to IP
    const userId = ctx.auth?.user?.id
    if (userId) {
      return `user:${userId}`
    }
    return `ip:${ctx.request.ip()}`
  }
}
