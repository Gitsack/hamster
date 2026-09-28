import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Award01Icon, Delete01Icon, Edit02Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsPage } from '@/components/settings/settings-page'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { EntityRow } from '@/components/settings/entity-row'
import { CustomFormatsSection } from '@/components/settings/custom-formats-section'
import { send } from '@/components/system/system_api'
import { useLibrarySettings } from '@/hooks/use_library_settings'
import { cn } from '@/lib/utils'
import {
  MEDIA_TYPES,
  MEDIA_TYPE_INFO,
  profileSummary,
  type MediaType,
  type QualityProfile,
} from './library_catalog'
import { QualityProfileSheet, type ProfileSheetMode } from './quality-profile-sheet'

interface QualitySettingsProps {
  /** ?type= from the URL; null picks the first enabled type. */
  type: MediaType | null
  /** Put the chosen type in the URL, so a reload or a shared link lands on it. */
  onTypeChange: (type: MediaType) => void
}

/**
 * Settings → Quality: the profiles that decide which releases are acceptable,
 * one media type at a time, and the custom formats that score them.
 */
export function QualitySettings({ type, onTypeChange }: QualitySettingsProps) {
  const library = useLibrarySettings({ settings: true, qualityProfiles: true })
  const [sheet, setSheet] = useState<ProfileSheetMode | null>(null)

  const settings = library.settings.data
  const profiles = library.qualityProfiles.data
  const enabled = settings?.enabledMediaTypes ?? []
  const current: MediaType = type ?? MEDIA_TYPES.find((t) => enabled.includes(t)) ?? 'movies'
  const info = MEDIA_TYPE_INFO[current]
  const scoped = (profiles ?? []).filter((profile) => profile.mediaType === current)
  const countFor = (t: MediaType) =>
    (profiles ?? []).filter((profile) => profile.mediaType === t).length

  const remove = async (profile: QualityProfile) => {
    await send(`/api/v1/qualityprofiles/${profile.id}`, 'DELETE')
    library.update('qualityProfiles', (list: QualityProfile[]) =>
      list.filter((p) => p.id !== profile.id)
    )
    toast.success(`${profile.name} deleted`)
  }

  const removeFromRow = async (profile: QualityProfile) => {
    try {
      await remove(profile)
    } catch (err) {
      toast.error(`${profile.name} was not deleted`, {
        description:
          err instanceof Error
            ? `${err.message}. It may still be assigned to a title.`
            : 'It may still be assigned to a title.',
      })
    }
  }

  const addProfile = () => setSheet({ kind: 'new', mediaType: current })

  const loading = library.qualityProfiles.loading || library.settings.loading
  const ready = !loading

  return (
    <SettingsPage
      title="Quality"
      description="Which releases Hamster accepts, and the custom formats that rank them."
      ready={ready}
    >
      <Section
        id="profiles"
        title="Profiles"
        description="Every monitored title uses one: the qualities it accepts and when upgrading stops."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={addProfile}>
            <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
            Add profile
          </Button>
        }
      >
        <TypeSwitcher
          value={current}
          enabled={enabled}
          counts={profiles ? countFor : null}
          onChange={onTypeChange}
        />
        {!loading && settings && !enabled.includes(current) && (
          <p className="text-sm text-muted-foreground">
            {info.label} {current === 'music' ? 'is' : 'are'} switched off in Media, so nothing uses
            these profiles until {current === 'music' ? 'it is' : 'they are'} back on.
          </p>
        )}
        <RowGroup
          loading={loading}
          skeletonRows={2}
          error={library.qualityProfiles.error}
          onRetry={() => void library.reload('qualityProfiles')}
          empty={
            <>
              No {info.noun} profile yet.{' '}
              <button
                type="button"
                onClick={addProfile}
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                Add one
              </button>{' '}
              to say which releases are acceptable.
            </>
          }
        >
          {scoped.map((profile) => (
            <EntityRow
              key={profile.id}
              icon={Award01Icon}
              name={profile.name}
              meta={profileSummary(profile)}
              onOpen={() => setSheet({ kind: 'edit', profile })}
              actions={[
                {
                  label: 'Edit',
                  icon: Edit02Icon,
                  onSelect: () => setSheet({ kind: 'edit', profile }),
                },
                {
                  label: 'Delete',
                  icon: Delete01Icon,
                  destructive: true,
                  onSelect: () => removeFromRow(profile),
                  confirm: {
                    title: `Delete ${profile.name}?`,
                    description:
                      'It can no longer be assigned. Titles using it keep their files; only the rule goes.',
                    confirmLabel: 'Delete profile',
                  },
                },
              ]}
            />
          ))}
        </RowGroup>
      </Section>

      <CustomFormatsSection qualityProfiles={profiles ?? []} />

      <QualityProfileSheet
        mode={sheet}
        onOpenChange={(open) => {
          if (!open) setSheet(null)
        }}
        onSaved={(saved, created) => {
          library.update('qualityProfiles', (list: QualityProfile[]) =>
            created ? [...list, saved] : list.map((p) => (p.id === saved.id ? saved : p))
          )
          toast.success(`${saved.name} ${created ? 'added' : 'saved'}`)
        }}
        onDelete={remove}
      />
    </SettingsPage>
  )
}

/**
 * The per-type segmented control. Scrolls sideways rather than wrapping when a
 * phone is too narrow, keeping the chosen type in view.
 */
function TypeSwitcher({
  value,
  enabled,
  counts,
  onChange,
}: {
  value: MediaType
  enabled: readonly MediaType[]
  counts: ((type: MediaType) => number) | null
  onChange: (type: MediaType) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Sideways only: scrollIntoView would also pull the page up from a #formats landing.
  useEffect(() => {
    const scroller = scrollerRef.current
    const active = activeRef.current
    if (!scroller || !active) return
    const start = active.offsetLeft
    const end = start + active.offsetWidth
    if (start < scroller.scrollLeft || end > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = Math.max(0, start - 16)
    }
  }, [value])

  return (
    <div
      ref={scrollerRef}
      className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      <div
        role="group"
        aria-label="Media type"
        className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-[3px]"
      >
        {MEDIA_TYPES.map((type) => {
          const active = type === value
          const off = !enabled.includes(type)
          const count = counts?.(type)
          return (
            <button
              key={type}
              ref={active ? activeRef : undefined}
              type="button"
              aria-pressed={active}
              title={off ? 'Switched off in Media' : undefined}
              onClick={() => !active && onChange(type)}
              className={cn(
                'inline-flex h-full shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors',
                'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                active
                  ? 'bg-background text-foreground shadow-sm dark:bg-input/60'
                  : 'text-muted-foreground hover:text-foreground',
                off && !active && 'opacity-60'
              )}
            >
              {MEDIA_TYPE_INFO[type].label}
              {count !== undefined && (
                <span className="readout text-xs text-muted-foreground">{count}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
