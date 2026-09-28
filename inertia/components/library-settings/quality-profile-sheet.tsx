import { useEffect, useId, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete01Icon } from '@hugeicons/core-free-icons'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EDITOR_SHEET_CLASS } from '@/components/settings/editor-sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useConfirmDialog } from '@/hooks/use_confirm_dialog'
import { SheetSection } from '@/components/settings/field-group'
import {
  DEFAULT_REQUIREMENTS,
  QualityRequirementsFields,
  type QualityRequirements,
} from '@/components/settings/quality-requirements-fields'
import { ReleaseTester } from '@/components/settings/release-tester'
import { send } from '@/components/system/system_api'
import {
  MEDIA_TYPE_INFO,
  QUALITY_OPTIONS,
  type MediaType,
  type QualityItem,
  type QualityProfile,
} from './library_catalog'

export type ProfileSheetMode =
  | { kind: 'new'; mediaType: MediaType }
  | { kind: 'edit'; profile: QualityProfile }

interface Draft {
  name: string
  items: QualityItem[]
  upgradeAllowed: boolean
  cutoff: number | null
  minSizeMb: string
  maxSizeMb: string
  requirements: QualityRequirements
}

function draftFor(mode: ProfileSheetMode): Draft {
  if (mode.kind === 'edit') {
    const profile = mode.profile
    return {
      name: profile.name,
      items: profile.items,
      upgradeAllowed: profile.upgradeAllowed,
      cutoff: profile.cutoff,
      minSizeMb: profile.minSizeMb !== null ? String(profile.minSizeMb) : '',
      maxSizeMb: profile.maxSizeMb !== null ? String(profile.maxSizeMb) : '',
      requirements: { ...DEFAULT_REQUIREMENTS, ...(profile.requirements ?? {}) },
    }
  }
  return {
    name: '',
    items: QUALITY_OPTIONS[mode.mediaType].map((option) => ({ ...option, allowed: true })),
    upgradeAllowed: true,
    cutoff: null,
    minSizeMb: '',
    maxSizeMb: '',
    requirements: DEFAULT_REQUIREMENTS,
  }
}

function modeType(mode: ProfileSheetMode): MediaType {
  return mode.kind === 'edit' ? (mode.profile.mediaType ?? 'movies') : mode.mediaType
}

/** Whole megabytes, or null when blank. NaN when it is not a number at all. */
function parseSize(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : Number.NaN
}

interface QualityProfileSheetProps {
  /** What the sheet edits; null closes it. */
  mode: ProfileSheetMode | null
  onOpenChange: (open: boolean) => void
  onSaved: (profile: QualityProfile, created: boolean) => void
  /** Delete from the footer. Reject with the reason to keep the sheet open. */
  onDelete: (profile: QualityProfile) => Promise<void>
}

/**
 * Add or edit a quality profile. The sections run in the order the questions
 * get asked: will this release name pass (edit only), which qualities, when to
 * stop upgrading, how big, then the audio, video, language and matching rules.
 */
export function QualityProfileSheet({
  mode,
  onOpenChange,
  onSaved,
  onDelete,
}: QualityProfileSheetProps) {
  const ids = useId()
  // Keep the last mode while the sheet animates closed.
  const [shown, setShown] = useState<ProfileSheetMode>(mode ?? { kind: 'new', mediaType: 'movies' })
  const [draft, setDraft] = useState<Draft>(() => draftFor(shown))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmDialog = useConfirmDialog()

  useEffect(() => {
    if (!mode) return
    setShown(mode)
    setDraft(draftFor(mode))
    setError(null)
    setSaving(false)
  }, [mode])

  const mediaType = modeType(shown)
  const info = MEDIA_TYPE_INFO[mediaType]
  const editing = shown.kind === 'edit' ? shown.profile : null
  const allowed = draft.items.filter((item) => item.allowed)
  const cutoff =
    draft.cutoff !== null && allowed.some((item) => item.id === draft.cutoff)
      ? draft.cutoff
      : (allowed[0]?.id ?? null)
  const minSize = parseSize(draft.minSizeMb)
  const maxSize = parseSize(draft.maxSizeMb)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    if (error) setError(null)
  }

  const problem = (): string | null => {
    if (!draft.name.trim()) return 'Give the profile a name so it can be picked later.'
    if (allowed.length === 0) return 'Allow at least one quality.'
    if (Number.isNaN(minSize) || Number.isNaN(maxSize)) return 'Sizes are whole megabytes.'
    if (minSize !== null && maxSize !== null && minSize > maxSize) {
      return 'The minimum size is above the maximum.'
    }
    return null
  }

  const submit = async () => {
    if (saving) return
    const invalid = problem()
    if (invalid) {
      setError(invalid)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: draft.name.trim(),
        mediaType,
        items: draft.items,
        upgradeAllowed: draft.upgradeAllowed,
        minSizeMb: minSize ?? undefined,
        maxSizeMb: maxSize ?? undefined,
        // The quality Hamster stops upgrading at. Defaults to the best allowed one.
        cutoff: cutoff ?? 1,
        requirements: draft.requirements,
      }
      const saved = editing
        ? await send<QualityProfile>(`/api/v1/qualityprofiles/${editing.id}`, 'PUT', body)
        : await send<QualityProfile>('/api/v1/qualityprofiles', 'POST', body)
      if (saved) onSaved(saved, !editing)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The profile was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const askDelete = () => {
    if (!editing) return
    confirmDialog.confirm({
      title: `Delete ${editing.name}?`,
      description:
        'It can no longer be assigned. Titles using it keep their files; only the rule goes. This cannot be undone.',
      confirmLabel: 'Delete profile',
      loadingLabel: 'Deleting…',
      onConfirm: async () => {
        try {
          await onDelete(editing)
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'The profile was not deleted.')
        }
      },
    })
  }

  return (
    <Sheet open={mode !== null} onOpenChange={(open) => !saving && onOpenChange(open)}>
      <SheetContent className={EDITOR_SHEET_CLASS}>
        <SheetHeader className="pr-14 pb-4">
          <SheetTitle className="truncate">
            {editing ? editing.name : `Add ${info.noun} profile`}
          </SheetTitle>
          <SheetDescription>
            Which releases Hamster may accept for {info.noun}, and when it stops upgrading.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="space-y-6 px-6 pb-8">
            <div className="space-y-1.5 pt-1">
              <label htmlFor={`${ids}-name`} className="block text-sm font-medium">
                Name
              </label>
              <Input
                id={`${ids}-name`}
                placeholder="e.g. HD 1080p"
                value={draft.name}
                onChange={(event) => set('name', event.target.value)}
                autoComplete="off"
              />
            </div>

            {editing && (
              <ReleaseTester profileId={editing.id} mediaType={mediaType} group={SheetSection} />
            )}

            <SheetSection
              title="Qualities"
              description="Releases outside this set are skipped. At least one is required."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {QUALITY_OPTIONS[mediaType].map((option) => {
                  const item = draft.items.find((i) => i.id === option.id)
                  const checkboxId = `${ids}-quality-${option.id}`
                  return (
                    <div key={option.id} className="flex items-center gap-2">
                      <Checkbox
                        id={checkboxId}
                        checked={item?.allowed ?? false}
                        onCheckedChange={() =>
                          set(
                            'items',
                            draft.items.some((i) => i.id === option.id)
                              ? draft.items.map((i) =>
                                  i.id === option.id ? { ...i, allowed: !i.allowed } : i
                                )
                              : [...draft.items, { ...option, allowed: true }]
                          )
                        }
                      />
                      <label htmlFor={checkboxId} className="readout cursor-pointer text-sm">
                        {option.name}
                      </label>
                    </div>
                  )
                })}
              </div>
            </SheetSection>

            <SheetSection title="Upgrades">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor={`${ids}-upgrade`} className="text-sm">
                  Replace a file on disk when a better release appears
                </label>
                <Switch
                  id={`${ids}-upgrade`}
                  checked={draft.upgradeAllowed}
                  onCheckedChange={(checked) => set('upgradeAllowed', checked)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${ids}-cutoff`} className="block text-sm font-medium">
                  Stop upgrading at
                </label>
                <Select
                  value={cutoff !== null ? String(cutoff) : ''}
                  onValueChange={(next) => set('cutoff', Number(next))}
                  disabled={!draft.upgradeAllowed || allowed.length === 0}
                >
                  <SelectTrigger id={`${ids}-cutoff`} className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        allowed.find((item) => String(item.id) === value)?.name ??
                        'Allow a quality first'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {allowed.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A file at this quality is final; anything below it is an upgrade candidate.
                </p>
              </div>
            </SheetSection>

            <SheetSection
              title="Size"
              description="A guard against mislabelled releases. Leave blank for no limit."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(
                  [
                    ['minSizeMb', 'Minimum', 'No minimum'],
                    ['maxSizeMb', 'Maximum', 'No maximum'],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <div key={key} className="space-y-1.5">
                    <label htmlFor={`${ids}-${key}`} className="block text-sm font-medium">
                      {label}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`${ids}-${key}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder={placeholder}
                        value={draft[key]}
                        onChange={(event) => set(key, event.target.value)}
                        className="readout"
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">MB</span>
                    </div>
                  </div>
                ))}
              </div>
            </SheetSection>

            <QualityRequirementsFields
              value={draft.requirements}
              onChange={(requirements) => set('requirements', requirements)}
              showVideoRules={mediaType === 'movies' || mediaType === 'tv'}
              group={SheetSection}
            />
          </div>
        </SheetBody>

        <SheetFooter className="flex-row flex-wrap items-center gap-2">
          {error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {error}
            </p>
          )}
          {editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={askDelete}
              disabled={saving}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <HugeiconsIcon icon={Delete01Icon} aria-hidden="true" />
              Delete
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void submit()} disabled={saving}>
              {saving && <Spinner />}
              {editing ? 'Save' : 'Add profile'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
      <ConfirmDialog
        state={confirmDialog.state}
        close={confirmDialog.close}
        loading={confirmDialog.loading}
        handleConfirm={confirmDialog.handleConfirm}
      />
    </Sheet>
  )
}
