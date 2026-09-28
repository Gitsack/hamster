import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@inertiajs/react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cancel01Icon,
  Delete01Icon,
  FolderSearchIcon,
  MoreVerticalIcon,
  RefreshIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { Button, buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Section } from '@/components/settings/section'
import { RowGroup, describeHttpError } from '@/components/settings/row-group'
import { StatusBadge } from '@/components/status-badge'
import { useActiveDownloads, type QueueItem } from '@/hooks/use_active_downloads'
import { ActivityRow, ActivityToolbar, Num, RefreshButton, RowButton } from './activity-row'
import {
  formatEta,
  formatSize,
  formatTimestamp,
  mediaTypeLabel,
  plural,
  readResponseError,
  timeAgo,
} from './activity_format'

/** A row from /api/v1/queue/history (failed or importing downloads). */
export interface DownloadRecord {
  id: string
  title: string
  status: 'completed' | 'failed' | 'importing'
  size: number | null
  mediaType: string | null
  downloadClient: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
  /** Importing and untouched past the server's recovery threshold. */
  stuck: boolean
}

interface DownloadPage {
  rows: DownloadRecord[]
  total: number
}

const FAILED_LIMIT = 50
const IMPORTING_LIMIT = 100

async function fetchDownloads(
  status: 'failed' | 'importing',
  limit: number
): Promise<DownloadPage> {
  const response = await fetch(`/api/v1/queue/history?status=${status}&limit=${limit}`)
  if (!response.ok) throw new Error(describeHttpError(response))
  const payload = (await response.json()) as { data?: DownloadRecord[]; meta?: { total?: number } }
  const rows = payload.data ?? []
  return { rows, total: payload.meta?.total ?? rows.length }
}

/** A download client the health monitor could not reach on its last check. */
interface UnreachableClient {
  id: string
  name: string
  type: string
  message: string
  since: string
}

/**
 * Unreachable clients from the health monitor's cache. Best effort: when the
 * summary cannot be read, the rows are simply absent — the lists below still
 * say what the database knows.
 */
async function fetchUnreachableClients(): Promise<UnreachableClient[]> {
  try {
    const response = await fetch('/api/v1/system/health-summary', {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return []
    const summary = (await response.json()) as {
      downloadClients?: (UnreachableClient & { status: string })[]
    }
    return (summary.downloadClients ?? []).filter((client) => client.status === 'error')
  } catch {
    return []
  }
}

type Confirm =
  | { kind: 'cancel'; item: QueueItem }
  | { kind: 'remove'; item: DownloadRecord }
  | { kind: 'clear-failed' }

export function QueueTab({
  reloadSignal,
  processing,
  onProcessDownloads,
  isAdmin = false,
}: {
  /** Bumped by the page when a Process downloads run changes what is on disk. */
  reloadSignal: number
  processing: boolean
  onProcessDownloads: () => void
  /** Offer the link to the client settings (admin only). */
  isAdmin?: boolean
}) {
  const { queue, counts, refresh: refreshQueue, refreshCounts } = useActiveDownloads()
  const [queueLoaded, setQueueLoaded] = useState(false)
  const [hiddenQueueIds, setHiddenQueueIds] = useState<ReadonlySet<string>>(new Set())

  const [failed, setFailed] = useState<DownloadPage | null>(null)
  const [failedError, setFailedError] = useState<string | null>(null)
  const [importing, setImporting] = useState<DownloadPage | null>(null)
  const [importingError, setImportingError] = useState<string | null>(null)
  const [unreachable, setUnreachable] = useState<UnreachableClient[]>([])

  const [refreshing, setRefreshing] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  // The payload outlives the open flag so the dialog keeps its words while it animates out.
  const [confirm, setConfirmPayload] = useState<Confirm | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const setConfirm = (next: Confirm) => {
    setConfirmPayload(next)
    setConfirmOpen(true)
  }

  const loadFailed = useCallback(async () => {
    try {
      setFailed(await fetchDownloads('failed', FAILED_LIMIT))
      setFailedError(null)
    } catch (error) {
      setFailedError(error instanceof Error ? error.message : 'The server did not answer')
    }
  }, [])

  const loadImporting = useCallback(async () => {
    try {
      setImporting(await fetchDownloads('importing', IMPORTING_LIMIT))
      setImportingError(null)
    } catch (error) {
      setImportingError(error instanceof Error ? error.message : 'The server did not answer')
    }
  }, [])

  const loadClientHealth = useCallback(async () => {
    setUnreachable(await fetchUnreachableClients())
  }, [])

  const loadQueue = useCallback(async () => {
    await refreshQueue()
    setHiddenQueueIds(new Set())
    setQueueLoaded(true)
  }, [refreshQueue])

  const reloadAll = useCallback(
    () =>
      Promise.all([
        loadQueue(),
        loadFailed(),
        loadImporting(),
        loadClientHealth(),
        refreshCounts(),
      ]),
    [loadQueue, loadFailed, loadImporting, loadClientHealth, refreshCounts]
  )

  useEffect(() => {
    void Promise.all([loadQueue(), loadFailed(), loadImporting(), loadClientHealth()])
  }, [loadQueue, loadFailed, loadImporting, loadClientHealth])

  // A Process downloads run moved files: reload quietly, keeping what is on screen.
  const firstSignal = useRef(reloadSignal)
  useEffect(() => {
    if (reloadSignal === firstSignal.current) return
    void Promise.all([loadQueue(), loadFailed(), loadImporting()])
  }, [reloadSignal, loadQueue, loadFailed, loadImporting])

  // The app-wide counts poll notices a new failure or a finished import before this
  // tab would; when those numbers move, re-read the lists they summarise.
  const countsKey = counts ? `${counts.failed}:${counts.importing}:${counts.stuckImporting}` : null
  const lastCountsKey = useRef(countsKey)
  useEffect(() => {
    if (countsKey === null) return
    const previous = lastCountsKey.current
    lastCountsKey.current = countsKey
    if (previous !== null && previous !== countsKey) {
      void loadFailed()
      void loadImporting()
    }
  }, [countsKey, loadFailed, loadImporting])

  const refresh = async () => {
    setRefreshing(true)
    try {
      // Ask the clients first so the rows below are current, not the last poll.
      await fetch('/api/v1/queue/refresh', { method: 'POST' }).catch(() => null)
      await reloadAll()
    } finally {
      setRefreshing(false)
    }
  }

  const postAction = async (url: string, successMsg: string) => {
    try {
      const response = await fetch(url, { method: 'POST' })
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.success(data.message || successMsg)
        void loadQueue()
      } else {
        toast.error(
          await readResponseError(
            response,
            `The server rejected the request (HTTP ${response.status})`
          ),
          {
            description: isAdmin
              ? 'Nothing was changed. Settings → System → Health shows whether a service is down.'
              : 'Nothing was changed. Try again in a minute.',
          }
        )
      }
    } catch {
      toast.error('The request never reached the server', {
        description: 'Nothing was changed. Check that Hamster is still running, then retry.',
      })
    }
  }

  const retry = async (item: DownloadRecord) => {
    setActioningId(item.id)
    try {
      const response = await fetch(`/api/v1/queue/${item.id}/retry`, { method: 'POST' })
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.success(
          data.message || (item.status === 'importing' ? 'Import retried' : 'Retry triggered')
        )
      } else {
        toast.error(await readResponseError(response, 'Retry rejected, nothing was re-sent'), {
          description:
            item.status === 'importing'
              ? 'The files are still in the completed folder. Check the error on the row.'
              : 'The release may be blacklisted. Search the item again from its page.',
        })
      }
    } catch {
      toast.error('Could not reach the server to retry this', {
        description: 'Nothing was re-sent. Refresh and try again.',
      })
    } finally {
      setActioningId(null)
      void Promise.all([loadFailed(), loadImporting(), loadQueue(), refreshCounts()])
    }
  }

  const dismiss = async (item: DownloadRecord) => {
    setActioningId(item.id)
    try {
      const response = await fetch(`/api/v1/queue/${item.id}?deleteFiles=false`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setFailed((prev) =>
          prev
            ? { rows: prev.rows.filter((row) => row.id !== item.id), total: prev.total - 1 }
            : prev
        )
        void refreshCounts()
      } else {
        toast.error('The error record could not be dismissed', {
          description: 'It is still listed. Refresh and try again.',
        })
      }
    } catch {
      toast.error('Could not reach the server to dismiss this error', {
        description: 'The record is unchanged. Refresh and try again.',
      })
    } finally {
      setActioningId(null)
    }
  }

  const runConfirmed = async () => {
    if (!confirm) return
    try {
      if (confirm.kind === 'cancel') {
        const id = confirm.item.id
        const response = await fetch(`/api/v1/queue/${id}`, { method: 'DELETE' })
        if (response.ok) {
          setHiddenQueueIds((prev) => new Set(prev).add(id))
          toast.success('Download cancelled and removed from the queue')
          void refreshQueue()
          void refreshCounts()
        } else {
          toast.error('The download client refused to cancel this item', {
            description: 'It is still in the queue. Cancel it in the client itself, then refresh.',
          })
        }
      } else if (confirm.kind === 'remove') {
        const id = confirm.item.id
        const response = await fetch(`/api/v1/queue/${id}?deleteFiles=true`, { method: 'DELETE' })
        if (response.ok) {
          setImporting((prev) =>
            prev ? { rows: prev.rows.filter((row) => row.id !== id), total: prev.total - 1 } : prev
          )
          toast.success('Download removed')
          void refreshCounts()
        } else {
          toast.error('The download could not be removed', {
            description: 'It is still listed and its files are untouched. Refresh and try again.',
          })
        }
      } else {
        const response = await fetch('/api/v1/queue/clear-failed', { method: 'POST' })
        if (response.ok) {
          const data = await response.json().catch(() => ({}))
          toast.success(data.message || 'Failed records cleared')
          setFailed({ rows: [], total: 0 })
          void refreshCounts()
        } else {
          toast.error('The failed records could not be cleared', {
            description: 'They are still listed, and no files were touched. Try again.',
          })
        }
      }
    } catch {
      toast.error('The request never reached the server', {
        description: 'Nothing was changed. Refresh and try again.',
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const liveQueue = queue.filter((item) => !hiddenQueueIds.has(item.id))
  const stuck = importing?.rows.filter((row) => row.stuck) ?? []
  const moving = importing?.rows.filter((row) => !row.stuck) ?? []
  const failedRows = failed?.rows ?? []
  const attention = (failed?.total ?? 0) + stuck.length + unreachable.length

  const attentionLoading =
    (failed === null && !failedError) || (importing === null && !importingError)
  const attentionError = failedError ?? importingError
  const downloadingLoading = !queueLoaded || (importing === null && !importingError)

  return (
    <div className="space-y-8">
      <ActivityToolbar
        summary={
          downloadingLoading ? null : (
            <>
              <Num>{liveQueue.length}</Num> downloading
              {moving.length > 0 && (
                <>
                  {' · '}
                  <Num>{moving.length}</Num> importing
                </>
              )}
              {attention > 0 && (
                <span className="text-destructive">
                  {' · '}
                  <Num>{attention}</Num> {attention === 1 ? 'needs' : 'need'} attention
                </span>
              )}
            </>
          )
        }
      >
        <RefreshButton onClick={refresh} refreshing={refreshing} label="Refresh queue" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <HugeiconsIcon icon={MoreVerticalIcon} aria-hidden="true" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                postAction('/api/v1/queue/search-requested', 'Searching for requested items…')
              }
            >
              <HugeiconsIcon icon={Search01Icon} aria-hidden="true" />
              Search requested
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onProcessDownloads} disabled={processing}>
              <HugeiconsIcon icon={FolderSearchIcon} aria-hidden="true" />
              Process downloads
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ActivityToolbar>

      <Section
        id="attention"
        title="Needs attention"
        actions={
          failedRows.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setConfirm({ kind: 'clear-failed' })}
            >
              Clear errors
            </Button>
          ) : null
        }
      >
        <RowGroup
          loading={attentionLoading}
          skeletonRows={2}
          error={attentionError}
          onRetry={() => void Promise.all([loadFailed(), loadImporting()])}
          empty="Nothing needs attention."
        >
          {/* A client that cannot be reached stalls everything behind it, so it leads. */}
          {unreachable.map((client) => (
            <ActivityRow
              key={`client:${client.id}`}
              title={`${client.name} unreachable`}
              status={<StatusBadge status="unreachable" />}
              meta={[
                client.type,
                <span key="t" title={formatTimestamp(client.since)}>
                  {timeAgo(client.since) === 'just now'
                    ? 'down since just now'
                    : `down ${timeAgo(client.since).replace(' ago', '')}`}
                </span>,
              ]}
              error={client.message}
              actions={
                isAdmin ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/settings/download-clients">Settings</Link>
                  </Button>
                ) : null
              }
            />
          ))}
          {failedRows.map((item) => (
            <ActivityRow
              key={item.id}
              title={<span className="readout">{item.title}</span>}
              titleHint={item.title}
              status={<StatusBadge status="failed" />}
              meta={[
                item.downloadClient,
                formatSize(item.size),
                <span key="t" title={formatTimestamp(item.completedAt ?? item.startedAt)}>
                  {timeAgo(item.completedAt ?? item.updatedAt ?? item.startedAt)}
                </span>,
              ]}
              error={item.errorMessage ?? 'The download failed without a reason from the client.'}
              actions={
                <>
                  <RowButton
                    icon={RefreshIcon}
                    label="Retry"
                    busy={actioningId === item.id}
                    onClick={() => retry(item)}
                  />
                  <RowButton
                    icon={Cancel01Icon}
                    label="Dismiss"
                    iconOnly
                    disabled={actioningId === item.id}
                    onClick={() => dismiss(item)}
                  />
                </>
              }
            />
          ))}
          {stuck.map((item) => (
            <ImportingRow
              key={item.id}
              item={item}
              busy={actioningId === item.id}
              onRetry={() => retry(item)}
              onRemove={() => setConfirm({ kind: 'remove', item })}
            />
          ))}
        </RowGroup>
        {failed && failed.total > failed.rows.length && (
          <p className="text-xs text-muted-foreground">
            Showing the latest <Num>{failed.rows.length}</Num> of <Num>{failed.total}</Num>{' '}
            failures.{' '}
            <Link
              href="/activity/history?event=failures"
              className="underline underline-offset-2 hover:text-foreground"
            >
              See all in History
            </Link>
          </p>
        )}
      </Section>

      <Section id="downloading" title="Downloading">
        <RowGroup
          loading={downloadingLoading}
          skeletonRows={3}
          empty="Nothing is downloading. Grabs appear here the moment they reach a download client."
        >
          {liveQueue.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              onCancel={() => setConfirm({ kind: 'cancel', item })}
            />
          ))}
          {moving.map((item) => (
            <ImportingRow
              key={item.id}
              item={item}
              busy={actioningId === item.id}
              onRetry={() => retry(item)}
              onRemove={() => setConfirm({ kind: 'remove', item })}
            />
          ))}
        </RowGroup>
      </Section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          {confirm?.kind === 'cancel' && (
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this download?</AlertDialogTitle>
              <AlertDialogDescription>
                The download client stops the transfer and the item leaves the queue. Partial files
                are removed by the client; nothing already imported is touched.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {confirm?.kind === 'remove' && (
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this download and its files?</AlertDialogTitle>
              <AlertDialogDescription>
                The record leaves Hamster and the downloaded files are deleted from the completed
                folder. Nothing already in the library is touched.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {confirm?.kind === 'clear-failed' && (
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all errors?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes {plural(failed?.total ?? 0, 'failed download record')}. Files on disk
                are not affected, and History keeps its own record of each failure.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>
              {confirm?.kind === 'cancel' ? 'Keep downloading' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => void runConfirmed()}
            >
              {confirm?.kind === 'cancel'
                ? 'Cancel download'
                : confirm?.kind === 'remove'
                  ? 'Remove'
                  : 'Clear errors'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function QueueRow({ item, onCancel }: { item: QueueItem; onCancel: () => void }) {
  const progress = Math.max(0, Math.min(100, Number(item.progress) || 0))
  const eta = formatEta(item.eta)
  const downloading = item.status === 'downloading'

  return (
    <ActivityRow
      title={<span className="readout">{item.title}</span>}
      titleHint={item.title}
      status={
        downloading ? (
          <StatusBadge status="downloading">
            <span className="readout">{progress.toFixed(0)}%</span>
          </StatusBadge>
        ) : (
          <StatusBadge status={item.status} />
        )
      }
      meta={[
        item.downloadClient,
        formatSize(item.size),
        eta ? (
          `${eta} left`
        ) : item.startedAt ? (
          <span key="t" title={formatTimestamp(item.startedAt)}>
            started {timeAgo(item.startedAt)}
          </span>
        ) : (
          'just queued'
        ),
      ]}
      actions={
        <RowButton
          icon={Delete01Icon}
          label="Cancel download"
          iconOnly
          destructive
          onClick={onCancel}
        />
      }
    >
      <Progress
        value={progress}
        aria-label={`Download progress, ${progress.toFixed(0)}%`}
        className={
          downloading
            ? 'mt-2 h-1 [&_[data-slot=progress-indicator]]:bg-status-transfer'
            : 'mt-2 h-1 [&_[data-slot=progress-indicator]]:bg-status-queued'
        }
      />
    </ActivityRow>
  )
}

function ImportingRow({
  item,
  busy,
  onRetry,
  onRemove,
}: {
  item: DownloadRecord
  busy: boolean
  onRetry: () => void
  onRemove: () => void
}) {
  const landed = item.completedAt ?? item.startedAt
  return (
    <ActivityRow
      title={<span className="readout">{item.title}</span>}
      titleHint={item.title}
      status={
        item.stuck ? (
          <StatusBadge tone="warning" label="Import stalled" />
        ) : (
          <StatusBadge status="importing" />
        )
      }
      meta={[
        item.downloadClient ?? 'Unknown client',
        mediaTypeLabel(item.mediaType),
        landed ? (
          <span key="t" title={formatTimestamp(landed)}>
            downloaded {timeAgo(landed)}
          </span>
        ) : null,
      ]}
      error={item.errorMessage}
      note={
        item.stuck && !item.errorMessage
          ? 'No progress for over 10 minutes. Recovery retries it on its own, or retry now.'
          : null
      }
      actions={
        <>
          <RowButton icon={RefreshIcon} label="Retry import" busy={busy} onClick={onRetry} />
          <RowButton
            icon={Delete01Icon}
            label="Remove"
            iconOnly
            destructive
            disabled={busy}
            onClick={onRemove}
          />
        </>
      }
    />
  )
}
