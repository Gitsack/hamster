import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AudioLanguageRules } from '@/components/settings/audio-language-rules'

/**
 * Mirrors QualityRequirements on the server. Kept as a plain object so the
 * dialog can hand it back verbatim.
 */
export interface QualityRequirements {
  minAudioChannels: number | null
  minAudioTier: string | null
  blockedAudioCodecs: string[]
  preferredAudioCodecs: string[]
  requiredAudioLanguages: string[]
  requireAllAudioLanguages: boolean
  preferredAudioLanguages: string[]
  blockedAudioLanguages: string[]
  requireHdr: boolean
  blockedVideoCodecs: string[]
  blockUpscaled: boolean
  blockHardcodedSubs: boolean
  blockUnknownQuality: boolean
  minCustomFormatScore: number
  minVideoBitrateKbps: number | null
  minAudioBitrateKbps: number | null
}

export const DEFAULT_REQUIREMENTS: QualityRequirements = {
  minAudioChannels: null,
  minAudioTier: null,
  blockedAudioCodecs: [],
  preferredAudioCodecs: [],
  requiredAudioLanguages: [],
  requireAllAudioLanguages: false,
  preferredAudioLanguages: [],
  blockedAudioLanguages: [],
  requireHdr: false,
  blockedVideoCodecs: [],
  blockUpscaled: true,
  blockHardcodedSubs: false,
  blockUnknownQuality: true,
  minCustomFormatScore: 0,
  minVideoBitrateKbps: null,
  minAudioBitrateKbps: null,
}

const AUDIO_CODECS = [
  'Atmos',
  'DTS-X',
  'TrueHD',
  'DTS-HD MA',
  'DTS-HD',
  'DTS',
  'EAC3',
  'AC3',
  'FLAC',
  'PCM',
  'AAC',
  'Opus',
  'MP3',
]

const VIDEO_CODECS = ['x264', 'x265', 'AV1', 'VP9', 'XviD']

const CHANNEL_CHOICES = [
  { value: 'any', label: 'Any' },
  { value: '2', label: 'Stereo (2.0) or better' },
  { value: '6', label: 'Surround (5.1) or better' },
  { value: '8', label: '7.1 or better' },
]

const TIER_CHOICES = [
  { value: 'any', label: 'Any' },
  { value: 'lossy-hd', label: 'DTS / E-AC3 or better' },
  { value: 'lossless', label: 'Lossless (TrueHD, DTS-HD MA, FLAC)' },
  { value: 'lossless-object', label: 'Object-based (Atmos, DTS:X)' },
]

interface Props {
  value: QualityRequirements
  onChange: (next: QualityRequirements) => void
  /** Audio/video rules only make sense for video profiles. */
  showVideoRules: boolean
}

/**
 * The half of a quality profile that decides whether a release is any *good*,
 * as opposed to merely the right resolution.
 *
 * Rules only bite when a release actually states the attribute. A title that
 * says nothing about audio is ranked lower, not rejected — otherwise a strict
 * profile would silently reject every release on badly-labelled indexers. The
 * file check after import is where silence stops being an excuse.
 */
export function QualityRequirementsFields({ value, onChange, showVideoRules }: Props) {
  const set = <K extends keyof QualityRequirements>(key: K, next: QualityRequirements[K]) =>
    onChange({ ...value, [key]: next })

  const toggleInList = (
    key: 'blockedAudioCodecs' | 'preferredAudioCodecs' | 'blockedVideoCodecs',
    entry: string
  ) => {
    const list = value[key]
    set(key, list.includes(entry) ? list.filter((x) => x !== entry) : [...list, entry])
  }

  return (
    <div className="space-y-6">
      {showVideoRules && (
        <>
          <fieldset className="space-y-3 border-t border-border pt-6">
            <legend className="sr-only">Audio</legend>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Audio</h3>
              <p className="text-xs text-muted-foreground">
                A perfect 1080p picture with a 2.0 AAC track is still the wrong file. These rules
                reject releases that say they carry weak audio, and rank the rest.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minAudioChannels">Minimum channels</Label>
                <Select
                  value={value.minAudioChannels === null ? 'any' : String(value.minAudioChannels)}
                  onValueChange={(next) =>
                    set('minAudioChannels', next === 'any' ? null : Number(next))
                  }
                >
                  <SelectTrigger id="minAudioChannels" className="w-full">
                    <SelectValue>
                      {(selected: string) =>
                        CHANNEL_CHOICES.find((c) => c.value === selected)?.label ?? 'Any'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {CHANNEL_CHOICES.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minAudioTier">Minimum audio format</Label>
                <Select
                  value={value.minAudioTier ?? 'any'}
                  onValueChange={(next) =>
                    set('minAudioTier', next === 'any' ? null : String(next))
                  }
                >
                  <SelectTrigger id="minAudioTier" className="w-full">
                    <SelectValue>
                      {(selected: string) =>
                        TIER_CHOICES.find((c) => c.value === selected)?.label ?? 'Any'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {TIER_CHOICES.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Never accept these audio codecs</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {AUDIO_CODECS.map((codec) => (
                  <div key={`block-${codec}`} className="flex items-center gap-2">
                    <Checkbox
                      id={`block-audio-${codec}`}
                      checked={value.blockedAudioCodecs.includes(codec)}
                      onCheckedChange={() => toggleInList('blockedAudioCodecs', codec)}
                    />
                    <Label
                      htmlFor={`block-audio-${codec}`}
                      className="readout cursor-pointer font-normal"
                    >
                      {codec}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prefer these audio codecs</Label>
              <p className="text-xs text-muted-foreground">
                Not a filter — a tiebreaker between releases of the same quality.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {AUDIO_CODECS.map((codec) => (
                  <div key={`prefer-${codec}`} className="flex items-center gap-2">
                    <Checkbox
                      id={`prefer-audio-${codec}`}
                      checked={value.preferredAudioCodecs.includes(codec)}
                      onCheckedChange={() => toggleInList('preferredAudioCodecs', codec)}
                    />
                    <Label
                      htmlFor={`prefer-audio-${codec}`}
                      className="readout cursor-pointer font-normal"
                    >
                      {codec}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-t border-border pt-6">
            <legend className="sr-only">Video</legend>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Video</h3>
            </div>

            <div className="space-y-2">
              <Label>Never accept these video codecs</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {VIDEO_CODECS.map((codec) => (
                  <div key={codec} className="flex items-center gap-2">
                    <Checkbox
                      id={`block-video-${codec}`}
                      checked={value.blockedVideoCodecs.includes(codec)}
                      onCheckedChange={() => toggleInList('blockedVideoCodecs', codec)}
                    />
                    <Label
                      htmlFor={`block-video-${codec}`}
                      className="readout cursor-pointer font-normal"
                    >
                      {codec}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="requireHdr"
                checked={value.requireHdr}
                onCheckedChange={(next) => set('requireHdr', next)}
              />
              <Label htmlFor="requireHdr" className="cursor-pointer font-normal">
                Require HDR or Dolby Vision for 4K releases
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="blockUpscaled"
                checked={value.blockUpscaled}
                onCheckedChange={(next) => set('blockUpscaled', next)}
              />
              <Label htmlFor="blockUpscaled" className="cursor-pointer font-normal">
                Reject upscales — the resolution tag is not real
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="blockHardcodedSubs"
                checked={value.blockHardcodedSubs}
                onCheckedChange={(next) => set('blockHardcodedSubs', next)}
              />
              <Label htmlFor="blockHardcodedSubs" className="cursor-pointer font-normal">
                Reject releases with burned-in subtitles
              </Label>
            </div>

            <p className="text-xs text-muted-foreground">
              Camera, telesync, telecine and screener rips are always rejected — there is no setting
              for those.
            </p>
          </fieldset>

          <fieldset className="space-y-3 border-t border-border pt-6">
            <legend className="sr-only">File checks</legend>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">File checks</h3>
              <p className="text-xs text-muted-foreground">
                Checked after import, against what the file actually contains. Release names never
                carry bitrates, so these cannot block a grab — they flag a file as below profile and
                offer a replacement.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minVideoBitrate">Minimum video bitrate (kbps)</Label>
                <Input
                  id="minVideoBitrate"
                  type="number"
                  min="0"
                  className="readout"
                  placeholder="No minimum"
                  value={value.minVideoBitrateKbps ?? ''}
                  onChange={(e) =>
                    set('minVideoBitrateKbps', e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minAudioBitrate">Minimum audio bitrate (kbps)</Label>
                <Input
                  id="minAudioBitrate"
                  type="number"
                  min="0"
                  className="readout"
                  placeholder="No minimum"
                  value={value.minAudioBitrateKbps ?? ''}
                  onChange={(e) =>
                    set('minAudioBitrateKbps', e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            </div>
          </fieldset>
        </>
      )}

      {/*
       * Outside the video block on purpose: a book or an audiobook in the wrong
       * language is as useless as a film in one, and the server evaluates the
       * rule for every media type.
       */}
      <AudioLanguageRules value={value} onChange={(next) => onChange({ ...value, ...next })} />

      <fieldset className="space-y-3 border-t border-border pt-6">
        <legend className="sr-only">Matching</legend>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Matching</h3>
        </div>

        <div className="space-y-2">
          <Label htmlFor="minCustomFormatScore">Minimum custom format score</Label>
          <Input
            id="minCustomFormatScore"
            type="number"
            className="readout w-32"
            value={value.minCustomFormatScore}
            onChange={(e) => set('minCustomFormatScore', Number(e.target.value) || 0)}
          />
          <p className="text-xs text-muted-foreground">
            Releases scoring below this across all custom formats are rejected.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="blockUnknownQuality"
            checked={value.blockUnknownQuality}
            onCheckedChange={(next) => set('blockUnknownQuality', next)}
          />
          <Label htmlFor="blockUnknownQuality" className="cursor-pointer font-normal">
            Reject releases whose quality can't be read from the name
          </Label>
        </div>
      </fieldset>
    </div>
  )
}
