import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@inertiajs/react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RowGroup, describeHttpError } from '@/components/settings/row-group'
import { StatusBadge } from '@/components/status-badge'
import { ActivityRow, ActivityToolbar, Num, RefreshButton, RowButton } from './activity-row'
import {
  HISTORY_EVENT_FILTERS,
  eventDetail,
  eventTypesFor,
  formatTimestamp,
  isFailureEvent,
  mediaLabel,
  readResponseError,
  searchAgainUrl,
  timeAgo,
  type HistoryEntry,
  type HistoryEventFilter,
} from './activity_format'

interface HistoryMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

const PAGE_SIZE = 50

/**
 * Everything grabbed, imported, failed, deleted and renamed — kept by Hamster
 * independently of the download client. The filter lives in the URL
 * (`?event=failures`) so the Dashboard and the Queue can link straight to it.
 */
export function HistoryTab({
  eventFilter,
  onEventFilterChange,
  reloadSignal,
}: {
  eventFilter: HistoryEventFilter
  onEventFilterChange: (filter: HistoryEventFilter) => void
  reloadSignal: number
}) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [meta, setMeta] = useState<HistoryMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [searchingId, setSearchingId] = useState<string | null>(null)
  const requestId = useRef(0)

  const loadPage = useCallback(
    async (page: number, filter: HistoryEventFilter, append: boolean) => {
      const id = ++requestId.current
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
        const types = eventTypesFor(filter)
        if (types) params.set('eventType', types)
        const response = await fetch(`/api/v1/history?${params}`)
        if (!response.ok) throw new Error(describeHttpError(response))
        const payload = (await response.json()) as { data: HistoryEntry[]; meta: HistoryMeta }
        // A newer request (the filter changed mid-flight) wins.
        if (id !== requestId.current) return
        setEntries((prev) => (append && prev ? [...prev, ...payload.data] : payload.data))
        setMeta(payload.meta)
        setError(null)
      } catch (err) {
        if (id !== requestId.current) return
        const message = err instanceof Error ? err.message : 'The server did not answer'
        if (append) {
          toast.error('More history could not be loaded', { description: message })
        } else {
          setError(message)
        }
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    []
  )

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/history/summary?days=7')
      if (!response.ok) return
      const payload = (await response.json()) as { summary?: Record<string, number> }
      setSummary(payload.summary ?? {})
    } catch {
      // The summary line is a readout, not the log; the log reports its own failures.
    }
  }, [])

  useEffect(() => {
    setEntries(null)
    setMeta(null)
    void loadPage(1, eventFilter, false)
  }, [eventFilter, loadPage])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const reload = useCallback(
    () => Promise.all([loadPage(1, eventFilter, false), loadSummary()]),
    [eventFilter, loadPage, loadSummary]
  )

  const firstSignal = useRef(reloadSignal)
  useEffect(() => {
    if (reloadSignal === firstSignal.current) return
    void reload()
  }, [reloadSignal, reload])

  const searchAgain = async (entry: HistoryEntry) => {
    const url = searchAgainUrl(entry.media)
    if (!url) return
    setSearchingId(entry.id)
    try {
      const response = await fetch(url, { method: 'POST' })
      if (!response.ok) {
        toast.error(await readResponseError(response, `Search failed (HTTP ${response.status})`))
        return
      }
      const data = await response.json().catch(() => ({}))
      if (data.grabbed) {
        toast.success('Grabbed a new release', {
          description: 'It is on its way to the download client. Follow it on the Queue.',
        })
      } else if (data.error) {
        toast.error(data.error)
      } else if (data.found === false) {
        toast.info('No release found', {
          description: 'Nothing on the indexers matched the quality profile. It stays wanted.',
        })
      } else {
        toast.success(data.message || 'Search finished')
      }
    } catch {
      toast.error('Could not reach the server to search again', {
        description: 'Nothing was searched. Try again in a moment.',
      })
    } finally {
      setSearchingId(null)
    }
  }

  const grabbed = summary?.grabbed ?? 0
  const imported = summary?.import_completed ?? 0
  const failed = (summary?.download_failed ?? 0) + (summary?.import_failed ?? 0)
  const hasMore = meta ? meta.currentPage < meta.lastPage : false
  const filterLabel = HISTORY_EVENT_FILTERS.find((f) => f.value === eventFilter)?.label

  return (
    <div className="space-y-4">
      <ActivityToolbar
        summary={
          summary === null ? null : (
            <>
              Last 7 days: <Num>{grabbed}</Num> grabbed · <Num>{imported}</Num> imported ·{' '}
              {failed > 0 ? (
                <button
                  type="button"
                  onClick={() => onEventFilterChange('failures')}
                  className="rounded-sm text-destructive underline underline-offset-2 outline-none hover:text-destructive/80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Num>{failed}</Num> failed
                </button>
              ) : (
                <>
                  <Num>0</Num> failed
                </>
              )}
            </>
          )
        }
      >
        <Select
          value={eventFilter}
          onValueChange={(v) => onEventFilterChange(v as HistoryEventFilter)}
        >
          <SelectTrigger size="sm" className="w-36" aria-label="Filter events">
            <SelectValue>
              {(value: HistoryEventFilter) =>
                HISTORY_EVENT_FILTERS.find((f) => f.value === value)?.label ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {HISTORY_EVENT_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <RefreshButton onClick={() => void reload()} refreshing={loading} label="Refresh history" />
      </ActivityToolbar>

      <RowGroup
        loading={entries === null && !error}
        skeletonRows={8}
        error={error}
        onRetry={() => void reload()}
        empty={
          eventFilter === 'all'
            ? 'No history yet. Grabs, imports and failures are recorded here as they happen.'
            : `No ${filterLabel?.toLowerCase() ?? 'matching'} events in the retained history.`
        }
      >
        {(entries ?? []).map((entry) => {
          const media = mediaLabel(entry.media)
          const detail = eventDetail(entry)
          const failure = isFailureEvent(entry.eventType)
          const canSearch = failure && searchAgainUrl(entry.media) !== null
          return (
            <ActivityRow
              key={entry.id}
              title={
                media.href ? (
                  <Link href={media.href} className="font-medium hover:underline" prefetch>
                    {media.text}
                  </Link>
                ) : (
                  <span className="font-medium text-muted-foreground">{media.text}</span>
                )
              }
              titleHint={media.text}
              status={<StatusBadge status={entry.eventType} />}
              meta={[
                <span key="t" title={formatTimestamp(entry.createdAt)}>
                  {timeAgo(entry.createdAt) || '—'}
                </span>,
                entry.quality,
                failure ? null : detail,
                entry.sourceTitle ? (
                  <span key="r" title={entry.sourceTitle}>
                    {entry.sourceTitle}
                  </span>
                ) : null,
              ]}
              error={failure ? (detail ?? 'Failed without a reason on record.') : null}
              actions={
                failure && (media.href || canSearch) ? (
                  <>
                    {canSearch && (
                      <RowButton
                        icon={Search01Icon}
                        label="Search again"
                        busy={searchingId === entry.id}
                        disabled={searchingId !== null}
                        onClick={() => void searchAgain(entry)}
                      />
                    )}
                    {media.href && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        asChild
                        aria-label={`Go to ${media.text}`}
                        title="Go to item"
                      >
                        <Link href={media.href}>
                          <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </>
                ) : undefined
              }
            />
          )
        })}
      </RowGroup>

      {meta && entries && entries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Showing <Num>{entries.length}</Num> of <Num>{meta.total}</Num>
          </span>
          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadPage(meta.currentPage + 1, eventFilter, true)}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
