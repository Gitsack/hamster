import { useCallback, useEffect, useId, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  Edit02Icon,
  FilterHorizontalIcon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
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
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useConfirmDialog } from '@/hooks/use_confirm_dialog'
import { getJson, send } from '@/components/system/system_api'
import { Section } from './section'
import { RowGroup } from './row-group'
import { EntityRow } from './entity-row'
import { SheetSection } from './field-group'

type Implementation =
  | 'contains'
  | 'notContains'
  | 'resolution'
  | 'source'
  | 'codec'
  | 'releaseGroup'
  | 'language'

interface Specification {
  name: string
  implementation: Implementation
  negate: boolean
  required: boolean
  value: string
}

export interface CustomFormat {
  id: string
  name: string
  includeWhenRenaming: boolean
  specifications: Specification[]
}

interface ProfileAssignment {
  id: string
  name: string
  score: number
}

export interface QualityProfileOption {
  id: string | number
  name: string
}

const IMPLEMENTATION_LABELS: Record<Implementation, string> = {
  contains: 'Name matches',
  notContains: 'Name does not match',
  resolution: 'Resolution is',
  source: 'Source is',
  codec: 'Video codec is',
  releaseGroup: 'Release group is',
  language: 'Audio language is',
}

const VALUE_HINTS: Record<Implementation, string> = {
  contains: 'Text or regular expression, e.g. \\bAtmos\\b',
  notContains: 'Text or regular expression',
  resolution: '2160p, 1080p, 720p or 480p',
  source: 'bluray, web, hdtv, dvd, cam or remux',
  codec: 'x264, x265, av1, vp9, xvid or divx',
  releaseGroup: 'Group name, e.g. FraMeSToR',
  // Codes rather than names, so the value means the same thing here as it does
  // in a profile's language rules.
  language: "Language code, e.g. de, en, ja — or 'multi'",
}

const EMPTY_SPEC: Specification = {
  name: '',
  implementation: 'contains',
  negate: false,
  required: false,
  value: '',
}

/** "Release group is FraMeSToR", "not Name matches CAM". */
export function describeSpecification(spec: Specification): string {
  return `${spec.negate ? 'not ' : ''}${IMPLEMENTATION_LABELS[spec.implementation]} ${spec.value}`
}

/**
 * Settings → Quality → Custom formats: the rules that say "this specific thing
 * in a release name is worth points to me". A format's score, set per quality
 * profile, counts towards that profile's minimum and towards ranking, so it can
 * promote a trusted group or bury a bad one.
 */
export function CustomFormatsSection({
  qualityProfiles,
}: {
  qualityProfiles: QualityProfileOption[]
}) {
  const [formats, setFormats] = useState<CustomFormat[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CustomFormat | 'new' | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setFormats(await getJson<CustomFormat[]>('/api/v1/customformats'))
    } catch (err) {
      setError(
        `Custom formats could not be loaded: ${err instanceof Error ? err.message : 'Hamster did not answer.'}`
      )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async (format: CustomFormat) => {
    await send(`/api/v1/customformats/${format.id}`, 'DELETE')
    setFormats((current) => current?.filter((f) => f.id !== format.id) ?? current)
    toast.success(`${format.name} deleted`)
  }

  const removeFromRow = async (format: CustomFormat) => {
    try {
      await remove(format)
    } catch (err) {
      toast.error(`${format.name} was not deleted`, {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <Section
      id="formats"
      title="Custom formats"
      description="Score releases on what the quality list can't express: a group, a tag, an audio format."
      actions={
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing('new')}>
          <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
          Add format
        </Button>
      }
    >
      <RowGroup
        loading={formats === null && error === null}
        skeletonRows={2}
        error={error}
        onRetry={() => void load()}
        empty={
          <>
            No custom formats yet.{' '}
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              Add one
            </button>{' '}
            to promote releases you trust, or push down the ones you never want.
          </>
        }
      >
        {(formats ?? []).map((format) => (
          <EntityRow
            key={format.id}
            icon={FilterHorizontalIcon}
            name={format.name}
            meta={format.specifications.map(describeSpecification)}
            onOpen={() => setEditing(format)}
            actions={[
              { label: 'Edit', icon: Edit02Icon, onSelect: () => setEditing(format) },
              {
                label: 'Delete',
                icon: Delete01Icon,
                destructive: true,
                onSelect: () => removeFromRow(format),
                confirm: {
                  title: `Delete ${format.name}?`,
                  description:
                    'Its scores come off every quality profile. Files already grabbed stay.',
                  confirmLabel: 'Delete format',
                },
              },
            ]}
          />
        ))}
      </RowGroup>

      <CustomFormatSheet
        format={editing}
        qualityProfiles={qualityProfiles}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={(saved, created) => {
          setFormats((current) =>
            created
              ? [...(current ?? []), saved]
              : (current ?? []).map((f) => (f.id === saved.id ? saved : f))
          )
          toast.success(`${saved.name} ${created ? 'added' : 'saved'}`)
        }}
        onDelete={remove}
      />
    </Section>
  )
}

function CustomFormatSheet({
  format,
  qualityProfiles,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  /** The format being edited, 'new', or null when closed. */
  format: CustomFormat | 'new' | null
  qualityProfiles: QualityProfileOption[]
  onOpenChange: (open: boolean) => void
  onSaved: (format: CustomFormat, created: boolean) => void
  onDelete: (format: CustomFormat) => Promise<void>
}) {
  const ids = useId()
  const [shown, setShown] = useState<CustomFormat | null>(null)
  const [name, setName] = useState('')
  const [includeWhenRenaming, setIncludeWhenRenaming] = useState(false)
  const [specs, setSpecs] = useState<Specification[]>([{ ...EMPTY_SPEC }])
  const [scores, setScores] = useState<Record<string, string>>({})
  const [scoresLoading, setScoresLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmDialog = useConfirmDialog()

  useEffect(() => {
    if (format === null) return
    let live = true
    const existing = format === 'new' ? null : format
    setShown(existing)
    setName(existing?.name ?? '')
    setIncludeWhenRenaming(existing?.includeWhenRenaming ?? false)
    setSpecs(existing?.specifications.length ? existing.specifications : [{ ...EMPTY_SPEC }])
    setScores({})
    setError(null)
    setSaving(false)

    // Per-profile scores live on the join table, so they come from the detail endpoint.
    if (existing) {
      setScoresLoading(true)
      getJson<{ qualityProfiles?: ProfileAssignment[] }>(`/api/v1/customformats/${existing.id}`)
        .then((detail) => {
          if (!live) return
          const assignments = detail.qualityProfiles ?? []
          setScores(Object.fromEntries(assignments.map((a) => [String(a.id), String(a.score)])))
        })
        .catch(() => {
          if (live) setError('The current scores could not be loaded. Saving would reset them.')
        })
        .finally(() => {
          if (live) setScoresLoading(false)
        })
    }
    return () => {
      live = false
    }
  }, [format])

  const updateSpec = (index: number, patch: Partial<Specification>) => {
    setSpecs((current) => current.map((spec, i) => (i === index ? { ...spec, ...patch } : spec)))
    if (error) setError(null)
  }

  /**
   * Push the per-profile scores. An empty or zero score removes the assignment
   * rather than storing a no-op row.
   */
  const saveScores = async (formatId: string) => {
    const failed: string[] = []
    await Promise.all(
      qualityProfiles.map(async (profile) => {
        const raw = scores[String(profile.id)]
        const score = raw === undefined || raw === '' ? 0 : Number(raw)
        try {
          if (!score) {
            await fetch(`/api/v1/customformats/${formatId}/profile/${profile.id}`, {
              method: 'DELETE',
            })
            return
          }
          await send(`/api/v1/customformats/${formatId}/profile`, 'POST', {
            qualityProfileId: String(profile.id),
            score,
          })
        } catch {
          failed.push(profile.name)
        }
      })
    )
    return failed
  }

  const submit = async () => {
    if (saving) return
    const cleaned = specs
      .filter((spec) => spec.value.trim())
      .map((spec) => ({ ...spec, name: spec.name.trim() || spec.value.trim() }))
    if (!name.trim()) {
      setError('Give the format a name.')
      return
    }
    if (cleaned.length === 0) {
      setError('A format needs at least one condition with a value.')
      return
    }
    const badScore = qualityProfiles.find((profile) => {
      const raw = scores[String(profile.id)]
      return raw !== undefined && raw !== '' && !Number.isFinite(Number(raw))
    })
    if (badScore) {
      setError(`The score for ${badScore.name} is not a number.`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const body = { name: name.trim(), includeWhenRenaming, specifications: cleaned }
      const saved = shown
        ? await send<CustomFormat>(`/api/v1/customformats/${shown.id}`, 'PUT', body)
        : await send<CustomFormat>('/api/v1/customformats', 'POST', body)
      if (!saved) throw new Error('The server did not return the saved format.')
      const failed = await saveScores(saved.id)
      onSaved(saved, !shown)
      if (failed.length > 0) {
        // The format itself is stored; say which scores did not land.
        setShown(saved)
        setError(`Saved, but the score for ${failed.join(', ')} was not. Save again to retry.`)
        return
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The format was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const askDelete = () => {
    if (!shown) return
    confirmDialog.confirm({
      title: `Delete ${shown.name}?`,
      description: 'Its scores come off every quality profile. Files already grabbed stay.',
      confirmLabel: 'Delete format',
      loadingLabel: 'Deleting…',
      onConfirm: async () => {
        try {
          await onDelete(shown)
          onOpenChange(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'The format was not deleted.')
        }
      },
    })
  }

  return (
    <Sheet open={format !== null} onOpenChange={(open) => !saving && onOpenChange(open)}>
      <SheetContent className={EDITOR_SHEET_CLASS}>
        <SheetHeader className="pr-14 pb-4">
          <SheetTitle className="truncate">{shown ? shown.name : 'Add custom format'}</SheetTitle>
          <SheetDescription>
            A release matches when every required condition passes and at least one of the others
            does.
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
                placeholder="e.g. Atmos audio"
                value={name}
                autoComplete="off"
                onChange={(event) => {
                  setName(event.target.value)
                  if (error) setError(null)
                }}
              />
            </div>

            <SheetSection title="Conditions">
              <ul className="space-y-3">
                {specs.map((spec, index) => (
                  <li key={index} className="space-y-3 rounded-lg border border-border p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`${ids}-impl-${index}`}
                          className="block text-sm font-medium"
                        >
                          Condition
                        </label>
                        <Select
                          value={spec.implementation}
                          onValueChange={(next) =>
                            updateSpec(index, { implementation: next as Implementation })
                          }
                        >
                          <SelectTrigger id={`${ids}-impl-${index}`} className="w-full">
                            <SelectValue>
                              {(value: string) =>
                                IMPLEMENTATION_LABELS[value as Implementation] ?? 'Condition'
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectPopup>
                            {(Object.keys(IMPLEMENTATION_LABELS) as Implementation[]).map((key) => (
                              <SelectItem key={key} value={key}>
                                {IMPLEMENTATION_LABELS[key]}
                              </SelectItem>
                            ))}
                          </SelectPopup>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`${ids}-value-${index}`}
                          className="block text-sm font-medium"
                        >
                          Value
                        </label>
                        <Input
                          id={`${ids}-value-${index}`}
                          className="readout"
                          placeholder={VALUE_HINTS[spec.implementation]}
                          value={spec.value}
                          spellCheck={false}
                          onChange={(event) => updateSpec(index, { value: event.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={spec.required}
                          onCheckedChange={(checked) =>
                            updateSpec(index, { required: checked === true })
                          }
                        />
                        Required
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={spec.negate}
                          onCheckedChange={(checked) =>
                            updateSpec(index, { negate: checked === true })
                          }
                        />
                        Invert
                      </label>
                      {specs.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-destructive hover:text-destructive"
                          onClick={() =>
                            setSpecs((current) => current.filter((_, i) => i !== index))
                          }
                          aria-label={`Remove condition ${index + 1}`}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSpecs((current) => [...current, { ...EMPTY_SPEC }])}
              >
                <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
                Add condition
              </Button>
            </SheetSection>

            {qualityProfiles.length > 0 && (
              <SheetSection
                title="Scores"
                description="Points a matching release earns, per profile. Negative pushes it down; 0 ignores it."
              >
                {scoresLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" /> Loading scores…
                  </div>
                ) : (
                  <div className="space-y-2">
                    {qualityProfiles.map((profile) => (
                      <div key={profile.id} className="flex items-center justify-between gap-3">
                        <label htmlFor={`${ids}-score-${profile.id}`} className="min-w-0 text-sm">
                          {profile.name}
                        </label>
                        <Input
                          id={`${ids}-score-${profile.id}`}
                          type="number"
                          inputMode="numeric"
                          className="readout w-24 shrink-0"
                          value={scores[String(profile.id)] ?? '0'}
                          onChange={(event) =>
                            setScores((current) => ({
                              ...current,
                              [String(profile.id)]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </SheetSection>
            )}

            <SheetSection title="Renaming">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={includeWhenRenaming}
                  onCheckedChange={(checked) => setIncludeWhenRenaming(checked === true)}
                />
                Include this format's name when renaming files
              </label>
            </SheetSection>
          </div>
        </SheetBody>

        <SheetFooter className="flex-row flex-wrap items-center gap-2">
          {error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {error}
            </p>
          )}
          {shown && (
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
            <Button
              type="button"
              size="sm"
              onClick={() => void submit()}
              disabled={saving || scoresLoading}
            >
              {saving && <Spinner />}
              {shown ? 'Save' : 'Add format'}
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
