import { useId, useState, type ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { RowGroup } from '@/components/settings/row-group'
import { StatusBadge } from '@/components/status-badge'
import { formatTimestamp, timeAgo } from '@/components/activity/activity_format'
import { cn } from '@/lib/utils'
import { deliveryProblem, type Delivery } from './targets'

interface DeliveryLogProps {
  /** null while the first fetch is in flight. */
  deliveries: readonly Delivery[] | null
  error?: ReactNode
  onRetry?: () => void
  /** Name each row's target; leave out inside a single target's sheet. */
  targetName?: (targetKey: string) => string | null
  empty: ReactNode
  skeletonRows?: number
}

/**
 * Delivery attempts, failures first. Each row expands to what was sent and,
 * for webhooks, what the endpoint answered.
 */
export function DeliveryLog({
  deliveries,
  error,
  onRetry,
  targetName,
  empty,
  skeletonRows = 3,
}: DeliveryLogProps) {
  return (
    <RowGroup
      loading={deliveries === null && !error}
      skeletonRows={skeletonRows}
      error={error}
      onRetry={onRetry}
      empty={empty}
    >
      {(deliveries ?? []).map((delivery) => (
        <DeliveryRow
          key={delivery.key}
          delivery={delivery}
          targetName={targetName ? (targetName(delivery.targetKey) ?? 'Deleted target') : null}
        />
      ))}
    </RowGroup>
  )
}

function DeliveryRow({ delivery, targetName }: { delivery: Delivery; targetName: string | null }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const hasDetail = Boolean(delivery.sent || delivery.response)
  const when = timeAgo(delivery.createdAt)

  const title = (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="min-w-0 truncate text-sm font-medium">
        {targetName ? (
          <>
            {targetName}
            <span className="font-normal text-muted-foreground"> · {delivery.eventLabel}</span>
          </>
        ) : (
          delivery.eventLabel
        )}
      </span>
      {delivery.success ? (
        <StatusBadge tone="ok" label="Delivered" />
      ) : (
        <StatusBadge tone="error" label="Failed" />
      )}
    </span>
  )

  const meta = (
    <span className="readout block truncate text-xs text-muted-foreground">
      {delivery.status !== null && <span>HTTP {delivery.status} · </span>}
      <time dateTime={delivery.createdAt} title={formatTimestamp(delivery.createdAt)}>
        {when}
      </time>
    </span>
  )

  // The status is already on the meta line; the error line only adds words beyond it.
  const problemText = delivery.success
    ? null
    : delivery.status !== null
      ? delivery.error && delivery.error !== `HTTP ${delivery.status}`
        ? delivery.error
        : null
      : deliveryProblem(delivery)
  const problem = problemText ? (
    <span className="mt-0.5 line-clamp-2 block text-xs break-words text-destructive">
      {problemText}
    </span>
  ) : null

  if (!hasDetail) {
    return (
      <div data-slot="delivery-row" className="min-h-14 px-4 py-3">
        {title}
        {meta}
        {problem}
      </div>
    )
  }

  return (
    <div data-slot="delivery-row">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="min-w-0 flex-1">
          {title}
          {meta}
          {problem}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div id={panelId} className="space-y-3 px-4 pb-4">
          {delivery.response !== null && (
            <DetailBlock
              label={delivery.status !== null ? `Response · HTTP ${delivery.status}` : 'Response'}
              body={delivery.response || '(empty body)'}
            />
          )}
          {delivery.sent && (
            <DetailBlock
              label={delivery.kind === 'webhook' ? 'Sent' : 'Message'}
              body={delivery.sent}
            />
          )}
        </div>
      )}
    </div>
  )
}

function DetailBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="readout max-h-64 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs break-words whitespace-pre-wrap">
        {body}
      </pre>
    </div>
  )
}
