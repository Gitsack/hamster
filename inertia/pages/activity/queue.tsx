import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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

function getStatusBadge(status: string) {
  switch (status) {
    case 'downloading':
      return <Badge className="bg-blue-500">Downloading</Badge>
    case 'paused':
      return <Badge variant="secondary">Paused</Badge>
    case 'queued':
      return <Badge variant="outline">Queued</Badge>
    case 'importing':
      return <Badge className="bg-purple-500">Importing</Badge>
    case 'completed':
      return (
        <Badge className="bg-green-500">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="destructive">
          <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    case 'pending':
      return <Badge variant="outline">Pending</Badge>
    case 'ignored':
      return <Badge variant="secondary">Ignored</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
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
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="rounded-full bg-muted p-6 mb-4">{icon}</div>}
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
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
      toast.error('Failed to refresh')
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
        toast.error(data.error || 'Action failed')
      }
    } catch {
      toast.error('Action failed')
    }
  }

  const processDownloads = async () => {
    if (processing) return
    setProcessing(true)
    setProcessingMessages([])

    try {
      const response = await fetch('/api/v1/files/scan-all-stream', { method: 'POST' })
      if (!response.ok || !response.body) {
        toast.error('Failed to process downloads')
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
      toast.error('Failed to process downloads')
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
        toast.success('Download cancelled')
        refreshSharedQueue()
      } else {
        toast.error('Failed to cancel download')
      }
    } catch {
      toast.error('Failed to cancel download')
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
        toast.error(data.error || 'Retry failed')
      }
    } catch {
      toast.error('Retry failed')
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
        toast.error('Failed to dismiss')
      }
    } catch {
      toast.error('Failed to dismiss')
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
        toast.error('Failed to clear errors')
      }
    } catch {
      toast.error('Failed to clear errors')
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
        toast.error(data.error || 'Cleanup failed')
      }
    } catch {
      toast.error('Cleanup failed')
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
        toast.error(data.error || 'Retry failed')
      }
    } catch {
      toast.error('Retry failed')
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
        toast.error('Failed to remove download')
      }
    } catch {
      toast.error('Failed to remove download')
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
        toast.error('Failed to ignore file')
      }
    } catch {
      toast.error('Failed to ignore file')
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
        toast.error('Failed to delete file')
      }
    } catch {
      toast.error('Failed to delete file')
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
        toast.error('Failed to ignore files')
      }
    } catch {
      toast.error('Failed to ignore files')
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
    const tsOf = (iso: string | null): number =>
      iso ? new Date(iso).getTime() : 0

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
        <Card className="mb-4 border-blue-500/30 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-2">
              <Spinner className="size-4" />
              <span className="text-sm font-medium">Processing downloads...</span>
            </div>
            {processingMessages.length > 0 && (
              <div className="ml-7 space-y-0.5 max-h-32 overflow-y-auto">
                {processingMessages.slice(-8).map((msg, i) => (
                  <p
                    key={i}
                    className={`text-xs ${
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
                className="ml-1.5 text-xs px-1.5 py-0 group-data-[active]:bg-white group-data-[active]:text-primary"
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
                className="ml-1.5 text-xs px-1.5 py-0 group-data-[active]:bg-white group-data-[active]:text-primary"
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
                className="ml-1.5 text-xs px-1.5 py-0 group-data-[active]:bg-white group-data-[active]:text-primary"
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
                  icon={
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      className="h-12 w-12 text-muted-foreground"
                    />
                  }
                  title="Nothing happening"
                  subtitle="Active downloads and recently finished items will show up here."
                />
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-24 text-right">Size</TableHead>
                        <TableHead className="w-40">When</TableHead>
                        <TableHead className="w-24"></TableHead>
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
                                <span
                                  className="font-medium truncate text-sm"
                                  title={item.title}
                                >
                                  {item.title}
                                </span>
                                {item.subtitle && (
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    · {item.subtitle}
                                  </span>
                                )}
                              </div>
                              {isDownloading && item.progress !== null && (
                                <div className="mt-1 flex items-center gap-2">
                                  <Progress
                                    value={item.progress}
                                    className="h-1 flex-1"
                                    aria-label="Download progress"
                                  />
                                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                                    {item.progress.toFixed(0)}%
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              {isError && item.errorMessage ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">
                                      {getStatusBadge(item.status)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm break-words whitespace-pre-wrap text-left">
                                    {item.errorMessage}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                getStatusBadge(item.status)
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right text-muted-foreground text-sm tabular-nums">
                              {formatSize(item.size)}
                            </TableCell>
                            <TableCell
                              className="py-2 text-muted-foreground text-sm"
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
                  icon={
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      className="h-12 w-12 text-muted-foreground"
                    />
                  }
                  title="Nothing pending"
                  subtitle="Downloads waiting to be imported will appear here."
                />
              ) : (
                <div className="space-y-6">
                  {importingItems.length > 0 && (
                    <div className="overflow-x-auto -mx-6 px-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-24">Type</TableHead>
                            <TableHead className="w-32">Status</TableHead>
                            <TableHead className="w-40">Time</TableHead>
                            <TableHead className="w-24"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importingItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="max-w-md">
                                <div className="font-medium truncate" title={item.title}>
                                  {item.title}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {item.downloadClient ?? 'Unknown client'}
                                  {item.errorMessage && (
                                    <span className="text-destructive ml-2">
                                      {item.errorMessage}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {item.mediaType ? (
                                  getMediaTypeBadge(
                                    item.mediaType as 'tv' | 'music' | 'movies' | 'books'
                                  )
                                ) : (
                                  <Badge variant="outline">?</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-purple-500">
                                  <Spinner className="h-3 w-3 mr-1" />
                                  Importing
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
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
                    <EmptyState title="No matching entries" subtitle="Try a different filter." />
                  ) : filteredCompleted.length > 0 ? (
                    <div className="overflow-x-auto -mx-6 px-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-24">Type</TableHead>
                            <TableHead className="w-48">Parsed</TableHead>
                            <TableHead className="w-16 text-center">Dups</TableHead>
                            <TableHead className="w-24">Flags</TableHead>
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
                                <div className="font-medium truncate" title={entry.name}>
                                  {entry.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {entry.downloadClientName}
                                </div>
                              </TableCell>
                              <TableCell>{getMediaTypeBadge(entry.mediaType)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {entry.title}
                                {entry.year ? ` (${entry.year})` : ''}
                              </TableCell>
                              <TableCell className="text-center">
                                {entry.duplicateCount > 1 && (
                                  <Badge variant="secondary">{entry.duplicateCount}</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {entry.isDuplicate && (
                                    <Badge
                                      variant="outline"
                                      className="text-yellow-600 border-yellow-600 text-xs"
                                    >
                                      dup
                                    </Badge>
                                  )}
                                  {entry.isUnpacking && (
                                    <Badge
                                      variant="outline"
                                      className="text-orange-600 border-orange-600 text-xs"
                                    >
                                      temp
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
                  icon={
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      className="h-12 w-12 text-muted-foreground"
                    />
                  }
                  title="No unmatched files"
                  subtitle="Files that couldn't be matched to library items will appear here."
                />
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead className="w-24">Type</TableHead>
                        <TableHead className="w-48">Parsed Info</TableHead>
                        <TableHead className="w-24 text-right">Size</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-28"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmatched.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-xs">
                            <div className="font-medium truncate">{item.fileName}</div>
                          </TableCell>
                          <TableCell>{getMediaTypeBadge(item.mediaType)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.parsedInfo?.title ? (
                              <span>
                                {item.parsedInfo.title}
                                {item.parsedInfo.year ? ` (${item.parsedInfo.year})` : ''}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
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
              This will cancel and remove the download from the queue.
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
              This removes the {recentErrors.length} failed download records. Files on disk are
              not affected.
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
              This will permanently delete the unmatched file record.
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
