import type React from 'react'
import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert01Icon, FileDownloadIcon, Search01Icon } from '@hugeicons/core-free-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

/**
 * The parsed facts the API returns alongside every release. Mirrors
 * AnnotatedRelease on the server — one parser, one verdict.
 */
export interface ReleaseQuality {
  name: string | null
  resolution: string | null
  source: string | null
  codec: string | null
  audioCodec: string | null
  audioChannels: number | null
  audioTier: string | null
  hdr: string | null
  bitDepth: number | null
  isRemux: boolean
  isProper: boolean
  isRepack: boolean
  isUpscaled: boolean
  hasHardcodedSubs: boolean
  isJunkSource: boolean
  junkSourceLabel: string | null
  releaseGroup: string | null
}

export interface AnnotatedRelease {
  id: string
  title: string
  size: number
  indexer: string
  indexerId?: string | null
  downloadUrl: string
  grabs?: number | null
  seeders?: number | null
  quality?: ReleaseQuality | null
  accepted?: boolean
  rejections?: string[]
  customFormats?: { name: string; score: number }[]
  score?: number
}

export interface ReleaseBadge {
  label: string
  tone: 'neutral' | 'good' | 'bad'
  hint?: string
}

const CHANNEL_LABELS: Record<number, string> = { 1: 'mono', 2: '2.0', 6: '5.1', 8: '7.1' }

/**
 * Turn the parsed facts into the row of badges.
 *
 * Order is deliberate: whatever disqualifies a release comes first, because
 * that is the one thing someone scanning the list must not miss. A CAM tag
 * buried after the codec is a CAM tag nobody reads.
 */
export function releaseBadges(release: AnnotatedRelease): ReleaseBadge[] {
  const q = release.quality
  if (!q) return []

  const badges: ReleaseBadge[] = []

  if (q.isJunkSource) {
    badges.push({
      label: q.junkSourceLabel ?? 'CAM',
      tone: 'bad',
      hint: 'Filmed in a cinema or taken from a screener — never an acceptable copy',
    })
  }
  if (q.isUpscaled) {
    badges.push({ label: 'UPSCALED', tone: 'bad', hint: 'Resolution was faked by upscaling' })
  }
  if (q.hasHardcodedSubs) {
    badges.push({ label: 'HARDSUB', tone: 'bad', hint: 'Subtitles are burned into the picture' })
  }

  if (q.resolution) badges.push({ label: q.resolution, tone: 'neutral' })
  if (q.source && !q.isJunkSource) badges.push({ label: q.source, tone: 'neutral' })
  if (q.isRemux) badges.push({ label: 'REMUX', tone: 'good', hint: 'Untouched disc video' })
  if (q.codec) badges.push({ label: q.codec, tone: 'neutral' })
  if (q.bitDepth && q.bitDepth >= 10) badges.push({ label: `${q.bitDepth}-bit`, tone: 'neutral' })
  if (q.hdr) badges.push({ label: q.hdr, tone: 'good' })

  if (q.audioCodec || q.audioChannels) {
    const channels = q.audioChannels ? CHANNEL_LABELS[q.audioChannels] : null
    const isWeakAudio = q.audioTier === 'lossy-sd' || q.audioChannels === 2
    badges.push({
      label: [q.audioCodec, channels].filter(Boolean).join(' '),
      tone: isWeakAudio ? 'bad' : q.audioTier === 'unknown' ? 'neutral' : 'good',
      hint: isWeakAudio ? 'Basic audio — check this is good enough' : undefined,
    })
  } else {
    badges.push({
      label: 'audio unknown',
      tone: 'neutral',
      hint: 'The title says nothing about audio',
    })
  }

  if (q.isRepack || q.isProper) {
    badges.push({
      label: q.isRepack ? 'REPACK' : 'PROPER',
      tone: 'good',
      hint: 'Fixes a problem in an earlier release',
    })
  }
  if (q.releaseGroup) badges.push({ label: q.releaseGroup, tone: 'neutral' })

  for (const format of release.customFormats ?? []) {
    badges.push({
      label: `${format.name} ${format.score > 0 ? '+' : ''}${format.score}`,
      tone: format.score < 0 ? 'bad' : 'good',
      hint: 'Custom format',
    })
  }

  return badges
}

const TONE_CLASS: Record<ReleaseBadge['tone'], string> = {
  neutral: 'border-border text-muted-foreground',
  good: 'border-status-complete-ink/40 text-status-complete-ink',
  bad: 'border-status-failed-ink/50 text-status-failed-ink',
}

/**
 * A filter/sort toggle.
 *
 * Deliberately a plain button rather than a dropdown: there are only a handful
 * of options, the list underneath is dense, and a chip shows the current state
 * without being opened.
 */
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        'outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        active
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-accent'
      )}
    >
      {children}
    </button>
  )
}

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

type SortKey = 'best' | 'size' | 'peers'

const SORT_LABELS: Record<SortKey, string> = {
  best: 'Best match',
  size: 'Largest first',
  peers: 'Most grabs',
}

interface ReleaseListProps {
  releases: AnnotatedRelease[]
  loading?: boolean
  grabbingId?: string | null
  onGrab: (release: AnnotatedRelease) => void
  /** Shown when the indexers returned nothing at all. */
  emptyMessage?: string
}

/**
 * The manual release picker.
 *
 * Two things this has to get right that a truncated table did not: the whole
 * release name is readable (it is the evidence), and what the name means is
 * spelled out as badges so nobody has to know that "HDTS" is a camera rip.
 */
export function ReleaseList({
  releases,
  loading = false,
  grabbingId = null,
  onGrab,
  emptyMessage = 'Your indexers returned nothing for this title. Check that the indexers are enabled and healthy in Settings, or widen the quality profile.',
}: ReleaseListProps) {
  const [query, setQuery] = useState('')
  const [hideRejected, setHideRejected] = useState(false)
  const [resolution, setResolution] = useState('all')
  const [sort, setSort] = useState<SortKey>('best')

  const resolutions = useMemo(() => {
    const found = new Set<string>()
    for (const release of releases) {
      if (release.quality?.resolution) found.add(release.quality.resolution)
    }
    return [...found].sort().reverse()
  }, [releases])

  const rejectedCount = useMemo(
    () => releases.filter((r) => r.accepted === false).length,
    [releases]
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    let list = releases.filter((release) => {
      if (needle && !release.title.toLowerCase().includes(needle)) return false
      if (hideRejected && release.accepted === false) return false
      if (resolution !== 'all' && release.quality?.resolution !== resolution) return false
      return true
    })

    list = [...list].sort((a, b) => {
      if (sort === 'size') return b.size - a.size
      if (sort === 'peers') return (b.grabs ?? b.seeders ?? 0) - (a.grabs ?? a.seeders ?? 0)
      // 'best': accepted releases first, then by the profile's own score.
      if ((a.accepted ?? true) !== (b.accepted ?? true)) return a.accepted ? -1 : 1
      return (b.score ?? 0) - (a.score ?? 0)
    })

    return list
  }, [releases, query, hideRejected, resolution, sort])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
        <span className="ml-3 text-muted-foreground">Searching indexers…</span>
      </div>
    )
  }

  if (releases.length === 0) {
    return (
      <EmptyState
        icon={<HugeiconsIcon icon={Search01Icon} />}
        title="No releases found"
        message={emptyMessage}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by release name…"
          className="readout h-9 w-full sm:w-64"
          aria-label="Filter releases by name"
        />

        {resolutions.length > 1 && (
          <div className="flex items-center gap-1" role="group" aria-label="Filter by resolution">
            {['all', ...resolutions].map((value) => (
              <FilterChip
                key={value}
                active={resolution === value}
                onClick={() => setResolution(value)}
              >
                {value === 'all' ? 'Any' : value}
              </FilterChip>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1" role="group" aria-label="Sort releases">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <FilterChip key={key} active={sort === key} onClick={() => setSort(key)}>
              {SORT_LABELS[key]}
            </FilterChip>
          ))}
        </div>

        {rejectedCount > 0 && (
          <FilterChip active={hideRejected} onClick={() => setHideRejected(!hideRejected)}>
            Hide {rejectedCount} below profile
          </FilterChip>
        )}

        <span className="readout ml-auto text-xs text-muted-foreground">
          {visible.length} of {releases.length}
        </span>
      </div>

      <div className="flex-1 overflow-auto -mx-1 px-1">
        <ul className="flex flex-col gap-2">
          {visible.map((release) => {
            const badges = releaseBadges(release)
            const rejections = release.rejections ?? []
            const isRejected = release.accepted === false

            return (
              <li
                key={release.id}
                className={cn(
                  'rounded-lg border border-border p-3 transition-colors hover:bg-accent/40',
                  isRejected && 'border-dashed'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* The full name, wrapped rather than clipped: this line is
                        the evidence, and a truncated one hides the tag that
                        matters most. */}
                    <p className="readout text-sm leading-snug break-all">{release.title}</p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {badges.map((badge, index) => (
                        <Badge
                          key={`${badge.label}-${index}`}
                          variant="outline"
                          className={cn('readout text-[0.6875rem]', TONE_CLASS[badge.tone])}
                          title={badge.hint}
                        >
                          {badge.label}
                        </Badge>
                      ))}
                    </div>

                    {isRejected && rejections.length > 0 && (
                      <p className="flex items-start gap-1.5 text-xs text-status-failed-ink">
                        <HugeiconsIcon icon={Alert01Icon} className="mt-px h-3.5 w-3.5 shrink-0" />
                        <span>{rejections.join(' · ')}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <div className="readout text-sm">{formatSize(release.size)}</div>
                      <div className="readout text-xs text-muted-foreground">{release.indexer}</div>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => onGrab(release)}
                      disabled={grabbingId === release.id}
                      aria-label={`Download ${release.title}`}
                      title={
                        isRejected
                          ? 'Grab anyway — this release is below your quality profile'
                          : 'Grab this release'
                      }
                    >
                      {grabbingId === release.id ? (
                        <Spinner />
                      ) : (
                        <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No releases match these filters.
          </p>
        )}
      </div>
    </div>
  )
}
