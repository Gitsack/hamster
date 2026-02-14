import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { HugeiconsIcon } from '@hugeicons/react'
import {
  RefreshIcon,
  Delete01Icon,
  CheckmarkCircle01Icon,
  ArrowDown01Icon,
  PauseIcon,
  FolderSearchIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface QueueItem {
  id: number
  externalId: string | null
  title: string
  status: string
  progress: number
  size: number | null
  remaining: number | null
  eta: number | null
  albumId: number | null
  downloadClient: string
  startedAt: string | null
}

export default function Queue() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [searchingRequested, setSearchingRequested] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQueue = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/queue')
      if (response.ok) {
        const data = await response.json()
        setQueue(data)
      } else {
        setError('Failed to fetch queue')
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()

    // Refresh every 5 seconds
    const interval = setInterval(() => fetchQueue(false), 5000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  const refreshQueue = async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/v1/queue/refresh', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        setQueue(data)
        toast.success('Queue refreshed')
      }
    } catch (err) {
      console.error('Failed to refresh queue:', err)
      toast.error('Failed to refresh queue')
    } finally {
      setRefreshing(false)
    }
  }

  const scanCompleted = async () => {
    setScanning(true)
    try {
      const response = await fetch('/api/v1/queue/scan-completed', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || 'Scan completed')
        // Refresh queue after scan
        fetchQueue(false)
      } else {
        toast.error(data.error || 'Scan failed')
      }
    } catch (err) {
      console.error('Failed to scan completed downloads:', err)
      toast.error('Failed to scan completed downloads')
    } finally {
      setScanning(false)
    }
  }

  const searchRequested = async () => {
    setSearchingRequested(true)
    try {
      const response = await fetch('/api/v1/queue/search-requested', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || 'Searching for requested items...')
      } else {
        toast.error(data.error || 'Search failed')
      }
    } catch (err) {
      console.error('Failed to search requested:', err)
      toast.error('Failed to search requested items')
    } finally {
      setSearchingRequested(false)
    }
  }

  const cancelDownload = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/queue/${deleteId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setQueue((prev) => prev.filter((item) => item.id !== deleteId))
        toast.success('Download cancelled')
      } else {
        toast.error('Failed to cancel download')
      }
    } catch (error) {
      console.error('Failed to cancel download:', error)
      toast.error('Failed to cancel download')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  const formatEta = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return '-'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const getStatusBadge = (status: string) => {
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
        return <Badge className="bg-green-500">Completed</Badge>
      case 'failed':
        return <Badge className="bg-red-500">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'downloading':
        return <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4 text-blue-500" />
      case 'paused':
        return <HugeiconsIcon icon={PauseIcon} className="h-4 w-4 text-muted-foreground" />
      default:
        return <Spinner className="text-muted-foreground" />
    }
  }

  return (
    <AppLayout
      title="Queue"
      actions={
        <div className="flex gap-2 flex-wrap">
          <Button onClick={searchRequested} disabled={searchingRequested} variant="outline" size="sm">
            <HugeiconsIcon
              icon={Search01Icon}
              className={`h-4 w-4 md:mr-2 ${searchingRequested ? 'animate-pulse' : ''}`}
            />
            <span className="hidden md:inline">{searchingRequested ? 'Searching...' : 'Search Requested'}</span>
          </Button>
          <Button onClick={scanCompleted} disabled={scanning} variant="outline" size="sm">
            <HugeiconsIcon
              icon={FolderSearchIcon}
              className={`h-4 w-4 md:mr-2 ${scanning ? 'animate-pulse' : ''}`}
            />
            <span className="hidden md:inline">{scanning ? 'Scanning...' : 'Import Completed'}</span>
          </Button>
          <Button onClick={refreshQueue} disabled={refreshing} size="sm">
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`h-4 w-4 md:mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      }
    >
      <Head title="Queue" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={() => fetchQueue()} variant="outline">
                  Try Again
                </Button>
              </div>
            ) : loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="h-12 w-12 text-green-500"
                  />
                </div>
                <h3 className="text-lg font-medium mb-2">No active downloads</h3>
                <p className="text-muted-foreground">
                  Downloads will appear here when you grab releases.
                </p>
              </div>
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
                          <div className="text-xs text-muted-foreground">{item.downloadClient}</div>
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
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(item.id)}>
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

        {/* Quick link to history */}
        <div className="text-center">
          <Link
            href="/activity/history"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            View download history
          </Link>
        </div>
      </div>

      {/* Cancel confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
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
              disabled={deleting}
            >
              {deleting ? 'Cancelling...' : 'Cancel Download'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
