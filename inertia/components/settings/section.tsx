import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionProps {
  /** Anchor id, so `/settings/media#playback` lands here. */
  id: string
  title: ReactNode
  /** One muted line. Longer help belongs behind an info popover. */
  description?: ReactNode
  /** The section-owned action: "Add format", "Clear", "Create backup". */
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * A flat settings section: a small heading, an optional line of description and
 * its content — usually one RowGroup. No card; the row group is the only box.
 */
export function Section({ id, title, description, actions, children, className }: SectionProps) {
  const headingId = useId()

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-slot="settings-section"
      className={cn('scroll-mt-20 space-y-3', className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-0.5">
          <h3 id={headingId} className="text-sm font-semibold">
            {title}
          </h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && (
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </section>
  )
}
