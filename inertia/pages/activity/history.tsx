import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect, useCallback } from 'react'

interface HistoryItem {
  id: number
  title: string
  status: 'completed' | 'failed'
  size: number | null
  albumId: number | null
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

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [meta, setMeta] = useState<HistoryMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set())

  const toggleError = (id: number) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      })
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/v1/queue/history?${params}`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data.data)
        setMeta(data.meta)
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  const formatDate = (dateStr: string | null) => {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
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
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <AppLayout title="History">
      <Head title="History" />

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle>Download History</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectPopup>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <Spinner className="size-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No history yet</h3>
                <p className="text-muted-foreground">
                  Completed and failed downloads will appear here.
                </p>
              </div>
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
                              <div className="text-xs text-muted-foreground">{item.albumTitle}</div>
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

                {/* Pagination */}
                {meta && meta.lastPage > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {(meta.currentPage - 1) * meta.perPage + 1} to{' '}
                      {Math.min(meta.currentPage * meta.perPage, meta.total)} of {meta.total}{' '}
                      entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={meta.currentPage <= 1}
                      >
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {meta.currentPage} of {meta.lastPage}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
                        disabled={meta.currentPage >= meta.lastPage}
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
      </div>
    </AppLayout>
  )
}
