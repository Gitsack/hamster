import { useEffect, useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { LANGUAGES, languageName } from '@/lib/languages'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface SubtitlePruningOptions {
  enabled: boolean
  maxTracks: number
  keepLanguages: string[]
}

/**
 * How many subtitle tracks an import is allowed to keep.
 *
 * A release with thirty-odd subtitle tracks costs nothing while it sits on
 * disk, so the obvious reading of this control is "housekeeping, ignore".
 * It is not: a server that transcodes has to offer every track separately, and
 * some clients stop partway down the list and abandon the playback with no
 * error anyone can see. So the copy here leads with the symptom, not the
 * tidiness — somebody arriving with "why does lower quality fail on this one
 * show" should recognise their problem on sight.
 */
export function SubtitlePruningCard() {
  const [options, setOptions] = useState<SubtitlePruningOptions | null>(null)
  const [ffmpegAvailable, setFfmpegAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      const response = await fetch('/api/v1/settings/subtitle-pruning')
      if (response.ok) {
        const data = await response.json()
        setOptions(data.options)
        setFfmpegAvailable(data.ffmpegAvailable)
      }
    } catch {
      toast.error('Subtitle settings could not be loaded — Hamster is unreachable.')
    } finally {
      setLoading(false)
    }
  }

  const save = async (next: SubtitlePruningOptions) => {
    setOptions(next)
    setSaving(true)
    try {
      const response = await fetch('/api/v1/settings/subtitle-pruning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        toast.error(body.error ?? 'Subtitle settings could not be saved.')
        await load()
        return
      }
      toast.success('Subtitle settings saved.')
    } catch {
      toast.error('Subtitle settings could not be saved — Hamster is unreachable.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const candidates = useMemo(() => {
    if (!options) return []
    const needle = query.trim().toLowerCase()
    if (needle === '') return []
    return LANGUAGES.filter(
      (language) =>
        !options.keepLanguages.includes(language.code) &&
        (language.name.toLowerCase().includes(needle) || language.code === needle)
    ).slice(0, 6)
  }, [query, options])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Spinner />
        </CardContent>
      </Card>
    )
  }

  if (!options) return null

  const addLanguage = (code: string) => {
    save({ ...options, keepLanguages: [...options.keepLanguages, code] })
    setQuery('')
  }

  const removeLanguage = (code: string) => {
    save({ ...options, keepLanguages: options.keepLanguages.filter((c) => c !== code) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subtitle tracks</CardTitle>
        <CardDescription>
          Some releases ship thirty or more subtitle tracks. They are harmless on disk, but a media
          server that transcodes has to hand every one of them to the player separately, and some
          clients give up partway through and refuse to start the stream at all. Trimming them at
          import keeps that off your library.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {!ffmpegAvailable && (
          <p className="border-status-failed-ink/30 bg-status-failed-ink/10 text-status-failed-ink rounded-md border px-3 py-2 text-xs">
            ffmpeg is not available in this container, so imports cannot be rewritten. These
            settings are saved but will not take effect.
          </p>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="subtitle-pruning-enabled">Trim surplus subtitle tracks</Label>
            <p className="text-muted-foreground text-xs">
              Off by default. Files are rewritten by copying the streams, never re-encoding, so
              video and audio come out untouched.
            </p>
          </div>
          <Switch
            id="subtitle-pruning-enabled"
            checked={options.enabled}
            disabled={saving}
            onCheckedChange={(enabled) => save({ ...options, enabled })}
          />
        </div>

        <div
          className={cn('space-y-6', !options.enabled && 'pointer-events-none opacity-50')}
          aria-hidden={!options.enabled}
        >
          <div className="space-y-1">
            <Label htmlFor="subtitle-pruning-max">Leave files alone up to</Label>
            <div className="flex items-center gap-2">
              <Input
                id="subtitle-pruning-max"
                type="number"
                min={1}
                max={100}
                className="w-24"
                value={options.maxTracks}
                disabled={saving || !options.enabled}
                onChange={(event) =>
                  setOptions({ ...options, maxTracks: Number(event.target.value) })
                }
                onBlur={() => {
                  const value = Math.min(100, Math.max(1, Math.round(options.maxTracks || 1)))
                  save({ ...options, maxTracks: value })
                }}
              />
              <span className="text-muted-foreground text-sm">tracks</span>
            </div>
            <p className="text-muted-foreground text-xs">
              A file at or below this count is never rewritten. 20 is a sensible default: it is
              where Infuse stops fetching.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Languages to keep</Label>
            {options.keepLanguages.length > 0 ? (
              <ul className="divide-border border-border divide-y rounded-md border">
                {options.keepLanguages.map((code) => (
                  <li key={code} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{languageName(code)}</span>
                    <span className="readout text-muted-foreground hidden text-xs sm:inline">
                      {code}
                    </span>
                    <button
                      type="button"
                      aria-label={`Stop keeping ${languageName(code)}`}
                      disabled={saving || !options.enabled}
                      onClick={() => removeLanguage(code)}
                      className="text-muted-foreground hover:text-foreground rounded-sm p-1"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">
                No languages named, so the first {options.maxTracks} tracks in file order are kept.
              </p>
            )}

            <Input
              placeholder="Add a language…"
              value={query}
              disabled={saving || !options.enabled}
              onChange={(event) => setQuery(event.target.value)}
            />

            {candidates.length > 0 && (
              <ul className="divide-border border-border divide-y rounded-md border">
                {candidates.map((language) => (
                  <li key={language.code}>
                    <button
                      type="button"
                      onClick={() => addLanguage(language.code)}
                      className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    >
                      <HugeiconsIcon icon={Add01Icon} className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{language.name}</span>
                      <span className="readout text-muted-foreground text-xs">{language.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-muted-foreground text-xs">
              Tracks with no language tag are always kept — an untagged track is usually forced
              signs, and there is no way to tell it apart from one worth losing. If none of your
              languages match, the first {options.maxTracks} tracks are kept rather than stripping
              every subtitle.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
