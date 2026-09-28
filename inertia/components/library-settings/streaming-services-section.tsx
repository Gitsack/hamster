import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle02Icon, Search01Icon } from '@hugeicons/core-free-icons'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EDITOR_SHEET_CLASS } from '@/components/settings/editor-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { SettingRow, saveErrorMessage } from '@/components/settings/setting-row'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import { regionName, type StreamingProvider } from './library_catalog'

interface StreamingServicesSectionProps {
  /** Null until settings have loaded. */
  hasTmdbKey: boolean | null
  onAddTmdbKey: () => void
  providers: StreamingProvider[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  locale: string
  selected: readonly number[]
  /** Persist the new selection. Reject with the reason; the selection reverts. */
  onChange: (selected: number[]) => Promise<void>
}

/**
 * Settings → Discovery → Your streaming services. Titles already on one of
 * them are marked in search, so they need not be downloaded. The list comes
 * from TMDB, so without a key the section says so instead of vanishing.
 */
export function StreamingServicesSection({
  hasTmdbKey,
  onAddTmdbKey,
  providers,
  loading,
  error,
  onRetry,
  locale,
  selected,
  onChange,
}: StreamingServicesSectionProps) {
  const [picking, setPicking] = useState(false)
  const chosen = (providers ?? []).filter((provider) => selected.includes(provider.id))
  const canPick = hasTmdbKey === true && (providers?.length ?? 0) > 0

  return (
    <Section
      id="streaming"
      title="Your streaming services"
      description="Titles already on these are marked in search, so you can skip downloading them."
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPicking(true)}
          disabled={!canPick}
        >
          Choose services
        </Button>
      }
    >
      {hasTmdbKey === false ? (
        <RowGroup>
          <SettingRow
            label="Needs TMDB key"
            description="The list of services comes from TMDB."
            control={
              <>
                <StatusBadge tone="warning" label="Missing" />
                <Button type="button" variant="ghost" size="sm" onClick={onAddTmdbKey}>
                  Add key
                </Button>
              </>
            }
          />
        </RowGroup>
      ) : (
        <RowGroup
          loading={loading || hasTmdbKey === null}
          skeletonRows={1}
          error={error}
          onRetry={onRetry}
          empty={`TMDB lists no services for ${regionName(locale)}. Try another region above.`}
        >
          {providers && providers.length > 0 && (
            <div className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-3">
              {chosen.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None chosen, so nothing is marked as already streaming.
                </p>
              ) : (
                chosen.map((provider) => (
                  <span
                    key={provider.id}
                    className="inline-flex h-8 items-center gap-2 rounded-md border border-border pr-2.5 pl-1 text-sm"
                  >
                    <img src={provider.logoPath} alt="" className="size-6 rounded-sm" />
                    {provider.name}
                  </span>
                ))
              )}
            </div>
          )}
        </RowGroup>
      )}

      <ProviderPicker
        open={picking}
        onOpenChange={setPicking}
        providers={providers ?? []}
        selected={selected}
        locale={locale}
        onChange={onChange}
      />
    </Section>
  )
}

function ProviderPicker({
  open,
  onOpenChange,
  providers,
  selected,
  locale,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  providers: StreamingProvider[]
  selected: readonly number[]
  locale: string
  onChange: (selected: number[]) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [optimistic, setOptimistic] = useState<number[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = optimistic ?? selected

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? providers.filter((p) => p.name.toLowerCase().includes(needle)) : providers
  }, [providers, query])

  const toggle = async (id: number) => {
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    setOptimistic(next)
    setError(null)
    try {
      await onChange(next)
    } catch (err) {
      setError(`Not saved: ${saveErrorMessage(err)}`)
    } finally {
      // The parent's list is now the truth, whichever way it went.
      setOptimistic((pending) => (pending === next ? null : pending))
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setQuery('')
      }}
    >
      <SheetContent className={EDITOR_SHEET_CLASS}>
        <SheetHeader className="pr-14 pb-4">
          <SheetTitle>Your streaming services</SheetTitle>
          <SheetDescription>
            <span className="readout">{current.length}</span> chosen · available in{' '}
            {regionName(locale)}. Each choice saves as you make it.
          </SheetDescription>
          <div className="pt-2">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search services…"
                aria-label="Search streaming services"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </SheetHeader>
        <SheetBody>
          {matches.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">No service matches that.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 px-6 pb-6 sm:grid-cols-2">
              {matches.map((provider) => {
                const on = current.includes(provider.id)
                return (
                  <li key={provider.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => void toggle(provider.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md border p-2.5 text-left outline-none transition-colors duration-150',
                        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        on ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                      )}
                    >
                      <img src={provider.logoPath} alt="" className="size-8 shrink-0 rounded-sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {provider.name}
                      </span>
                      {on && (
                        <HugeiconsIcon
                          icon={CheckmarkCircle02Icon}
                          aria-hidden="true"
                          className="size-4 shrink-0 text-primary"
                        />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
