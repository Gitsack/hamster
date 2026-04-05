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
    <Card className={href ? 'transition-shadow hover:shadow-md' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value.toLocaleString()}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <HugeiconsIcon icon={icon} className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

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
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div className="h-9 w-9 rounded-md bg-orange-500/10 flex items-center justify-center flex-shrink-0">
        <HugeiconsIcon icon={icon} className="h-4 w-4 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">{count} missing</p>
      </div>
      {count > 0 && (
        <Badge variant="secondary" className="text-orange-600 bg-orange-500/10">
          {count}
        </Badge>
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
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <HugeiconsIcon icon={Download04Icon} className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No active downloads</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {queue.map((item) => (
        <div key={item.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium truncate flex-1">{item.title}</p>
            <Badge
              variant={
                item.status === 'downloading'
                  ? 'default'
                  : item.status === 'completed'
                    ? 'default'
                    : 'secondary'
              }
              className="text-xs flex-shrink-0"
            >
              {item.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={item.progress} className="flex-1 h-1.5" />
            <span className="text-xs text-muted-foreground w-12 text-right">
              {Math.round(item.progress)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.sizeBytes ? formatBytes(item.sizeBytes) : '--'}</span>
            <span>ETA: {formatEta(item.etaSeconds)}</span>
          </div>
        </div>
      ))}
      <Link
        href="/activity/queue"
        className="block text-center text-sm text-primary hover:underline pt-2"
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

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Download Clients</h4>
        {allClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No download clients configured</p>
        ) : (
          <div className="space-y-2">
            {allClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={client.enabled ? CheckmarkCircle01Icon : Cancel01Icon}
                    className={`h-4 w-4 ${client.enabled ? 'text-green-500' : 'text-red-500'}`}
                  />
                  <span className="text-sm">{client.name}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {client.type}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {allClients.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {enabledClients.length} of {allClients.length} enabled
          </p>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Indexers</h4>
        {allIndexers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No indexers configured</p>
        ) : (
          <div className="space-y-2">
            {allIndexers.map((indexer) => (
              <div key={indexer.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={indexer.enabled ? CheckmarkCircle01Icon : Cancel01Icon}
                    className={`h-4 w-4 ${indexer.enabled ? 'text-green-500' : 'text-red-500'}`}
                  />
                  <span className="text-sm">{indexer.name}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {indexer.type}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {allIndexers.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
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

      <div className="space-y-6">
        {/* Library Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            href="/library?tab=tvshows"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Additions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Recent Additions</CardTitle>
            </CardHeader>
            <CardContent>
              {recentAdditions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No items in your library yet. Start by adding some media!
                </p>
              ) : (
                <div className="space-y-3">
                  {recentAdditions.map((item) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={typeUrl(item.type, item.id)}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatRelativeTime(item.addedAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar column */}
          <div className="space-y-6">
            {/* Missing / Wanted */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Missing</CardTitle>
                  {totalMissing > 0 && (
                    <Badge variant="secondary" className="text-orange-600 bg-orange-500/10">
                      {totalMissing}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <MissingCard title="Movies" count={missing.movies} icon={Film01Icon} />
                  <MissingCard title="Episodes" count={missing.episodes} icon={Tv01Icon} />
                  <MissingCard title="Albums" count={missing.albums} icon={MusicNote01Icon} />
                  <MissingCard title="Books" count={missing.books} icon={Book01Icon} />
                </div>
              </CardContent>
            </Card>

            {/* Download Activity */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Downloads</CardTitle>
                  {activeDownloadCount > 0 && (
                    <Badge>
                      <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 mr-1" />
                      {activeDownloadCount}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <DownloadActivity />
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
      </div>
    </AppLayout>
  )
}
