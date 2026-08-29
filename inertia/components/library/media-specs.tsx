import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface MediaSpec {
  label: string
  value: ReactNode
  /** Paths and identifiers an operator compares character by character. */
  mono?: boolean
}

/**
 * The configuration band at the foot of a detail hero: quality profile, download client,
 * root folder, and the outbound reference links.
 *
 * These used to sit in the hero as a third row of badges, indistinguishable from the genre
 * chips above them — chip-shaped, same size, same rhythm — so a squint at the page found a
 * field of pills and no hierarchy. They are not description; they are how this item is
 * wired up. A seam separates them, and the type steps down to Label, which is what the
 * design system already reserves for metadata.
 */
export function MediaSpecs({
  specs,
  control,
  links,
  className,
}: {
  specs: MediaSpec[]
  /** An interactive spec, such as the download-client picker. */
  control?: ReactNode
  links?: ReactNode
  className?: string
}) {
  const shown = specs.filter((spec) => spec.value)
  if (shown.length === 0 && !control && !links) return null

  return (
    <div
      className={cn(
        'border-border flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3',
        className
      )}
    >
      {shown.map((spec) => (
        <div key={spec.label} className="flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">{spec.label}</span>
          <span className={cn('text-foreground truncate text-xs', spec.mono && 'readout')}>
            {spec.value}
          </span>
        </div>
      ))}
      {control}
      {links && <div className="ml-auto flex items-center gap-3">{links}</div>}
    </div>
  )
}

/** Outbound reference link, sized to sit in the spec band without competing with it. */
export function MediaSpecLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-primary focus-visible:ring-ring/50 rounded-sm text-xs underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
    >
      {children}
    </a>
  )
}
