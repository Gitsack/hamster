import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Archive01Icon,
  CleanIcon,
  Copy01Icon,
  Delete01Icon,
  FolderSearchIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons'
import { Button, buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { useActiveDownloads } from '@/hooks/use_active_downloads'
import { ActivityRow, ActivityToolbar, Num, RefreshButton, RowButton } from './activity-row'
import { formatSize, mediaTypeLabel, plural, readResponseError } from './activity_format'
import { BrowseClientSection } from './browse-client-section'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompletedEntry {
  name: string
  path: string
  baseName: string
  isDuplicate: boolean
  isUnpacking: boolean
  mediaType: 'tv' | 'music' | 'movies' | 'books'
  title: string
  year: string | null
  sizeBytes: number | null
  downloadClientId: string
  downloadClientName: string
  duplicateCount: number
}

interface ParsedInfo {
  title?: string
  year?: number
}

interface UnmatchedItem {
  id: string
  fileName: string
  mediaType: string | null
  fileSizeBytes: number | null
  parsedInfo: ParsedInfo | null
  status: string
}

type CompletedFilter = 'all' | 'duplicates' | 'unpacking'

const COMPLETED_FILTER_LABELS: Record<CompletedFilter, string> = {
  all: 'All entries',
  duplicates: 'Duplicates',
  unpacking: 'Unpacking',
}

const MEDIA_FILTER_LABELS: Record<string, string> = {
  all: 'All types',
  music: 'Music',
  movies: 'Movies',
  tv: 'TV',
  books: 'Books',
}

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: 'Any status',
  pending: 'Pending',
  ignored: 'Ignored',
}

type Confirm =
  | { kind: 'cleanup'; count: number }
  | { kind: 'delete-unmatched'; item: UnmatchedItem }

export function ImportsTab({
  clientParam,
  onClientChange,
  isAdmin,
  reloadSignal,
  processing,
  onProcessDownloads,
}: {
  /** `?client=:id` — the client whose folder the Browse section opens on. */
  clientParam: string | null
  onClientChange: (clientId: string) => void
  isAdmin: boolean
  reloadSignal: number
  processing: boolean
  onProcessDownloads: () => void
}) {
  const { refreshCounts } = useActiveDownloads()
  const [refreshing, setRefreshing] = useState(false)

  // Completed folder
  const [entries, setEntries] = useState<CompletedEntry[] | null>(null)
  const [entriesError, setEntriesError] = useState<string | null>(null)
  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>('all')

  // Unmatched files
  const [unmatched, setUnmatched] = useState<UnmatchedItem[] | null>(null)
  const [unmatchedError, setUnmatchedError] = useState<string | null>(null)
  const [mediaFilter, setMediaFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [bulkIgnoring, setBulkIgnoring] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)

  // Confirmation dialog; the payload outlives the open flag so the words stay while it closes.
  const [confirm, setConfirmPayload] = useState<Confirm | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const askConfirm = (next: Confirm) => {
    setConfirmPayload(next)
    setConfirmOpen(true)
  }

  const loadCompleted = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/files/browse-completed')
      if (!response.ok) throw new Error(describeHttpError(response))
      const data = await response.json()
      setEntries(data.entries ?? [])
      setEntriesError(null)
    } catch (error) {
      setEntriesError(error instanceof Error ? error.message : 'The server did not answer')
    }
  }, [])

  const loadUnmatched = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (mediaFilter !== 'all') params.append('mediaType', mediaFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      const response = await fetch(`/api/v1/unmatched?${params}`)
      if (!response.ok) throw new Error(describeHttpError(response))
      const data = await response.json()
      setUnmatched(Array.isArray(data) ? data : (data.data ?? []))
      setUnmatchedError(null)
    } catch (error) {
      setUnmatchedError(error instanceof Error ? error.message : 'The server did not answer')
    }
  }, [mediaFilter, statusFilter])

  useEffect(() => {
    void loadCompleted()
  }, [loadCompleted])

  useEffect(() => {
    void loadUnmatched()
  }, [loadUnmatched])

  const firstSignal = useRef(reloadSignal)
  useEffect(() => {
    if (reloadSignal === firstSignal.current) return
    void loadCompleted()
    void loadUnmatched()
  }, [reloadSignal, loadCompleted, loadUnmatched])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadCompleted(), loadUnmatched(), refreshCounts()])
    } finally {
      setRefreshing(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const cleanupCompleted = async () => {
    try {
      const response = await fetch('/api/v1/files/cleanup-completed', { method: 'POST' })
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        const freed = data.freedBytes ? ` and freed ${formatSize(data.freedBytes)}` : ''
        toast.success(`Removed ${plural(Number(data.deleted ?? 0), 'item')}${freed}`)
        void loadCompleted()
      } else {
        toast.error(await readResponseError(response, 'Cleanup failed, nothing was deleted'), {
          description: 'Check that the completed folder is writable by Hamster, then retry.',
        })
      }
    } catch {
      toast.error('Could not reach the server to clean up the completed folder', {
        description: 'No files were deleted. Refresh and try again.',
      })
    }
  }

  const ignoreUnmatched = async (id: string) => {
    setActioningId(id)
    try {
      const response = await fetch(`/api/v1/unmatched/${id}/ignore`, { method: 'POST' })
      if (response.ok) {
        toast.success('File ignored')
        void loadUnmatched()
        void refreshCounts()
      } else {
        toast.error('The file could not be marked as ignored', {
          description: 'It is still listed as pending. Try again.',
        })
      }
    } catch {
      toast.error('Could not reach the server to ignore this file', {
        description: 'The file is still listed as pending. Refresh and try again.',
      })
    } finally {
      setActioningId(null)
    }
  }

  const deleteUnmatched = async (item: UnmatchedItem) => {
    try {
      const response = await fetch(`/api/v1/unmatched/${item.id}`, { method: 'DELETE' })
      if (response.ok) {
        setUnmatched((prev) => prev?.filter((row) => row.id !== item.id) ?? prev)
        toast.success('Record deleted')
        void refreshCounts()
      } else {
        toast.error('The unmatched record could not be deleted', {
          description: 'It is still listed. Refresh and try again.',
        })
      }
    } catch {
      toast.error('Could not reach the server to delete this record', {
        description: 'Nothing was removed. Refresh and try again.',
      })
    }
  }

  const ignoreAllPending = async () => {
    const pendingIds = (unmatched ?? []).filter((u) => u.status === 'pending').map((u) => u.id)
    if (pendingIds.length === 0) return
    setBulkIgnoring(true)
    try {
      const response = await fetch('/api/v1/unmatched/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingIds, status: 'ignored' }),
      })
      if (response.ok) {
        toast.success(`${plural(pendingIds.length, 'file')} ignored`)
        void loadUnmatched()
        void refreshCounts()
      } else {
        toast.error('The pending files could not be ignored', {
          description: 'They are still listed as pending. Try again.',
        })
      }
    } catch {
      toast.error('Could not reach the server to ignore these files', {
        description: 'Nothing changed. Refresh and try again.',
      })
    } finally {
      setBulkIgnoring(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const allEntries = entries ?? []
  const duplicates = allEntries.filter((e) => e.isDuplicate).length
  const unpacking = allEntries.filter((e) => e.isUnpacking).length
  const cleanable = allEntries.filter((e) => e.isDuplicate || e.isUnpacking).length
  const shownEntries = allEntries.filter((e) => {
    if (completedFilter === 'duplicates') return e.isDuplicate
    if (completedFilter === 'unpacking') return e.isUnpacking
    return true
  })
  const unmatchedRows = unmatched ?? []
  const pendingUnmatched = unmatchedRows.filter((u) => u.status === 'pending').length

  const completedEmpty =
    allEntries.length === 0
      ? 'The completed folder is clear. Finished downloads land here first, then move into the library.'
      : 'No entries match this filter. Switch back to All entries to see the rest of the folder.'

  return (
    <div className="space-y-8">
      <ActivityToolbar
        summary={
          entries === null ? null : (
            <>
              <Num>{allEntries.length}</Num> in the completed folder
              {unmatched !== null && statusFilter === 'pending' && mediaFilter === 'all' && (
                <>
                  {' · '}
                  <Num>{pendingUnmatched}</Num> unmatched
                </>
              )}
            </>
          )
        }
      >
        <RefreshButton onClick={refresh} refreshing={refreshing} label="Refresh imports" />
        <Button variant="outline" size="sm" onClick={onProcessDownloads} disabled={processing}>
          {processing ? <Spinner /> : <HugeiconsIcon icon={FolderSearchIcon} aria-hidden="true" />}
          Process downloads
        </Button>
      </ActivityToolbar>

      {/* ------------------------------------------------------------------ */}
      <Section
        id="completed"
        title="Completed folder"
        description="Finished downloads Hamster has not imported yet."
        actions={
          <>
            <Select
              value={completedFilter}
              onValueChange={(v) => setCompletedFilter(v as CompletedFilter)}
            >
              <SelectTrigger size="sm" className="w-40" aria-label="Filter the completed folder">
                <SelectValue>
                  {(value: CompletedFilter) => COMPLETED_FILTER_LABELS[value] ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="all">
                  All entries <Num className="text-muted-foreground">{allEntries.length}</Num>
                </SelectItem>
                <SelectItem value="duplicates">
                  Duplicates <Num className="text-muted-foreground">{duplicates}</Num>
                </SelectItem>
                <SelectItem value="unpacking">
                  Unpacking <Num className="text-muted-foreground">{unpacking}</Num>
                </SelectItem>
              </SelectPopup>
            </Select>
            {cleanable > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => askConfirm({ kind: 'cleanup', count: cleanable })}
              >
                <HugeiconsIcon icon={CleanIcon} aria-hidden="true" />
                Clean up <Num>{cleanable}</Num>
              </Button>
            )}
          </>
        }
      >
        <RowGroup
          loading={entries === null && !entriesError}
          error={entriesError}
          onRetry={() => void loadCompleted()}
          empty={completedEmpty}
        >
          {shownEntries.map((entry) => (
            <ActivityRow
              key={entry.path}
              dimmed={entry.isDuplicate || entry.isUnpacking}
              title={<span className="readout">{entry.name}</span>}
              titleHint={entry.name}
              status={
                <>
                  {entry.isDuplicate && (
                    <StatusBadge
                      tone="warning"
                      label="Duplicate"
                      icon={Copy01Icon}
                      title="A copy of this release is already in the library"
                    />
                  )}
                  {entry.isUnpacking && (
                    <StatusBadge
                      tone="transit"
                      label="Unpacking"
                      icon={Archive01Icon}
                      title="The download client is still unpacking this release"
                    />
                  )}
                </>
              }
              meta={[
                entry.downloadClientName,
                mediaTypeLabel(entry.mediaType),
                entry.title ? `${entry.title}${entry.year ? ` (${entry.year})` : ''}` : null,
                formatSize(entry.sizeBytes),
                entry.duplicateCount > 1 ? `×${entry.duplicateCount}` : null,
              ]}
            />
          ))}
        </RowGroup>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        id="unmatched"
        title="Unmatched files"
        description="Files the library scan could not tie to a title."
        actions={
          <>
            <Select value={mediaFilter} onValueChange={(v) => setMediaFilter(v as string)}>
              <SelectTrigger size="sm" className="w-32" aria-label="Filter by media type">
                <SelectValue>{(value: string) => MEDIA_FILTER_LABELS[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {Object.entries(MEDIA_FILTER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
              <SelectTrigger size="sm" className="w-32" aria-label="Filter by status">
                <SelectValue>{(value: string) => STATUS_FILTER_LABELS[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={ignoreAllPending}
              disabled={bulkIgnoring || pendingUnmatched === 0}
            >
              {bulkIgnoring ? <Spinner /> : <HugeiconsIcon icon={ViewOffIcon} aria-hidden="true" />}
              Ignore all pending
            </Button>
          </>
        }
      >
        <RowGroup
          loading={unmatched === null && !unmatchedError}
          error={unmatchedError}
          onRetry={() => void loadUnmatched()}
          empty={
            statusFilter === 'pending' && mediaFilter === 'all'
              ? 'No unmatched files. Every scanned file was matched to a library item.'
              : 'No unmatched files match these filters.'
          }
        >
          {unmatchedRows.map((item) => (
            <ActivityRow
              key={item.id}
              title={<span className="readout">{item.fileName}</span>}
              titleHint={item.fileName}
              status={<StatusBadge status={item.status} />}
              meta={[
                mediaTypeLabel(item.mediaType),
                item.parsedInfo?.title
                  ? `${item.parsedInfo.title}${item.parsedInfo.year ? ` (${item.parsedInfo.year})` : ''}`
                  : 'could not be parsed',
                formatSize(item.fileSizeBytes),
              ]}
              actions={
                <>
                  {item.status !== 'ignored' && (
                    <RowButton
                      icon={ViewOffIcon}
                      label="Ignore"
                      busy={actioningId === item.id}
                      onClick={() => ignoreUnmatched(item.id)}
                    />
                  )}
                  <RowButton
                    icon={Delete01Icon}
                    label="Delete record"
                    iconOnly
                    destructive
                    disabled={actioningId === item.id}
                    onClick={() => askConfirm({ kind: 'delete-unmatched', item })}
                  />
                </>
              }
            />
          ))}
        </RowGroup>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <BrowseClientSection
        clientParam={clientParam}
        onClientChange={onClientChange}
        isAdmin={isAdmin}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          {confirm?.kind === 'cleanup' && (
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete{' '}
                {plural(
                  confirm.count,
                  'duplicate or unpacking entry',
                  'duplicate or unpacking entries'
                )}
                ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Duplicates of releases already in the library and leftover unpack folders are
                deleted from the completed folder. Everything else stays.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {confirm?.kind === 'delete-unmatched' && (
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this record?</AlertDialogTitle>
              <AlertDialogDescription>
                The record leaves Hamster, but the file stays on disk and the next scan lists it
                again. Ignore it instead to keep it out of this list.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (confirm?.kind === 'cleanup') void cleanupCompleted()
                else if (confirm?.kind === 'delete-unmatched') void deleteUnmatched(confirm.item)
              }}
            >
              {confirm?.kind === 'cleanup' ? 'Delete' : 'Delete record'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
