import BlacklistedRelease, { type FailureType } from '#models/blacklisted_release'
import type { UnifiedSearchResult } from '#services/indexers/indexer_manager'
import { DateTime } from 'luxon'

const BLACKLIST_EXPIRY_DAYS = 30
const MAX_RETRIES = 3

export interface BlacklistEntry {
  guid: string
  indexer: string
  title: string
  movieId?: string | null
  episodeId?: string | null
  albumId?: string | null
  bookId?: string | null
  reason: string
  failureType: FailureType
}

// Failure patterns that should trigger blacklisting (SABnzbd/download failures)
const BLACKLISTABLE_PATTERNS: string[] = [
  'download failed',
  'failed',
  'extraction failed',
  'unpack failed',
  'crc error',
  'par2 failed',
  'verification failed',
  'repair failed',
  'missing articles',
  'incomplete',
  'aborted',
  'out of retention',
  'password protected',
  'encrypted',
  'damaged',
  'corrupt',
]

// Failure patterns that should NOT trigger blacklisting (usually config/path issues)
const NON_BLACKLISTABLE_PATTERNS: string[] = [
  'path not accessible',
  'not mounted',
  'remote path mapping',
  'permission denied',
  'disk full',
  'no space',
  'network storage',
  'file not found',
]

class BlacklistService {
  /**
   * Add a release to the blacklist
   */
  async blacklist(entry: BlacklistEntry): Promise<BlacklistedRelease> {
    // Check if already blacklisted (same guid + indexer combo)
    const existing = await BlacklistedRelease.query()
      .where('guid', entry.guid)
      .where('indexer', entry.indexer)
      .first()

    const now = DateTime.now()
    const expiresAt = now.plus({ days: BLACKLIST_EXPIRY_DAYS })

    if (existing) {
      // Update existing entry
      existing.reason = entry.reason
      existing.blacklistedAt = now
      existing.expiresAt = expiresAt
      await existing.save()
      return existing
    }

    // Create new blacklist entry
    return await BlacklistedRelease.create({
      guid: entry.guid,
      indexer: entry.indexer,
      title: entry.title,
      movieId: entry.movieId || null,
      episodeId: entry.episodeId || null,
      albumId: entry.albumId || null,
      bookId: entry.bookId || null,
      reason: entry.reason,
      failureType: entry.failureType,
      blacklistedAt: now,
      expiresAt,
    })
  }

  /**
   * Check if a release is blacklisted
   */
  async isBlacklisted(guid: string, indexer: string): Promise<boolean> {
    const entry = await BlacklistedRelease.query()
      .where('guid', guid)
      .where('indexer', indexer)
      .where('expiresAt', '>', DateTime.now().toSQL()!)
      .first()

    return !!entry
  }

  /**
   * Filter out blacklisted releases from search results
   */
  async filterBlacklisted(results: UnifiedSearchResult[]): Promise<UnifiedSearchResult[]> {
    if (results.length === 0) return results

    // Query active blacklist entries (not expired)
    const blacklisted = await BlacklistedRelease.query().where(
      'expiresAt',
      '>',
      DateTime.now().toSQL()!
    )

    if (blacklisted.length === 0) return results

    // Build a set of blacklisted keys for O(1) lookup
    const blacklistedKeys = new Set(blacklisted.map((b) => `${b.guid}|${b.indexer}`))

    // Filter out blacklisted results
    const filtered = results.filter((r) => !blacklistedKeys.has(`${r.id}|${r.indexer}`))

    if (filtered.length < results.length) {
      console.log(
        `[Blacklist] Filtered out ${results.length - filtered.length} blacklisted release(s)`
      )
    }

    return filtered
  }

  /**
   * Get the retry count for a specific media item
   */
  async getRetryCount(options: {
    movieId?: string | null
    episodeId?: string | null
    albumId?: string | null
    bookId?: string | null
  }): Promise<number> {
    const query = BlacklistedRelease.query().where('expiresAt', '>', DateTime.now().toSQL()!)

    if (options.movieId) query.where('movieId', options.movieId)
    else if (options.episodeId) query.where('episodeId', options.episodeId)
    else if (options.albumId) query.where('albumId', options.albumId)
    else if (options.bookId) query.where('bookId', options.bookId)
    else return 0

    const count = await query.count('* as total')
    return Number(count[0].$extras.total) || 0
  }

  /**
   * Check if we've exceeded the maximum retry count for a media item
   */
  async hasExceededRetries(options: {
    movieId?: string | null
    episodeId?: string | null
    albumId?: string | null
    bookId?: string | null
  }): Promise<boolean> {
    const count = await this.getRetryCount(options)
    return count >= MAX_RETRIES
  }

  /**
   * Get blacklist entries for a specific media item
   */
  async getForMedia(options: {
    movieId?: string
    episodeId?: string
    albumId?: string
    bookId?: string
  }): Promise<BlacklistedRelease[]> {
    const query = BlacklistedRelease.query()

    if (options.movieId) query.where('movieId', options.movieId)
    if (options.episodeId) query.where('episodeId', options.episodeId)
    if (options.albumId) query.where('albumId', options.albumId)
    if (options.bookId) query.where('bookId', options.bookId)

    return await query.orderBy('blacklistedAt', 'desc')
  }

  /**
   * Get all blacklist entries with pagination
   */
  async getAll(
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: BlacklistedRelease[]; total: number }> {
    const result = await BlacklistedRelease.query()
      .orderBy('blacklistedAt', 'desc')
      .paginate(page, limit)

    return {
      data: result.all(),
      total: result.total,
    }
  }

  /**
   * Remove a blacklist entry (allow retry)
   */
  async remove(id: string): Promise<boolean> {
    const entry = await BlacklistedRelease.find(id)
    if (!entry) return false
    await entry.delete()
    return true
  }

  /**
   * Remove all blacklist entries for a media item
   */
  async removeForMedia(options: {
    movieId?: string
    episodeId?: string
    albumId?: string
    bookId?: string
  }): Promise<number> {
    const query = BlacklistedRelease.query()

    if (options.movieId) query.where('movieId', options.movieId)
    else if (options.episodeId) query.where('episodeId', options.episodeId)
    else if (options.albumId) query.where('albumId', options.albumId)
    else if (options.bookId) query.where('bookId', options.bookId)
    else return 0

    const deleted = await query.delete()
    return deleted.length
  }

  /**
   * Clean up expired blacklist entries
   */
  async cleanupExpired(): Promise<number> {
    const deleted = await BlacklistedRelease.query()
      .where('expiresAt', '<', DateTime.now().toSQL()!)
      .delete()

    if (deleted.length > 0) {
      console.log(`[Blacklist] Cleaned up ${deleted.length} expired entries`)
    }

    return deleted.length
  }

  /**
   * Determine if an error message should trigger blacklisting
   */
  shouldBlacklist(errorMessage: string): boolean {
    const lowerError = errorMessage.toLowerCase()

    // Check for non-blacklistable patterns first (configuration issues)
    for (const pattern of NON_BLACKLISTABLE_PATTERNS) {
      if (lowerError.includes(pattern)) {
        return false
      }
    }

    // Check for blacklistable failures
    for (const pattern of BLACKLISTABLE_PATTERNS) {
      if (lowerError.includes(pattern)) {
        return true
      }
    }

    // Default to blacklisting unknown errors from SABnzbd
    // (if it's a 'Failed' status, we should blacklist)
    return false
  }

  /**
   * Determine the failure type from error message
   */
  determineFailureType(errorMessage: string): FailureType {
    const lowerError = errorMessage.toLowerCase()

    if (lowerError.includes('extract') || lowerError.includes('unpack')) {
      return 'extraction_failed'
    }
    if (
      lowerError.includes('crc') ||
      lowerError.includes('par2') ||
      lowerError.includes('verification') ||
      lowerError.includes('repair')
    ) {
      return 'verification_failed'
    }
    if (lowerError.includes('import')) {
      return 'import_failed'
    }
    if (lowerError.includes('missing')) {
      return 'missing_files'
    }

    return 'download_failed'
  }
}

export const blacklistService = new BlacklistService()
