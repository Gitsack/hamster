import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  Delete01Icon,
  FileDownloadIcon,
  MoreHorizontalIcon,
  Refresh01Icon,
  StarIcon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatBytes as formatSize, getJson, send } from '@/components/system/system_api'

export interface MediaVersion {
  id: string
  profileId: string | null
  label: string
  status: 'queued' | 'encoding' | 'ready' | 'failed'
  path: string | null
  size: number | null
  summary: string | null
  error: string | null
  encoder: string | null
  progress: { percent: number; fps: number | null; eta: number | null } | null
  /** Set for an episode's version. */
  episode: { id: string; seasonNumber: number; episodeNumber: number; title: string | null } | null
  downloadUrl: string | null
}

interface ProfileOption {
  id: string
  name: string
  label: string
}

const POLL_MS = 3000

export function formatEta(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return 'under a minute left'
  if (minutes < 60) return `${minutes} min left`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min left`
}

export function episodeCode(episode: { seasonNumber: number; episodeNumber: number }): string {
  return `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster did not answer.'
}

function isActive(version: MediaVersion): boolean {
  return version.status === 'queued' || version.status === 'encoding'
}

/**
 * Load a versions endpoint, and keep polling it while anything is queued or
 * encoding so progress moves without a reload.
 */
function useVersions<T extends { versions: MediaVersion[]; profiles: ProfileOption[] }>(
  url: string
) {
  const [data, setData] = useState<T | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    try {
      const next = await getJson<T>(url)
      if (mounted.current) setData(next)
    } catch {
      // Keep what is showing; the next poll or action tries again.
    }
  }, [url])

  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
    }
  }, [load])

  const active = data?.versions.some(isActive)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(timer)
  }, [active, load])

  return { data, setData, load }
}

/** Delete and promote, shared by the movie and the show card. */
function useVersionActions(reload: () => Promise<void>, onPromoted?: () => void) {
  const [promoting, setPromoting] = useState<MediaVersion | null>(null)
  const [busy, setBusy] = useState(false)

  const remove = async (version: MediaVersion) => {
    try {
      await send(`/api/v1/versions/${version.id}`, 'DELETE')
      toast.success(
        version.status === 'ready'
          ? `${version.label} version deleted`
          : `${version.label} cancelled`
      )
      await reload()
    } catch (err) {
      toast.error(`Could not delete ${version.label}`, { description: message(err) })
    }
  }

  const promote = async () => {
    if (!promoting) return
    setBusy(true)
    try {
      await send(`/api/v1/versions/${promoting.id}/promote`, 'POST')
      toast.success(`Kept only the ${promoting.label} version`)
      setPromoting(null)
      onPromoted?.()
      await reload()
    } catch (err) {
      toast.error('The original was not removed', { description: message(err) })
    } finally {
      setBusy(false)
    }
  }

  return { promoting, setPromoting, busy, remove, promote }
}

function PromoteDialog({
  version,
  originalSize,
  busy,
  onCancel,
  onConfirm,
}: {
  version: MediaVersion | null
  originalSize: number | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const what = version?.episode ? `${episodeCode(version.episode)}'s` : 'the'
  return (
    <AlertDialog open={version !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keep only the {version?.label} version?</AlertDialogTitle>
          <AlertDialogDescription>
            {what === 'the' ? 'The' : what} original file is deleted for good
            {originalSize ? `, freeing ${formatSize(originalSize)}` : ''}
            {version?.size ? `. Playback continues from the ${formatSize(version.size)} copy` : ''}.
            Getting the full quality back means downloading it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
            disabled={busy}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete original
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * The smaller copies kept beside a movie's file: what exists, what is being
 * encoded, and the one-way door of keeping only a copy.
 */
export function MovieVersionsCard({
  movieId,
  originalSize,
  onPromoted,
}: {
  movieId: string
  originalSize: number
  /** The original is gone and a version is the movie's file now. */
  onPromoted: () => void
}) {
  const { data, load } = useVersions<{ versions: MediaVersion[]; profiles: ProfileOption[] }>(
    `/api/v1/movies/${movieId}/versions`
  )
  const actions = useVersionActions(load, onPromoted)

  // Nothing to show and nothing to offer: stay out of the way.
  if (!data || (data.versions.length === 0 && data.profiles.length === 0)) return null
  const { versions, profiles } = data

  const missing = profiles.filter((profile) => !versions.some((v) => v.label === profile.label))

  const create = async (profileId: string) => {
    try {
      await send(`/api/v1/movies/${movieId}/versions`, 'POST', { profileId })
      await load()
    } catch (err) {
      toast.error('Could not queue the version', { description: message(err) })
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Versions</CardTitle>
        {missing.length > 0 && (
          <CardAction>
            {missing.length === 1 ? (
              <Button variant="outline" size="sm" onClick={() => void create(missing[0].id)}>
                <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
                Create {missing[0].name}
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
                    Create version
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {missing.map((profile) => (
                    <DropdownMenuItem key={profile.id} onClick={() => void create(profile.id)}>
                      {profile.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <NoVersionsYet />
        ) : (
          <ul className="divide-y divide-border">
            {versions.map((version) => (
              <VersionRow
                key={version.id}
                version={version}
                originalSize={originalSize}
                onRetry={() => version.profileId && void create(version.profileId)}
                onDelete={() => void actions.remove(version)}
                onPromote={() => actions.setPromoting(version)}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <PromoteDialog
        version={actions.promoting}
        originalSize={originalSize}
        busy={actions.busy}
        onCancel={() => actions.setPromoting(null)}
        onConfirm={() => void actions.promote()}
      />
    </Card>
  )
}

/**
 * A show's versions: one line per profile saying how far it has got across
 * the episodes, ways to queue the whole show or a season, and the episodes
 * themselves behind a toggle — a long-running show has hundreds.
 */
export function ShowVersionsCard({
  showId,
  seasons,
  onPromoted,
}: {
  showId: string
  /** Season numbers that have at least one episode file. */
  seasons: number[]
  onPromoted?: () => void
}) {
  const { data, load } = useVersions<{
    versions: MediaVersion[]
    profiles: ProfileOption[]
    episodesWithFiles: number
  }>(`/api/v1/tvshows/${showId}/versions`)
  const actions = useVersionActions(load, onPromoted)
  const [open, setOpen] = useState(false)

  if (!data || (data.versions.length === 0 && data.profiles.length === 0)) return null
  if (data.episodesWithFiles === 0 && data.versions.length === 0) return null
  const { versions, profiles, episodesWithFiles } = data

  const create = async (profile: ProfileOption, seasonNumber?: number) => {
    try {
      const result = await send<{ queued: number }>(`/api/v1/tvshows/${showId}/versions`, 'POST', {
        profileId: profile.id,
        seasonNumber,
      })
      const queued = result?.queued ?? 0
      toast.success(
        queued > 0
          ? `${queued} ${queued === 1 ? 'episode' : 'episodes'} queued for ${profile.name}`
          : `Every episode there already has a ${profile.name} version`
      )
      await load()
    } catch (err) {
      toast.error('Could not queue the versions', { description: message(err) })
    }
  }

  const retry = async (version: MediaVersion) => {
    if (!version.profileId || !version.episode) return
    try {
      await send(`/api/v1/tvshows/${showId}/versions`, 'POST', {
        profileId: version.profileId,
        episodeId: version.episode.id,
      })
      await load()
    } catch (err) {
      toast.error('Could not queue the version', { description: message(err) })
    }
  }

  const labels = [...new Set([...profiles.map((p) => p.label), ...versions.map((v) => v.label)])]

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Versions</CardTitle>
        {profiles.length > 0 && episodesWithFiles > 0 && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
                  Create versions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {profiles.map((profile, index) => (
                  <Fragment key={profile.id}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{profile.name}</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => void create(profile)}>
                        All episodes
                      </DropdownMenuItem>
                      {seasons.length > 1 &&
                        seasons.map((season) => (
                          <DropdownMenuItem
                            key={season}
                            onClick={() => void create(profile, season)}
                          >
                            {season === 0 ? 'Specials' : `Season ${season}`}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {versions.length === 0 ? (
          <NoVersionsYet />
        ) : (
          <>
            <ul className="space-y-3">
              {labels.map((label) => (
                <ProfileProgress
                  key={label}
                  label={label}
                  versions={versions.filter((v) => v.label === label)}
                  episodesWithFiles={episodesWithFiles}
                />
              ))}
            </ul>
            <div className="border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className={
                    open
                      ? 'h-4 w-4 rotate-180 transition-transform'
                      : 'h-4 w-4 transition-transform'
                  }
                />
                {open ? 'Hide episodes' : `Show ${versions.length} episode versions`}
              </Button>
              {open && (
                <ul className="mt-2 divide-y divide-border">
                  {versions.map((version) => (
                    <VersionRow
                      key={version.id}
                      version={version}
                      originalSize={null}
                      onRetry={() => void retry(version)}
                      onDelete={() => void actions.remove(version)}
                      onPromote={() => actions.setPromoting(version)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>

      <PromoteDialog
        version={actions.promoting}
        originalSize={null}
        busy={actions.busy}
        onCancel={() => actions.setPromoting(null)}
        onConfirm={() => void actions.promote()}
      />
    </Card>
  )
}

/** "Mobile · 12 of 40 episodes · 3 queued", with a bar while any are encoding. */
function ProfileProgress({
  label,
  versions,
  episodesWithFiles,
}: {
  label: string
  versions: MediaVersion[]
  episodesWithFiles: number
}) {
  const ready = versions.filter((v) => v.status === 'ready')
  const queued = versions.filter((v) => v.status === 'queued').length
  const failed = versions.filter((v) => v.status === 'failed').length
  const encoding = versions.find((v) => v.status === 'encoding')
  const size = ready.reduce((sum, v) => sum + (v.size ?? 0), 0)

  const parts = [
    `${ready.length} of ${episodesWithFiles} episodes`,
    size > 0 ? formatSize(size) : null,
    queued > 0 ? `${queued} queued` : null,
    failed > 0 ? `${failed} failed` : null,
  ].filter(Boolean)

  return (
    <li className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <p className="readout text-xs text-muted-foreground">{parts.join(' · ')}</p>
      {encoding?.episode && (
        <>
          <p className="readout text-xs text-muted-foreground">
            {[
              `Encoding ${episodeCode(encoding.episode)} ${Math.floor(encoding.progress?.percent ?? 0)}%`,
              formatEta(encoding.progress?.eta),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <Progress
            value={encoding.progress?.percent ?? 0}
            aria-label={`${label} encoding progress`}
          />
        </>
      )}
    </li>
  )
}

function NoVersionsYet() {
  return (
    <p className="text-sm text-muted-foreground">
      No smaller copy yet. Profiles live in{' '}
      <Link href="/settings/media#versions" className="underline underline-offset-4">
        Settings → Media
      </Link>
      .
    </p>
  )
}

function VersionRow({
  version,
  originalSize,
  onRetry,
  onDelete,
  onPromote,
}: {
  version: MediaVersion
  originalSize: number | null
  onRetry: () => void
  onDelete: () => void
  onPromote: () => void
}) {
  const percent = version.progress?.percent ?? 0
  const saved =
    version.size && originalSize ? Math.round((1 - version.size / originalSize) * 100) : null

  let detail: string
  if (version.status === 'queued') {
    detail = 'Queued'
  } else if (version.status === 'encoding') {
    detail = [
      `Encoding ${Math.floor(percent)}%`,
      version.encoder === 'x265' ? 'on the CPU' : 'on the GPU',
      formatEta(version.progress?.eta),
    ]
      .filter(Boolean)
      .join(' · ')
  } else if (version.status === 'failed') {
    detail = version.error ?? 'Failed'
  } else {
    detail = [
      version.size ? formatSize(version.size) : null,
      saved !== null && saved > 0 ? `${saved}% smaller` : null,
      version.summary,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const name = version.episode
    ? `${episodeCode(version.episode)}${version.episode.title ? ` · ${version.episode.title}` : ''}`
    : version.label

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {name}
            {version.episode && (
              <span className="font-normal text-muted-foreground"> · {version.label}</span>
            )}
          </p>
          <p
            className={
              version.status === 'failed'
                ? 'text-xs text-status-failed-ink'
                : 'readout truncate text-xs text-muted-foreground'
            }
          >
            {detail}
          </p>
        </div>
        {version.status === 'ready' && version.downloadUrl && (
          <Button variant="outline" size="sm" asChild aria-label={`Download ${name}`}>
            <a href={version.downloadUrl} download>
              <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </Button>
        )}
        {version.status === 'failed' && version.profileId && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <HugeiconsIcon icon={Refresh01Icon} className="h-4 w-4" />
            <span className="hidden sm:inline">Retry</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`More actions for ${name}`}>
              <HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {version.status === 'ready' && (
              <>
                <DropdownMenuItem onClick={onPromote}>
                  <HugeiconsIcon icon={StarIcon} className="h-4 w-4" />
                  Keep only this version
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
              {isActive(version) ? 'Cancel' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {version.status === 'encoding' && (
        <Progress value={percent} aria-label={`${name} encoding progress`} />
      )}
    </li>
  )
}
