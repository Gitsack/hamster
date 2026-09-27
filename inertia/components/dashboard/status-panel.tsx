import { Link } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, CheckmarkCircle01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
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
 * what is moving, what failed, what is still wanted, what is on disk, and
 * whether the services are wired up. Colour only appears when a number needs
 * attention.
 */
export function StatusPanel({
  stats,
  missing,
  failedLastDay,
  health,
}: {
  stats: DashboardStats
  missing: DashboardMissing
  failedLastDay: number
  health: { downloadClients: HealthService[]; indexers: HealthService[] }
}) {
  return (
    <aside
      aria-label="Library status"
      className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
    >
      <ActivitySection failedLastDay={failedLastDay} />

      <Section title="Missing" href="/library?tab=missing" linkLabel="Wanted">
        <FigureGrid
          figures={[
            { label: 'Movies', value: missing.movies },
            { label: 'Episodes', value: missing.episodes },
            { label: 'Albums', value: missing.albums },
            { label: 'Books', value: missing.books },
          ]}
          flag="queued"
        />
      </Section>

      <Section title="On disk" href="/library" linkLabel="Library">
        <FigureGrid
          figures={[
            { label: 'Movies', value: stats.movies },
            { label: 'Episodes', value: stats.episodes, note: `${stats.tvShows} shows` },
            { label: 'Albums', value: stats.albums, note: `${stats.artists} artists` },
            { label: 'Books', value: stats.books, note: `${stats.authors} authors` },
          ]}
        />
      </Section>

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
    <section className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
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

function FigureGrid({
  figures,
  flag,
}: {
  figures: { label: string; value: number; note?: string }[]
  flag?: 'queued'
}) {
  return (
    <dl className="grid grid-cols-4 gap-x-2 gap-y-3 lg:grid-cols-2">
      {figures.map((f) => (
        <div key={f.label} className="flex min-w-0 flex-col">
          <dt className="order-2 truncate text-xs text-muted-foreground">{f.label}</dt>
          <dd
            className={cn(
              'readout order-1 text-base leading-6 font-medium',
              flag === 'queued' && f.value > 0 && 'text-status-queued-ink',
              flag === 'queued' && f.value === 0 && 'text-muted-foreground'
            )}
          >
            {f.value.toLocaleString()}
          </dd>
          {f.note && (
            <dd className="readout order-3 truncate text-xs text-muted-foreground">{f.note}</dd>
          )}
        </div>
      ))}
    </dl>
  )
}

const STATUS_BAR: Record<string, string> = {
  downloading: 'bg-status-transfer',
  importing: 'bg-status-transit',
  failed: 'bg-status-failed',
  completed: 'bg-status-complete',
}

function ActivitySection({ failedLastDay }: { failedLastDay: number }) {
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

      {failedLastDay > 0 ? (
        <Link
          href="/activity/history"
          className="mt-3 flex items-center gap-2 rounded-md text-sm text-status-failed-ink outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <HugeiconsIcon icon={Alert02Icon} className="size-4 shrink-0" />
          <span>
            <span className="readout">{failedLastDay.toLocaleString()}</span> failed in the last 24h
          </span>
        </Link>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            className="size-3.5 text-status-complete-ink"
          />
          No failures in the last 24h
        </p>
      )}
    </Section>
  )
}

function ServicesSection({
  health,
}: {
  health: { downloadClients: HealthService[]; indexers: HealthService[] }
}) {
  const groups = [
    {
      label: 'Download clients',
      items: health.downloadClients,
      href: '/settings/download-clients',
      empty: 'No download client — nothing can be grabbed.',
    },
    {
      label: 'Indexers',
      items: health.indexers,
      href: '/settings/indexers',
      empty: 'No indexer — searches return nothing.',
    },
  ]

  return (
    <Section title="Services">
      <div className="space-y-2">
        {groups.map((g) =>
          g.items.length === 0 ? (
            <Link
              key={g.label}
              href={g.href}
              className="flex items-start gap-2 text-sm text-status-failed-ink hover:underline"
            >
              <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
              {g.empty}
            </Link>
          ) : (
            <div key={g.label} className="min-w-0">
              <p className="sr-only">{g.label}</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {g.items.map((s) => (
                  <li key={s.id} className="flex min-w-0 items-center gap-1.5 text-sm">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        s.enabled ? 'bg-status-complete' : 'bg-muted-foreground/40'
                      )}
                    />
                    <span className={cn('truncate', !s.enabled && 'text-muted-foreground')}>
                      {s.name}
                    </span>
                    <span className="sr-only">{s.enabled ? 'enabled' : 'disabled'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>
    </Section>
  )
}
