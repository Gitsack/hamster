import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Delete01Icon, Edit02Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

type Implementation =
  | 'contains'
  | 'notContains'
  | 'resolution'
  | 'source'
  | 'codec'
  | 'releaseGroup'

interface Specification {
  name: string
  implementation: Implementation
  negate: boolean
  required: boolean
  value: string
}

interface CustomFormat {
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

interface QualityProfileOption {
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
}

const VALUE_HINTS: Record<Implementation, string> = {
  contains: 'Text or regular expression, e.g. \\bAtmos\\b',
  notContains: 'Text or regular expression',
  resolution: '2160p, 1080p, 720p or 480p',
  source: 'bluray, web, hdtv, dvd, cam or remux',
  codec: 'x264, x265, av1, vp9, xvid or divx',
  releaseGroup: 'Group name, e.g. FraMeSToR',
}

const EMPTY_SPEC: Specification = {
  name: '',
  implementation: 'contains',
  negate: false,
  required: false,
  value: '',
}

/**
 * Custom formats: the rules that say "this specific thing in a release name is
 * worth points to me".
 *
 * These already existed in the database and in the matcher, with no way to
 * create one and no effect on which release got grabbed. Both halves are wired
 * up now — a format's score counts towards the profile's minimum and towards
 * ranking, so it can promote a trusted group or bury a bad one.
 */
export function CustomFormatsCard({
  qualityProfiles,
}: {
  qualityProfiles: QualityProfileOption[]
}) {
  const [formats, setFormats] = useState<CustomFormat[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomFormat | null>(null)
  const [name, setName] = useState('')
  const [includeWhenRenaming, setIncludeWhenRenaming] = useState(false)
  const [specs, setSpecs] = useState<Specification[]>([{ ...EMPTY_SPEC }])
  const [scores, setScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchFormats()
  }, [])

  const fetchFormats = async () => {
    try {
      const response = await fetch('/api/v1/customformats')
      if (response.ok) setFormats(await response.json())
    } catch {
      toast.error('Custom formats could not be loaded — Hamster is unreachable.')
    } finally {
      setLoading(false)
    }
  }

  const openDialog = async (format?: CustomFormat) => {
    if (format) {
      setEditing(format)
      setName(format.name)
      setIncludeWhenRenaming(format.includeWhenRenaming)
      setSpecs(format.specifications.length ? format.specifications : [{ ...EMPTY_SPEC }])

      // Existing per-profile scores live on the join table, so they come from
      // the detail endpoint rather than the list.
      try {
        const response = await fetch(`/api/v1/customformats/${format.id}`)
        if (response.ok) {
          const detail = await response.json()
          const assignments: ProfileAssignment[] = detail.qualityProfiles ?? []
          setScores(Object.fromEntries(assignments.map((a) => [String(a.id), String(a.score)])))
        }
      } catch {
        setScores({})
      }
    } else {
      setEditing(null)
      setName('')
      setIncludeWhenRenaming(false)
      setSpecs([{ ...EMPTY_SPEC }])
      setScores({})
    }
    setDialogOpen(true)
  }

  const updateSpec = (index: number, patch: Partial<Specification>) => {
    setSpecs((prev) => prev.map((spec, i) => (i === index ? { ...spec, ...patch } : spec)))
  }

  const save = async () => {
    const cleaned = specs
      .filter((spec) => spec.value.trim())
      .map((spec) => ({ ...spec, name: spec.name.trim() || spec.value.trim() }))

    if (!name.trim()) {
      toast.error('Give the format a name.')
      return
    }
    if (cleaned.length === 0) {
      toast.error('A format needs at least one condition with a value.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(
        editing ? `/api/v1/customformats/${editing.id}` : '/api/v1/customformats',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            includeWhenRenaming,
            specifications: cleaned,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        toast.error(error?.error?.message || error?.error || 'Custom format not saved')
        return
      }

      const saved: CustomFormat = await response.json()
      await saveScores(saved.id)

      setFormats((prev) =>
        editing ? prev.map((f) => (f.id === saved.id ? saved : f)) : [...prev, saved]
      )
      toast.success(`Custom format ${editing ? 'updated' : 'created'}`)
      setDialogOpen(false)
    } catch {
      toast.error('Custom format not saved — Hamster is unreachable.')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Push the per-profile scores. An empty or zero score removes the assignment
   * rather than storing a no-op row.
   */
  const saveScores = async (formatId: string) => {
    await Promise.all(
      qualityProfiles.map(async (profile) => {
        const raw = scores[String(profile.id)]
        const score = raw === undefined || raw === '' ? 0 : Number(raw)

        if (!score) {
          await fetch(`/api/v1/customformats/${formatId}/profile/${profile.id}`, {
            method: 'DELETE',
          }).catch(() => {})
          return
        }

        await fetch(`/api/v1/customformats/${formatId}/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qualityProfileId: String(profile.id), score }),
        }).catch(() => {})
      })
    )
  }

  const remove = async (format: CustomFormat) => {
    setDeletingId(format.id)
    try {
      const response = await fetch(`/api/v1/customformats/${format.id}`, { method: 'DELETE' })
      if (response.ok) {
        setFormats((prev) => prev.filter((f) => f.id !== format.id))
        toast.success('Custom format deleted')
      } else {
        toast.error('Custom format not deleted — the server refused.')
      }
    } catch {
      toast.error('Custom format not deleted — Hamster is unreachable.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Custom formats</CardTitle>
          <CardDescription>
            Score releases on anything the quality list cannot express — a trusted release group, a
            language tag, an audio format. Scores are set per quality profile and count towards both
            ranking and the profile's minimum score.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => openDialog()}>
          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-6 w-6" />
          </div>
        ) : formats.length === 0 ? (
          <EmptyState
            title="No custom formats"
            message="Add one to promote releases you trust, or to push down the ones you never want."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {formats.map((format) => (
              <li key={format.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{format.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {format.specifications.map((spec, index) => (
                      <Badge
                        key={`${spec.name}-${index}`}
                        variant="outline"
                        className="readout text-[0.6875rem] text-muted-foreground"
                      >
                        {spec.negate ? 'not ' : ''}
                        {IMPLEMENTATION_LABELS[spec.implementation]} {spec.value}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openDialog(format)}
                  aria-label={`Edit ${format.name}`}
                >
                  <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => remove(format)}
                  disabled={deletingId === format.id}
                  aria-label={`Delete ${format.name}`}
                >
                  {deletingId === format.id ? (
                    <Spinner className="size-4" />
                  ) : (
                    <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Add'} custom format</DialogTitle>
            <DialogDescription>
              A release matches when every required condition passes and at least one optional
              condition passes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="cf-name">Name</Label>
              <Input
                id="cf-name"
                placeholder="e.g. Atmos audio"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <fieldset className="space-y-3 border-t border-border pt-6">
              <legend className="sr-only">Conditions</legend>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Conditions</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSpecs((prev) => [...prev, { ...EMPTY_SPEC }])}
                >
                  <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
                  Add condition
                </Button>
              </div>

              {specs.map((spec, index) => (
                <div key={index} className="space-y-3 rounded-md border border-border p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`cf-impl-${index}`}>Condition</Label>
                      <Select
                        value={spec.implementation}
                        onValueChange={(next) =>
                          updateSpec(index, { implementation: next as Implementation })
                        }
                      >
                        <SelectTrigger id={`cf-impl-${index}`} className="w-full">
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

                    <div className="space-y-2">
                      <Label htmlFor={`cf-value-${index}`}>Value</Label>
                      <Input
                        id={`cf-value-${index}`}
                        className="readout"
                        placeholder={VALUE_HINTS[spec.implementation]}
                        value={spec.value}
                        onChange={(e) => updateSpec(index, { value: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`cf-required-${index}`}
                        checked={spec.required}
                        onCheckedChange={(checked) =>
                          updateSpec(index, { required: checked === true })
                        }
                      />
                      <Label
                        htmlFor={`cf-required-${index}`}
                        className="cursor-pointer font-normal"
                      >
                        Required
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`cf-negate-${index}`}
                        checked={spec.negate}
                        onCheckedChange={(checked) =>
                          updateSpec(index, { negate: checked === true })
                        }
                      />
                      <Label htmlFor={`cf-negate-${index}`} className="cursor-pointer font-normal">
                        Invert
                      </Label>
                    </div>
                    {specs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-destructive hover:text-destructive"
                        onClick={() => setSpecs((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </fieldset>

            {qualityProfiles.length > 0 && (
              <fieldset className="space-y-3 border-t border-border pt-6">
                <legend className="sr-only">Scores</legend>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Scores</h3>
                  <p className="text-xs text-muted-foreground">
                    Points added to a matching release, per profile. Negative pushes it down; leave
                    at 0 to ignore this format for that profile.
                  </p>
                </div>
                <div className="space-y-2">
                  {qualityProfiles.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between gap-3">
                      <Label htmlFor={`cf-score-${profile.id}`} className="font-normal">
                        {profile.name}
                      </Label>
                      <Input
                        id={`cf-score-${profile.id}`}
                        type="number"
                        className="readout w-24"
                        value={scores[String(profile.id)] ?? '0'}
                        onChange={(e) =>
                          setScores((prev) => ({ ...prev, [String(profile.id)]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="flex items-center gap-2 border-t border-border pt-6">
              <Checkbox
                id="cf-renaming"
                checked={includeWhenRenaming}
                onCheckedChange={(checked) => setIncludeWhenRenaming(checked === true)}
              />
              <Label htmlFor="cf-renaming" className="cursor-pointer font-normal">
                Include this format's name when renaming files
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
