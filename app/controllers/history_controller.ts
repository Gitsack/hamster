import type { HttpContext } from '@adonisjs/core/http'
import { historyService } from '#services/history/history_service'
import type { HistoryEventType } from '#models/history'

const VALID_EVENT_TYPES: HistoryEventType[] = [
  'grabbed',
  'download_completed',
  'download_failed',
  'import_completed',
  'import_failed',
  'deleted',
  'renamed',
]

function parseEventTypes(raw: unknown): HistoryEventType[] | undefined {
  if (!raw) return undefined
  const values = String(raw)
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is HistoryEventType => VALID_EVENT_TYPES.includes(v as HistoryEventType))
  return values.length > 0 ? values : undefined
}

export default class HistoryController {
  /**
   * Paginated event log, newest first.
   */
  async index({ request, response }: HttpContext) {
    const entries = await historyService.list({
      page: Number(request.input('page', 1)) || 1,
      limit: Number(request.input('limit', 50)) || 50,
      eventType: parseEventTypes(request.input('eventType')),
      movieId: request.input('movieId') || undefined,
      tvShowId: request.input('tvShowId') || undefined,
      episodeId: request.input('episodeId') || undefined,
      albumId: request.input('albumId') || undefined,
      bookId: request.input('bookId') || undefined,
    })

    return response.json({
      data: entries.all().map((entry) => ({
        id: entry.id,
        eventType: entry.eventType,
        sourceTitle: entry.sourceTitle,
        quality: entry.quality,
        data: entry.data,
        createdAt: entry.createdAt?.toISO(),
        downloadId: entry.downloadId,
        media: {
          movieId: entry.movieId,
          movieTitle: entry.movie?.title ?? null,
          tvShowId: entry.tvShowId,
          tvShowTitle: entry.tvShow?.title ?? null,
          episodeId: entry.episodeId,
          episodeTitle: entry.episode?.title ?? null,
          seasonNumber: entry.episode?.seasonNumber ?? null,
          episodeNumber: entry.episode?.episodeNumber ?? null,
          albumId: entry.albumId,
          albumTitle: entry.album?.title ?? null,
          bookId: entry.bookId,
          bookTitle: entry.book?.title ?? null,
        },
      })),
      meta: {
        total: entries.total,
        perPage: entries.perPage,
        currentPage: entries.currentPage,
        lastPage: entries.lastPage,
      },
    })
  }

  /**
   * Event counts for the last N days, for the summary strip.
   */
  async summary({ request, response }: HttpContext) {
    const days = Number(request.input('days', 7)) || 7
    return response.json({ days, summary: await historyService.summary(days) })
  }
}
