import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Film01Icon,
  Tv01Icon,
  MusicNote01Icon,
  Book01Icon,
  Download04Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentItem {
  id: string
  title: string
  type: 'movie' | 'tvshow' | 'album' | 'book'
  imageUrl: string | null
  addedAt: string
  year: number | null
  subtitle: string | null
}

interface HealthService {
  id: string
  name: string
  type: string
  enabled: boolean
}

interface QueueItem {
  id: string
  title: string
  status: string
  progress: number
  sizeBytes: number | null
  remainingBytes: number | null
  etaSeconds: number | null
  mediaType: string | null
}

interface DashboardProps {
  stats: {
    movies: number
    tvShows: number
    episodes: number
    artists: number
    albums: number
    authors: number
    books: number
  }
  missing: {
    movies: number
    episodes: number
    albums: number
    books: number
  }
  activeDownloadCount: number
  recentAdditions: RecentItem[]
  health: {
    downloadClients: HealthService[]
    indexers: HealthService[]
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatEta(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '--'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function typeLabel(type: string): string {
  switch (type) {
    case 'movie':
      return 'Movie'
    case 'tvshow':
      return 'TV Show'
    case 'album':
      return 'Album'
    case 'book':
      return 'Book'
    default:
      return type
  }
}

/**
 * Queue status → the status ramp. Transfer cyan while bytes are moving,
 * transit magenta while the file is being imported, queued amber while it is
 * waiting, complete green on disk, alarm red on failure. Every state carries an
 * icon and a label as well as a fill.
 */
function downloadState(status: string): {
  label: string
  badge: string
  bar: string
  icon: typeof Film01Icon
} {
  switch (status) {
    case 'downloading':
      return {
        label: 'Downloading',
        badge: 'border-transparent bg-status-transfer text-white',
        bar: '[&_[data-slot=progress-indicator]]:bg-status-transfer',
        icon: ArrowDown01Icon,
      }
    case 'importing':
      return {
        label: 'Importing',
        badge: 'border-transparent bg-status-transit text-white',
        bar: '[&_[data-slot=progress-indicator]]:bg-status-transit',
        icon: Download04Icon,
      }
    case 'completed':
      return {
        label: 'Completed',
        badge: 'border-transparent bg-status-complete text-white',
        bar: '[&_[data-slot=progress-indicator]]:bg-status-complete',
        icon: CheckmarkCircle01Icon,
      }
    case 'failed':
      return {
        label: 'Failed',
        badge: 'border-transparent bg-status-failed text-white',
        bar: '[&_[data-slot=progress-indicator]]:bg-status-failed',
        icon: Cancel01Icon,
      }
    case 'paused':
      return {
        label: 'Paused',
        badge: 'border-transparent bg-status-queued text-white',
        bar: '[&_[data-slot=progress-indicator]]:bg-status-queued',
        icon: Download04Icon,
      }
    default:
      return {
        label: status === 'queued' ? 'Queued' : status,
        badge: 'border-transparent bg-status-queued text-white',
        bar: '[&_[data-slot=progress-indicator]]:bg-status-queued',
        icon: Download04Icon,
      }
  }
}

function typeUrl(type: string, id: string): string {
  switch (type) {
    case 'movie':
      return `/movie/${id}`
    case 'tvshow':
      return `/tvshow/${id}`
    case 'album':
      return `/album/${id}`
    case 'book':
      return `/book/${id}`
    default:
      return '/library'
  }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** One cell of the library inventory strip. Counts, not a hero metric. */
function StatCard({
  title,
  value,
  icon,
  subtitle,
  href,
}: {
  title: string
  value: number
  icon: typeof Film01Icon
  subtitle?: string
  href?: string
}) {
  const content = (
    <div
      className={`flex h-full items-center gap-3 bg-card px-4 py-3 ${
        href ? 'transition-colors hover:bg-accent' : ''
      }`}
    >
      <HugeiconsIcon icon={icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="readout text-lg leading-6 font-medium">{value.toLocaleString()}</p>
        <p className="truncate text-xs text-muted-foreground">{title}</p>
        {subtitle && <p className="readout truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full focus-visible:z-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {content}
      </Link>
    )
  }
  return content
}

/**
 * A missing row. Queued Amber is the ramp value for "monitored and waiting" —
 * nothing is broken, nothing has arrived yet — so the count carries it only
 * when there is actually something outstanding.
 */
function MissingCard({
  title,
  count,
  icon,
}: {
  title: string
  count: number
  icon: typeof Film01Icon
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <HugeiconsIcon icon={icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="readout text-xs text-muted-foreground">{count} missing</p>
      </div>
      {count > 0 && (
        <Badge className="readout border-transparent bg-status-queued text-white">{count}</Badge>
      )}
    </div>
  )
}

function DownloadActivity() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/queue')
      if (res.ok) {
        const data = await res.json()
        const items = Array.isArray(data) ? data : data.items || data.queue || []
        setQueue(items.slice(0, 5))
      }
    } catch {
      // Silently fail - queue may not be available
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 10000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <HugeiconsIcon icon={Download04Icon} className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No active downloads</p>
        <p className="max-w-[28ch] text-xs text-muted-foreground">
          Grabs appear here while they transfer. Nothing running means nothing was grabbed — search
          a title, or check Activity for failures.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {queue.map((item) => {
        const state = downloadState(item.status)
        return (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex-1 truncate text-sm font-medium">{item.title}</p>
              <Badge className={`flex-shrink-0 gap-1 text-xs ${state.badge}`}>
                <HugeiconsIcon icon={state.icon} className="h-3 w-3" />
                {state.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={item.progress}
                aria-label={`${item.title} progress`}
                className={`h-1.5 flex-1 ${state.bar}`}
              />
              <span className="readout w-12 text-right text-xs text-muted-foreground">
                {Math.round(item.progress)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="readout">{item.sizeBytes ? formatBytes(item.sizeBytes) : '--'}</span>
              <span className="readout">{formatEta(item.etaSeconds)} left</span>
            </div>
          </div>
        )
      })}
      <Link
        href="/activity/queue"
        className="block pt-2 text-center text-sm text-primary hover:underline"
      >
        View all activity
      </Link>
    </div>
  )
}

function HealthStatus({ health }: { health: DashboardProps['health'] }) {
  const allClients = health.downloadClients
  const allIndexers = health.indexers
  const enabledClients = allClients.filter((c) => c.enabled)
  const enabledIndexers = allIndexers.filter((i) => i.enabled)

  // "Enabled" is a configuration fact, not a reachability check, so a disabled
  // service reads as neutral rather than as a failure.
  const serviceRow = (service: HealthService) => (
    <div key={service.id} className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <HugeiconsIcon
          icon={service.enabled ? CheckmarkCircle01Icon : Cancel01Icon}
          className={`h-4 w-4 shrink-0 ${
            service.enabled ? 'text-status-complete-ink' : 'text-muted-foreground'
          }`}
        />
        <span className="truncate text-sm">{service.name}</span>
        <span className="sr-only">{service.enabled ? 'enabled' : 'disabled'}</span>
      </div>
      <Badge variant="outline" className="readout text-xs">
        {service.type}
      </Badge>
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-1 text-xs font-medium text-muted-foreground">Download clients</h4>
        {allClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No download clients configured
            <span className="mt-0.5 block text-xs">
              Nothing can be grabbed until one is added in Settings → Download Clients.
            </span>
          </p>
        ) : (
          <div className="divide-y divide-border">{allClients.map(serviceRow)}</div>
        )}
        {allClients.length > 0 && (
          <p className="readout mt-1 text-xs text-muted-foreground">
            {enabledClients.length} of {allClients.length} enabled
          </p>
        )}
      </div>

      <div>
        <h4 className="mb-1 text-xs font-medium text-muted-foreground">Indexers</h4>
        {allIndexers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No indexers configured
            <span className="mt-0.5 block text-xs">
              Add Prowlarr or a Newznab indexer in Settings → Indexers so searches return releases.
            </span>
          </p>
        ) : (
          <div className="divide-y divide-border">{allIndexers.map(serviceRow)}</div>
        )}
        {allIndexers.length > 0 && (
          <p className="readout mt-1 text-xs text-muted-foreground">
            {enabledIndexers.length} of {allIndexers.length} enabled
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Dashboard({
  stats,
  missing,
  activeDownloadCount,
  recentAdditions,
  health,
}: DashboardProps) {
  const totalMissing = missing.movies + missing.episodes + missing.albums + missing.books

  return (
    <AppLayout title="Dashboard">
      <Head title="Dashboard" />

      <div className="space-y-4">
        {/* What needs the operator first: what is moving, and what is still missing. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Downloads</CardTitle>
                {activeDownloadCount > 0 && (
                  <Badge className="readout border-transparent bg-status-transfer text-white">
                    <HugeiconsIcon icon={ArrowDown01Icon} className="mr-1 h-3 w-3" />
                    {activeDownloadCount}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <DownloadActivity />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Missing</CardTitle>
                {totalMissing > 0 && (
                  <Badge className="readout border-transparent bg-status-queued text-white">
                    {totalMissing}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                <MissingCard title="Movies" count={missing.movies} icon={Film01Icon} />
                <MissingCard title="Episodes" count={missing.episodes} icon={Tv01Icon} />
                <MissingCard title="Albums" count={missing.albums} icon={MusicNote01Icon} />
                <MissingCard title="Books" count={missing.books} icon={Book01Icon} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Library inventory — one panel, four figures, hairline seams. */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
          <StatCard
            title="Movies"
            value={stats.movies}
            icon={Film01Icon}
            href="/library?tab=movies"
          />
          <StatCard
            title="TV Shows"
            value={stats.tvShows}
            icon={Tv01Icon}
            subtitle={`${stats.episodes.toLocaleString()} episodes`}
            href="/library?tab=tv"
          />
          <StatCard
            title="Albums"
            value={stats.albums}
            icon={MusicNote01Icon}
            subtitle={`${stats.artists.toLocaleString()} artists`}
            href="/library?tab=music"
          />
          <StatCard
            title="Books"
            value={stats.books}
            icon={Book01Icon}
            subtitle={`${stats.authors.toLocaleString()} authors`}
            href="/library?tab=books"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Recent Additions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Recent Additions</CardTitle>
            </CardHeader>
            <CardContent>
              {recentAdditions.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No items in your library yet. Start by adding some media!
                </p>
              ) : (
                <div className="space-y-3">
                  {recentAdditions.map((item) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={typeUrl(item.type, item.id)}
                      className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <HugeiconsIcon
                            icon={
                              item.type === 'movie'
                                ? Film01Icon
                                : item.type === 'tvshow'
                                  ? Tv01Icon
                                  : item.type === 'album'
                                    ? MusicNote01Icon
                                    : Book01Icon
                            }
                            className="h-5 w-5 text-muted-foreground"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.subtitle && `${item.subtitle} \u00b7 `}
                          {item.year && `${item.year} \u00b7 `}
                          {typeLabel(item.type)}
                        </p>
                      </div>
                      <span className="readout flex-shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(item.addedAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Health Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <HealthStatus health={health} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
