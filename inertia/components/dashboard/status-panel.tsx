import { Link } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  ArrowRight01Icon,
  Film01Icon,
  Tv01Icon,
  CdIcon,
  Book01Icon,
} from '@hugeicons/core-free-icons'
import { useActiveDownloads } from '@/hooks/use_active_downloads'
import { cn } from '@/lib/utils'

export interface DashboardStats {
  movies: number
  tvShows: number
  episodes: number
  artists: number
  albums: number
  authors: number
  books: number
}

export interface DashboardMissing {
  movies: number
  episodes: number
  albums: number
  books: number
}

export interface HealthService {
  id: string
  name: string
  type: string
  enabled: boolean
}

/**
 * Everything the operator used to see first, folded into one quiet panel:
 * what is moving and what failed, then one line per kind of media — what is
 * on disk, what is still wanted, and how complete that shelf is — and a
 * single line for the services. Colour only appears when a number needs
 * attention.
 */
export interface StuckTitles {
  count: number
  /** Up to three, for the message. */
  titles: string[]
}

export function StatusPanel({
  stats,
  missing,
  stuck,
  health,
}: {
  stats: DashboardStats
  missing: DashboardMissing
  stuck: StuckTitles
  health: { downloadClients: HealthService[]; indexers: HealthService[] }
}) {
  return (
    <aside
      aria-label="Library status"
      className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
    >
      <ActivitySection stuck={stuck} />
      <LibrarySection stats={stats} missing={missing} />
      <ServicesSection health={health} />
    </aside>
  )
}

function Section({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string
  href?: string
  linkLabel?: string
  children: React.ReactNode
}) {
  return (
    <section className="px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
        {href && (
          <Link
            href={href}
            className="-mr-1 inline-flex items-center gap-0.5 rounded-sm px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {linkLabel}
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Library — one line per kind of media
// ---------------------------------------------------------------------------

interface Shelf {
  key: string
  icon: typeof Film01Icon
  have: number
  noun: [string, string]
  detail: string | null
  wanted: number
  href: string
}

const plural = (n: number, [one, many]: [string, string]) => (n === 1 ? one : many)

/**
 * A shelf reads as a sentence — "317 episodes · 21 shows" — with what is still
 * wanted on the right and a hairline showing how complete the shelf is. The
 * wanted count is the only colour, and only when it is not zero.
 */
function LibrarySection({ stats, missing }: { stats: DashboardStats; missing: DashboardMissing }) {
  const all: Shelf[] = [
    {
      key: 'movies',
      icon: Film01Icon,
      have: stats.movies,
      noun: ['movie', 'movies'],
      detail: null,
      wanted: missing.movies,
      href: '/library?tab=movies',
    },
    {
      key: 'tv',
      icon: Tv01Icon,
      have: stats.episodes,
      noun: ['episode', 'episodes'],
      detail: stats.tvShows
        ? `${stats.tvShows.toLocaleString()} ${plural(stats.tvShows, ['show', 'shows'])}`
        : null,
      wanted: missing.episodes,
      href: '/library?tab=tv',
    },
    {
      key: 'music',
      icon: CdIcon,
      have: stats.albums,
      noun: ['album', 'albums'],
      detail: stats.artists
        ? `${stats.artists.toLocaleString()} ${plural(stats.artists, ['artist', 'artists'])}`
        : null,
      wanted: missing.albums,
      href: '/library?tab=music',
    },
    {
      key: 'books',
      icon: Book01Icon,
      have: stats.books,
      noun: ['book', 'books'],
      detail: stats.authors
        ? `${stats.authors.toLocaleString()} ${plural(stats.authors, ['author', 'authors'])}`
        : null,
      wanted: missing.books,
      href: '/library?tab=books',
    },
  ]
  const shelves = all.filter((s) => s.have > 0 || s.wanted > 0 || s.detail)

  return (
    <Section title="Library" href="/library" linkLabel="Open">
      {shelves.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in the library yet.</p>
      ) : (
        <ul className="space-y-3">
          {shelves.map((shelf) => (
            <ShelfRow key={shelf.key} shelf={shelf} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function ShelfRow({ shelf }: { shelf: Shelf }) {
  const total = shelf.have + shelf.wanted
  const complete = total > 0 ? shelf.have / total : 1

  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <HugeiconsIcon icon={shelf.icon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        {/* The sentence gets the full width; what is still wanted sits at the
            end of the completeness bar it belongs to. */}
        <Link
          href={shelf.href}
          className="block truncate rounded-sm text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="readout font-medium">{shelf.have.toLocaleString()}</span>{' '}
          {plural(shelf.have, shelf.noun)}
          {shelf.detail && <span className="text-muted-foreground"> · {shelf.detail}</span>}
        </Link>
        {shelf.wanted > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-status-queued/25"
              role="img"
              aria-label={`${Math.round(complete * 100)}% of wanted ${shelf.noun[1]} on disk`}
            >
              <div
                className="h-full rounded-full bg-status-complete"
                style={{ width: `${Math.max(2, complete * 100)}%` }}
              />
            </div>
            <Link
              href="/library?tab=missing"
              className="shrink-0 rounded-sm text-xs text-status-queued-ink outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="readout">{shelf.wanted.toLocaleString()}</span> wanted
            </Link>
          </div>
        )}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

const STATUS_BAR: Record<string, string> = {
  downloading: 'bg-status-transfer',
  importing: 'bg-status-transit',
  failed: 'bg-status-failed',
  completed: 'bg-status-complete',
}

function ActivitySection({ stuck }: { stuck: StuckTitles }) {
  const { queue } = useActiveDownloads()
  const active = queue.filter((q) => q.status !== 'completed')
  const shown = active.slice(0, 3)

  return (
    <Section title="Downloads" href="/activity/queue" linkLabel="Queue">
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing downloading.</p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((item) => (
            <li key={item.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm" title={item.title}>
                  {item.title}
                </p>
                <span className="readout shrink-0 text-xs text-muted-foreground">
                  {item.status === 'importing' ? 'importing' : `${Math.round(item.progress)}%`}
                </span>
              </div>
              <div
                className="mt-1 h-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${item.title} progress`}
                aria-valuenow={Math.round(item.progress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    STATUS_BAR[item.status] ?? 'bg-status-queued'
                  )}
                  style={{ width: `${Math.max(2, Math.min(100, item.progress))}%` }}
                />
              </div>
            </li>
          ))}
          {active.length > shown.length && (
            <li className="readout text-xs text-muted-foreground">
              +{active.length - shown.length} more in the queue
            </li>
          )}
        </ul>
      )}

      {/* Failed attempts are routine — a broken release is blacklisted and the
          next one grabbed — so they are not counted here. Only a title that
          failed, is still missing and has nothing new downloading is. */}
      {stuck.count > 0 && (
        <Link
          href="/library?tab=missing"
          className="mt-3 flex items-start gap-2 rounded-md text-sm text-status-failed-ink outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="readout">{stuck.count}</span>{' '}
            {stuck.count === 1 ? 'title is' : 'titles are'} stuck — failed, and nothing new is
            downloading
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {stuck.titles.join(', ')}
              {stuck.count > stuck.titles.length &&
                ` and ${stuck.count - stuck.titles.length} more`}
            </span>
          </span>
        </Link>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Services — one line while all is well
// ---------------------------------------------------------------------------

function ServicesSection({
  health,
}: {
  health: { downloadClients: HealthService[]; indexers: HealthService[] }
}) {
  const clients = health.downloadClients
  const indexers = health.indexers
  const clientsOn = clients.filter((c) => c.enabled)
  const indexersOn = indexers.filter((i) => i.enabled)
  const off = clients.length - clientsOn.length + (indexers.length - indexersOn.length)
  const healthy = clientsOn.length > 0 && indexersOn.length > 0

  return (
    <section aria-label="Services" className="px-4 py-3 text-sm">
      {clients.length === 0 && (
        <Warning href="/settings/download-clients">
          No download client — nothing can be grabbed.
        </Warning>
      )}
      {indexers.length === 0 && (
        <Warning href="/settings/indexers">No indexer — searches return nothing.</Warning>
      )}
      {(clients.length > 0 || indexers.length > 0) && (
        <p className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              healthy ? 'bg-status-complete' : 'bg-status-failed'
            )}
          />
          <span className="sr-only">
            {healthy ? 'Services ready:' : 'Services need attention:'}
          </span>
          <span className="min-w-0 truncate">
            {clients.length > 0 && (
              <Link
                href="/settings/download-clients"
                className={cn('hover:underline', clientsOn.length === 0 && 'text-muted-foreground')}
              >
                {(clientsOn.length > 0 ? clientsOn : clients).map((c) => c.name).join(', ')}
              </Link>
            )}
            {clients.length > 0 && indexers.length > 0 && (
              <span className="text-muted-foreground"> · </span>
            )}
            {indexers.length > 0 && (
              <Link href="/settings/indexers" className="hover:underline">
                <span className="readout">{indexersOn.length}</span>{' '}
                {plural(indexersOn.length, ['indexer', 'indexers'])}
              </Link>
            )}
            {off > 0 && <span className="text-muted-foreground"> · {off} off</span>}
          </span>
        </p>
      )}
    </section>
  )
}

function Warning({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-1.5 flex items-start gap-2 text-status-failed-ink last:mb-0 hover:underline"
    >
      <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
      {children}
    </Link>
  )
}
