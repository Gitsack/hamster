import { useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Copy01Icon,
  Delete01Icon,
  Edit02Icon,
  PlayListAddIcon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { EntityRow } from '@/components/settings/entity-row'
import { ToggleRow } from '@/components/settings/setting-row'
import { EditorSheet, SheetField, SheetSwitch } from '@/components/settings/editor-sheet'
import { SheetSection } from '@/components/settings/field-group'
import { getJson, send } from '@/components/system/system_api'

export type VersionQuality = 'high' | 'balanced' | 'small'
export type VersionAudio = 'stereo' | 'surround'

export interface VersionProfile {
  id: string
  name: string
  label: string
  maxHeight: number
  quality: VersionQuality
  audio: VersionAudio
  subtitles: boolean
  auto: boolean
  counts?: Partial<Record<'queued' | 'encoding' | 'ready' | 'failed', number>>
}

interface VersionProfilesResponse {
  profiles: VersionProfile[]
  options: { hardwareEncoding: boolean }
  encoder: { hardwareAvailable: boolean; active: 'gpu' | 'cpu' }
}

export const MAX_HEIGHTS = [
  { value: 2160, label: '4K (2160p)' },
  { value: 1080, label: '1080p' },
  { value: 720, label: '720p' },
  { value: 480, label: '480p' },
]

/** Sizes for a two-hour 1080p Blu-ray; clean digital films come out smaller. */
export const QUALITIES: { value: VersionQuality; label: string; help: string }[] = [
  { value: 'high', label: 'High', help: 'Hard to tell apart even on a TV. About 3–4 GB.' },
  {
    value: 'balanced',
    label: 'Balanced',
    help: 'Looks the same on a phone or tablet. About 2–2.5 GB.',
  },
  { value: 'small', label: 'Small', help: 'Softer in dark and busy scenes. About 1.5–2 GB.' },
]

export const AUDIO_MODES: { value: VersionAudio; label: string; help: string }[] = [
  { value: 'stereo', label: 'Stereo', help: 'AAC 2.0. Right for headphones and phone speakers.' },
  {
    value: 'surround',
    label: 'Keep surround',
    help: 'E-AC-3 5.1 where the source has more than two channels. AirPods spatialise it.',
  },
]

export function describeVersionProfile(profile: VersionProfile): string {
  const height =
    MAX_HEIGHTS.find((h) => h.value === profile.maxHeight)?.label ?? `${profile.maxHeight}p`
  const quality = QUALITIES.find((q) => q.value === profile.quality)?.label ?? profile.quality
  const audio = AUDIO_MODES.find((a) => a.value === profile.audio)?.label ?? profile.audio
  return `${height} · ${quality} · ${audio}${profile.subtitles ? '' : ' · No subtitles'}`
}

function describeCounts(counts: VersionProfile['counts']): string | null {
  if (!counts) return null
  const parts = [
    counts.ready ? `${counts.ready} ready` : null,
    counts.encoding ? `${counts.encoding} encoding` : null,
    counts.queued ? `${counts.queued} queued` : null,
    counts.failed ? `${counts.failed} failed` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster did not answer.'
}

export function useVersionProfiles() {
  const [data, setData] = useState<VersionProfilesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const next = await getJson<VersionProfilesResponse>('/api/v1/versionprofiles')
      if (mounted.current) setData(next)
    } catch (err) {
      if (mounted.current) setError(`Version profiles could not be loaded: ${message(err)}`)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load, setData }
}

type SheetMode = { kind: 'add' } | { kind: 'edit'; profile: VersionProfile }

/**
 * Settings → Media → Versions: smaller copies kept beside a movie's main file,
 * so a player like Infuse can download a phone-sized version from Jellyfin.
 */
export function VersionsSection() {
  const { data, loading, error, reload, setData } = useVersionProfiles()
  const [sheet, setSheet] = useState<SheetMode | null>(null)

  const profiles = data?.profiles ?? []
  const encoder = data?.encoder

  const patchProfile = (saved: VersionProfile) =>
    setData((current) =>
      current
        ? {
            ...current,
            profiles: current.profiles.some((p) => p.id === saved.id)
              ? current.profiles.map((p) => (p.id === saved.id ? { ...p, ...saved } : p))
              : [...current.profiles, saved],
          }
        : current
    )

  const setAuto = async (profile: VersionProfile, auto: boolean) => {
    const saved = await send<VersionProfile>(`/api/v1/versionprofiles/${profile.id}`, 'PUT', {
      ...profile,
      auto,
    })
    if (saved) patchProfile(saved)
  }

  const backfill = async (profile: VersionProfile) => {
    try {
      const result = await send<{ queued: number }>(
        `/api/v1/versionprofiles/${profile.id}/backfill`,
        'POST'
      )
      const queued = result?.queued ?? 0
      toast.success(
        queued > 0
          ? `${queued} ${queued === 1 ? 'movie' : 'movies'} queued for ${profile.name}`
          : `Every movie already has a ${profile.name} version`
      )
      void reload()
    } catch (err) {
      toast.error(`Could not queue ${profile.name}`, { description: message(err) })
    }
  }

  const remove = async (profile: VersionProfile) => {
    await send(`/api/v1/versionprofiles/${profile.id}`, 'DELETE')
    setData((current) =>
      current
        ? { ...current, profiles: current.profiles.filter((p) => p.id !== profile.id) }
        : current
    )
    toast.success(`${profile.name} deleted`)
  }

  const encoderDescription = !encoder
    ? undefined
    : encoder.hardwareAvailable
      ? 'The GPU encodes about three times faster than the CPU, at the same size and quality.'
      : 'No usable GPU was found, so versions are encoded on the CPU. Pass /dev/dri to the container to use one.'

  return (
    <Section
      id="versions"
      title="Versions"
      description="Smaller copies kept beside a movie, for downloading to a phone or tablet. Jellyfin lists them as versions."
      actions={
        <Button type="button" variant="outline" size="sm" onClick={() => setSheet({ kind: 'add' })}>
          <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
          Add profile
        </Button>
      }
    >
      <RowGroup
        loading={loading}
        skeletonRows={2}
        error={error}
        onRetry={() => void reload()}
        empty={
          <>
            No version profile yet.{' '}
            <button
              type="button"
              onClick={() => setSheet({ kind: 'add' })}
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              Add one
            </button>{' '}
            to make smaller copies of your movies.
          </>
        }
      >
        {profiles.map((profile) => (
          <EntityRow
            key={profile.id}
            icon={Copy01Icon}
            name={profile.name}
            meta={[
              describeVersionProfile(profile),
              profile.auto ? 'Runs on every import' : 'Manual only',
              describeCounts(profile.counts),
            ].filter((part): part is string => Boolean(part))}
            enabled={profile.auto}
            enabledLabel={`Create ${profile.name} automatically on import`}
            onEnabledChange={(auto) => setAuto(profile, auto)}
            onOpen={() => setSheet({ kind: 'edit', profile })}
            actions={[
              {
                label: 'Edit',
                icon: Edit02Icon,
                onSelect: () => setSheet({ kind: 'edit', profile }),
              },
              {
                label: 'Create for all movies',
                icon: PlayListAddIcon,
                onSelect: () => backfill(profile),
                confirm: {
                  title: `Create ${profile.name} for every movie?`,
                  description:
                    'Every movie without one is queued. Encodes run one at a time in the background, which takes a while for a large library.',
                  confirmLabel: 'Queue all',
                },
              },
              {
                label: 'Delete',
                icon: Delete01Icon,
                destructive: true,
                onSelect: async () => {
                  try {
                    await remove(profile)
                  } catch (err) {
                    toast.error(`${profile.name} was not deleted`, { description: message(err) })
                  }
                },
                confirm: {
                  title: `Delete ${profile.name}?`,
                  description:
                    'Queued copies are cancelled. Finished copies stay on disk and on each movie’s page.',
                  confirmLabel: 'Delete profile',
                },
              },
            ]}
          />
        ))}
      </RowGroup>

      {data && (
        <RowGroup>
          <ToggleRow
            label="Encode on the GPU"
            description={encoderDescription}
            checked={data.options.hardwareEncoding && encoder?.hardwareAvailable === true}
            disabled={!encoder?.hardwareAvailable}
            onSave={async (hardwareEncoding) => {
              await send('/api/v1/versionprofiles/options', 'PUT', { hardwareEncoding })
              setData((current) =>
                current ? { ...current, options: { hardwareEncoding } } : current
              )
            }}
          />
        </RowGroup>
      )}

      <VersionProfileSheet
        mode={sheet}
        onOpenChange={(open) => {
          if (!open) setSheet(null)
        }}
        onSaved={(saved, created) => {
          patchProfile(saved)
          toast.success(`${saved.name} ${created ? 'added' : 'saved'}`)
        }}
        onDelete={remove}
      />
    </Section>
  )
}

interface ProfileDraft {
  name: string
  label: string
  maxHeight: number
  quality: VersionQuality
  audio: VersionAudio
  subtitles: boolean
  auto: boolean
}

const NEW_PROFILE: ProfileDraft = {
  name: 'Mobile',
  label: '',
  maxHeight: 1080,
  quality: 'balanced',
  audio: 'stereo',
  subtitles: true,
  auto: false,
}

function VersionProfileSheet({
  mode,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  mode: SheetMode | null
  onOpenChange: (open: boolean) => void
  onSaved: (profile: VersionProfile, created: boolean) => void
  onDelete: (profile: VersionProfile) => Promise<void>
}) {
  const editing = mode?.kind === 'edit' ? mode.profile : null
  const [draft, setDraft] = useState<ProfileDraft>(NEW_PROFILE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mode) return
    setError(null)
    setDraft(mode.kind === 'edit' ? { ...mode.profile } : NEW_PROFILE)
  }, [mode])

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const label = (editing ? editing.label : draft.label.trim() || draft.name.trim()) || 'Mobile'

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = { ...draft, label: editing ? editing.label : draft.label.trim() || undefined }
      const saved = editing
        ? await send<VersionProfile>(`/api/v1/versionprofiles/${editing.id}`, 'PUT', body)
        : await send<VersionProfile>('/api/v1/versionprofiles', 'POST', body)
      if (saved) onSaved(saved, !editing)
      onOpenChange(false)
    } catch (err) {
      setError(message(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <EditorSheet
      open={mode !== null}
      onOpenChange={onOpenChange}
      title={editing ? editing.name : 'Add version profile'}
      description="Changes apply to copies made from now on; finished ones stay as they are."
      error={error}
      onSave={save}
      saveLabel={editing ? 'Save' : 'Add'}
      saving={saving}
      saveDisabled={!draft.name.trim()}
      onDelete={
        editing
          ? async () => {
              await onDelete(editing)
              onOpenChange(false)
            }
          : undefined
      }
      deleteConfirm={{
        title: `Delete ${editing?.name ?? 'profile'}?`,
        description: 'Queued copies are cancelled. Finished copies stay on disk.',
      }}
    >
      <SheetSection title="Profile">
        <SheetField label="Name">
          {(props) => (
            <Input
              {...props}
              value={draft.name}
              onChange={(event) => set('name', event.target.value)}
              autoComplete="off"
            />
          )}
        </SheetField>
        <SheetField
          label="File label"
          optional={!editing}
          help={
            <>
              Files are named <span className="font-mono">Movie (2020) - {label}.mkv</span>
              {editing
                ? '. Fixed once created, so existing copies keep matching.'
                : '. Defaults to the name.'}
            </>
          }
        >
          {(props) => (
            <Input
              {...props}
              value={editing ? editing.label : draft.label}
              placeholder={draft.name}
              disabled={Boolean(editing)}
              onChange={(event) => set('label', event.target.value)}
              autoComplete="off"
            />
          )}
        </SheetField>
        <SheetSwitch
          label="Create on every import"
          description="Off: only when you ask for it on a movie, or for all movies at once."
          checked={draft.auto}
          onCheckedChange={(auto) => set('auto', auto)}
        />
      </SheetSection>

      <SheetSection title="Picture">
        <SheetField label="Maximum resolution" help="Smaller sources are never upscaled.">
          {(props) => (
            <Select
              value={String(draft.maxHeight)}
              onValueChange={(v) => set('maxHeight', Number(v))}
            >
              <SelectTrigger id={props.id} className="w-full">
                <SelectValue>
                  {(value: string) =>
                    MAX_HEIGHTS.find((h) => String(h.value) === value)?.label ?? value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {MAX_HEIGHTS.map((height) => (
                  <SelectItem key={height.value} value={String(height.value)}>
                    {height.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          )}
        </SheetField>
        <SheetField label="Quality" help={QUALITIES.find((q) => q.value === draft.quality)?.help}>
          {(props) => (
            <Select
              value={draft.quality}
              onValueChange={(v) => set('quality', v as VersionQuality)}
            >
              <SelectTrigger id={props.id} className="w-full">
                <SelectValue>
                  {(value: string) => QUALITIES.find((q) => q.value === value)?.label ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {QUALITIES.map((quality) => (
                  <SelectItem key={quality.value} value={quality.value}>
                    {quality.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          )}
        </SheetField>
      </SheetSection>

      <SheetSection title="Sound and subtitles">
        <SheetField label="Audio" help={AUDIO_MODES.find((a) => a.value === draft.audio)?.help}>
          {(props) => (
            <Select value={draft.audio} onValueChange={(v) => set('audio', v as VersionAudio)}>
              <SelectTrigger id={props.id} className="w-full">
                <SelectValue>
                  {(value: string) => AUDIO_MODES.find((a) => a.value === value)?.label ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {AUDIO_MODES.map((audio) => (
                  <SelectItem key={audio.value} value={audio.value}>
                    {audio.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          )}
        </SheetField>
        <SheetSwitch
          label="Include subtitles"
          description="Embedded in the copy, so a downloaded file has them offline. Follows the subtitle languages set under Import."
          checked={draft.subtitles}
          onCheckedChange={(subtitles) => set('subtitles', subtitles)}
        />
      </SheetSection>
    </EditorSheet>
  )
}
