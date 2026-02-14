import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HugeiconsIcon } from '@hugeicons/react'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface NotificationHistoryItem {
  id: number
  providerName: string
  eventType: string
  success: boolean
  error: string | null
  sentAt: string
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

export default function SystemEvents() {
  const [notifHistory, setNotifHistory] = useState<NotificationHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const response = await fetch('/api/v1/notifications/history?limit=50')
      if (response.ok) {
        const data = await response.json()
        setNotifHistory(Array.isArray(data) ? data : data.data ?? [])
      }
    } catch {
      toast.error('Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData(false)
    setRefreshing(false)
    toast.success('Events refreshed')
  }

  return (
    <AppLayout
      title="Events"
      actions={
        <Button onClick={handleRefresh} disabled={refreshing}>
          <HugeiconsIcon
            icon={RefreshIcon}
            className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      }
    >
      <Head title="Events" />

      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : notifHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No events yet.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="w-36">Event</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-36">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.providerName}</div>
                        {item.error && (
                          <div className="text-xs text-destructive mt-0.5 truncate max-w-md">
                            {item.error}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.success ? (
                          <Badge className="bg-green-500">Sent</Badge>
                        ) : (
                          <Badge className="bg-red-500">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatRelativeTime(item.sentAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  )
}
