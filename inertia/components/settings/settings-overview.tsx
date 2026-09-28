import { Link, router } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { SettingsPage } from './settings-page'
import { Section } from './section'
import { RowGroup, RowGroupError } from './row-group'
import { visibleSettingsNav, type SettingsNavItem } from './settings_nav'
import { overviewLine, type OverviewLine, type SettingsOverview } from './settings_overview'
import { cn } from '@/lib/utils'

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

/**
 * /settings: every settings page, grouped as in the settings sidebar, each with
 * one live line of what it is set to and whether anything there is failing.
 * Below md, where the sidebar is a sheet, this is also the drill-in list.
 */
export function SettingsOverviewList({
  overview,
  email,
  now,
}: {
  /** Null when the server could not gather the facts; the rows still navigate. */
  overview: SettingsOverview | null
  email?: string | null
  /** For stories and tests; defaults to the current time. */
  now?: number
}) {
  const groups = visibleSettingsNav(true)

  return (
    <SettingsPage
      title="Overview"
      description="Every part of Hamster you can configure, and anything there that needs a look."
    >
      {overview === null && (
        <RowGroup>
          <RowGroupError
            message="Status could not be loaded. The pages below still open."
            onRetry={() => router.reload({ only: ['overview'] })}
          />
        </RowGroup>
      )}
      {groups.map((group) => (
        <Section key={group.label} id={slug(group.label)} title={group.label}>
          <RowGroup>
            {group.items.map((item) => (
              <OverviewRow
                key={item.id}
                item={item}
                line={overview ? overviewLine(item.id, overview, { email, now }) : null}
              />
            ))}
          </RowGroup>
        </Section>
      ))}
    </SettingsPage>
  )
}

const LINE_CLASSES: Record<OverviewLine['tone'], string> = {
  ok: 'text-muted-foreground',
  warning: 'text-status-queued-ink',
  error: 'text-destructive',
}

function OverviewRow({ item, line }: { item: SettingsNavItem; line: OverviewLine | null }) {
  return (
    <Link
      href={item.url}
      data-tone={line?.tone}
      className="flex min-h-14 items-center gap-3 px-4 py-3 outline-none transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      <HugeiconsIcon
        icon={item.icon}
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{item.label}</span>
        {line && (
          <span
            className={cn(
              'mt-0.5 flex min-w-0 items-start gap-1 text-xs tabular-nums',
              LINE_CLASSES[line.tone]
            )}
          >
            {line.tone !== 'ok' && (
              <HugeiconsIcon
                icon={Alert02Icon}
                aria-hidden="true"
                className="mt-0.5 size-3 shrink-0"
              />
            )}
            {line.tone === 'error' && <span className="sr-only">Failing:</span>}
            {line.tone === 'warning' && <span className="sr-only">Needs a look:</span>}
            <span className="min-w-0 break-words">{line.text}</span>
          </span>
        )}
      </span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Link>
  )
}
