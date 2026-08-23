import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  RefreshIcon,
  CheckmarkCircle01Icon,
  Alert02Icon,
  FileDownloadIcon,
  Clock01Icon,
  Download01Icon,
  Delete02Icon,
  Edit02Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HistoryEventType =
  | 'grabbed'
  | 'download_completed'
  | 'download_failed'
  | 'import_completed'
  | 'import_failed'
  | 'deleted'
  | 'renamed'

interface HistoryMedia {
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

interface HistoryEntry {
  id: string
  eventType: HistoryEventType
  sourceTitle: string | null
  quality: string | null
  data: Record<string, unknown>
  createdAt: string | null
  downloadId: string | null
  media: HistoryMedia
}

interface HistoryMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<HistoryEventType, string> = {
  grabbed: 'Grabbed',
  download_completed: 'Downloaded',
  download_failed: 'Download failed',
  import_completed: 'Imported',
  import_failed: 'Import failed',
  deleted: 'Deleted',
  renamed: 'Renamed',
}

/**
 * Event type → status ramp. Colour here describes what happened to the media,
 * never the app's own voice: transfer cyan covers the acquisition phase,
 * complete green means the file reached the library, alarm red means it did not.
 */
const EVENT_STYLES: Record<
  HistoryEventType,
  { className: string; icon: typeof RefreshIcon | null }
> = {
  grabbed: {
    className: 'border-transparent bg-status-transfer text-white',
    icon: FileDownloadIcon,
  },
  download_completed: {
    className: 'border-transparent bg-status-transfer text-white',
    icon: Download01Icon,
  },
  download_failed: {
    className: 'border-transparent bg-status-failed text-white',
    icon: Alert02Icon,
  },
  import_completed: {
    className: 'border-transparent bg-status-complete text-white',
    icon: CheckmarkCircle01Icon,
  },
  import_failed: { className: 'border-transparent bg-status-failed text-white', icon: Alert02Icon },
  deleted: { className: 'border-border text-muted-foreground', icon: Delete02Icon },
  renamed: { className: 'border-border text-muted-foreground', icon: Edit02Icon },
}

const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All events' },
  { value: 'grabbed', label: 'Grabbed' },
  { value: 'import_completed', label: 'Imported' },
  { value: 'download_failed,import_failed', label: 'Failures' },
]

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** The library item an entry belongs to, with a link when we can build one. */
function mediaLabel(media: HistoryMedia): { text: string; href: string | null } {
  if (media.episodeId && media.tvShowId) {
    const code =
      media.seasonNumber !== null && media.episodeNumber !== null
        ? `S${String(media.seasonNumber).padStart(2, '0')}E${String(media.episodeNumber).padStart(2, '0')}`
        : ''
    const show = media.tvShowTitle ?? 'Unknown show'
    return {
      text: [show, code, media.episodeTitle].filter(Boolean).join(' · '),
      href: `/library/tvshow/${media.tvShowId}`,
    }
  }
  if (media.tvShowId) {
    return { text: media.tvShowTitle ?? 'Unknown show', href: `/library/tvshow/${media.tvShowId}` }
  }
  if (media.movieId) {
    return { text: media.movieTitle ?? 'Unknown movie', href: `/library/movie/${media.movieId}` }
  }
  if (media.albumId) {
    return { text: media.albumTitle ?? 'Unknown album', href: `/library/album/${media.albumId}` }
  }
  if (media.bookId) {
    return { text: media.bookTitle ?? 'Unknown book', href: `/library/book/${media.bookId}` }
  }
  return { text: 'Unlinked', href: null }
}

/** The most useful detail for this event type, shown inline. */
function eventDetail(entry: HistoryEntry): string | null {
  const data = entry.data ?? {}
  if (entry.eventType === 'download_failed' || entry.eventType === 'import_failed') {
    return typeof data.error === 'string' ? data.error : null
  }
  if (entry.eventType === 'import_completed') {
    const count = data.filesImported
    return typeof count === 'number' ? `${count} file${count === 1 ? '' : 's'} imported` : null
  }
  if (entry.eventType === 'grabbed') {
    return typeof data.indexer === 'string' ? `from ${data.indexer}` : null
  }
  return null
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ActivityHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [meta, setMeta] = useState<HistoryMeta | null>(null)
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(
    async (targetPage: number, eventFilter: string, append: boolean) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(targetPage), limit: '50' })
        if (eventFilter !== 'all') params.set('eventType', eventFilter)

        const response = await fetch(`/api/v1/history?${params.toString()}`)
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)

        const payload = (await response.json()) as { data: HistoryEntry[]; meta: HistoryMeta }
        setEntries((prev) => (append ? [...prev, ...payload.data] : payload.data))
        setMeta(payload.meta)
      } catch (error) {
        console.error('Failed to load history:', error)
        toast.error('History could not be loaded', {
          description:
            error instanceof Error
              ? `${error.message}. Use Refresh to try again.`
              : 'The server did not answer. Use Refresh to try again.',
        })
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/history/summary?days=7')
      if (!response.ok) return
      const payload = (await response.json()) as { summary: Record<string, number> }
      setSummary(payload.summary ?? {})
    } catch {
      // The summary strip is decorative; a failure here should not surface.
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchHistory(1, filter, false)
    fetchSummary()
  }, [filter, fetchHistory, fetchSummary])

  const refresh = () => {
    setPage(1)
    fetchHistory(1, filter, false)
    fetchSummary()
  }

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchHistory(next, filter, true)
  }

  const hasMore = meta ? meta.currentPage < meta.lastPage : false
  const showSkeleton = loading && entries.length === 0

  const failedLast7 = (summary.download_failed ?? 0) + (summary.import_failed ?? 0)

  return (
    <AppLayout
      title="History"
      actions={
        <>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectPopup>
              {FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh history"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
          </Button>
        </>
      }
    >
      <Head title="History" />

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Everything grabbed, imported and failed — kept independently of the download client.
        </p>

        {/* Last-7-days summary: one panel, four aligned figures, seams between. */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
            Last 7 days
            {failedLast7 > 0 && (
              <span className="text-status-failed-ink">
                {' · '}
                <span className="readout">{failedLast7}</span> failure
                {failedLast7 === 1 ? '' : 's'} to review
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl bg-border sm:grid-cols-4">
            <SummaryTile
              icon={FileDownloadIcon}
              label="Grabbed"
              value={summary.grabbed ?? 0}
              tone="text-status-transfer-ink"
            />
            <SummaryTile
              icon={CheckmarkCircle01Icon}
              label="Imported"
              value={summary.import_completed ?? 0}
              tone="text-status-complete-ink"
            />
            <SummaryTile
              icon={Alert02Icon}
              label="Download failed"
              value={summary.download_failed ?? 0}
              tone="text-status-failed-ink"
            />
            <SummaryTile
              icon={Alert02Icon}
              label="Import failed"
              value={summary.import_failed ?? 0}
              tone="text-status-failed-ink"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {showSkeleton ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <EmptyState
                icon={<HugeiconsIcon icon={Clock01Icon} />}
                title="No history yet"
                message={
                  filter === 'all'
                    ? 'Nothing has been grabbed or imported yet. Add media and request it, or run a search from a library page.'
                    : 'No events of this kind in the retained history. Switch the filter back to All events to see everything.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-auto whitespace-nowrap">Event</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="hidden lg:table-cell">Release</TableHead>
                      {/* Below sm the timestamp folds into the Item cell — see below. */}
                      <TableHead className="hidden w-[170px] sm:table-cell">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const media = mediaLabel(entry.media)
                      const detail = eventDetail(entry)
                      const style = EVENT_STYLES[entry.eventType]
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`gap-1 ${style?.className ?? 'border-border text-muted-foreground'}`}
                            >
                              {style?.icon && (
                                <HugeiconsIcon icon={style.icon} className="h-3 w-3" />
                              )}
                              {EVENT_LABELS[entry.eventType] ?? entry.eventType}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {media.href ? (
                                <Link
                                  href={media.href}
                                  className="font-medium hover:underline"
                                  prefetch
                                >
                                  {media.text}
                                </Link>
                              ) : (
                                <span className="font-medium text-muted-foreground">
                                  {media.text}
                                </span>
                              )}
                              {detail && (
                                <span
                                  className={
                                    entry.eventType.endsWith('failed')
                                      ? 'readout text-xs text-status-failed-ink'
                                      : 'readout text-xs text-muted-foreground'
                                  }
                                >
                                  {detail}
                                </span>
                              )}
                              {/* The When column is hidden below sm; the timestamp
                                  rides here instead so the table never scrolls sideways. */}
                              <span className="readout text-xs text-muted-foreground sm:hidden">
                                {relativeTime(entry.createdAt)}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="hidden max-w-[380px] lg:table-cell">
                            <Tooltip>
                              <TooltipTrigger className="readout block truncate text-left text-xs text-muted-foreground">
                                {entry.sourceTitle ?? '—'}
                              </TooltipTrigger>
                              <TooltipContent className="readout max-w-[520px] break-all">
                                {entry.sourceTitle ?? '—'}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>

                          <TableCell className="hidden sm:table-cell">
                            <Tooltip>
                              <TooltipTrigger className="readout text-left text-xs text-muted-foreground">
                                {relativeTime(entry.createdAt)}
                              </TooltipTrigger>
                              <TooltipContent className="readout">
                                {formatTimestamp(entry.createdAt)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {meta && entries.length > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Showing <span className="readout">{entries.length}</span> of{' '}
              <span className="readout">{meta.total}</span>
            </span>
            {hasMore && (
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                {loading ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: typeof RefreshIcon
  label: string
  value: number
  tone: string
}) {
  return (
    <div className="flex items-center gap-2 bg-card px-4 py-3">
      <HugeiconsIcon
        icon={icon}
        className={`h-4 w-4 shrink-0 ${value > 0 ? tone : 'text-muted-foreground'}`}
      />
      <span className="readout text-base font-medium">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
