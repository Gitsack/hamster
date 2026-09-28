/**
 * Formatting and mapping helpers shared by the three Activity tabs. Pure, so
 * they are tested directly (activity_format.test.ts).
 */

export type ActivityTab = 'queue' | 'imports' | 'history'

export const ACTIVITY_TABS: readonly ActivityTab[] = ['queue', 'imports', 'history']

/** Each tab has its own URL; /activity is the canonical Queue. */
export const ACTIVITY_TAB_PATHS: Record<ActivityTab, string> = {
  queue: '/activity',
  imports: '/activity/imports',
  history: '/activity/history',
}

export function isActivityTab(value: unknown): value is ActivityTab {
  return typeof value === 'string' && (ACTIVITY_TABS as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Numbers and time
// ---------------------------------------------------------------------------

export function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export function formatEta(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

/** "just now", "4m ago", "3h ago", "2d ago"; empty for a missing or unparseable date. */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/** The full local timestamp, for a title attribute behind a relative time. */
export function formatTimestamp(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleString()
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  music: 'Music',
  movies: 'Movies',
  tv: 'TV',
  books: 'Books',
}

export function mediaTypeLabel(mediaType: string | null | undefined): string | null {
  if (!mediaType) return null
  return MEDIA_TYPE_LABELS[mediaType] ?? mediaType
}

/** "1 file", "3 files". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export type HistoryEventType =
  | 'grabbed'
  | 'download_completed'
  | 'download_failed'
  | 'import_completed'
  | 'import_failed'
  | 'deleted'
  | 'renamed'

export interface HistoryMedia {
  movieId: string | null
  movieTitle: string | null
  tvShowId: string | null
  tvShowTitle: string | null
  episodeId: string | null
  episodeTitle: string | null
  seasonNumber: number | null
  episodeNumber: number | null
  albumId: string | null
  albumTitle: string | null
  bookId: string | null
  bookTitle: string | null
}

export interface HistoryEntry {
  id: string
  eventType: HistoryEventType
  sourceTitle: string | null
  quality: string | null
  data: Record<string, unknown> | null
  createdAt: string | null
  downloadId: string | null
  media: HistoryMedia
}

/** The `?event=` values the History tab understands. */
export type HistoryEventFilter = 'all' | 'grabbed' | 'imported' | 'failures' | 'deleted' | 'renamed'

export const HISTORY_EVENT_FILTERS: ReadonlyArray<{
  value: HistoryEventFilter
  label: string
  eventTypes: HistoryEventType[] | null
}> = [
  { value: 'all', label: 'All events', eventTypes: null },
  { value: 'grabbed', label: 'Grabbed', eventTypes: ['grabbed'] },
  { value: 'imported', label: 'Imported', eventTypes: ['import_completed'] },
  { value: 'failures', label: 'Failures', eventTypes: ['download_failed', 'import_failed'] },
  { value: 'deleted', label: 'Deleted', eventTypes: ['deleted'] },
  { value: 'renamed', label: 'Renamed', eventTypes: ['renamed'] },
]

/** Unknown or missing values fall back to all events. */
export function parseEventFilter(raw: string | null | undefined): HistoryEventFilter {
  const match = HISTORY_EVENT_FILTERS.find((filter) => filter.value === raw)
  return match ? match.value : 'all'
}

/** The `eventType` query for /api/v1/history, or null for everything. */
export function eventTypesFor(filter: HistoryEventFilter): string | null {
  const match = HISTORY_EVENT_FILTERS.find((f) => f.value === filter)
  return match?.eventTypes ? match.eventTypes.join(',') : null
}

export function isFailureEvent(eventType: HistoryEventType): boolean {
  return eventType === 'download_failed' || eventType === 'import_failed'
}

/** The library item an entry belongs to, with a link when one can be built. */
export function mediaLabel(media: HistoryMedia): { text: string; href: string | null } {
  if (media.episodeId && media.tvShowId) {
    const code =
      media.seasonNumber !== null && media.episodeNumber !== null
        ? `S${String(media.seasonNumber).padStart(2, '0')}E${String(media.episodeNumber).padStart(2, '0')}`
        : ''
    const show = media.tvShowTitle ?? 'Unknown show'
    return {
      text: [show, code, media.episodeTitle].filter(Boolean).join(' · '),
      href: `/tvshow/${media.tvShowId}`,
    }
  }
  if (media.tvShowId) {
    return { text: media.tvShowTitle ?? 'Unknown show', href: `/tvshow/${media.tvShowId}` }
  }
  if (media.movieId) {
    return { text: media.movieTitle ?? 'Unknown movie', href: `/movie/${media.movieId}` }
  }
  if (media.albumId) {
    return { text: media.albumTitle ?? 'Unknown album', href: `/album/${media.albumId}` }
  }
  if (media.bookId) {
    return { text: media.bookTitle ?? 'Unknown book', href: `/book/${media.bookId}` }
  }
  return { text: 'Unlinked', href: null }
}

/** The endpoint that searches this item again, most specific first; null when unlinked. */
export function searchAgainUrl(media: HistoryMedia): string | null {
  if (media.episodeId && media.tvShowId) {
    return `/api/v1/tvshows/${media.tvShowId}/episodes/${media.episodeId}/search`
  }
  if (media.movieId) return `/api/v1/movies/${media.movieId}/search`
  if (media.albumId) return `/api/v1/albums/${media.albumId}/search`
  if (media.bookId) return `/api/v1/books/${media.bookId}/search`
  if (media.tvShowId) return `/api/v1/tvshows/${media.tvShowId}/search`
  return null
}

/** The most useful detail for this event, shown inline: the error, a file count, the indexer. */
export function eventDetail(entry: Pick<HistoryEntry, 'eventType' | 'data'>): string | null {
  const data = entry.data ?? {}
  if (isFailureEvent(entry.eventType)) {
    return typeof data.error === 'string' ? data.error : null
  }
  if (entry.eventType === 'import_completed') {
    const count = data.filesImported
    return typeof count === 'number' ? `${plural(count, 'file')} imported` : null
  }
  if (entry.eventType === 'grabbed') {
    return typeof data.indexer === 'string' ? `from ${data.indexer}` : null
  }
  return null
}

/** The server's own words for a failed request, or the fallback when it gave none. */
export async function readResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json()
    return data?.error || data?.errors?.[0] || data?.message || fallback
  } catch {
    return fallback
  }
}
