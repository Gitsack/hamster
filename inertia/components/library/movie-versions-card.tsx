import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
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
  DropdownMenuItem,
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

export interface MovieVersion {
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

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster did not answer.'
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
  const [versions, setVersions] = useState<MovieVersion[] | null>(null)
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [promoting, setPromoting] = useState<MovieVersion | null>(null)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    try {
      const data = await getJson<{ versions: MovieVersion[]; profiles: ProfileOption[] }>(
        `/api/v1/movies/${movieId}/versions`
      )
      if (!mounted.current) return
      setVersions(data.versions)
      setProfiles(data.profiles)
    } catch {
      if (mounted.current) setVersions((current) => current ?? [])
    }
  }, [movieId])

  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
    }
  }, [load])

  const active = versions?.some((v) => v.status === 'queued' || v.status === 'encoding')
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(timer)
  }, [active, load])

  // Nothing to show and nothing to offer: stay out of the way.
  if (!versions || (versions.length === 0 && profiles.length === 0)) return null

  const missing = profiles.filter((profile) => !versions.some((v) => v.label === profile.label))

  const create = async (profileId: string) => {
    try {
      await send(`/api/v1/movies/${movieId}/versions`, 'POST', { profileId })
      void load()
    } catch (err) {
      toast.error('Could not queue the version', { description: message(err) })
    }
  }

  const remove = async (version: MovieVersion) => {
    try {
      await send(`/api/v1/movies/${movieId}/versions/${version.id}`, 'DELETE')
      setVersions((current) => current?.filter((v) => v.id !== version.id) ?? null)
      toast.success(
        version.status === 'ready'
          ? `${version.label} version deleted`
          : `${version.label} cancelled`
      )
    } catch (err) {
      toast.error(`Could not delete ${version.label}`, { description: message(err) })
    }
  }

  const promote = async () => {
    if (!promoting) return
    setBusy(true)
    try {
      await send(`/api/v1/movies/${movieId}/versions/${promoting.id}/promote`, 'POST')
      toast.success(`Kept only the ${promoting.label} version`)
      setPromoting(null)
      onPromoted()
      void load()
    } catch (err) {
      toast.error('The original was not removed', { description: message(err) })
    } finally {
      setBusy(false)
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
          <p className="text-sm text-muted-foreground">
            No smaller copy yet. Profiles live in{' '}
            <Link href="/settings/media#versions" className="underline underline-offset-4">
              Settings → Media
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {versions.map((version) => (
              <VersionRow
                key={version.id}
                version={version}
                originalSize={originalSize}
                onRetry={() => version.profileId && void create(version.profileId)}
                onDelete={() => void remove(version)}
                onPromote={() => setPromoting(version)}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={promoting !== null} onOpenChange={(open) => !open && setPromoting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keep only the {promoting?.label} version?</AlertDialogTitle>
            <AlertDialogDescription>
              The original file is deleted for good
              {promoting?.size
                ? `, freeing ${formatSize(Math.max(0, originalSize))}. The movie keeps playing from the ${formatSize(promoting.size)} copy`
                : ''}
              . Getting the full quality back means downloading it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void promote()
              }}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete original
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function VersionRow({
  version,
  originalSize,
  onRetry,
  onDelete,
  onPromote,
}: {
  version: MovieVersion
  originalSize: number
  onRetry: () => void
  onDelete: () => void
  onPromote: () => void
}) {
  const percent = version.progress?.percent ?? 0
  const saved =
    version.size && originalSize > 0 ? Math.round((1 - version.size / originalSize) * 100) : null

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

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{version.label}</p>
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
          <Button variant="outline" size="sm" asChild aria-label={`Download ${version.label}`}>
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
            <Button variant="ghost" size="icon" aria-label={`More actions for ${version.label}`}>
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
              {version.status === 'ready' || version.status === 'failed' ? 'Delete' : 'Cancel'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {version.status === 'encoding' && (
        <Progress value={percent} aria-label={`${version.label} encoding progress`} />
      )}
    </li>
  )
}
