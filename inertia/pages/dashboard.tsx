import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { MediaImage } from '@/components/library/media-image'
import { ForYouDeck } from '@/components/dashboard/for-you-deck'
import {
  StatusPanel,
  type DashboardMissing,
  type DashboardStats,
  type HealthService,
  type StuckTitles,
} from '@/components/dashboard/status-panel'

interface RecentItem {
  id: string
  title: string
  type: 'movie' | 'tvshow' | 'album' | 'book'
  imageUrl: string | null
  addedAt: string
  year: number | null
  subtitle: string | null
}

interface DashboardProps {
  stats: DashboardStats
  missing: DashboardMissing
  activeDownloadCount: number
  stuck: StuckTitles
  recentAdditions: RecentItem[]
  health: {
    downloadClients: HealthService[]
    indexers: HealthService[]
  }
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateString).toLocaleDateString()
}

const RECENT_META: Record<
  RecentItem['type'],
  { href: (id: string) => string; imageType: 'movies' | 'tv' | 'album' | 'books'; square: boolean }
> = {
  movie: { href: (id) => `/movie/${id}`, imageType: 'movies', square: false },
  tvshow: { href: (id) => `/tvshow/${id}`, imageType: 'tv', square: false },
  album: { href: (id) => `/album/${id}`, imageType: 'album', square: true },
  book: { href: (id) => `/book/${id}`, imageType: 'books', square: false },
}

/**
 * What landed on disk most recently. A fixed-height lane: posters stand at
 * 2:3, album covers stay square, nothing gets cropped into the wrong shape.
 */
function RecentlyImported({ items }: { items: RecentItem[] }) {
  if (items.length === 0) return null

  return (
    <section aria-labelledby="recent-heading" className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id="recent-heading" className="text-xs font-medium text-muted-foreground">
          Recently imported
        </h2>
        <Link
          href="/activity/history"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          History
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0">
        {items.map((item) => {
          const meta = RECENT_META[item.type]
          return (
            <li key={`${item.type}-${item.id}`} className="shrink-0 snap-start">
              <Link
                href={meta.href(item.id)}
                className="group block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <div
                  className={`h-32 overflow-hidden rounded-lg bg-muted shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] ${
                    meta.square ? 'w-32' : 'w-[5.33rem]'
                  }`}
                >
                  <MediaImage
                    src={item.imageUrl}
                    alt=""
                    mediaType={meta.imageType}
                    iconClassName="size-6"
                    className="transition-opacity group-hover:opacity-90"
                  />
                </div>
                <p
                  className={`mt-1.5 truncate text-xs font-medium group-hover:underline ${
                    meta.square ? 'w-32' : 'w-[5.33rem]'
                  }`}
                  title={item.subtitle ? `${item.title} — ${item.subtitle}` : item.title}
                >
                  {item.title}
                </p>
                <p className="readout text-xs text-muted-foreground">
                  {formatRelativeTime(item.addedAt)}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Dashboard({
  stats,
  missing,
  stuck = { count: 0, titles: [] },
  recentAdditions,
  health,
}: DashboardProps) {
  return (
    <AppLayout title="Dashboard">
      <Head title="Dashboard" />

      <div className="mx-auto max-w-6xl space-y-8">
        {/* The deck leads: it is the one thing on this page that asks for a decision. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
          <ForYouDeck />
          <div>
            <StatusPanel stats={stats} missing={missing} stuck={stuck} health={health} />
          </div>
        </div>

        <RecentlyImported items={recentAdditions} />
      </div>
    </AppLayout>
  )
}
