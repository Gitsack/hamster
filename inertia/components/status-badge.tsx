import type { ReactNode } from 'react'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Delete02Icon,
  Download01Icon,
  Edit02Icon,
  FileDownloadIcon,
  PackageMovingIcon,
  PauseIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

/**
 * One status language for every list in the app.
 *
 *   ok        — quiet: a 6px green dot and muted text. Success is the resting state.
 *   warning   — amber outline chip. Something wants a look, nothing is broken yet.
 *   error     — Alarm Red chip. The row explains why on its second line.
 *   paused    — the operator switched it off; muted at 60%.
 *   transfer  — actively downloading (Transfer Cyan fill).
 *   transit   — landed and being imported (Transit Magenta fill, icon pulses).
 *   queued    — waiting; nothing is wrong, nothing has happened yet.
 *   neutral   — a fact without a verdict (ignored, deleted, renamed).
 *
 * Colour never travels alone: every tone carries a word, and every chip an icon.
 */
export type StatusTone =
  | 'ok'
  | 'warning'
  | 'error'
  | 'paused'
  | 'transfer'
  | 'transit'
  | 'queued'
  | 'neutral'

interface OutcomeStyle {
  tone: StatusTone
  label: string
  icon?: IconSvgElement
}

/** Default icon per tone. OK is a dot, so its icon is for callers that need one (health rows). */
export const STATUS_TONE_ICONS: Record<StatusTone, IconSvgElement> = {
  ok: CheckmarkCircle02Icon,
  warning: Alert02Icon,
  error: Cancel01Icon,
  paused: PauseIcon,
  transfer: Download01Icon,
  transit: PackageMovingIcon,
  queued: Clock01Icon,
  neutral: CheckmarkCircle02Icon,
}

/**
 * Known outcomes across downloads, imports and history events. One label per
 * outcome, so "Imported" means the same thing on the queue, the history log and
 * the dashboard.
 */
export const STATUS_OUTCOMES = {
  // Download / queue lifecycle
  queued: { tone: 'queued', label: 'Queued' },
  pending: { tone: 'queued', label: 'Pending' },
  downloading: { tone: 'transfer', label: 'Downloading' },
  importing: { tone: 'transit', label: 'Importing' },
  completed: { tone: 'ok', label: 'Completed' },
  failed: { tone: 'error', label: 'Failed' },
  paused: { tone: 'paused', label: 'Paused' },
  ignored: { tone: 'neutral', label: 'Ignored', icon: ViewOffIcon },
  // History events
  grabbed: { tone: 'transfer', label: 'Grabbed', icon: FileDownloadIcon },
  download_completed: { tone: 'transfer', label: 'Downloaded' },
  download_failed: { tone: 'error', label: 'Download failed' },
  import_completed: { tone: 'ok', label: 'Imported' },
  import_failed: { tone: 'error', label: 'Import failed' },
  deleted: { tone: 'neutral', label: 'Deleted', icon: Delete02Icon },
  renamed: { tone: 'neutral', label: 'Renamed', icon: Edit02Icon },
  // Service health
  reachable: { tone: 'ok', label: 'Reachable' },
  unreachable: { tone: 'error', label: 'Unreachable' },
  disabled: { tone: 'paused', label: 'Disabled' },
} as const satisfies Record<string, OutcomeStyle>

export type StatusOutcome = keyof typeof STATUS_OUTCOMES

export function isStatusOutcome(value: string): value is StatusOutcome {
  return Object.prototype.hasOwnProperty.call(STATUS_OUTCOMES, value)
}

/** The tone a known outcome maps to; unknown strings are neutral. */
export function toneForStatus(status: string): StatusTone {
  return isStatusOutcome(status) ? STATUS_OUTCOMES[status].tone : 'neutral'
}

const TONE_RANK: Record<StatusTone, number> = {
  error: 0,
  warning: 1,
  transit: 2,
  transfer: 2,
  queued: 2,
  paused: 2,
  neutral: 2,
  ok: 2,
}

/** Sort key: errors first, then warnings, everything else keeps its order. */
export function statusRank(tone: StatusTone): number {
  return TONE_RANK[tone]
}

/** Stable sort that floats errors, then warnings, to the top of a list. */
export function sortByStatus<T>(items: readonly T[], toneOf: (item: T) => StatusTone): T[] {
  return items
    .map((item, index) => ({ item, index, rank: statusRank(toneOf(item)) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item)
}

const CHIP =
  'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-medium [&>svg]:size-3 [&>svg]:shrink-0'

const TONE_CLASSES: Record<StatusTone, string> = {
  ok: 'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground',
  paused:
    'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground opacity-60 [&>svg]:size-3',
  warning: cn(CHIP, 'border-status-queued-ink/50 text-status-queued-ink'),
  error: cn(CHIP, 'border-transparent bg-status-failed text-white'),
  transfer: cn(CHIP, 'border-transparent bg-status-transfer text-white'),
  transit: cn(CHIP, 'border-transparent bg-status-transit text-white'),
  queued: cn(CHIP, 'border-transparent bg-status-queued text-white'),
  neutral: cn(CHIP, 'border-border text-muted-foreground'),
}

const DOT_CLASSES: Record<StatusTone, string> = {
  ok: 'bg-status-complete',
  warning: 'bg-status-queued',
  error: 'bg-destructive',
  paused: 'bg-muted-foreground/60',
  transfer: 'bg-status-transfer',
  transit: 'bg-status-transit',
  queued: 'bg-status-queued',
  neutral: 'bg-muted-foreground',
}

type StatusBadgeProps = {
  className?: string
  /** Native tooltip, e.g. the full error text behind a short label. */
  title?: string
  /** Overrides the label, e.g. a live "72%" on a downloading row. */
  children?: ReactNode
  /** Overrides the tone's default icon. */
  icon?: IconSvgElement
} & (
  | { status: StatusOutcome | (string & {}); tone?: never; label?: never }
  | { tone: StatusTone; label: string; status?: never }
)

/**
 * The status chip. Pass a known `status` ("downloading", "import_failed",
 * "unreachable"...) or an explicit `tone` + `label`.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { className, title, children, icon: iconOverride } = props

  let tone: StatusTone
  let label: string
  let icon: IconSvgElement | undefined
  if (props.tone !== undefined) {
    tone = props.tone
    label = props.label
  } else if (isStatusOutcome(props.status)) {
    const outcome: OutcomeStyle = STATUS_OUTCOMES[props.status]
    tone = outcome.tone
    label = outcome.label
    icon = outcome.icon
  } else {
    // An outcome we have no word for yet: show it plainly rather than guessing a colour.
    tone = 'neutral'
    label = props.status
  }
  icon = iconOverride ?? icon ?? STATUS_TONE_ICONS[tone]

  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      title={title}
      className={cn(TONE_CLASSES[tone], className)}
    >
      {tone === 'ok' ? (
        <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASSES.ok)} />
      ) : (
        <HugeiconsIcon
          icon={icon}
          aria-hidden="true"
          className={tone === 'transit' ? 'animate-pulse motion-reduce:animate-none' : undefined}
        />
      )}
      <span className="min-w-0 truncate">{children ?? label}</span>
    </span>
  )
}

/**
 * A 6px status dot for places with no room for a word — the sidebar Settings
 * item, a settings rail entry. Always carries an accessible label.
 */
export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: StatusTone
  label: string
  className?: string
}) {
  return (
    <span
      data-slot="status-dot"
      data-tone={tone}
      role="img"
      aria-label={label}
      title={label}
      className={cn('inline-block size-1.5 shrink-0 rounded-full', DOT_CLASSES[tone], className)}
    />
  )
}
