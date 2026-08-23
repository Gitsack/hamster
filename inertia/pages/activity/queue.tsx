import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  RefreshIcon,
  Delete01Icon,
  CheckmarkCircle01Icon,
  FolderSearchIcon,
  Search01Icon,
  CleanIcon,
  Cancel01Icon,
  MoreVerticalIcon,
  Download01Icon,
  Clock01Icon,
  PauseIcon,
  PackageMovingIcon,
  Alert02Icon,
  ViewOffIcon,
  Copy01Icon,
  Archive01Icon,
  InboxIcon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useActiveDownloads, type QueueItem } from '@/hooks/use_active_downloads'

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

interface ImportingItem {
  id: string
  title: string
  status: string
  progress: number
  outputPath: string | null
  errorMessage: string | null
  mediaType: string | null
  movieId: string | null
  episodeId: string | null
  bookId: string | null
  albumId: string | null
  startedAt: string | null
  completedAt: string | null
  downloadClient: string | null
}

interface ParsedInfo {
  title?: string
  year?: number
  showTitle?: string
  seasonNumber?: number
  episodeNumber?: number
  artistName?: string
  albumTitle?: string
  authorName?: string
  bookTitle?: string
  quality?: string
}

interface UnmatchedItem {
  id: string
  fileName: string
  mediaType: string | null
  fileSizeBytes: number | null
  parsedInfo: ParsedInfo | null
  status: string
}

interface HistoryItem {
  id: string
  title: string
  status: 'completed' | 'failed'
  size: number | null
  albumId: string | null
  albumTitle: string | null
  downloadClient: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatEta(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '-'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  return timeAgoMs(new Date(dateStr).getTime())
}

function timeAgoMs(ms: number): string {
  if (!ms || ms <= 0) return '—'
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/**
 * Every row state in the control room resolves to the status ramp:
 *   transfer  — bytes are moving
 *   transit   — the file landed and is being imported
 *   queued    — waiting; nothing is wrong, nothing has happened yet
 *   complete  — the file is on disk
 *   failed    — it did not work, and the row says why
 * States the operator caused (paused, ignored) stay neutral: chroma is
 * reserved for what the media is doing. Colour never travels alone — each
 * badge carries an icon and a word as well.
 */
const STATUS_STYLES: Record<
  string,
  { label: string; className: string; icon: typeof RefreshIcon }
> = {
  downloading: {
    label: 'Downloading',
    className: 'border-transparent bg-status-transfer text-white',
    icon: Download01Icon,
  },
  importing: {
    label: 'Importing',
    className: 'border-transparent bg-status-transit text-white',
    icon: PackageMovingIcon,
  },
  queued: {
    label: 'Queued',
    className: 'border-transparent bg-status-queued text-white',
    icon: Clock01Icon,
  },
  pending: {
    label: 'Pending',
    className: 'border-transparent bg-status-queued text-white',
    icon: Clock01Icon,
  },
  completed: {
    label: 'Completed',
    className: 'border-transparent bg-status-complete text-white',
    icon: CheckmarkCircle01Icon,
  },
  failed: {
    label: 'Failed',
    className: 'border-transparent bg-status-failed text-white',
    icon: Alert02Icon,
  },
  paused: {
    label: 'Paused',
    className: 'border-border bg-muted text-muted-foreground',
    icon: PauseIcon,
  },
  ignored: {
    label: 'Ignored',
    className: 'border-border bg-muted text-muted-foreground',
    icon: ViewOffIcon,
  },
}

function getStatusBadge(status: string) {
  const style = STATUS_STYLES[status]
  if (!style) {
    return (
      <Badge variant="outline" className="readout">
        {status}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={`gap-1 ${style.className}`}>
      <HugeiconsIcon icon={style.icon} className="h-3 w-3" />
      {style.label}
    </Badge>
  )
}

function getMediaTypeBadge(mediaType: string | null) {
  switch (mediaType) {
    case 'music':
      return <Badge variant="outline">Music</Badge>
    case 'movies':
      return <Badge variant="outline">Movies</Badge>
    case 'tv':
      return <Badge variant="outline">TV</Badge>
    case 'books':
      return <Badge variant="outline">Books</Badge>
    default:
      return <Badge variant="outline">{mediaType || 'Unknown'}</Badge>
  }
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Activity() {
  const [activeTab, setActiveTab] = useState('activity')

  // Active downloads
  const { queue: sharedQueue, refresh: refreshSharedQueue } = useActiveDownloads()
  const [queueOverride, setQueueOverride] = useState<QueueItem[] | null>(null)
  const queue = queueOverride ?? sharedQueue
  const [queueLoading, setQueueLoading] = useState(true)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Recent errors + completed (status='failed' / 'completed')
  const [recentErrors, setRecentErrors] = useState<HistoryItem[]>([])
  const [recentCompleted, setRecentCompleted] = useState<HistoryItem[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [clearingFailed, setClearingFailed] = useState(false)
  const [confirmClearFailed, setConfirmClearFailed] = useState(false)

  // Completed folder state
  const [completedEntries, setCompletedEntries] = useState<CompletedEntry[]>([])
  const [importingItems, setImportingItems] = useState<ImportingItem[]>([])
  const [completedLoading, setCompletedLoading] = useState(true)
  const [completedFilter, setCompletedFilter] = useState<'all' | 'duplicates' | 'unpacking'>('all')
  const [cleaningUp, setCleaningUp] = useState(false)

  // Unmatched state
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([])
  const [unmatchedLoading, setUnmatchedLoading] = useState(true)
  const [unmatchedMediaFilter, setUnmatchedMediaFilter] = useState('all')
  const [unmatchedStatusFilter, setUnmatchedStatusFilter] = useState('pending')
  const [deleteUnmatchedId, setDeleteUnmatchedId] = useState<string | null>(null)
  const [deletingUnmatched, setDeletingUnmatched] = useState(false)
  const [bulkActioning, setBulkActioning] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)

  // Action loading states
  const [refreshing, setRefreshing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingMessages, setProcessingMessages] = useState<string[]>([])

  // Track lazy-loaded tabs
  const tabLoadedRef = useRef<Record<string, boolean>>({
    activity: false,
    pending: false,
    unmatched: false,
  })

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchQueue = useCallback(async () => {
    setQueueOverride(null)
    await refreshSharedQueue()
    setQueueLoading(false)
  }, [refreshSharedQueue])

  // Errors + recent completions both come from /queue/history with a status filter.
  // We fetch them in parallel; both feed the Activity tab.
  const fetchRecent = useCallback(async (showLoading = true) => {
    if (showLoading) setRecentLoading(true)
    try {
      const [failedRes, completedRes] = await Promise.all([
        fetch('/api/v1/queue/history?status=failed&limit=20'),
        fetch('/api/v1/queue/history?status=completed&limit=10'),
      ])
      if (failedRes.ok) {
        const data = await failedRes.json()
        setRecentErrors(data.data ?? [])
      }
      if (completedRes.ok) {
        const data = await completedRes.json()
        setRecentCompleted(data.data ?? [])
      }
    } catch {
      console.error('Failed to fetch recent activity')
    } finally {
      setRecentLoading(false)
    }
  }, [])

  const fetchCompleted = useCallback(async (showLoading = true) => {
    if (showLoading) setCompletedLoading(true)
    try {
      const response = await fetch('/api/v1/files/browse-completed')
      if (response.ok) {
        const data = await response.json()
        setCompletedEntries(data.entries ?? [])
        setImportingItems(data.importing ?? [])
      }
    } catch {
      console.error('Failed to fetch completed folder')
    } finally {
      setCompletedLoading(false)
    }
  }, [])

  const fetchUnmatched = useCallback(
    async (showLoading = true) => {
      if (showLoading) setUnmatchedLoading(true)
      try {
        const params = new URLSearchParams()
        if (unmatchedMediaFilter !== 'all') params.append('mediaType', unmatchedMediaFilter)
        if (unmatchedStatusFilter !== 'all') params.append('status', unmatchedStatusFilter)
        const response = await fetch(`/api/v1/unmatched?${params}`)
        if (response.ok) {
          const data = await response.json()
          setUnmatched(Array.isArray(data) ? data : (data.data ?? []))
        }
      } catch {
        console.error('Failed to fetch unmatched files')
      } finally {
        setUnmatchedLoading(false)
      }
    },
    [unmatchedMediaFilter, unmatchedStatusFilter]
  )

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchQueue()
    fetchRecent()
    tabLoadedRef.current.activity = true
  }, [fetchQueue, fetchRecent])

  useEffect(() => {
    if (activeTab === 'pending' && !tabLoadedRef.current.pending) {
      tabLoadedRef.current.pending = true
      fetchCompleted()
    } else if (activeTab === 'unmatched' && !tabLoadedRef.current.unmatched) {
      tabLoadedRef.current.unmatched = true
      fetchUnmatched()
    }
  }, [activeTab, fetchCompleted, fetchUnmatched])

  // Re-fetch unmatched when filters change
  useEffect(() => {
    if (tabLoadedRef.current.unmatched) {
      fetchUnmatched()
    }
  }, [unmatchedMediaFilter, unmatchedStatusFilter, fetchUnmatched])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const refreshActiveTab = async () => {
    setRefreshing(true)
    try {
      switch (activeTab) {
        case 'activity': {
          await fetch('/api/v1/queue/refresh', { method: 'POST' }).catch(() => null)
          await Promise.all([fetchQueue(), fetchRecent(false)])
          break
        }
        case 'pending':
          await fetchCompleted(false)
          break
        case 'unmatched':
          await fetchUnmatched(false)
          break
      }
    } catch {
      toast.error('Refresh failed — the server did not answer', {
        description: 'Hamster may be restarting. Try again in a moment.',
      })
    }
    setRefreshing(false)
  }

  const postAction = async (url: string, successMsg: string) => {
    try {
      const response = await fetch(url, { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || successMsg)
        fetchQueue()
      } else {
        toast.error(data.error || `The server rejected the request (HTTP ${response.status})`, {
          description: 'Nothing was changed. Check System → Logs for the full response.',
        })
      }
    } catch {
      toast.error('The request never reached the server', {
        description: 'Nothing was changed. Check that Hamster is still running, then retry.',
      })
    }
  }

  const processDownloads = async () => {
    if (processing) return
    setProcessing(true)
    setProcessingMessages([])

    try {
      const response = await fetch('/api/v1/files/scan-all-stream', { method: 'POST' })
      if (!response.ok || !response.body) {
        toast.error(`Could not start the download scan (HTTP ${response.status})`, {
          description: 'The completed folder was left untouched. Retry, or check the server logs.',
        })
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let totalImported = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.phase === 'done') {
              try {
                const summary = JSON.parse(event.message)
                totalImported = summary.totalImported || 0
              } catch {
                // not JSON summary
              }
            } else {
              setProcessingMessages((prev) => [...prev, event.message])
              if (event.action === 'imported' || event.action === 'cleaned') {
                fetchCompleted(false)
                fetchRecent(false)
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (totalImported > 0) {
        toast.success(`Done — ${totalImported} imported`)
      } else {
        toast.success('Done — no new imports')
      }
      fetchQueue()
      fetchCompleted(false)
      fetchUnmatched(false)
      fetchRecent(false)
    } catch {
      toast.error('The download scan stopped early', {
        description:
          'Anything already imported is kept. Run Process Downloads again to finish the rest.',
      })
    } finally {
      setProcessing(false)
    }
  }

  const cancelDownload = async () => {
    if (!cancelId) return
    setCancelling(true)
    try {
      const response = await fetch(`/api/v1/queue/${cancelId}`, { method: 'DELETE' })
      if (response.ok) {
        setQueueOverride((prev) => (prev ?? sharedQueue).filter((item) => item.id !== cancelId))
        toast.success('Download cancelled and removed from the queue')
        refreshSharedQueue()
      } else {
        toast.error('The download client refused to cancel this item', {
          description: 'It is still in the queue. Cancel it in the client itself, then refresh.',
        })
      }
    } catch {
      toast.error('Could not reach the server to cancel this download', {
        description: 'The item is unchanged. Refresh the queue and try again.',
      })
    } finally {
      setCancelling(false)
      setCancelId(null)
    }
  }

  const retryDownload = async (id: string) => {
    setActioningId(id)
    try {
      const response = await fetch(`/api/v1/queue/${id}/retry`, { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || 'Retry triggered')
        fetchRecent(false)
        fetchQueue()
      } else {
        toast.error(data.error || 'Retry rejected — no new grab was made', {
          description: 'The release may be blacklisted. Search the item again from its page.',
        })
      }
    } catch {
      toast.error('Could not reach the server to retry this grab', {
        description: 'Nothing was re-sent. Refresh and try again.',
      })
    } finally {
      setActioningId(null)
    }
  }

  const dismissError = async (id: string) => {
    setActioningId(id)
    try {
      const response = await fetch(`/api/v1/queue/${id}?deleteFiles=false`, { method: 'DELETE' })
      if (response.ok) {
        setRecentErrors((prev) => prev.filter((e) => e.id !== id))
      } else {
        toast.error('The error record could not be dismissed', {
          description: 'It is still listed. Refresh the tab and try again.',
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

  const clearAllFailed = async () => {
    setClearingFailed(true)
    try {
      const response = await fetch('/api/v1/queue/clear-failed', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || `Cleared ${data.count ?? ''} errors`)
        setRecentErrors([])
      } else {
        toast.error('The failed records could not be cleared', {
          description: 'They are still listed, and no files were touched. Try again.',
        })
      }
    } catch {
      toast.error('Could not reach the server to clear failed records', {
        description: 'Nothing was removed. Refresh and try again.',
      })
    } finally {
      setClearingFailed(false)
      setConfirmClearFailed(false)
    }
  }

  const cleanupCompleted = async () => {
    setCleaningUp(true)
    try {
      const response = await fetch('/api/v1/files/cleanup-completed', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        const freedMB = data.freedBytes ? ` (freed ${formatSize(data.freedBytes)})` : ''
        toast.success(`Removed ${data.deleted} items${freedMB}`)
        fetchCompleted(false)
      } else {
        toast.error(data.error || 'Cleanup failed — nothing was deleted', {
          description: 'Check that the completed folder is writable by Hamster, then retry.',
        })
      }
    } catch {
      toast.error('Could not reach the server to clean up the completed folder', {
        description: 'No files were deleted. Refresh and try again.',
      })
    } finally {
      setCleaningUp(false)
    }
  }

  const retryImportItem = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/queue/${id}/retry`, { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || 'Import retried')
        fetchCompleted(false)
      } else {
        toast.error(data.error || 'The import could not be retried', {
          description: 'The files are still in the completed folder. Check the error on the row.',
        })
      }
    } catch {
      toast.error('Could not reach the server to retry this import', {
        description: 'The files are untouched. Refresh and try again.',
      })
    }
  }

  const removeImport = async (id: string, deleteFiles = true) => {
    try {
      const response = await fetch(`/api/v1/queue/${id}?deleteFiles=${deleteFiles}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setImportingItems((prev) => prev.filter((item) => item.id !== id))
        toast.success('Download removed')
        fetchCompleted(false)
      } else {
        toast.error('The download could not be removed', {
          description: 'It is still queued and its files are untouched. Refresh and try again.',
        })
      }
    } catch {
      toast.error('Could not reach the server to remove this download', {
        description: 'Nothing was deleted. Refresh and try again.',
      })
    }
  }

  const ignoreUnmatched = async (id: string) => {
    setActioningId(id)
    try {
      const response = await fetch(`/api/v1/unmatched/${id}/ignore`, { method: 'POST' })
      if (response.ok) {
        toast.success('File ignored')
        fetchUnmatched(false)
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

  const deleteUnmatchedItem = async () => {
    if (!deleteUnmatchedId) return
    setDeletingUnmatched(true)
    try {
      const response = await fetch(`/api/v1/unmatched/${deleteUnmatchedId}`, { method: 'DELETE' })
      if (response.ok) {
        setUnmatched((prev) => prev.filter((item) => item.id !== deleteUnmatchedId))
        toast.success('File deleted')
      } else {
        toast.error('The unmatched record could not be deleted', {
          description: 'It is still listed. Refresh and try again.',
        })
      }
    } catch {
      toast.error('Could not reach the server to delete this record', {
        description: 'Nothing was removed. Refresh and try again.',
      })
    } finally {
      setDeletingUnmatched(false)
      setDeleteUnmatchedId(null)
    }
  }

  const bulkIgnoreUnmatched = async () => {
    setBulkActioning(true)
    try {
      const pendingIds = unmatched.filter((u) => u.status === 'pending').map((u) => u.id)
      if (pendingIds.length === 0) {
        toast.info('No pending files to ignore')
        setBulkActioning(false)
        return
      }
      const response = await fetch('/api/v1/unmatched/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingIds, status: 'ignored' }),
      })
      if (response.ok) {
        toast.success('All pending files ignored')
        fetchUnmatched(false)
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
      setBulkActioning(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const pendingUnmatchedCount = unmatched.filter((u) => u.status === 'pending').length
  const duplicateCount = completedEntries.filter((e) => e.isDuplicate || e.isUnpacking).length
  const pendingImportCount = completedEntries.length + importingItems.length
  const filteredCompleted = completedEntries.filter((e) => {
    if (completedFilter === 'duplicates') return e.isDuplicate
    if (completedFilter === 'unpacking') return e.isUnpacking
    return true
  })

  // One chronological feed mixing active, errors, and recent completions.
  // Sort key: startedAt for active rows (or now() if queued with no startedAt yet),
  // completedAt for finished rows.
  type FeedKind = 'active' | 'error' | 'completed'
  interface FeedItem {
    id: string
    kind: FeedKind
    status: string
    title: string
    subtitle: string | null
    errorMessage: string | null
    progress: number | null
    size: number | null
    eta: number | null
    timestamp: number
    timestampIso: string | null
  }

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []

    for (const q of queue) {
      const iso = q.startedAt ?? null
      items.push({
        id: q.id,
        kind: 'active',
        status: q.status,
        title: q.title,
        subtitle: q.downloadClient,
        errorMessage: null,
        progress: Number(q.progress) || 0,
        size: q.size,
        eta: q.eta,
        // Items without a startedAt (e.g. freshly queued) belong at the top.
        timestamp: iso ? new Date(iso).getTime() : Date.now(),
        timestampIso: iso,
      })
    }

    // Fall back to startedAt when completedAt is null — failed rows often
    // have no completedAt (e.g. when a download fails at import time before
    // the client marks it complete), but they always have a startedAt.
    const tsOf = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0)

    for (const e of recentErrors) {
      const iso = e.completedAt ?? e.startedAt
      items.push({
        id: e.id,
        kind: 'error',
        status: 'failed',
        title: e.title,
        subtitle: e.downloadClient ?? e.albumTitle ?? null,
        errorMessage: e.errorMessage,
        progress: null,
        size: e.size,
        eta: null,
        timestamp: tsOf(iso),
        timestampIso: iso,
      })
    }

    for (const c of recentCompleted) {
      const iso = c.completedAt ?? c.startedAt
      items.push({
        id: c.id,
        kind: 'completed',
        status: 'completed',
        title: c.title,
        subtitle: c.downloadClient ?? c.albumTitle ?? null,
        errorMessage: null,
        progress: null,
        size: c.size,
        eta: null,
        timestamp: tsOf(iso),
        timestampIso: iso,
      })
    }

    items.sort((a, b) => b.timestamp - a.timestamp)
    return items
  }, [queue, recentErrors, recentCompleted])

  const feedLoading = queueLoading || recentLoading

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppLayout
      title="Activity"
      actions={
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  postAction('/api/v1/queue/search-requested', 'Searching for requested items...')
                }
              >
                <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 mr-2" />
                Search Requested
              </DropdownMenuItem>
              <DropdownMenuItem onClick={processDownloads} disabled={processing}>
                <HugeiconsIcon icon={FolderSearchIcon} className="h-4 w-4 mr-2" />
                Process Downloads
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={refreshActiveTab}
            disabled={refreshing}
            size="sm"
            variant="outline"
            aria-label="Refresh"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      }
    >
      <Head title="Activity" />

      {processing && (
        // Import in progress — Transit Magenta, tinted, no side stripe.
        <Card className="mb-4 border-status-transit/30 bg-status-transit/5 py-4">
          <CardContent>
            <div className="mb-2 flex items-center gap-3">
              <Spinner className="size-4 text-status-transit-ink" />
              <span className="text-sm font-medium">Scanning completed downloads…</span>
              <span className="readout ml-auto text-xs text-muted-foreground">
                {processingMessages.length} steps
              </span>
            </div>
            {processingMessages.length > 0 && (
              <div className="ml-7 max-h-32 space-y-0.5 overflow-y-auto">
                {processingMessages.slice(-8).map((msg, i) => (
                  <p
                    key={i}
                    className={`readout text-xs ${
                      i === processingMessages.slice(-8).length - 1
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {msg}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="activity" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="activity" className="group">
            Activity
            {(queue.length > 0 || recentErrors.length > 0) && (
              <Badge
                variant="default"
                className="readout ml-1.5 px-1.5 py-0 text-xs group-data-[active]:bg-primary-foreground group-data-[active]:text-primary"
              >
                {queue.length + recentErrors.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="group">
            Pending Import
            {pendingImportCount > 0 && (
              <Badge
                variant="default"
                className="readout ml-1.5 px-1.5 py-0 text-xs group-data-[active]:bg-primary-foreground group-data-[active]:text-primary"
              >
                {pendingImportCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unmatched" className="group">
            Unmatched
            {pendingUnmatchedCount > 0 && (
              <Badge
                variant="default"
                className="readout ml-1.5 px-1.5 py-0 text-xs group-data-[active]:bg-primary-foreground group-data-[active]:text-primary"
              >
                {pendingUnmatchedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------------------- */}
        {/* Activity (one chronological feed: active + errors + completed)    */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="activity">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              {recentErrors.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClearFailed(true)}
                  disabled={clearingFailed}
                  className="text-muted-foreground"
                >
                  Clear errors
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {feedLoading ? (
                <TableSkeleton rows={5} />
              ) : feed.length === 0 ? (
                <EmptyState
                  icon={<HugeiconsIcon icon={InboxIcon} />}
                  title="Queue is empty"
                  message="Nothing is downloading, and nothing has failed recently. Grabs appear here the moment they are sent to a download client."
                />
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {/* Below md, Size and When fold into the Title cell so the
                            table reflows at 375px instead of scrolling sideways.
                            The action column stays: cancelling from a phone is the
                            reason the operator opened this screen. */}
                        <TableHead>Title</TableHead>
                        <TableHead className="md:w-32">Status</TableHead>
                        <TableHead className="hidden text-right md:table-cell md:w-24">
                          Size
                        </TableHead>
                        <TableHead className="hidden md:table-cell md:w-40">When</TableHead>
                        <TableHead className="md:w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feed.map((item) => {
                        const isActive = item.kind === 'active'
                        const isError = item.kind === 'error'
                        const isDownloading =
                          isActive &&
                          (item.status === 'downloading' ||
                            item.status === 'queued' ||
                            item.status === 'paused')
                        // "When" is relative-time-only; the Status badge already
                        // tells the user the row kind. Exception: when actively
                        // downloading with an ETA, that's more useful than
                        // "started Nm ago". We read the numeric `timestamp`
                        // (not the iso string) so freshly-queued items —
                        // which have no startedAt yet — render as "just now"
                        // instead of an empty cell.
                        const when =
                          isActive && item.eta && item.eta > 0
                            ? `${formatEta(item.eta)} left`
                            : timeAgoMs(item.timestamp)

                        return (
                          <TableRow key={`${item.kind}-${item.id}`}>
                            <TableCell className="py-2 max-w-md">
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className="readout truncate text-sm" title={item.title}>
                                  {item.title}
                                </span>
                                {item.subtitle && (
                                  <span className="readout shrink-0 text-xs text-muted-foreground">
                                    · {item.subtitle}
                                  </span>
                                )}
                              </div>
                              {/* What came back, on the row itself — not hidden
                                  behind a hover on the badge. */}
                              {isError && item.errorMessage && (
                                <Tooltip>
                                  <TooltipTrigger className="readout mt-0.5 block max-w-full cursor-help truncate text-left text-xs text-status-failed-ink">
                                    {item.errorMessage}
                                  </TooltipTrigger>
                                  <TooltipContent className="readout max-w-sm break-words whitespace-pre-wrap text-left">
                                    {item.errorMessage}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {isDownloading && item.progress !== null && (
                                <div className="mt-1 flex items-center gap-2">
                                  <Progress
                                    value={item.progress}
                                    className={`h-1 flex-1 ${
                                      item.status === 'downloading'
                                        ? '[&_[data-slot=progress-indicator]]:bg-status-transfer'
                                        : '[&_[data-slot=progress-indicator]]:bg-status-queued'
                                    }`}
                                    aria-label="Download progress"
                                  />
                                  <span className="readout shrink-0 text-xs text-muted-foreground">
                                    {item.progress.toFixed(0)}%
                                  </span>
                                </div>
                              )}
                              {/* Size and When live here below md, where their own
                                  columns are hidden. */}
                              <div
                                className="readout mt-0.5 flex gap-2 text-xs text-muted-foreground md:hidden"
                                title={item.timestampIso ?? ''}
                              >
                                <span>{formatSize(item.size)}</span>
                                <span aria-hidden="true">·</span>
                                <span>{when}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2">{getStatusBadge(item.status)}</TableCell>
                            <TableCell className="readout hidden py-2 text-right text-sm text-muted-foreground md:table-cell">
                              {formatSize(item.size)}
                            </TableCell>
                            <TableCell
                              className="readout hidden py-2 text-sm text-muted-foreground md:table-cell"
                              title={item.timestampIso ?? ''}
                            >
                              {when}
                            </TableCell>
                            <TableCell className="py-2">
                              {/* min-h-8 keeps row height consistent across
                                  rows with and without action buttons. */}
                              <div className="flex gap-1 justify-end min-h-8 items-center">
                                {isActive && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCancelId(item.id)}
                                    title="Cancel"
                                    aria-label="Cancel download"
                                  >
                                    <HugeiconsIcon
                                      icon={Delete01Icon}
                                      className="h-4 w-4 text-destructive"
                                    />
                                  </Button>
                                )}
                                {isError && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => retryDownload(item.id)}
                                      disabled={actioningId === item.id}
                                      title="Retry"
                                      aria-label="Retry"
                                    >
                                      {actioningId === item.id ? (
                                        <Spinner className="h-4 w-4" />
                                      ) : (
                                        <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => dismissError(item.id)}
                                      disabled={actioningId === item.id}
                                      title="Dismiss"
                                      aria-label="Dismiss"
                                    >
                                      <HugeiconsIcon
                                        icon={Cancel01Icon}
                                        className="h-4 w-4 text-muted-foreground"
                                      />
                                    </Button>
                                  </>
                                )}
                              </div>
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
        </TabsContent>

        {/* ----------------------------------------------------------------- */}
        {/* Pending Import Tab                                                 */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={completedFilter}
                    onValueChange={(v) =>
                      setCompletedFilter(v as 'all' | 'duplicates' | 'unpacking')
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="all">All ({completedEntries.length})</SelectItem>
                      <SelectItem value="duplicates">
                        Duplicates ({completedEntries.filter((e) => e.isDuplicate).length})
                      </SelectItem>
                      <SelectItem value="unpacking">
                        Unpacking ({completedEntries.filter((e) => e.isUnpacking).length})
                      </SelectItem>
                    </SelectPopup>
                  </Select>
                </div>
                {duplicateCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cleanupCompleted}
                    disabled={cleaningUp}
                    className="text-destructive"
                  >
                    <HugeiconsIcon
                      icon={CleanIcon}
                      className={`h-4 w-4 mr-2 ${cleaningUp ? 'animate-pulse' : ''}`}
                    />
                    {cleaningUp ? 'Cleaning...' : `Cleanup ${duplicateCount} duplicates & temp`}
                  </Button>
                )}
              </div>

              {completedLoading ? (
                <TableSkeleton rows={5} />
              ) : completedEntries.length === 0 && importingItems.length === 0 ? (
                <EmptyState
                  icon={<HugeiconsIcon icon={CheckmarkCircle01Icon} />}
                  title="Nothing pending import"
                  message="The completed folder is clear. Finished downloads land here first, then move into the library. If a file is stuck in the client, use Actions → Process Downloads."
                />
              ) : (
                <div className="space-y-6">
                  {importingItems.length > 0 && (
                    <div className="overflow-x-auto -mx-6 px-6">
                      <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                        Being imported — <span className="readout">{importingItems.length}</span>
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {/* Type and Time fold into the Name cell below md. */}
                            <TableHead>Name</TableHead>
                            <TableHead className="hidden md:table-cell md:w-24">Type</TableHead>
                            <TableHead className="md:w-32">Status</TableHead>
                            <TableHead className="hidden md:table-cell md:w-40">Time</TableHead>
                            <TableHead className="md:w-24"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importingItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="max-w-md">
                                <div className="readout truncate text-sm" title={item.title}>
                                  {item.title}
                                </div>
                                <div className="readout text-xs text-muted-foreground">
                                  {item.downloadClient ?? 'Unknown client'}
                                  <span className="md:hidden">
                                    {item.mediaType ? ` · ${item.mediaType}` : ''}
                                    {item.completedAt
                                      ? ` · downloaded ${timeAgo(item.completedAt)}`
                                      : item.startedAt
                                        ? ` · started ${timeAgo(item.startedAt)}`
                                        : ''}
                                  </span>
                                </div>
                                {item.errorMessage && (
                                  <div
                                    className="readout truncate text-xs text-status-failed-ink"
                                    title={item.errorMessage}
                                  >
                                    {item.errorMessage}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {item.mediaType ? (
                                  getMediaTypeBadge(
                                    item.mediaType as 'tv' | 'music' | 'movies' | 'books'
                                  )
                                ) : (
                                  <Badge variant="outline">?</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className="gap-1 border-transparent bg-status-transit text-white">
                                  <Spinner className="h-3 w-3" />
                                  Importing
                                </Badge>
                              </TableCell>
                              <TableCell className="readout hidden text-sm text-muted-foreground md:table-cell">
                                {item.completedAt ? (
                                  <div title={formatDateTime(item.completedAt)}>
                                    Downloaded {timeAgo(item.completedAt)}
                                  </div>
                                ) : item.startedAt ? (
                                  <div title={formatDateTime(item.startedAt)}>
                                    Started {timeAgo(item.startedAt)}
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => retryImportItem(item.id)}
                                    title="Retry import"
                                    aria-label="Retry import"
                                  >
                                    <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeImport(item.id)}
                                    title="Remove"
                                    aria-label="Remove import"
                                  >
                                    <HugeiconsIcon
                                      icon={Delete01Icon}
                                      className="h-4 w-4 text-destructive"
                                    />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {filteredCompleted.length === 0 && completedEntries.length > 0 ? (
                    <EmptyState
                      title="No entries match this filter"
                      message="The completed folder is not empty — switch the filter back to All to see everything in it."
                    />
                  ) : filteredCompleted.length > 0 ? (
                    <div className="overflow-x-auto -mx-6 px-6">
                      <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                        In the completed folder —{' '}
                        <span className="readout">{filteredCompleted.length}</span>
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {/* Type, Parsed and Dups fold into the Name cell below md. */}
                            <TableHead>Name</TableHead>
                            <TableHead className="hidden md:table-cell md:w-24">Type</TableHead>
                            <TableHead className="hidden md:table-cell md:w-48">Parsed</TableHead>
                            <TableHead className="hidden text-center md:table-cell md:w-16">
                              Dups
                            </TableHead>
                            <TableHead className="md:w-24">Flags</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCompleted.map((entry) => (
                            <TableRow
                              key={entry.name}
                              className={
                                entry.isDuplicate || entry.isUnpacking ? 'opacity-60' : undefined
                              }
                            >
                              <TableCell className="max-w-md">
                                <div className="readout truncate text-sm" title={entry.name}>
                                  {entry.name}
                                </div>
                                <div className="readout text-xs text-muted-foreground">
                                  {entry.downloadClientName}
                                  <span className="md:hidden">
                                    {` · ${entry.mediaType}`}
                                    {entry.title ? ` · ${entry.title}` : ''}
                                    {entry.year ? ` (${entry.year})` : ''}
                                    {entry.duplicateCount > 1 ? ` · ×${entry.duplicateCount}` : ''}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {getMediaTypeBadge(entry.mediaType)}
                              </TableCell>
                              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                                {entry.title}
                                {entry.year ? ` (${entry.year})` : ''}
                              </TableCell>
                              <TableCell className="hidden text-center md:table-cell">
                                {entry.duplicateCount > 1 && (
                                  <Badge variant="secondary" className="readout">
                                    {entry.duplicateCount}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {entry.isDuplicate && (
                                    <Badge
                                      variant="outline"
                                      className="gap-1 border-transparent bg-status-queued text-xs text-white"
                                      title="A copy of this release is already in the library"
                                    >
                                      <HugeiconsIcon icon={Copy01Icon} className="h-3 w-3" />
                                      Duplicate
                                    </Badge>
                                  )}
                                  {entry.isUnpacking && (
                                    <Badge
                                      variant="outline"
                                      className="gap-1 border-transparent bg-status-transit text-xs text-white"
                                      title="The download client is still unpacking this release"
                                    >
                                      <HugeiconsIcon icon={Archive01Icon} className="h-3 w-3" />
                                      Unpacking
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------------------------------------------------------- */}
        {/* Unmatched Tab                                                      */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="unmatched">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-2">
                  <Select value={unmatchedMediaFilter} onValueChange={setUnmatchedMediaFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Media Type" />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="music">Music</SelectItem>
                      <SelectItem value="movies">Movies</SelectItem>
                      <SelectItem value="tv">TV</SelectItem>
                      <SelectItem value="books">Books</SelectItem>
                    </SelectPopup>
                  </Select>
                  <Select value={unmatchedStatusFilter} onValueChange={setUnmatchedStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="ignored">Ignored</SelectItem>
                    </SelectPopup>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={bulkIgnoreUnmatched}
                  disabled={bulkActioning || pendingUnmatchedCount === 0}
                >
                  Ignore All Pending
                </Button>
              </div>

              {unmatchedLoading ? (
                <TableSkeleton rows={3} />
              ) : unmatched.length === 0 ? (
                <EmptyState
                  icon={<HugeiconsIcon icon={CheckmarkCircle01Icon} />}
                  title="No unmatched files"
                  message="Every scanned file was matched to a library item. Files the scanner cannot identify land here, where you can ignore or delete them."
                />
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {/* Type, Parsed Info and Size fold into the File Name cell below md. */}
                        <TableHead>File Name</TableHead>
                        <TableHead className="hidden md:table-cell md:w-24">Type</TableHead>
                        <TableHead className="hidden md:table-cell md:w-48">Parsed Info</TableHead>
                        <TableHead className="hidden text-right md:table-cell md:w-24">
                          Size
                        </TableHead>
                        <TableHead className="md:w-24">Status</TableHead>
                        <TableHead className="md:w-28"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmatched.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-xs">
                            <div className="readout truncate text-sm" title={item.fileName}>
                              {item.fileName}
                            </div>
                            <div className="readout text-xs text-muted-foreground md:hidden">
                              {item.mediaType}
                              {item.parsedInfo?.title
                                ? ` · ${item.parsedInfo.title}${
                                    item.parsedInfo.year ? ` (${item.parsedInfo.year})` : ''
                                  }`
                                : ' · could not be parsed'}
                              {` · ${formatSize(item.fileSizeBytes)}`}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {getMediaTypeBadge(item.mediaType)}
                          </TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                            {item.parsedInfo?.title ? (
                              <span>
                                {item.parsedInfo.title}
                                {item.parsedInfo.year ? ` (${item.parsedInfo.year})` : ''}
                              </span>
                            ) : (
                              <span className="text-xs">Could not be parsed</span>
                            )}
                          </TableCell>
                          <TableCell className="readout hidden text-right text-sm text-muted-foreground md:table-cell">
                            {formatSize(item.fileSizeBytes)}
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {item.status !== 'ignored' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => ignoreUnmatched(item.id)}
                                  disabled={actioningId === item.id}
                                >
                                  {actioningId === item.id ? (
                                    <Spinner className="h-3 w-3" />
                                  ) : (
                                    'Ignore'
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteUnmatchedId(item.id)}
                                title="Delete record"
                                aria-label="Delete unmatched file record"
                              >
                                <HugeiconsIcon
                                  icon={Delete01Icon}
                                  className="h-4 w-4 text-destructive"
                                />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cancel download confirmation */}
      <AlertDialog open={cancelId !== null} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel download?</AlertDialogTitle>
            <AlertDialogDescription>
              The download client stops the transfer and the item leaves the queue. Partial files in
              the download folder are removed by the client; nothing already imported is touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={cancelDownload}
              className="bg-destructive text-destructive-foreground"
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Download'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all errors confirmation */}
      <AlertDialog open={confirmClearFailed} onOpenChange={setConfirmClearFailed}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all errors?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the {recentErrors.length} failed download records. Files on disk are not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearAllFailed}
              className="bg-destructive text-destructive-foreground"
              disabled={clearingFailed}
            >
              {clearingFailed ? 'Clearing...' : 'Clear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete unmatched item confirmation */}
      <AlertDialog
        open={deleteUnmatchedId !== null}
        onOpenChange={() => setDeleteUnmatchedId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the unmatched record from Hamster. The file itself stays on disk and will
              be picked up again by the next scan unless you ignore it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUnmatchedItem}
              className="bg-destructive text-destructive-foreground"
              disabled={deletingUnmatched}
            >
              {deletingUnmatched ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
