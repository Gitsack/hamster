import { Head, Link, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  MoreVerticalIcon,
  Delete01Icon,
  Tv01Icon,
  ViewIcon,
  ViewOffIcon,
  Calendar01Icon,
  StarIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  FileDownloadIcon,
  Add01Icon,
  PlayIcon,
  Refresh01Icon,
  Notification01Icon,
  NotificationOff01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MediaStatusBadge, type MediaItemStatus } from '@/components/library/media-status-badge'
import { MediaHero } from '@/components/media-hero'
import { SimilarLane } from '@/components/library/similar-lane'
import { useAudioPlayer } from '@/contexts/audio_player_context'
import { VideoPlayer } from '@/components/player/video_player'

interface QualityProfile {
  id: number
  name: string
  minSizeMb?: number | null
  maxSizeMb?: number | null
}

interface RootFolder {
  id: number
  path: string
}

interface Season {
  id: number
  seasonNumber: number
  title: string
  episodeCount: number
  requested: boolean
  posterUrl: string | null
  downloadedCount: number
  downloadingCount: number
  requestedCount: number
}

interface EpisodeFile {
  id: number
  path: string
  size: number
  quality: string | null
  downloadUrl: string
}

interface Episode {
  id: number
  episodeNumber: number
  title: string
  overview: string | null
  airDate: string | null
  runtime: number | null
  stillUrl: string | null
  requested: boolean
  hasFile: boolean
  episodeFile: EpisodeFile | null
}

interface TvShow {
  id: number
  tmdbId: string | null
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  firstAired: string | null
  status: string | null
  network: string | null
  posterUrl: string | null
  backdropUrl: string | null
  rating: number | null
  genres: string[]
  trailerUrl: string | null
  backdropImages: string[]
  requested: boolean
  monitored: boolean
  seasonCount: number
  episodeCount: number
  qualityProfile: QualityProfile | null
  rootFolder: RootFolder | null
  seasons: Season[]
  addedAt: string | null
}

interface SeasonDetail {
  id: number
  seasonNumber: number
  title: string
  overview: string | null
  airDate: string | null
  posterUrl: string | null
  requested: boolean
  episodes: Episode[]
}

interface ActiveDownload {
  episodeId: string | null
  progress: number
  status: string
}

export default function TvShowDetail() {
  const { url } = usePage()
  const showId = url.split('/').pop()

  const [show, setShow] = useState<TvShow | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [seasonDetails, setSeasonDetails] = useState<Record<number, SeasonDetail>>({})
  const [loadingSeasons, setLoadingSeasons] = useState<Set<number>>(new Set())
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null)
  const [activeDownloads, setActiveDownloads] = useState<
    Map<string, { progress: number; status: string }>
  >(new Map())
  const [togglingSeasons, setTogglingSeasons] = useState<Set<number>>(new Set())
  const [togglingEpisodes, setTogglingEpisodes] = useState<Set<number>>(new Set())
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false)
  const [deletingFile, setDeletingFile] = useState(false)
  const [selectedEpisodeForDelete, setSelectedEpisodeForDelete] = useState<{
    id: number
    title: string
    seasonNumber: number
  } | null>(null)
  const [removeWithFileDialogOpen, setRemoveWithFileDialogOpen] = useState(false)
  const [episodeToRemove, setEpisodeToRemove] = useState<{
    id: number
    title: string
    seasonNumber: number
    hasFile: boolean
  } | null>(null)
  const [removingWithFile, setRemovingWithFile] = useState(false)
  const [requestingAllSeasons, setRequestingAllSeasons] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false)
  const [playingEpisode, setPlayingEpisode] = useState<{
    id: number
    fileId: number
    title: string
  } | null>(null)
  const audioPlayer = useAudioPlayer()

  useEffect(() => {
    fetchShow()
    fetchActiveDownloads()
    // Poll for download status every 5 seconds
    const interval = setInterval(fetchActiveDownloads, 5000)
    return () => clearInterval(interval)
  }, [showId])

  const fetchShow = async () => {
    try {
      const response = await fetch(`/api/v1/tvshows/${showId}`)
      if (response.ok) {
        const data = await response.json()
        setShow(data)
      } else if (response.status === 404) {
        toast.error('TV show not found')
        router.visit('/library?tab=tv')
      }
    } catch (error) {
      console.error('Failed to fetch show:', error)
      toast.error('Failed to load TV show')
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveDownloads = async () => {
    try {
      const response = await fetch('/api/v1/queue')
      if (response.ok) {
        const data = await response.json()
        const downloads = new Map<string, { progress: number; status: string }>()
        for (const item of data) {
          if (item.tvShowId === showId && item.episodeId) {
            downloads.set(item.episodeId, {
              progress: item.progress || 0,
              status: item.status || 'downloading',
            })
          }
        }
        setActiveDownloads(downloads)
      }
    } catch (error) {
      // Silently ignore - polling will retry
    }
  }

  const getEpisodeStatus = (episode: Episode): { status: MediaItemStatus; progress: number } => {
    if (episode.hasFile) {
      return { status: 'downloaded', progress: 100 }
    }
    const downloadInfo = activeDownloads.get(String(episode.id))
    if (downloadInfo !== undefined) {
      if (downloadInfo.status === 'importing') {
        return { status: 'importing', progress: 100 }
      }
      return { status: 'downloading', progress: downloadInfo.progress }
    }
    if (episode.requested) {
      return { status: 'requested', progress: 0 }
    }
    return { status: 'none', progress: 0 }
  }

  const fetchSeasonDetails = async (seasonNumber: number) => {
    if (seasonDetails[seasonNumber] || loadingSeasons.has(seasonNumber)) return

    setLoadingSeasons((prev) => new Set(prev).add(seasonNumber))
    try {
      const response = await fetch(`/api/v1/tvshows/${showId}/season/${seasonNumber}`)
      if (response.ok) {
        const data = await response.json()
        setSeasonDetails((prev) => ({ ...prev, [seasonNumber]: data }))
      }
    } catch (error) {
      console.error('Failed to fetch season:', error)
    } finally {
      setLoadingSeasons((prev) => {
        const next = new Set(prev)
        next.delete(seasonNumber)
        return next
      })
    }
  }

  const toggleMonitored = async () => {
    if (!show) return

    const wasMonitored = show.monitored
    setShow({ ...show, monitored: !wasMonitored })

    try {
      const response = await fetch(`/api/v1/tvshows/${showId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored: !wasMonitored }),
      })
      if (response.ok) {
        toast.success(wasMonitored ? 'Monitoring disabled' : 'Monitoring enabled')
      } else {
        setShow({ ...show, monitored: wasMonitored })
        toast.error('Failed to update monitoring')
      }
    } catch (error) {
      console.error('Failed to update monitoring:', error)
      setShow({ ...show, monitored: wasMonitored })
      toast.error('Failed to update monitoring')
    }
  }

  const toggleWanted = async () => {
    if (!show) return

    try {
      const response = await fetch(`/api/v1/tvshows/${showId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !show.requested }),
      })
      if (response.ok) {
        setShow({ ...show, requested: !show.requested })
        toast.success(show.requested ? 'TV show unrequested' : 'TV show requested')
      }
    } catch (error) {
      console.error('Failed to update show:', error)
      toast.error('Failed to update TV show')
    }
  }

  const deleteShow = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/tvshows/${showId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('TV show deleted')
        router.visit('/library?tab=tv')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Failed to delete show:', error)
      toast.error('Failed to delete TV show')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const toggleSeason = (seasonNumber: number) => {
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null)
    } else {
      setExpandedSeason(seasonNumber)
      fetchSeasonDetails(seasonNumber)
    }
  }

  const toggleSeasonRequested = async (
    seasonNumber: number,
    currentlyRequested: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    if (!show) return

    // Optimistically update UI immediately
    setShow({
      ...show,
      seasons: show.seasons.map((s) =>
        s.seasonNumber === seasonNumber ? { ...s, requested: !currentlyRequested } : s
      ),
    })
    if (seasonDetails[seasonNumber]) {
      setSeasonDetails((prev) => ({
        ...prev,
        [seasonNumber]: {
          ...prev[seasonNumber],
          requested: !currentlyRequested,
          episodes: prev[seasonNumber].episodes.map((ep) => ({
            ...ep,
            requested: !currentlyRequested,
          })),
        },
      }))
    }

    // Show loading state for this season
    setTogglingSeasons((prev) => new Set(prev).add(seasonNumber))

    try {
      const response = await fetch(`/api/v1/tvshows/${showId}/season/${seasonNumber}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !currentlyRequested }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.deleted) {
          // Season was deleted - check if show still exists
          toast.success('Season removed from library')
          fetchShow()
        } else {
          toast.success(currentlyRequested ? 'Season unrequested' : 'Season requested')
          fetchShow()
        }
      } else if (data.hasFile) {
        // Season has episodes with files - show error
        toast.error(
          `Cannot unrequest: ${data.episodesWithFiles} episode(s) have downloaded files. Delete files first.`
        )
        // Revert
        setShow({
          ...show,
          seasons: show.seasons.map((s) =>
            s.seasonNumber === seasonNumber ? { ...s, requested: currentlyRequested } : s
          ),
        })
        if (seasonDetails[seasonNumber]) {
          setSeasonDetails((prev) => ({
            ...prev,
            [seasonNumber]: {
              ...prev[seasonNumber],
              requested: currentlyRequested,
              episodes: prev[seasonNumber].episodes.map((ep) => ({
                ...ep,
                requested: currentlyRequested,
              })),
            },
          }))
        }
      } else {
        // Revert on error
        setShow({
          ...show,
          seasons: show.seasons.map((s) =>
            s.seasonNumber === seasonNumber ? { ...s, requested: currentlyRequested } : s
          ),
        })
        toast.error(data.error || 'Failed to update season')
      }
    } catch (error) {
      console.error('Failed to update season:', error)
      // Revert on error
      setShow({
        ...show,
        seasons: show.seasons.map((s) =>
          s.seasonNumber === seasonNumber ? { ...s, requested: currentlyRequested } : s
        ),
      })
      toast.error('Failed to update season')
    } finally {
      setTogglingSeasons((prev) => {
        const next = new Set(prev)
        next.delete(seasonNumber)
        return next
      })
    }
  }

  const toggleEpisodeRequested = async (
    episodeId: number,
    currentlyRequested: boolean,
    seasonNumber: number,
    hasFile?: boolean,
    title?: string
  ) => {
    if (!show) return

    // If unrequesting an episode with a file, show confirmation dialog
    if (currentlyRequested && hasFile) {
      setEpisodeToRemove({ id: episodeId, title: title || 'Episode', seasonNumber, hasFile: true })
      setRemoveWithFileDialogOpen(true)
      return
    }

    // Optimistically update UI immediately
    setSeasonDetails((prev) => ({
      ...prev,
      [seasonNumber]: {
        ...prev[seasonNumber],
        episodes: prev[seasonNumber].episodes.map((ep) =>
          ep.id === episodeId ? { ...ep, requested: !currentlyRequested } : ep
        ),
      },
    }))

    // Show loading state for this episode
    setTogglingEpisodes((prev) => new Set(prev).add(episodeId))

    try {
      const response = await fetch(`/api/v1/tvshows/${showId}/episodes/${episodeId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !currentlyRequested }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.deleted) {
          // Episode was deleted - refresh show to check if season/show still exist
          toast.success('Episode removed from library')
          fetchShow()
        } else {
          toast.success(currentlyRequested ? 'Episode unrequested' : 'Episode requested')
          fetchShow()
        }
      } else if (data.hasFile) {
        // Episode has a file - show confirmation dialog
        setSeasonDetails((prev) => ({
          ...prev,
          [seasonNumber]: {
            ...prev[seasonNumber],
            episodes: prev[seasonNumber].episodes.map((ep) =>
              ep.id === episodeId ? { ...ep, requested: currentlyRequested } : ep
            ),
          },
        }))
        setEpisodeToRemove({
          id: episodeId,
          title: title || 'Episode',
          seasonNumber,
          hasFile: true,
        })
        setRemoveWithFileDialogOpen(true)
      } else {
        // Revert on error
        setSeasonDetails((prev) => ({
          ...prev,
          [seasonNumber]: {
            ...prev[seasonNumber],
            episodes: prev[seasonNumber].episodes.map((ep) =>
              ep.id === episodeId ? { ...ep, requested: currentlyRequested } : ep
            ),
          },
        }))
        toast.error(data.error || 'Failed to update episode')
      }
    } catch (error) {
      console.error('Failed to update episode:', error)
      // Revert on error
      setSeasonDetails((prev) => ({
        ...prev,
        [seasonNumber]: {
          ...prev[seasonNumber],
          episodes: prev[seasonNumber].episodes.map((ep) =>
            ep.id === episodeId ? { ...ep, requested: currentlyRequested } : ep
          ),
        },
      }))
      toast.error('Failed to update episode')
    } finally {
      setTogglingEpisodes((prev) => {
        const next = new Set(prev)
        next.delete(episodeId)
        return next
      })
    }
  }

  const removeEpisodeWithFile = async () => {
    if (!episodeToRemove) return

    setRemovingWithFile(true)
    try {
      const response = await fetch(
        `/api/v1/tvshows/${showId}/episodes/${episodeToRemove.id}?deleteFile=true`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        toast.success('Episode and files removed from library')
        setRemoveWithFileDialogOpen(false)
        setEpisodeToRemove(null)
        fetchShow()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to remove episode')
      }
    } catch (error) {
      console.error('Failed to remove episode:', error)
      toast.error('Failed to remove episode')
    } finally {
      setRemovingWithFile(false)
    }
  }

  const deleteEpisodeFile = async () => {
    if (!selectedEpisodeForDelete) return

    setDeletingFile(true)
    try {
      const response = await fetch(
        `/api/v1/tvshows/${showId}/episodes/${selectedEpisodeForDelete.id}/file`,
        { method: 'DELETE' }
      )
      if (response.ok) {
        toast.success('Episode file deleted successfully')
        // Update local state
        setSeasonDetails((prev) => ({
          ...prev,
          [selectedEpisodeForDelete.seasonNumber]: {
            ...prev[selectedEpisodeForDelete.seasonNumber],
            episodes: prev[selectedEpisodeForDelete.seasonNumber].episodes.map((ep) =>
              ep.id === selectedEpisodeForDelete.id
                ? { ...ep, hasFile: false, episodeFile: null }
                : ep
            ),
          },
        }))
        // Refresh show to update season counts
        fetchShow()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete file')
      }
    } catch (error) {
      console.error('Failed to delete episode file:', error)
      toast.error('Failed to delete file')
    } finally {
      setDeletingFile(false)
      setDeleteFileDialogOpen(false)
      setSelectedEpisodeForDelete(null)
    }
  }

  const enrichTvShow = async () => {
    if (!show) return

    setEnriching(true)
    try {
      const response = await fetch(`/api/v1/tvshows/${showId}/enrich`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.enriched) {
          toast.success(`TV show enriched with TMDB data (${data.seasonsEnriched} seasons updated)`)
          fetchShow()
        } else {
          toast.warning(data.message || 'No matching TV show found')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to enrich')
      }
    } catch (error) {
      console.error('Failed to enrich TV show:', error)
      toast.error('Failed to enrich TV show')
    } finally {
      setEnriching(false)
    }
  }

  const refreshTvShow = async () => {
    if (!show) return

    setRefreshing(true)
    try {
      const response = await fetch(`/api/v1/tvshows/${showId}/refresh`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        const messages = []
        if (data.seasonsCreated > 0) messages.push(`${data.seasonsCreated} seasons added`)
        if (data.episodesCreated > 0) messages.push(`${data.episodesCreated} episodes added`)
        if (messages.length > 0) {
          toast.success(`Refreshed: ${messages.join(', ')}`)
        } else {
          toast.success('Metadata refreshed (no new episodes)')
        }
        fetchShow()
        // Clear cached season details to force refetch
        setSeasonDetails({})
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to refresh')
      }
    } catch (error) {
      console.error('Failed to refresh TV show:', error)
      toast.error('Failed to refresh TV show')
    } finally {
      setRefreshing(false)
    }
  }

  const requestAllSeasons = async () => {
    if (!show) return

    const seasonsToRequest = show.seasons.filter((s) => !s.requested)
    if (seasonsToRequest.length === 0) {
      toast.info('All seasons are already requested')
      return
    }

    // Optimistically update UI
    setShow({
      ...show,
      seasons: show.seasons.map((s) => ({ ...s, requested: true })),
    })

    setRequestingAllSeasons(true)

    try {
      // Request all seasons in parallel
      const results = await Promise.all(
        seasonsToRequest.map((season) =>
          fetch(`/api/v1/tvshows/${showId}/season/${season.seasonNumber}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requested: true }),
          })
        )
      )

      const failedCount = results.filter((r) => !r.ok).length
      if (failedCount === 0) {
        toast.success(`Requested ${seasonsToRequest.length} seasons`)
        fetchShow() // Refresh to get updated counts
      } else if (failedCount < seasonsToRequest.length) {
        toast.warning(
          `Requested ${seasonsToRequest.length - failedCount} seasons, ${failedCount} failed`
        )
        fetchShow()
      } else {
        toast.error('Failed to request seasons')
        fetchShow() // Revert
      }
    } catch (error) {
      console.error('Failed to request all seasons:', error)
      toast.error('Failed to request seasons')
      fetchShow()
    } finally {
      setRequestingAllSeasons(false)
    }
  }

  if (loading) {
    return (
      <AppLayout title="Loading...">
        <Head title="Loading..." />
        <div className="space-y-6">
          <div className="flex gap-6">
            <Skeleton className="h-72 w-48 rounded-lg" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!show) {
    return (
      <AppLayout title="Not Found">
        <Head title="Not Found" />
        <div className="text-center py-12">
          <p className="text-muted-foreground">TV show not found</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={show.title}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link href="/library?tab=tv">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Back</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={toggleMonitored}>
            <HugeiconsIcon
              icon={show.monitored ? Notification01Icon : NotificationOff01Icon}
              className="h-4 w-4 md:mr-2"
            />
            <span className="hidden md:inline">{show.monitored ? 'Monitored' : 'Monitor'}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!show.tmdbId && (
                <DropdownMenuItem onClick={enrichTvShow} disabled={enriching}>
                  <HugeiconsIcon
                    icon={Add01Icon}
                    className={`h-4 w-4 mr-2 ${enriching ? 'animate-spin' : ''}`}
                  />
                  {enriching ? 'Enriching...' : 'Enrich from TMDB'}
                </DropdownMenuItem>
              )}
              {show.tmdbId && (
                <DropdownMenuItem onClick={refreshTvShow} disabled={refreshing}>
                  <HugeiconsIcon
                    icon={Refresh01Icon}
                    className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
                  />
                  {refreshing ? 'Refreshing...' : 'Refresh from TMDB'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 mr-2" />
                Remove from Library
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <Head title={show.title} />

      <div className="space-y-6">
        <MediaHero
          trailerUrl={show.trailerUrl}
          images={show.backdropImages?.length ? show.backdropImages : show.backdropUrl ? [show.backdropUrl] : undefined}
          title={show.title}
          posterUrl={show.posterUrl}
          posterFallback={<HugeiconsIcon icon={Tv01Icon} className="h-16 w-16 text-muted-foreground/50" />}
          overview={show.overview}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{show.title}</h1>
              {show.year && <span className="text-muted-foreground">({show.year})</span>}
            </div>
            {show.originalTitle && show.originalTitle !== show.title && (
              <p className="text-muted-foreground">{show.originalTitle}</p>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {show.status && <Badge variant="outline">{show.status}</Badge>}
            {show.network && <Badge variant="outline">{show.network}</Badge>}
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {show.firstAired && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4" />
                {show.firstAired}
              </div>
            )}
            {show.rating && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={StarIcon} className="h-4 w-4" />
                {show.rating.toFixed(1)}
              </div>
            )}
            <div className="text-muted-foreground">
              {show.seasonCount} seasons · {show.episodeCount} episodes
            </div>
          </div>

          {/* Genres */}
          {show.genres && show.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {show.genres.slice(0, 5).map((genre, i) => (
                <Badge key={i} variant="outline">
                  {genre}
                </Badge>
              ))}
            </div>
          )}

          {/* Quality and folder info */}
          <div className="flex flex-wrap gap-2 text-sm">
            {show.qualityProfile && <Badge variant="secondary">{show.qualityProfile.name}</Badge>}
            {show.rootFolder && <Badge variant="secondary">{show.rootFolder.path}</Badge>}
          </div>

          {/* External links */}
          {show.tmdbId && (
            <div className="text-sm">
              <a
                href={`https://www.themoviedb.org/tv/${show.tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                TMDB
              </a>
            </div>
          )}
        </MediaHero>

        {/* Seasons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Seasons</h2>
              {show.seasons.some((s) => !s.requested) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestAllSeasons}
                  disabled={requestingAllSeasons}
                >
                  {requestingAllSeasons ? (
                    <>
                      <Spinner className="mr-2" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
                      Request All
                    </>
                  )}
                </Button>
              )}
            </div>
            {show.seasons.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No seasons found</p>
            ) : (
              <div className="space-y-2">
                {show.seasons.map((season) => (
                  <div key={season.id} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSeason(season.seasonNumber)}
                      className="flex items-center gap-4 w-full p-4 hover:bg-muted/50 transition-colors text-left"
                    >
                      {season.posterUrl ? (
                        <img
                          src={season.posterUrl}
                          alt={season.title}
                          className="h-16 w-12 rounded object-cover"
                        />
                      ) : (
                        <div className="h-16 w-12 rounded bg-muted flex items-center justify-center">
                          <HugeiconsIcon
                            icon={Tv01Icon}
                            className="h-6 w-6 text-muted-foreground"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{season.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <span>{season.episodeCount} episodes</span>
                          {(season.downloadedCount > 0 ||
                            season.downloadingCount > 0 ||
                            season.requestedCount > 0) && (
                            <span className="text-muted-foreground/50 hidden sm:inline">•</span>
                          )}
                          {season.downloadedCount > 0 && (
                            <span className="text-green-600 font-medium">
                              {season.downloadedCount} downloaded
                            </span>
                          )}
                          {season.downloadingCount > 0 && (
                            <span className="text-blue-600 font-medium">
                              {season.downloadingCount} downloading
                            </span>
                          )}
                          {season.requestedCount > 0 && (
                            <span className="text-yellow-600 font-medium">
                              {season.requestedCount} requested
                            </span>
                          )}
                        </div>
                      </div>
                      {togglingSeasons.has(season.seasonNumber) ? (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          <Spinner className="size-3 mr-1" />
                          {season.requested ? 'Requesting...' : 'Unrequesting...'}
                        </Badge>
                      ) : season.requested ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="cursor-pointer bg-yellow-600 hover:bg-destructive text-white transition-colors group"
                                onClick={(e) => toggleSeasonRequested(season.seasonNumber, true, e)}
                              >
                                <span className="group-hover:hidden">Requested</span>
                                <span className="hidden group-hover:inline">Unrequest</span>
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Click to unrequest</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => toggleSeasonRequested(season.seasonNumber, false, e)}
                        >
                          <HugeiconsIcon icon={Add01Icon} className="h-3 w-3 mr-1" />
                          Request
                        </Button>
                      )}
                      <HugeiconsIcon
                        icon={
                          expandedSeason === season.seasonNumber ? ArrowUp01Icon : ArrowDown01Icon
                        }
                        className="h-5 w-5 text-muted-foreground"
                      />
                    </button>
                    {expandedSeason === season.seasonNumber && (
                      <div className="border-t p-4">
                        {loadingSeasons.has(season.seasonNumber) ? (
                          <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <Skeleton key={i} className="h-12 w-full" />
                            ))}
                          </div>
                        ) : seasonDetails[season.seasonNumber] ? (
                          <div className="space-y-2">
                            {seasonDetails[season.seasonNumber].episodes.map((episode) => (
                              <div
                                key={episode.id}
                                className="flex items-center gap-2 sm:gap-4 p-3 rounded-lg bg-muted/50"
                              >
                                <div className="w-6 sm:w-8 text-center font-mono text-muted-foreground text-sm sm:text-base flex-shrink-0">
                                  {episode.episodeNumber}
                                </div>
                                {episode.stillUrl ? (
                                  <img
                                    src={episode.stillUrl}
                                    alt={episode.title}
                                    className="h-12 w-20 rounded object-cover hidden sm:block"
                                  />
                                ) : (
                                  <div className="h-12 w-20 rounded bg-muted hidden sm:block" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{episode.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {episode.airDate || 'TBA'}
                                    {episode.runtime && ` • ${episode.runtime}m`}
                                  </p>
                                  {episode.episodeFile && (
                                    <p className="text-xs text-muted-foreground/70 truncate">
                                      {episode.episodeFile.path}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                  {(() => {
                                    const { status, progress } = getEpisodeStatus(episode)

                                    // Downloaded: Show status badge + file action buttons
                                    if (status === 'downloaded') {
                                      return (
                                        <>
                                          <MediaStatusBadge status="downloaded" size="sm" />
                                          {episode.episodeFile && (
                                            <>
                                              <Button
                                                variant="default"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => {
                                                  audioPlayer.pause()
                                                  setPlayingEpisode({
                                                    id: episode.id,
                                                    fileId: episode.episodeFile!.id,
                                                    title: `S${season.seasonNumber.toString().padStart(2, '0')}E${episode.episodeNumber.toString().padStart(2, '0')} - ${episode.title}`,
                                                  })
                                                  setVideoPlayerOpen(true)
                                                }}
                                              >
                                                <HugeiconsIcon
                                                  icon={PlayIcon}
                                                  className="h-3.5 w-3.5"
                                                />
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7"
                                                asChild
                                              >
                                                <a href={episode.episodeFile.downloadUrl} download>
                                                  <HugeiconsIcon
                                                    icon={FileDownloadIcon}
                                                    className="h-3.5 w-3.5"
                                                  />
                                                </a>
                                              </Button>
                                            </>
                                          )}
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => {
                                              setSelectedEpisodeForDelete({
                                                id: episode.id,
                                                title: episode.title,
                                                seasonNumber: season.seasonNumber,
                                              })
                                              setDeleteFileDialogOpen(true)
                                            }}
                                          >
                                            <HugeiconsIcon
                                              icon={Delete01Icon}
                                              className="h-3.5 w-3.5"
                                            />
                                          </Button>
                                        </>
                                      )
                                    }

                                    // All other statuses: Use unified MediaStatusBadge
                                    return (
                                      <MediaStatusBadge
                                        status={status}
                                        progress={progress}
                                        isToggling={togglingEpisodes.has(episode.id)}
                                        onToggleRequest={() =>
                                          toggleEpisodeRequested(
                                            episode.id,
                                            episode.requested,
                                            season.seasonNumber,
                                            episode.hasFile,
                                            episode.title || `Episode ${episode.episodeNumber}`
                                          )
                                        }
                                      />
                                    )
                                  })()}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {show.tmdbId && (
          <SimilarLane mediaType="tv" mediaId={show.id} tmdbId={show.tmdbId} />
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {show.title}?</DialogTitle>
            <DialogDescription>
              This will remove the TV show and all seasons/episodes from your library. Files on disk
              will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteShow} disabled={deleting}>
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete episode file confirmation dialog */}
      <Dialog
        open={deleteFileDialogOpen}
        onOpenChange={(open) => {
          setDeleteFileDialogOpen(open)
          if (!open) setSelectedEpisodeForDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete episode file?</DialogTitle>
            <DialogDescription>
              This will permanently delete the file for "{selectedEpisodeForDelete?.title}" from
              disk. The episode will remain in your library but will need to be downloaded again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteEpisodeFile} disabled={deletingFile}>
              {deletingFile ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete File'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove episode with file confirmation dialog */}
      <Dialog
        open={removeWithFileDialogOpen}
        onOpenChange={(open) => {
          setRemoveWithFileDialogOpen(open)
          if (!open) setEpisodeToRemove(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from library?</DialogTitle>
            <DialogDescription>
              "{episodeToRemove?.title}" has downloaded files. This will permanently delete the
              files from disk and remove the episode from your library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveWithFileDialogOpen(false)
                setEpisodeToRemove(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeEpisodeWithFile}
              disabled={removingWithFile}
            >
              {removingWithFile ? (
                <>
                  <Spinner className="mr-2" />
                  Removing...
                </>
              ) : (
                'Delete Files & Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video player dialog */}
      <Dialog
        open={videoPlayerOpen}
        onOpenChange={(open) => {
          setVideoPlayerOpen(open)
          if (!open) setPlayingEpisode(null)
        }}
      >
        <DialogContent className="max-w-6xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>
              {show?.title} - {playingEpisode?.title}
            </DialogTitle>
          </DialogHeader>
          {playingEpisode && videoPlayerOpen && (
            <VideoPlayer
              mediaType="episode"
              mediaFileId={playingEpisode.fileId}
              title={`${show?.title} - ${playingEpisode.title}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
