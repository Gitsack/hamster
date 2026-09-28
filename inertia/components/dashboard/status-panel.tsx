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

/** The dashboard's `health` prop: configuration plus the health monitor's cache. */
export interface DashboardHealth {
  level: 'ok' | 'warning' | 'error' | 'starting'
  checkedAt: string | null
  canManage: boolean
  /** False when the dashboard's queries failed: clients and indexers are unknown, not absent. */
  configLoaded?: boolean
  downloadClients: {
    id: string
    name: string
    type: string
    enabled: boolean
    status: 'ok' | 'error' | 'unknown'
    message: string | null
    since: string | null
  }[]
  indexers: { enabled: number; total: number }
  rootFolders: { total: number; problems: { label: string; status: string; message: string }[] }
  freeBytes: number | null
  database: { status: string; message: string; since: string } | null
  failedTasks: { id: string; name: string; lastError: string | null; lastRunAt: string | null }[]
  backup: { lastRunAt: string | null; lastStatus: string | null } | null
  failedDeliveries: number
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
  health: DashboardHealth
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
    <Section title="Downloads" href="/activity" linkLabel="Queue">
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
// Services — one quiet line while all is well
// ---------------------------------------------------------------------------

/** "4m", "3h", "2d" — how long ago, without the "ago". */
function age(iso: string | null | undefined): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

/** Disk space for the summary line: "812 GB", "1.2 TB". */
function formatFree(bytes: number): string {
  const tb = bytes / 1024 ** 4
  if (tb >= 1) return `${tb.toFixed(1)} TB`
  const gb = bytes / 1024 ** 3
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`
}

export interface HealthIssue {
  key: string
  tone: 'error' | 'warning'
  title: string
  detail?: string | null
  /** When it started, for "3h". */
  since?: string | null
  href: string
}

/**
 * Everything that is wrong, worst first. Configuration gaps come from the
 * database; reachability, folders and the database itself from the health
 * monitor's cache. Routine download failures are left to the stuck-titles
 * line above: a failed grab that was replaced is not a problem.
 */
export function healthIssues(health: DashboardHealth): HealthIssue[] {
  const issues: HealthIssue[] = []

  if (health.database) {
    issues.push({
      key: 'database',
      tone: health.database.status === 'error' ? 'error' : 'warning',
      title: health.database.status === 'error' ? 'Database unreachable' : 'Database is slow',
      detail: health.database.message,
      since: health.database.since,
      href: '/settings/system#health',
    })
  }

  // When the dashboard's own queries failed, configuration is unknown, not empty.
  const configKnown = health.configLoaded !== false

  if (!configKnown) {
    // Nothing to say about clients and indexers; the database issue above covers it.
  } else if (health.downloadClients.length === 0) {
    issues.push({
      key: 'no-client',
      tone: 'error',
      title: 'No download client — nothing can be grabbed',
      href: '/settings/download-clients',
    })
  } else if (!health.downloadClients.some((c) => c.enabled)) {
    issues.push({
      key: 'clients-off',
      tone: 'error',
      title: 'Every download client is switched off',
      href: '/settings/download-clients',
    })
  }
  for (const client of health.downloadClients) {
    if (client.enabled && client.status === 'error') {
      issues.push({
        key: `client:${client.id}`,
        tone: 'error',
        title: `${client.name} unreachable`,
        detail: client.message,
        since: client.since,
        href: '/settings/download-clients',
      })
    }
  }

  if (!configKnown) {
    // As above.
  } else if (health.indexers.total === 0) {
    issues.push({
      key: 'no-indexer',
      tone: 'error',
      title: 'No indexer — searches return nothing',
      href: '/settings/indexers',
    })
  } else if (health.indexers.enabled === 0) {
    issues.push({
      key: 'indexers-off',
      tone: 'error',
      title: 'Every indexer is switched off',
      href: '/settings/indexers',
    })
  }

  for (const folder of health.rootFolders.problems) {
    issues.push({
      key: `folder:${folder.label}`,
      tone: folder.status === 'error' ? 'error' : 'warning',
      title: `${folder.label}: ${folder.message.charAt(0).toLowerCase()}${folder.message.slice(1)}`,
      // Media → Media types, where each type's folder is set.
      href: '/settings/media#types',
    })
  }

  for (const task of health.failedTasks) {
    issues.push({
      key: `task:${task.id}`,
      tone: 'error',
      title: `${task.name} failed`,
      detail: task.lastError,
      since: task.lastRunAt,
      href: '/settings/system#tasks',
    })
  }

  if (health.failedDeliveries > 0) {
    issues.push({
      key: 'deliveries',
      tone: 'warning',
      title: `${health.failedDeliveries} ${plural(health.failedDeliveries, ['notification', 'notifications'])} failed to send in 24h`,
      href: '/settings/notifications#deliveries',
    })
  }

  return [
    ...issues.filter((i) => i.tone === 'error'),
    ...issues.filter((i) => i.tone === 'warning'),
  ]
}

function ServicesSection({ health }: { health: DashboardHealth }) {
  const issues = healthIssues(health)
  const starting = health.level === 'starting'
  const clientsOn = health.downloadClients.filter((c) => c.enabled)
  const reachable = clientsOn.filter((c) => c.status !== 'error')
  const failing = issues.some((i) => i.tone === 'error')

  const facts: React.ReactNode[] = []
  if (reachable.length > 0) {
    facts.push(
      health.canManage ? (
        <Link key="clients" href="/settings/download-clients" className="hover:underline">
          {reachable.map((c) => c.name).join(', ')}
        </Link>
      ) : (
        <span key="clients">{reachable.map((c) => c.name).join(', ')}</span>
      )
    )
  }
  if (health.indexers.enabled > 0) {
    facts.push(
      <span key="indexers">
        <span className="readout">{health.indexers.enabled}</span>{' '}
        {plural(health.indexers.enabled, ['indexer', 'indexers'])}
      </span>
    )
  }
  if (health.freeBytes !== null) {
    facts.push(
      <span key="free">
        <span className="readout">{formatFree(health.freeBytes)}</span> free
      </span>
    )
  }
  if (health.canManage && health.backup?.lastRunAt && health.backup.lastStatus !== 'failed') {
    facts.push(
      <span key="backup">
        backup <span className="readout">{age(health.backup.lastRunAt)}</span>
        {age(health.backup.lastRunAt) === 'now' ? '' : ' ago'}
      </span>
    )
  }

  return (
    <section aria-label="Services" className="px-4 py-3 text-sm">
      {issues.length > 0 && (
        <ul className="mb-2.5 space-y-2 last:mb-0">
          {issues.map((issue) => (
            <Warning key={issue.key} issue={issue} canManage={health.canManage} />
          ))}
        </ul>
      )}
      {(facts.length > 0 || starting) && (
        <p className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              starting
                ? 'bg-muted-foreground/60'
                : failing
                  ? 'bg-status-failed'
                  : issues.length > 0
                    ? 'bg-status-queued'
                    : 'bg-status-complete'
            )}
          />
          <span className="sr-only">
            {starting
              ? 'Checking services:'
              : issues.length > 0
                ? 'Services need attention:'
                : 'Services ready:'}
          </span>
          <span className="min-w-0 truncate">
            {facts.map((fact, index) => (
              <span key={index}>
                {index > 0 && <span className="text-muted-foreground"> · </span>}
                {fact}
              </span>
            ))}
            {starting && (
              <span className="text-muted-foreground">
                {facts.length > 0 ? ' · ' : ''}checking…
              </span>
            )}
          </span>
        </p>
      )}
    </section>
  )
}

function Warning({ issue, canManage }: { issue: HealthIssue; canManage: boolean }) {
  const ink = issue.tone === 'error' ? 'text-status-failed-ink' : 'text-status-queued-ink'
  const since = age(issue.since)
  return (
    <li className="flex min-w-0 items-start gap-2">
      <HugeiconsIcon
        icon={Alert02Icon}
        aria-hidden="true"
        className={cn('mt-0.5 size-4 shrink-0', ink)}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', ink)}>
          {issue.title}
          {since && (
            <span
              className="readout text-xs text-muted-foreground"
              title={issue.since ?? undefined}
            >
              {' · '}
              {since}
            </span>
          )}
        </p>
        {issue.detail && (
          <p className="truncate text-xs text-muted-foreground" title={issue.detail}>
            {issue.detail}
          </p>
        )}
      </div>
      {canManage && (
        <Link
          href={issue.href}
          className="shrink-0 rounded-sm text-xs font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`Fix: ${issue.title}`}
        >
          Fix
        </Link>
      )}
    </li>
  )
}
