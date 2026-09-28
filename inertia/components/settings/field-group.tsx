import { useId, type ComponentType, type ReactNode } from 'react'

export interface FieldGroupProps {
  title: string
  /** One muted sentence under the heading. */
  description?: ReactNode
  children: ReactNode
}

/** How an editor lays out one group of fields. Components that own several take one. */
export type FieldGroupComponent = ComponentType<FieldGroupProps>

/**
 * A group of fields inside a dialog or inline form: a hairline above, a small
 * heading, then the fields.
 */
export function FieldGroup({ title, description, children }: FieldGroupProps) {
  return (
    <fieldset className="min-w-0 space-y-3 border-t border-border pt-6">
      <legend className="sr-only">{title}</legend>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </fieldset>
  )
}

/**
 * A group of fields inside a Sheet editor. Its heading sticks to the top of the
 * sheet's scroll area while its fields scroll past, so a long editor always
 * says where you are.
 */
export function SheetSection({ title, description, children }: FieldGroupProps) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-4">
      <h4
        id={headingId}
        className="sticky top-0 z-10 -mx-6 border-b border-border bg-popover px-6 pt-4 pb-2 text-sm font-semibold"
      >
        {title}
      </h4>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {children}
    </section>
  )
}
