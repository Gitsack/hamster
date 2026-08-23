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
  PulseIcon,
} from '@hugeicons/core-free-icons'
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

/** Health state maps onto the status ramp: healthy is a fact, error is an alarm. */
const HEALTH_STATE = {
  ok: { label: 'Healthy', icon: CheckmarkCircle01Icon, fill: 'bg-status-complete text-white' },
  warning: { label: 'Warning', icon: Alert01Icon, fill: 'bg-status-queued text-white' },
  error: { label: 'Error', icon: Cancel01Icon, fill: 'bg-status-failed text-white' },
} as const

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

function formatCheckedAt(timestamp: string | undefined): string {
  if (!timestamp) return '-'
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'error' }) {
  const state = HEALTH_STATE[status]
  return (
    <Badge className={`${state.fill} border-transparent`}>
      <HugeiconsIcon icon={state.icon} aria-hidden="true" />
      {state.label}
    </Badge>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="readout truncate text-sm text-foreground">{value}</div>
    </div>
  )
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
      toast.error('Could not reach the Hamster server', {
        description:
          '/health and /api/v1/system/info did not respond. Check that the container is running, then hit Refresh.',
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
    toast.success('Status refreshed')
  }

  const memoryPercent = systemInfo
    ? Math.min(Math.round((systemInfo.memory.used / systemInfo.memory.total) * 100), 100)
    : 0

  return (
    <AppLayout
      title="System Status"
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>System Information</CardTitle>
                  {health && <StatusBadge status={health.status} />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoField
                    label="Version"
                    value={systemInfo?.version || health?.version || '-'}
                  />
                  <InfoField label="Node.js" value={systemInfo?.nodeVersion || '-'} />
                  <InfoField
                    label="Platform"
                    value={systemInfo ? `${systemInfo.platform} (${systemInfo.arch})` : '-'}
                  />
                  <InfoField
                    label="Uptime"
                    value={systemInfo ? formatUptime(systemInfo.uptime) : '-'}
                  />
                </div>

                {systemInfo && (
                  <div className="mt-6 border-t border-border pt-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs font-medium text-muted-foreground">Memory</span>
                      <span className="readout text-xs text-foreground">
                        {systemInfo.memory.used} / {systemInfo.memory.total} MB · {memoryPercent}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Memory usage"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={memoryPercent}
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                        style={{ width: `${memoryPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Health Checks */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Health Checks</CardTitle>
                  {health && (
                    <span className="readout text-xs text-muted-foreground">
                      checked {formatCheckedAt(health.timestamp)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {health ? (
                  <div className="-mx-6 divide-y divide-border border-t border-border">
                    {health.checks.map((check) => (
                      <div
                        key={check.name}
                        className="flex items-center justify-between gap-4 px-6 py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {CHECK_LABELS[check.name] || check.name}
                          </div>
                          {check.message && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {check.message}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={check.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <HugeiconsIcon
                        icon={PulseIcon}
                        aria-hidden="true"
                        className="size-6 text-muted-foreground"
                      />
                    </div>
                    <p className="mt-4 text-lg font-medium">Health checks did not report</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      The <span className="readout">/health</span> endpoint returned nothing, so the
                      state of the database, root folders, indexers and download clients is unknown.
                      Refresh once the server has finished starting.
                    </p>
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
