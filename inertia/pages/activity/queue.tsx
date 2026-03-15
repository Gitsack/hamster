import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  RefreshIcon,
  Delete01Icon,
  CheckmarkCircle01Icon,
  ArrowDown01Icon,
  PauseIcon,
  FolderSearchIcon,
  Search01Icon,
  CleanIcon,
  Cancel01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  MoreVerticalIcon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueItem {
  id: string
  externalId: string | null
  title: string
  status: string
  progress: number
  size: number | null
  remaining: number | null
  eta: number | null
  albumId: string | null
  downloadClient: string
  startedAt: string | null
}

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

interface HistoryMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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

function getStatusIcon(status: string) {
  switch (status) {
    case 'downloading':
      return <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4 text-blue-500" />
    case 'paused':
      return <HugeiconsIcon icon={PauseIcon} className="h-4 w-4 text-muted-foreground" />
    default:
      return <Spinner className="text-muted-foreground" />
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
  const [activeTab, setActiveTab] = useState('downloads')

  // Downloads state
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Completed folder state
  const [completedEntries, setCompletedEntries] = useState<CompletedEntry[]>([])
  const [completedLoading, setCompletedLoading] = useState(true)
  const [completedFilter, setCompletedFilter] = useState<'all' | 'duplicates' | 'unpacking'>('all')
  const [cleaningUp, setCleaningUp] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)

  // Unmatched state
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([])
  const [unmatchedLoading, setUnmatchedLoading] = useState(true)
  const [unmatchedMediaFilter, setUnmatchedMediaFilter] = useState('all')
  const [unmatchedStatusFilter, setUnmatchedStatusFilter] = useState('pending')
  const [deleteUnmatchedId, setDeleteUnmatchedId] = useState<string | null>(null)
  const [deletingUnmatched, setDeletingUnmatched] = useState(false)
  const [bulkActioning, setBulkActioning] = useState(false)

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyMeta, setHistoryMeta] = useState<HistoryMeta | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all')
  const [historyPage, setHistoryPage] = useState(1)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  // Action loading states
  const [refreshing, setRefreshing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingMessages, setProcessingMessages] = useState<string[]>([])

  // Track whether tabs have been loaded at least once
  const tabLoadedRef = useRef<Record<string, boolean>>({
    downloads: false,
    completed: false,
    unmatched: false,
    history: false,
  })

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchQueue = useCallback(async (showLoading = true) => {
    if (showLoading) setQueueLoading(true)
    setQueueError(null)
    try {
      const response = await fetch('/api/v1/queue')
      if (response.ok) {
        const data = await response.json()
        setQueue(data)
      } else {
        setQueueError('Failed to fetch queue')
      }
    } catch {
      setQueueError('Failed to connect to server')
    } finally {
      setQueueLoading(false)
    }
  }, [])

  const fetchCompleted = useCallback(async (showLoading = true) => {
    if (showLoading) setCompletedLoading(true)
    try {
      const response = await fetch('/api/v1/files/browse-completed')
      if (response.ok) {
        const data = await response.json()
        setCompletedEntries(data.entries ?? [])
      }
    } catch {
      console.error('Failed to fetch completed folder')
    } finally {
      setCompletedLoading(false)
    }
  }, [])

  const fetchUnmatched = useCallback(async (showLoading = true) => {
    if (showLoading) setUnmatchedLoading(true)
    try {
      const params = new URLSearchParams()
      if (unmatchedMediaFilter !== 'all') params.append('mediaType', unmatchedMediaFilter)
      if (unmatchedStatusFilter !== 'all') params.append('status', unmatchedStatusFilter)
      const response = await fetch(`/api/v1/unmatched?${params}`)
      if (response.ok) {
        const data = await response.json()
        setUnmatched(Array.isArray(data) ? data : data.data ?? [])
      }
    } catch {
      console.error('Failed to fetch unmatched files')
    } finally {
      setUnmatchedLoading(false)
    }
  }, [unmatchedMediaFilter, unmatchedStatusFilter])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        page: historyPage.toString(),
        limit: '25',
      })
      if (historyStatusFilter !== 'all') params.append('status', historyStatusFilter)
      const response = await fetch(`/api/v1/queue/history?${params}`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data.data)
        setHistoryMeta(data.meta)
      }
    } catch {
      console.error('Failed to fetch history')
    } finally {
      setHistoryLoading(false)
    }
  }, [historyPage, historyStatusFilter])

  // ---------------------------------------------------------------------------
  // Initial load & auto-refresh for downloads tab
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchQueue()
    tabLoadedRef.current.downloads = true
  }, [fetchQueue])

  // Auto-refresh downloads every 5 seconds when on downloads tab
  useEffect(() => {
    if (activeTab !== 'downloads') return
    const interval = setInterval(() => fetchQueue(false), 5000)
    return () => clearInterval(interval)
  }, [activeTab, fetchQueue])

  // Fetch tab data when switching tabs (only first time)
  useEffect(() => {
    if (activeTab === 'completed' && !tabLoadedRef.current.completed) {
      tabLoadedRef.current.completed = true
      fetchCompleted()
    } else if (activeTab === 'unmatched' && !tabLoadedRef.current.unmatched) {
      tabLoadedRef.current.unmatched = true
      fetchUnmatched()
    } else if (activeTab === 'history' && !tabLoadedRef.current.history) {
      tabLoadedRef.current.history = true
      fetchHistory()
    }
  }, [activeTab, fetchCompleted, fetchUnmatched, fetchHistory])

  // Re-fetch unmatched when filters change
  useEffect(() => {
    if (tabLoadedRef.current.unmatched) {
      fetchUnmatched()
    }
  }, [unmatchedMediaFilter, unmatchedStatusFilter, fetchUnmatched])

  // Re-fetch history when filters/page change
  useEffect(() => {
    if (tabLoadedRef.current.history) {
      fetchHistory()
    }
  }, [historyPage, historyStatusFilter, fetchHistory])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const refreshActiveTab = async () => {
    setRefreshing(true)
    try {
      switch (activeTab) {
        case 'downloads': {
          const response = await fetch('/api/v1/queue/refresh', { method: 'POST' })
          if (response.ok) {
            const data = await response.json()
            setQueue(data)
          }
          break
        }
        case 'completed':
          await fetchCompleted(false)
          break
        case 'unmatched':
          await fetchUnmatched(false)
          break
        case 'history':
          await fetchHistory()
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
        fetchQueue(false)
        if (activeTab === 'completed') fetchCompleted(false)
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
              // Refresh the pending import list when items are imported or cleaned up
              if (event.action === 'imported' || event.action === 'cleaned') {
                fetchCompleted(false)
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
      fetchQueue(false)
      fetchCompleted(false)
      fetchUnmatched(false)
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
        setQueue((prev) => prev.filter((item) => item.id !== cancelId))
        toast.success('Download cancelled')
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

  // Completed folder actions
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

  // Unmatched tab actions
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

  const bulkDeleteUnmatched = async () => {
    setBulkActioning(true)
    try {
      const ids = unmatched.map((u) => u.id)
      if (ids.length === 0) {
        toast.info('No files to delete')
        setBulkActioning(false)
        return
      }
      const response = await fetch('/api/v1/unmatched/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (response.ok) {
        toast.success('All files deleted')
        fetchUnmatched(false)
      } else {
        toast.error('Failed to delete files')
      }
    } catch {
      toast.error('Failed to delete files')
    } finally {
      setBulkActioning(false)
    }
  }

  const toggleError = (id: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Counts for tab badges
  // ---------------------------------------------------------------------------

  const pendingUnmatchedCount = unmatched.filter((u) => u.status === 'pending').length
  const duplicateCount = completedEntries.filter((e) => e.isDuplicate || e.isUnpacking).length
  const filteredCompleted = completedEntries.filter((e) => {
    if (completedFilter === 'duplicates') return e.isDuplicate
    if (completedFilter === 'unpacking') return e.isUnpacking
    return true
  })

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
                onClick={() => postAction('/api/v1/queue/search-requested', 'Searching for requested items...')}
              >
                <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 mr-2" />
                Search Requested
              </DropdownMenuItem>
              <DropdownMenuItem onClick={processDownloads} disabled={processing}>
                <HugeiconsIcon icon={FolderSearchIcon} className="h-4 w-4 mr-2" />
                Process Downloads
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => postAction('/api/v1/queue/deduplicate', 'Deduplication complete')}
              >
                <HugeiconsIcon icon={CleanIcon} className="h-4 w-4 mr-2" />
                Deduplicate Queue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={refreshActiveTab} disabled={refreshing} size="sm" variant="outline">
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

      <Tabs defaultValue="downloads" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="downloads">
            Downloads
            {queue.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                {queue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Pending Import
            {completedEntries.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                {completedEntries.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unmatched">
            Unmatched
            {pendingUnmatchedCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                {pendingUnmatchedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------------------- */}
        {/* Downloads Tab                                                      */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="downloads">
          <Card>
            <CardContent className="pt-6">
              {queueError ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-destructive mb-4">{queueError}</p>
                  <Button onClick={() => fetchQueue()} variant="outline">
                    Try Again
                  </Button>
                </div>
              ) : queueLoading ? (
                <TableSkeleton rows={3} />
              ) : queue.length === 0 ? (
                <EmptyState
                  icon={
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      className="h-12 w-12 text-green-500"
                    />
                  }
                  title="No active downloads"
                  subtitle="Downloads will appear here when you grab releases."
                />
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-48">Progress</TableHead>
                        <TableHead className="w-24 text-right">Size</TableHead>
                        <TableHead className="w-24 text-right">ETA</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queue.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{getStatusIcon(item.status)}</TableCell>
                          <TableCell>
                            <div className="font-medium truncate max-w-md">{item.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.downloadClient}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={Number(item.progress) || 0} className="h-2" />
                              <div className="text-xs text-muted-foreground">
                                {(Number(item.progress) || 0).toFixed(1)}%
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatSize(item.size)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatEta(item.eta)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCancelId(item.id)}
                            >
                              <HugeiconsIcon
                                icon={Delete01Icon}
                                className="h-4 w-4 text-destructive"
                              />
                            </Button>
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

        {/* ----------------------------------------------------------------- */}
        {/* Completed Tab                                                      */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="completed">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={completedFilter}
                    onValueChange={(v) => setCompletedFilter(v as 'all' | 'duplicates' | 'unpacking')}
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
                    <HugeiconsIcon icon={CleanIcon} className={`h-4 w-4 mr-2 ${cleaningUp ? 'animate-pulse' : ''}`} />
                    {cleaningUp ? 'Cleaning...' : `Cleanup ${duplicateCount} duplicates & temp`}
                  </Button>
                )}
              </div>

              {completedLoading ? (
                <TableSkeleton rows={5} />
              ) : completedEntries.length === 0 ? (
                <EmptyState
                  icon={
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      className="h-12 w-12 text-muted-foreground"
                    />
                  }
                  title="Download folder is empty"
                  subtitle="Downloads waiting to be imported will appear here."
                />
              ) : filteredCompleted.length === 0 ? (
                <EmptyState
                  title="No matching entries"
                  subtitle="Try a different filter."
                />
              ) : (
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
                            entry.isDuplicate || entry.isUnpacking
                              ? 'opacity-60'
                              : undefined
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
                                <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">
                                  dup
                                </Badge>
                              )}
                              {entry.isUnpacking && (
                                <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={bulkIgnoreUnmatched}
                    disabled={bulkActioning || pendingUnmatchedCount === 0}
                  >
                    Ignore All Pending
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={bulkDeleteUnmatched}
                    disabled={bulkActioning || unmatched.length === 0}
                    className="text-destructive"
                  >
                    Delete All
                  </Button>
                </div>
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

        {/* ----------------------------------------------------------------- */}
        {/* History Tab                                                        */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <Select
                  value={historyStatusFilter}
                  onValueChange={(v) => {
                    setHistoryStatusFilter(v)
                    setHistoryPage(1)
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectPopup>
                </Select>
              </div>

              {historyLoading ? (
                <TableSkeleton rows={5} />
              ) : history.length === 0 ? (
                <EmptyState
                  icon={<Spinner className="size-12 text-muted-foreground" />}
                  title="No history yet"
                  subtitle="Completed and failed downloads will appear here."
                />
              ) : (
                <>
                  <div className="overflow-x-auto -mx-6 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead className="w-28">Status</TableHead>
                          <TableHead className="w-24 text-right">Size</TableHead>
                          <TableHead className="w-40">Client</TableHead>
                          <TableHead className="w-44">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="max-w-md">
                              <div className="font-medium truncate">{item.title}</div>
                              {item.albumTitle && (
                                <div className="text-xs text-muted-foreground">
                                  {item.albumTitle}
                                </div>
                              )}
                              {item.errorMessage && (
                                <div
                                  className="text-xs text-destructive mt-1 cursor-pointer hover:text-destructive/80"
                                  onClick={() => toggleError(item.id)}
                                >
                                  {expandedErrors.has(item.id) ? (
                                    <span className="break-words whitespace-pre-wrap">
                                      {item.errorMessage}
                                    </span>
                                  ) : (
                                    <span className="line-clamp-1">{item.errorMessage}</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatSize(item.size)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.downloadClient || '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(item.completedAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {historyMeta && historyMeta.lastPage > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Showing {(historyMeta.currentPage - 1) * historyMeta.perPage + 1} to{' '}
                        {Math.min(historyMeta.currentPage * historyMeta.perPage, historyMeta.total)}{' '}
                        of {historyMeta.total} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          disabled={historyMeta.currentPage <= 1}
                        >
                          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                          Page {historyMeta.currentPage} of {historyMeta.lastPage}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setHistoryPage((p) => Math.min(historyMeta.lastPage, p + 1))
                          }
                          disabled={historyMeta.currentPage >= historyMeta.lastPage}
                        >
                          <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
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
