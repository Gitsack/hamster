import type { ReactNode } from 'react'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type MetaPart = ReactNode | null | undefined | false

/**
 * One row in an Activity list. Two lines at every width, so a phone sees the
 * same facts as a desktop, just wrapped:
 *
 *   Title                          (status)          [actions]
 *   mono meta · meta · meta
 *   error text / progress / anything else the row needs
 */
export function ActivityRow({
  title,
  titleHint,
  status,
  meta,
  error,
  note,
  children,
  actions,
  dimmed = false,
  className,
}: {
  /** Line 1. Release and file names read best in the Readout face; pass a node to choose. */
  title: ReactNode
  /** The full text behind a truncated title. */
  titleHint?: string
  /** A StatusBadge beside the title. */
  status?: ReactNode
  /** Line 2, joined with " · "; empty parts are dropped. */
  meta?: ReadonlyArray<MetaPart>
  /** The failure, in destructive ink, wrapped to two lines with the full text on hover. */
  error?: string | null
  /** A warning in amber ink: something to look at, not a failure. */
  note?: ReactNode
  /** Anything else under the meta line (a progress bar). */
  children?: ReactNode
  /** Right-aligned controls. */
  actions?: ReactNode
  /** Operator-muted rows: duplicates, still unpacking. */
  dimmed?: boolean
  className?: string
}) {
  const parts = (meta ?? []).filter(
    (part): part is Exclude<MetaPart, null | undefined | false> =>
      part !== null && part !== undefined && part !== false && part !== ''
  )

  return (
    <div
      data-slot="activity-row"
      className={cn('flex min-h-14 items-start gap-3 px-4 py-3', className)}
    >
      <div className="min-w-0 flex-1">
        {/* Title and status on line 1, meta on line 2. On a phone the title may take two
            lines and the meta wraps instead of truncating, so a long release name and the
            time at the end of the meta are never cut off. */}
        <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-0.5">
          <div
            className={cn(
              'line-clamp-2 min-w-0 flex-1 basis-0 text-sm wrap-anywhere sm:line-clamp-1',
              // Dim the words, not the status: a faded badge would drop below contrast.
              dimmed && 'opacity-60'
            )}
            title={titleHint}
          >
            {title}
          </div>
          {status && <div className="flex shrink-0 items-center gap-1">{status}</div>}
          {parts.length > 0 && (
            <p
              className={cn(
                'readout min-w-0 basis-full text-xs wrap-anywhere text-muted-foreground sm:truncate',
                dimmed && 'opacity-60'
              )}
            >
              {parts.map((part, index) => (
                <span key={index}>
                  {index > 0 && <span aria-hidden="true"> · </span>}
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>
        {error && (
          <p
            className="mt-0.5 line-clamp-4 text-xs break-words text-destructive sm:line-clamp-2"
            title={error}
          >
            {error}
          </p>
        )}
        {note && <p className="mt-0.5 text-xs text-status-queued-ink">{note}</p>}
        {children}
      </div>
      {actions && <div className="-my-1 flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}

/**
 * The row above each tab's content: a readout or filter on the left, Refresh
 * and actions on the right. It wraps rather than scrolling at 375px.
 */
export function ActivityToolbar({
  summary,
  children,
}: {
  summary?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 text-sm text-muted-foreground">{summary}</div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function RefreshButton({
  onClick,
  refreshing,
  label = 'Refresh',
}: {
  onClick: () => void
  refreshing: boolean
  label?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={onClick}
      disabled={refreshing}
      aria-label={label}
      title={label}
    >
      <HugeiconsIcon
        icon={RefreshIcon}
        aria-hidden="true"
        className={cn(refreshing && 'animate-spin motion-reduce:animate-none')}
      />
    </Button>
  )
}

/** A number inside running text: Readout face, tabular figures. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('readout tabular-nums', className)}>{children}</span>
}

/**
 * A row action. Labelled buttons keep their word from 640px up and fold to the
 * icon on a phone; the accessible name is always the full label.
 */
export function RowButton({
  icon,
  label,
  onClick,
  busy = false,
  disabled = false,
  iconOnly = false,
  destructive = false,
}: {
  icon: IconSvgElement
  label: string
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  iconOnly?: boolean
  destructive?: boolean
}) {
  const glyph = busy ? (
    <Spinner />
  ) : (
    <HugeiconsIcon
      icon={icon}
      aria-hidden="true"
      className={destructive ? 'text-destructive' : undefined}
    />
  )
  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClick}
        disabled={disabled || busy}
        aria-label={label}
        title={label}
      >
        {glyph}
      </Button>
    )
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      title={label}
      className="max-sm:size-8 max-sm:px-0"
    >
      {glyph}
      <span className="max-sm:sr-only">{label}</span>
    </Button>
  )
}
