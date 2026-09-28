import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSettingsShell } from './settings_shell'

interface PageHeaderProps {
  /** Equals the settings rail label. */
  title: ReactNode
  /** One sentence, roughly 90 characters at most. */
  description?: ReactNode
  /** The page's primary action (a small Button). Drops below the title, full width, under sm. */
  actions?: ReactNode
  className?: string
}

/**
 * The heading of a settings page. It lives in the content column, never in the
 * app header's sliding actions slot, so the primary action stays where the
 * content is on every breakpoint.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  const { inShell } = useSettingsShell()

  return (
    <header
      data-slot="settings-page-header"
      className={cn(
        'mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 className={cn('text-xl font-semibold text-balance', inShell && 'max-md:sr-only')}>
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </header>
  )
}
