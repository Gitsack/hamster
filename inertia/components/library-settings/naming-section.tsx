import { useEffect, useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '@/components/ui/accordion'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import {
  MEDIA_TYPE_INFO,
  NAMING_FIELD_LABELS,
  renderPattern,
  renderPatternPath,
  type MediaType,
  type NamingPatternsData,
} from './library_catalog'

export type NamingDraft = Record<MediaType, Record<string, string>>

/** Field errors keyed "movies.movieFile". */
export type NamingFieldErrors = Record<string, string>

interface NamingSectionProps {
  naming: NamingPatternsData | null
  loading: boolean
  error: string | null
  onRetry: () => void
  enabledTypes: readonly MediaType[]
  /** The patterns as edited; saved with the page's save bar. */
  draft: NamingDraft | null
  onChange: (type: MediaType, field: string, value: string) => void
  fieldErrors: NamingFieldErrors
}

/**
 * Settings → Media → File organization: the folder and file names Hamster
 * writes on import. Each type collapses to the path its patterns render to,
 * so the common case — checking, not changing — needs no click.
 */
export function NamingSection({
  naming,
  loading,
  error,
  onRetry,
  enabledTypes,
  draft,
  onChange,
  fieldErrors,
}: NamingSectionProps) {
  return (
    <Section
      id="naming"
      title="File organization"
      description="The folder and file names Hamster writes when it imports."
    >
      <RowGroup
        loading={loading}
        skeletonRows={2}
        error={error}
        onRetry={onRetry}
        empty="No media type is on yet. Switch one on above and its naming patterns appear here."
      >
        {naming && draft
          ? enabledTypes.map((type) => (
              <NamingRow
                key={type}
                type={type}
                naming={naming}
                patterns={draft[type] ?? {}}
                saved={naming.patterns[type] ?? {}}
                onChange={(field, value) => onChange(type, field, value)}
                fieldErrors={fieldErrors}
              />
            ))
          : null}
      </RowGroup>
    </Section>
  )
}

function NamingRow({
  type,
  naming,
  patterns,
  saved,
  onChange,
  fieldErrors,
}: {
  type: MediaType
  naming: NamingPatternsData
  patterns: Record<string, string>
  saved: Record<string, string>
  onChange: (field: string, value: string) => void
  fieldErrors: NamingFieldErrors
}) {
  const baseId = useId()
  const info = MEDIA_TYPE_INFO[type]
  const example = renderPatternPath(naming, type, patterns)
  const edited = Object.keys(patterns).some((field) => patterns[field] !== saved[field])
  const hasError = Object.keys(patterns).some((field) => fieldErrors[`${type}.${field}`])
  const [open, setOpen] = useState(false)

  // A pattern the server refused opens its type, so the reason is in view.
  useEffect(() => {
    if (hasError) setOpen(true)
  }, [hasError])

  return (
    <CollapsibleRoot
      data-slot="setting-row"
      open={open}
      onOpenChange={setOpen}
      className="px-4 py-3"
    >
      <CollapsibleTrigger className="-mx-1 flex min-h-8 w-[calc(100%+0.5rem)] min-w-0 items-center gap-2 px-1 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3">
          <span className="shrink-0 text-sm font-medium">{info.label}</span>
          <span className="readout min-w-0 truncate text-xs font-normal text-muted-foreground">
            {example}
          </span>
        </span>
        {hasError ? (
          <span className="shrink-0 text-xs font-normal text-destructive">Check patterns</span>
        ) : edited ? (
          <span className="shrink-0 text-xs font-normal text-status-queued-ink">Edited</span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="space-y-5 pt-4 pb-1 md:pl-5">
          {Object.entries(patterns).map(([field, pattern]) => {
            const id = `${baseId}-${field}`
            const variables = naming.variables[type]?.[field] ?? []
            const rendered = renderPattern(variables, pattern)
            const fieldError = fieldErrors[`${type}.${field}`]
            return (
              <div key={field} className="space-y-1.5">
                <label htmlFor={id} className="block text-sm font-medium">
                  {NAMING_FIELD_LABELS[field] ?? field}
                </label>
                <Input
                  id={id}
                  value={pattern}
                  onChange={(event) => onChange(field, event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby={`${id}-example${fieldError ? ` ${id}-error` : ''}`}
                  className="readout"
                />
                {fieldError && (
                  <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
                    {fieldError}
                  </p>
                )}
                <p id={`${id}-example`} className="text-xs break-all text-muted-foreground">
                  Renders as <span className="readout">{rendered || '—'}</span>
                </p>
                {variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5" aria-label="Insert a variable">
                    {variables.map((variable) => (
                      <button
                        key={variable.name}
                        type="button"
                        onClick={() => onChange(field, `${pattern}{${variable.name}}`)}
                        title={variable.description}
                        aria-label={`Append {${variable.name}}: ${variable.description}`}
                        className="readout rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        {`{${variable.name}}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CollapsiblePanel>
    </CollapsibleRoot>
  )
}
