import { languageName } from '@/lib/languages'

export interface AudioTrack {
  index: number
  codec: string | null
  channels: number | null
  channelLayout: string | null
  /** ISO 639-1, or null when the muxer never tagged the track. */
  language: string | null
  /** The muxer's own label — "Commentary", "Director's cut". */
  title: string | null
  isDefault: boolean
}

const CHANNEL_LABELS: Record<number, string> = { 1: 'mono', 2: '2.0', 6: '5.1', 8: '7.1' }

function describeTrack(track: AudioTrack): string {
  const channels = track.channels ? (CHANNEL_LABELS[track.channels] ?? `${track.channels}ch`) : null
  return [track.codec?.toUpperCase(), channels].filter(Boolean).join(' ')
}

/**
 * The audio tracks a file actually carries.
 *
 * The spec band above summarises the *first* track, which is all a single-track
 * file has and exactly the wrong answer for a dual-audio one — the second track
 * is the reason that release was worth grabbing, and nothing on the page said
 * it was there. One row per track, language first, because that is the column
 * anyone opening this is reading.
 *
 * Renders nothing for a file with one track: the summary already said it.
 */
export function AudioTrackList({ tracks }: { tracks: AudioTrack[] | undefined }) {
  if (!tracks || tracks.length < 2) return null

  return (
    <div className="border-border space-y-2 border-t pt-3">
      <p className="text-muted-foreground text-xs font-medium">Audio tracks</p>
      <ul className="space-y-1">
        {tracks.map((track) => (
          <li key={track.index} className="flex items-baseline gap-3 text-xs">
            <span className="text-foreground min-w-24 font-medium">
              {track.language ? languageName(track.language) : 'Untagged'}
            </span>
            <span className="readout text-muted-foreground">{describeTrack(track)}</span>
            {track.title && (
              <span className="text-muted-foreground min-w-0 truncate">{track.title}</span>
            )}
            {track.isDefault && (
              <span className="text-muted-foreground ml-auto shrink-0 text-[0.625rem] font-medium tracking-[0.01em] uppercase">
                default
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
