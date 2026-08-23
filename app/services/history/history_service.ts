import logger from '@adonisjs/core/services/logger'
import History, { type HistoryEventType } from '#models/history'
import type Download from '#models/download'
import { DateTime } from 'luxon'

export interface HistoryEntry {
  eventType: HistoryEventType
  sourceTitle?: string | null
  downloadId?: string | null
  albumId?: string | null
  artistId?: string | null
  movieId?: string | null
  tvShowId?: string | null
  episodeId?: string | null
  bookId?: string | null
  trackFileId?: string | null
  movieFileId?: string | null
  episodeFileId?: string | null
  bookFileId?: string | null
  quality?: string | null
  /** Free-form details: indexer, guid, error message, file counts, ... */
  data?: Record<string, unknown>
}

export interface HistoryQueryOptions {
  page?: number
  limit?: number
  eventType?: HistoryEventType | HistoryEventType[]
  movieId?: string
  tvShowId?: string
  episodeId?: string
  albumId?: string
  bookId?: string
}

/**
 * The library's event log: what was grabbed, what failed, what was imported.
 *
 * This is deliberately independent of the `downloads` table. Download rows are
 * mutable and get pruned, and the download client's own history rotates out —
 * so without this, "why did this episode never arrive?" became unanswerable as
 * soon as either was cleaned up.
 */
class HistoryService {
  /**
   * Record an event. Never throws: history is diagnostic, and losing an entry
   * must not fail the grab or import that was being recorded.
   */
  async record(entry: HistoryEntry): Promise<History | null> {
    try {
      return await History.create({
        eventType: entry.eventType,
        sourceTitle: entry.sourceTitle ?? null,
        downloadId: entry.downloadId ?? null,
        albumId: entry.albumId ?? null,
        artistId: entry.artistId ?? null,
        movieId: entry.movieId ?? null,
        tvShowId: entry.tvShowId ?? null,
        episodeId: entry.episodeId ?? null,
        bookId: entry.bookId ?? null,
        trackFileId: entry.trackFileId ?? null,
        movieFileId: entry.movieFileId ?? null,
        episodeFileId: entry.episodeFileId ?? null,
        bookFileId: entry.bookFileId ?? null,
        quality: entry.quality ?? null,
        data: entry.data ?? {},
      })
    } catch (error) {
      logger.error({ err: error, eventType: entry.eventType }, 'History: Failed to record event')
      return null
    }
  }

  /**
   * Record an event for a download, copying its media links across so the entry
   * stays attributable after the download row is gone.
   */
  async recordForDownload(
    download: Download,
    eventType: HistoryEventType,
    extra: { quality?: string | null; data?: Record<string, unknown> } = {}
  ): Promise<History | null> {
    return this.record({
      eventType,
      sourceTitle: download.title,
      downloadId: download.id,
      albumId: download.albumId,
      movieId: download.movieId,
      tvShowId: download.tvShowId,
      episodeId: download.episodeId,
      bookId: download.bookId,
      quality: extra.quality ?? null,
      data: {
        indexer: download.nzbInfo?.indexer,
        guid: download.nzbInfo?.guid,
        sizeBytes: download.sizeBytes,
        ...extra.data,
      },
    })
  }

  /**
   * Paginated history, newest first.
   */
  async list(options: HistoryQueryOptions = {}) {
    const page = options.page ?? 1
    const limit = Math.min(options.limit ?? 50, 200)

    const query = History.query()
      .preload('movie')
      .preload('tvShow')
      .preload('episode')
      .preload('album')
      .preload('book')
      .orderBy('createdAt', 'desc')

    if (options.eventType) {
      const types = Array.isArray(options.eventType) ? options.eventType : [options.eventType]
      if (types.length > 0) query.whereIn('eventType', types)
    }
    if (options.movieId) query.where('movieId', options.movieId)
    if (options.tvShowId) query.where('tvShowId', options.tvShowId)
    if (options.episodeId) query.where('episodeId', options.episodeId)
    if (options.albumId) query.where('albumId', options.albumId)
    if (options.bookId) query.where('bookId', options.bookId)

    return query.paginate(page, limit)
  }

  /**
   * Count of each event type within the given window, for the summary strip.
   */
  async summary(sinceDays = 7): Promise<Record<string, number>> {
    const rows = await History.query()
      .where('createdAt', '>=', DateTime.now().minus({ days: sinceDays }).toSQL())
      .groupBy('eventType')
      .select('eventType')
      .count('* as total')

    const summary: Record<string, number> = {}
    for (const row of rows) {
      summary[row.eventType] = Number(row.$extras.total ?? 0)
    }
    return summary
  }

  /**
   * Drop entries older than the retention window. History is unbounded
   * otherwise, and a busy library writes several entries per grab.
   */
  async prune(retentionDays = 90): Promise<number> {
    const cutoff = DateTime.now().minus({ days: retentionDays })
    const deleted = await History.query().where('createdAt', '<', cutoff.toSQL()).delete()
    // Lucid returns driver-shaped results here; normalise to a count.
    const count = Array.isArray(deleted) ? Number(deleted[0] ?? 0) : Number(deleted ?? 0)
    if (count > 0) {
      logger.info({ count, retentionDays }, 'History: Pruned old entries')
    }
    return count
  }
}

export const historyService = new HistoryService()
export default HistoryService
