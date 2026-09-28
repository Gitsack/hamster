import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Alert02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Input } from '@/components/ui/input'
import { LANGUAGES, languageName } from '@/lib/languages'
import { getJson, send } from '@/components/system/system_api'
import { cn } from '@/lib/utils'
import { Section } from './section'
import { RowGroup } from './row-group'
import { FieldRow, SettingRow, ToggleRow, saveErrorMessage } from './setting-row'

export interface SubtitlePruningOptions {
  enabled: boolean
  maxTracks: number
  keepLanguages: string[]
}

export const MIN_TRACKS = 1
export const MAX_TRACKS = 100

/** The track limit as typed, or null when it is not a whole number from 1 to 100. */
export function parseMaxTracks(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return parsed >= MIN_TRACKS && parsed <= MAX_TRACKS ? parsed : null
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster did not answer.'
}

/**
 * The subtitle pruning policy: GET/PUT /api/v1/settings/subtitle-pruning.
 * `update` merges into the newest options — including a write still in
 * flight — so a quick switch then a language never undo each other.
 */
export function useSubtitlePruning() {
  const [options, setOptions] = useState<SubtitlePruningOptions | null>(null)
  const [ffmpegAvailable, setFfmpegAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<SubtitlePruningOptions | null>(null)
  const inFlight = useRef(0)
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
      const data = await getJson<{ options: SubtitlePruningOptions; ffmpegAvailable: boolean }>(
        '/api/v1/settings/subtitle-pruning'
      )
      if (!mounted.current) return
      setOptions(data.options)
      setFfmpegAvailable(data.ffmpegAvailable !== false)
    } catch (err) {
      if (mounted.current) setError(`Subtitle settings could not be loaded: ${message(err)}`)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const optionsRef = useRef(options)
  optionsRef.current = options

  /** Persist a change. Rejects with the server's words; what is stored stays showing. */
  const update = useCallback(async (patch: Partial<SubtitlePruningOptions>) => {
    const base = pending.current ?? optionsRef.current
    if (!base) throw new Error('Subtitle settings have not loaded yet.')
    const next = { ...base, ...patch }
    pending.current = next
    inFlight.current++
    try {
      const result = await send<{ options: SubtitlePruningOptions }>(
        '/api/v1/settings/subtitle-pruning',
        'PUT',
        next
      )
      if (mounted.current) setOptions(result?.options ?? next)
    } catch (err) {
      pending.current = null
      throw err
    } finally {
      inFlight.current--
      if (inFlight.current === 0) pending.current = null
    }
  }, [])

  return { options, ffmpegAvailable, loading, error, reload: load, update }
}

export type SubtitlePruningState = ReturnType<typeof useSubtitlePruning>

interface SubtitlePruningSectionProps {
  state: SubtitlePruningState
  /** The track limit as typed. Saved with the page's save bar, never on its own. */
  maxTracks: string
  onMaxTracksChange: (value: string) => void
  maxTracksError?: string | null
}

/**
 * Settings → Media → Import: how many subtitle tracks an import may keep.
 *
 * A release with thirty-odd subtitle tracks costs nothing on disk, so this
 * reads as housekeeping. It is not: a server that transcodes offers every
 * track separately, and some clients stop partway down the list and abandon
 * the stream with no error anyone sees. The description leads with that
 * symptom so somebody chasing it recognises it on sight.
 */
export function SubtitlePruningSection({
  state,
  maxTracks,
  onMaxTracksChange,
  maxTracksError,
}: SubtitlePruningSectionProps) {
  const { options, ffmpegAvailable, loading, error, reload, update } = state

  return (
    <Section
      id="import"
      title="Import"
      description="Trim surplus subtitle tracks at import; some players give up on files that carry dozens."
    >
      <RowGroup loading={loading} skeletonRows={3} error={error} onRetry={() => void reload()}>
        {options && !ffmpegAvailable && (
          <p
            role="note"
            className="flex min-h-14 items-center gap-2 px-4 py-3 text-sm text-status-queued-ink"
          >
            <HugeiconsIcon icon={Alert02Icon} aria-hidden="true" className="size-4 shrink-0" />
            ffmpeg isn't available here, so these settings are saved but can't take effect.
          </p>
        )}
        {options && (
          <ToggleRow
            label="Trim surplus subtitle tracks"
            description="Streams are copied, never re-encoded, so video and audio come out untouched."
            checked={options.enabled}
            onSave={(enabled) => update({ enabled })}
          />
        )}
        {options && (
          <FieldRow
            label="Leave files alone up to"
            description="Files at or below this many tracks are never rewritten. 20 is where Infuse stops."
            type="number"
            inputMode="numeric"
            min={MIN_TRACKS}
            max={MAX_TRACKS}
            mono
            suffix="tracks"
            value={maxTracks}
            onChange={onMaxTracksChange}
            error={maxTracksError}
            disabled={!options.enabled}
            inputClassName="md:w-20"
          />
        )}
        {options && (
          <KeepLanguagesRow
            options={options}
            onChange={(keepLanguages) => update({ keepLanguages })}
          />
        )}
      </RowGroup>
    </Section>
  )
}

function KeepLanguagesRow({
  options,
  onChange,
}: {
  options: SubtitlePruningOptions
  onChange: (keepLanguages: string[]) => Promise<void>
}) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const disabled = !options.enabled || busy

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return []
    return LANGUAGES.filter(
      (language) =>
        !options.keepLanguages.includes(language.code) &&
        (language.name.toLowerCase().includes(needle) || language.code === needle)
    ).slice(0, 6)
  }, [query, options.keepLanguages])

  const save = async (keepLanguages: string[]) => {
    setBusy(true)
    setError(null)
    try {
      await onChange(keepLanguages)
    } catch (err) {
      setError(saveErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingRow
      label="Languages to keep"
      htmlFor={inputId}
      description={
        options.keepLanguages.length === 0
          ? `None named, so the first ${options.maxTracks} tracks in file order are kept.`
          : 'Untagged tracks are always kept: they are usually forced signs.'
      }
      error={error}
    >
      <div className={cn('mt-3 space-y-2', !options.enabled && 'opacity-60')}>
        {options.keepLanguages.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Kept languages">
            {options.keepLanguages.map((code) => (
              <li
                key={code}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border pr-1 pl-2.5 text-sm"
              >
                {languageName(code)}
                <span className="readout text-xs text-muted-foreground">{code}</span>
                <button
                  type="button"
                  aria-label={`Stop keeping ${languageName(code)}`}
                  disabled={disabled}
                  onClick={() => void save(options.keepLanguages.filter((c) => c !== code))}
                  className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none"
                >
                  <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Input
          id={inputId}
          placeholder="Add a language…"
          autoComplete="off"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          className="md:max-w-xs"
        />

        {candidates.length > 0 && (
          <ul className="max-w-xs divide-y divide-border overflow-hidden rounded-lg border border-border bg-popover">
            {candidates.map((language) => (
              <li key={language.code}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setQuery('')
                    void save([...options.keepLanguages, language.code])
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                >
                  <HugeiconsIcon icon={Add01Icon} aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{language.name}</span>
                  <span className="readout text-xs text-muted-foreground">{language.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingRow>
  )
}
