import { Children, type ComponentProps, type ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const GROUP = 'overflow-hidden rounded-xl border border-border bg-card divide-y divide-border'

interface RowGroupProps extends ComponentProps<'div'> {
  /** Paint skeleton rows until data arrives; defaults are never painted. */
  loading?: boolean
  /** How many skeleton rows to show while loading. */
  skeletonRows?: number
  /** A fetch failure. Replaces the rows with one inline destructive row. */
  error?: ReactNode
  /** Offered beside a fetch failure. */
  onRetry?: () => void
  /** Shown (as one muted line, no box) when there are no rows. */
  empty?: ReactNode
}

/**
 * The only container on a settings page: a bordered panel of rows separated by
 * hairlines. Rows go straight inside — never a box inside this box.
 */
export function RowGroup({
  loading = false,
  skeletonRows = 3,
  error,
  onRetry,
  empty,
  className,
  children,
  ...props
}: RowGroupProps) {
  if (loading) {
    return (
      <div data-slot="row-group" aria-busy="true" className={cn(GROUP, className)} {...props}>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (error) {
    return (
      <div data-slot="row-group" className={cn(GROUP, className)} {...props}>
        <RowGroupError message={error} onRetry={onRetry} />
      </div>
    )
  }

  const hasRows = Children.toArray(children).length > 0
  if (!hasRows) {
    if (!empty) return null
    return (
      <div data-slot="row-group-empty" className="text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }

  return (
    <div data-slot="row-group" className={cn(GROUP, className)} {...props}>
      {children}
    </div>
  )
}

/** A placeholder with the same footprint as a two-line row. */
export function RowSkeleton() {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3" aria-hidden="true">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40 max-w-[60%]" />
        <Skeleton className="h-3 w-64 max-w-[85%]" />
      </div>
      <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
    </div>
  )
}

/**
 * An inline failure row: what went wrong (include the HTTP status when there is
 * one) and a way to try again.
 */
export function RowGroupError({ message, onRetry }: { message: ReactNode; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
    >
      <p className="flex min-w-0 items-center gap-2 text-sm text-destructive">
        <HugeiconsIcon icon={Alert02Icon} aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0">{message}</span>
      </p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <HugeiconsIcon icon={RefreshIcon} aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  )
}

/** "HTTP 502 · Bad Gateway" from a failed fetch Response, for RowGroup's `error`. */
export function describeHttpError(response: Pick<Response, 'status' | 'statusText'>): string {
  const text = response.statusText?.trim()
  return text ? `HTTP ${response.status} · ${text}` : `HTTP ${response.status}`
}

/**
 * The inline action inside an empty section's muted line: "No clients yet.
 * Add one to start."
 */
export function InlineAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {children}
    </button>
  )
}
