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
import {
  RefreshIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Notification01Icon,
} from '@hugeicons/core-free-icons'
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
        setNotifHistory(Array.isArray(data) ? data : (data.data ?? []))
      }
    } catch {
      toast.error('Could not load notification history', {
        description:
          '/api/v1/notifications/history did not respond. Check that the server is running, then hit Refresh.',
      })
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
            aria-hidden="true"
            className={refreshing ? 'animate-spin' : undefined}
          />
          Refresh
        </Button>
      }
    >
      <Head title="Events" />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Notification History</CardTitle>
            {!loading && notifHistory.length > 0 && (
              <span className="readout text-xs text-muted-foreground">
                {notifHistory.length} most recent
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : notifHistory.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <HugeiconsIcon
                  icon={Notification01Icon}
                  aria-hidden="true"
                  className="size-6 text-muted-foreground"
                />
              </div>
              <p className="mt-4 text-lg font-medium">No delivery attempts recorded</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Every notification Hamster sends is logged here with its result. Connect a provider
                under Settings → Notifications to start recording deliveries.
              </p>
            </div>
          ) : (
            <div className="-mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Provider</TableHead>
                    <TableHead className="w-40">Event</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-28 pr-6" data-numeric>
                      Time
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-6">
                        <div className="text-sm font-medium">{item.providerName}</div>
                        {item.error && (
                          <div className="readout mt-0.5 max-w-md truncate text-xs text-destructive">
                            {item.error}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="readout">
                          {item.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.success ? (
                          <Badge className="border-transparent bg-status-complete text-white">
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} aria-hidden="true" />
                            Sent
                          </Badge>
                        ) : (
                          <Badge className="border-transparent bg-status-failed text-white">
                            <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-muted-foreground" data-numeric>
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
