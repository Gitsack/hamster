import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  RefreshIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Alert01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface HealthCheck {
  name: string
  status: 'ok' | 'warning' | 'error'
  message?: string
}

interface HealthData {
  status: 'ok' | 'warning' | 'error'
  version: string
  uptime: number
  checks: HealthCheck[]
  timestamp: string
}

interface SystemInfo {
  version: string
  nodeVersion: string
  platform: string
  arch: string
  uptime: number
  memory: {
    used: number
    total: number
  }
}

const CHECK_LABELS: Record<string, string> = {
  database: 'Database',
  rootFolders: 'Root Folders',
  indexers: 'Indexers',
  downloadClients: 'Download Clients',
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (parts.length === 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}

function StatusIcon({ status }: { status: 'ok' | 'warning' | 'error' }) {
  switch (status) {
    case 'ok':
      return <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5 text-green-500" />
    case 'warning':
      return <HugeiconsIcon icon={Alert01Icon} className="h-5 w-5 text-yellow-500" />
    case 'error':
      return <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5 text-red-500" />
  }
}

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'error' }) {
  switch (status) {
    case 'ok':
      return <Badge className="bg-green-500">Healthy</Badge>
    case 'warning':
      return <Badge className="bg-yellow-500 text-black">Warning</Badge>
    case 'error':
      return <Badge className="bg-red-500">Error</Badge>
  }
}

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [healthRes, infoRes] = await Promise.all([
        fetch('/health'),
        fetch('/api/v1/system/info'),
      ])

      if (healthRes.ok) {
        setHealth(await healthRes.json())
      }
      if (infoRes.ok) {
        setSystemInfo(await infoRes.json())
      }
    } catch {
      toast.error('Failed to fetch system status')
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
    toast.success('Status refreshed')
  }

  return (
    <AppLayout
      title="System Status"
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
      <Head title="System Status" />

      <div className="space-y-6">
        {/* Overall Status */}
        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* System Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>System Information</CardTitle>
                  {health && <StatusBadge status={health.status} />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Version</div>
                    <div className="text-sm font-medium">
                      {systemInfo?.version || health?.version || '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Node.js</div>
                    <div className="text-sm font-medium">{systemInfo?.nodeVersion || '-'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Platform</div>
                    <div className="text-sm font-medium">
                      {systemInfo ? `${systemInfo.platform} (${systemInfo.arch})` : '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Uptime</div>
                    <div className="text-sm font-medium">
                      {systemInfo ? formatUptime(systemInfo.uptime) : '-'}
                    </div>
                  </div>
                </div>

                {systemInfo && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground mb-2">Memory Usage</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-2.5">
                        <div
                          className="bg-primary rounded-full h-2.5 transition-all"
                          style={{
                            width: `${Math.min((systemInfo.memory.used / systemInfo.memory.total) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">
                        {systemInfo.memory.used} / {systemInfo.memory.total} MB
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Health Checks */}
            <Card>
              <CardHeader>
                <CardTitle>Health Checks</CardTitle>
              </CardHeader>
              <CardContent>
                {health ? (
                  <div className="space-y-3">
                    {health.checks.map((check) => (
                      <div
                        key={check.name}
                        className="flex items-center justify-between p-3 rounded-md border"
                      >
                        <div className="flex items-center gap-3">
                          <StatusIcon status={check.status} />
                          <div>
                            <div className="text-sm font-medium">
                              {CHECK_LABELS[check.name] || check.name}
                            </div>
                            {check.message && (
                              <div className="text-xs text-muted-foreground">{check.message}</div>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            check.status === 'ok'
                              ? 'border-green-500 text-green-500'
                              : check.status === 'warning'
                                ? 'border-yellow-500 text-yellow-500'
                                : 'border-red-500 text-red-500'
                          }
                        >
                          {check.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Unable to fetch health status.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  )
}
