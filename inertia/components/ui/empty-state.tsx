import React from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  message,
  subtitle,
  className,
}: {
  icon?: React.ReactNode
  title?: string
  message?: string
  subtitle?: string
  className?: string
}) {
  const description = message || subtitle

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-6 [&_svg]:size-6">
          {icon}
        </div>
      )}
      {title && <h3 className="text-lg font-medium">{title}</h3>}
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground text-balance">{description}</p>
      )}
    </div>
  )
}
