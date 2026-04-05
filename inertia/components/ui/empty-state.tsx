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
      {icon && <div className="rounded-full bg-muted p-6 mb-4">{icon}</div>}
      {title && <h3 className="text-lg font-medium mb-2">{title}</h3>}
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  )
}
