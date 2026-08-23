import { Head, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  MoreVerticalIcon,
  Delete01Icon,
  Tv01Icon,
  Calendar01Icon,
  StarIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  FileDownloadIcon,
  Search01Icon,
  Add01Icon,
  PlayIcon,
  Refresh01Icon,
  Notification01Icon,
  NotificationOff01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useOperationTrackerContext } from '@/hooks/use_operation_tracker'
import { MediaStatusBadge, type MediaItemStatus } from '@/components/library/media-status-badge'
import { MediaHero } from '@/components/media-hero'
import { SimilarLane } from '@/components/library/similar-lane'
import { DownloadProgressCard } from '@/components/library/download-progress-card'
import { useActiveDownloads, type ActiveDownloadInfo } from '@/hooks/use_active_downloads'
import { useAudioPlayer } from '@/contexts/audio_player_context'
import { VideoPlayer } from '@/components/player/video_player'
import { DeleteMediaDialog } from '@/components/library/delete-media-dialog'
import { DownloadClientIndicator } from '@/components/library/download-client-indicator'
import { useDownloadClients } from '@/hooks/use_download_clients'

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

interface SearchResult {
  id: string
  title: string
  indexer: string
  indexerId: number
  size: number
  publishDate: string
  downloadUrl: string
  quality?: string
  seeders?: number
  grabs?: number
  protocol: string
}

export default function TvShowDetail() {
  const { url } = usePage()
  const showId = url.split('/').pop()

  const [show, setShow] = useState<TvShow | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [seasonDetails, setSeasonDetails] = useState<Record<number, SeasonDetail>>({})
  const [loadingSeasons, setLoadingSeasons] = useState<Set<number>>(new Set())
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null)
  const { getForTvShow } = useActiveDownloads()
  const activeDownloads = showId ? getForTvShow(showId) : new Map<string, ActiveDownloadInfo>()
  const [togglingSeasons, setTogglingSeasons] = useState<Set<number>>(new Set())
  const [togglingEpisodes, setTogglingEpisodes] = useState<Set<number>>(new Set())
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false)
  const [selectedEpisodeForDelete, setSelectedEpisodeForDelete] = useState<{
    id: number
    title: string
    seasonNumber: number
  } | null>(null)
  const [requestingAllSeasons, setRequestingAllSeasons] = useState(false)
  const { runBulk } = useOperationTrackerContext()
  const [enriching, setEnriching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [episodeSearchResults, setEpisodeSearchResults] = useState<Record<number, SearchResult[]>>(
    {}
  )
  const [searchingEpisode, setSearchingEpisode] = useState<number | null>(null)
  const [grabbingRelease, setGrabbingRelease] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const { clients: downloadClients } = useDownloadClients()
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [grabbing, setGrabbing] = useState<string | null>(null)
  const [releasePickerOpen, setReleasePickerOpen] = useState(false)
  const [releasePickerTitle, setReleasePickerTitle] = useState('')
  const [releasePickerEpisodeId, setReleasePickerEpisodeId] = useState<number | null>(null)
  const [playingEpisode, setPlayingEpisode] = useState<{
    id: number
    fileId: number
    title: string
  } | null>(null)
  const audioPlayer = useAudioPlayer()
  const EPISODES_PAGE_SIZE = 50
  const [episodeVisibleCounts, setEpisodeVisibleCounts] = useState<Record<number, number>>({})

  const getVisibleEpisodes = useCallback(
    (seasonNumber: number) => {
      const details = seasonDetails[seasonNumber]
      if (!details) return []
      const limit = episodeVisibleCounts[seasonNumber] ?? EPISODES_PAGE_SIZE
      return details.episodes.slice(0, limit)
    },
    [seasonDetails, episodeVisibleCounts]
  )

  const hasMoreEpisodes = useCallback(
    (seasonNumber: number) => {
      const details = seasonDetails[seasonNumber]
      if (!details) return false
      const limit = episodeVisibleCounts[seasonNumber] ?? EPISODES_PAGE_SIZE
      return details.episodes.length > limit
    },
    [seasonDetails, episodeVisibleCounts]
  )

  const showMoreEpisodes = useCallback((seasonNumber: number) => {
    setEpisodeVisibleCounts((prev) => ({
      ...prev,
      [seasonNumber]: (prev[seasonNumber] ?? EPISODES_PAGE_SIZE) + EPISODES_PAGE_SIZE,
    }))
  }, [])

  useEffect(() => {
    fetchShow()
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
    const response = await fetch(`/api/v1/tvshows/${showId}`, { method: 'DELETE' })
    if (response.ok) {
      toast.success('TV show deleted')
      router.visit('/library?tab=tv')
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to delete')
    }
    setDeleteDialogOpen(false)
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
        toast.success(currentlyRequested ? 'Season unrequested' : 'Season requested')
        fetchShow()
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

  // Requesting is purely about wantedness. Unrequesting an episode that already
  // has a file just marks it unwanted and leaves the file alone — use the
  // per-episode delete button to remove a file.
  const toggleEpisodeRequested = async (
    episodeId: number,
    currentlyRequested: boolean,
    seasonNumber: number
  ) => {
    if (!show) return

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
        toast.success(currentlyRequested ? 'Episode unrequested' : 'Episode requested')
        fetchShow()
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

  const deleteEpisodeFile = async () => {
    if (!selectedEpisodeForDelete) return

    const response = await fetch(
      `/api/v1/tvshows/${showId}/episodes/${selectedEpisodeForDelete.id}/file`,
      { method: 'DELETE' }
    )
    if (response.ok) {
      toast.success('Episode file deleted successfully')
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
      fetchShow()
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to delete file')
    }
    setDeleteFileDialogOpen(false)
    setSelectedEpisodeForDelete(null)
  }

  const refreshMetadata = async () => {
    if (!show) return

    if (show.tmdbId) {
      // Already linked - refresh
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
    } else {
      // No TMDB ID - enrich
      setEnriching(true)
      try {
        const response = await fetch(`/api/v1/tvshows/${showId}/enrich`, {
          method: 'POST',
        })
        if (response.ok) {
          const data = await response.json()
          if (data.enriched) {
            toast.success(
              `TV show enriched with TMDB data (${data.seasonsEnriched} seasons updated)`
            )
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
  }

  const searchReleases = async () => {
    if (!show) return
    setSearching(true)
    setReleasePickerTitle(show.title)
    setReleasePickerEpisodeId(null)
    setReleasePickerOpen(true)
    try {
      const response = await fetch(`/api/v1/tvshows/${showId}/releases`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        toast.error('Failed to search releases')
      }
    } catch (error) {
      console.error('Failed to search releases:', error)
      toast.error('Failed to search releases')
    } finally {
      setSearching(false)
    }
  }

  const searchEpisodeReleases = async (episodeId: number, episodeLabel: string) => {
    setSearching(true)
    setReleasePickerTitle(episodeLabel)
    setReleasePickerEpisodeId(episodeId)
    setReleasePickerOpen(true)
    try {
      const response = await fetch(`/api/v1/tvshows/${showId}/episodes/${episodeId}/releases`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        toast.error('Failed to search releases')
      }
    } catch (error) {
      console.error('Failed to search releases:', error)
      toast.error('Failed to search releases')
    } finally {
      setSearching(false)
    }
  }

  const grabRelease = async (result: SearchResult) => {
    setGrabbing(result.id)
    try {
      const response = await fetch('/api/v1/queue/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.title,
          downloadUrl: result.downloadUrl,
          size: result.size,
          tvShowId: show?.id,
          ...(releasePickerEpisodeId ? { episodeId: releasePickerEpisodeId } : {}),
          indexerId: result.indexerId,
          indexerName: result.indexer,
          guid: result.id,
          replaceExisting: true,
          ...(selectedClientId && { downloadClientId: selectedClientId }),
        }),
      })
      if (response.ok) {
        toast.success('Download started')
        setReleasePickerOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to grab release')
      }
    } catch (error) {
      console.error('Failed to grab release:', error)
      toast.error('Failed to grab release')
    } finally {
      setGrabbing(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
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
      const results = await runBulk(
        `Requesting ${seasonsToRequest.length} seasons`,
        seasonsToRequest.map((season) => ({
          id: String(season.seasonNumber),
          label: `Season ${season.seasonNumber}`,
          execute: async () => {
            const res = await fetch(
              `/api/v1/tvshows/${showId}/season/${season.seasonNumber}/request`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requested: true }),
              }
            )
            if (!res.ok) throw new Error('Request failed')
            return res.json()
          },
        }))
      )

      const failedCount = results.filter((r) => r.status === 'error').length
      if (failedCount === 0) {
        toast.success(`Requested ${seasonsToRequest.length} seasons`)
        fetchShow()
      } else if (failedCount < seasonsToRequest.length) {
        toast.warning(
          `Requested ${seasonsToRequest.length - failedCount} seasons, ${failedCount} failed`
        )
        fetchShow()
      } else {
        toast.error('Failed to request seasons')
        fetchShow()
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
          <div className="flex gap-4 md:gap-6">
            <Skeleton className="w-28 sm:w-40 md:w-48 aspect-[2/3] rounded-lg shrink-0" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
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
        <EmptyState
          icon={<HugeiconsIcon icon={Tv01Icon} />}
          title="TV show not found"
          message="This show is no longer in your library — it may have been removed. Head back to the TV library to pick another."
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={show.title}
      headerPrefix={<Breadcrumbs items={[{ label: 'TV Shows', href: '/library?tab=tv' }]} />}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={toggleMonitored} aria-pressed={show.monitored}>
                  <HugeiconsIcon
                    icon={show.monitored ? Notification01Icon : NotificationOff01Icon}
                    className="h-4 w-4"
                  />
                  <span className="hidden md:inline">
                    {show.monitored ? 'Monitored' : 'Monitor'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{show.monitored ? 'Monitored' : 'Monitor'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={searchReleases} disabled={searching}>
                  {searching ? (
                    <Spinner />
                  ) : (
                    <HugeiconsIcon icon={Search01Icon} className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">
                    {searching ? 'Searching...' : 'Browse releases'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{searching ? 'Searching...' : 'Browse releases'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!show.tmdbId && (
                <DropdownMenuItem onClick={refreshMetadata} disabled={enriching}>
                  <HugeiconsIcon
                    icon={Search01Icon}
                    className={`h-4 w-4 ${enriching ? 'animate-spin' : ''}`}
                  />
                  {enriching ? 'Enriching...' : 'Enrich from TMDB'}
                </DropdownMenuItem>
              )}
              {show.tmdbId && (
                <DropdownMenuItem onClick={refreshMetadata} disabled={refreshing}>
                  <HugeiconsIcon
                    icon={Refresh01Icon}
                    className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                  />
                  {refreshing ? 'Refreshing...' : 'Refresh metadata'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
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
          images={
            show.backdropImages?.length
              ? show.backdropImages
              : show.backdropUrl
                ? [show.backdropUrl]
                : undefined
          }
          title={show.title}
          posterUrl={show.posterUrl}
          posterFallback={
            <HugeiconsIcon icon={Tv01Icon} className="h-16 w-16 text-muted-foreground/50" />
          }
          overview={show.overview}
        >
          <div>
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold tracking-[-0.01em]">{show.title}</h1>
              {show.year && (
                <span className="readout text-sm text-muted-foreground">({show.year})</span>
              )}
            </div>
            {show.originalTitle && show.originalTitle !== show.title && (
              <p className="text-sm text-muted-foreground">{show.originalTitle}</p>
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
                <span className="readout">{show.firstAired}</span>
              </div>
            )}
            {show.rating && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={StarIcon} className="h-4 w-4" />
                <span className="readout">{show.rating.toFixed(1)}</span>
              </div>
            )}
            <div className="text-muted-foreground">
              <span className="readout">{show.seasonCount}</span> seasons ·{' '}
              <span className="readout">{show.episodeCount}</span> episodes
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

          {/* Quality, download client, and folder info */}
          <div className="flex flex-wrap gap-2 text-sm">
            {show.qualityProfile && <Badge variant="secondary">{show.qualityProfile.name}</Badge>}
            <DownloadClientIndicator
              clients={downloadClients}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
            />
            {show.rootFolder && (
              <Badge variant="secondary" className="readout">
                {show.rootFolder.path}
              </Badge>
            )}
          </div>

          {/* External links */}
          {show.tmdbId && (
            <div className="flex gap-4 text-xs">
              <a
                href={`https://www.themoviedb.org/tv/${show.tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                TMDB
              </a>
            </div>
          )}
        </MediaHero>

        {activeDownloads.size > 0 && (
          <DownloadProgressCard downloads={Array.from(activeDownloads.values())} />
        )}

        {/* Seasons */}
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Seasons</h2>
              {show.seasons.some((s) => !s.requested) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestAllSeasons}
                  disabled={requestingAllSeasons}
                >
                  {requestingAllSeasons ? (
                    <>
                      <Spinner />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
                      Request All
                    </>
                  )}
                </Button>
              )}
            </div>
            {show.seasons.length === 0 ? (
              <EmptyState
                icon={<HugeiconsIcon icon={Tv01Icon} />}
                title="No seasons found"
                message="TMDB has not returned season data for this show. Run Refresh metadata from the actions menu to fetch it again."
              />
            ) : (
              <div className="space-y-2">
                {show.seasons.map((season) => (
                  <div key={season.id} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSeason(season.seasonNumber)}
                      aria-expanded={expandedSeason === season.seasonNumber}
                      className="flex items-center gap-4 w-full p-4 hover:bg-accent transition-colors duration-150 text-left outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-inset"
                    >
                      {season.posterUrl ? (
                        <img
                          src={season.posterUrl}
                          alt={season.title}
                          className="h-16 w-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-16 w-12 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                          <HugeiconsIcon
                            icon={Tv01Icon}
                            className="h-6 w-6 text-muted-foreground"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{season.title}</p>
                        {/* Tally: the dot carries the status colour, the word carries the
                            label, so no state is signalled by colour alone. */}
                        <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap">
                          <span>
                            <span className="readout">{season.episodeCount}</span> episodes
                          </span>
                          {season.downloadedCount > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="size-1.5 rounded-full bg-status-complete"
                                aria-hidden="true"
                              />
                              <span className="readout">{season.downloadedCount}</span> downloaded
                            </span>
                          )}
                          {season.downloadingCount > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="size-1.5 rounded-full bg-status-transfer"
                                aria-hidden="true"
                              />
                              <span className="readout">{season.downloadingCount}</span> downloading
                            </span>
                          )}
                          {season.requestedCount > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="size-1.5 rounded-full bg-status-queued"
                                aria-hidden="true"
                              />
                              <span className="readout">{season.requestedCount}</span> requested
                            </span>
                          )}
                        </div>
                      </div>
                      <MediaStatusBadge
                        status={season.requested ? 'requested' : 'none'}
                        isToggling={togglingSeasons.has(season.seasonNumber)}
                        onToggleRequest={() => {
                          const syntheticEvent = { stopPropagation: () => {} } as React.MouseEvent
                          toggleSeasonRequested(
                            season.seasonNumber,
                            season.requested,
                            syntheticEvent
                          )
                        }}
                      />
                      <HugeiconsIcon
                        icon={
                          expandedSeason === season.seasonNumber ? ArrowUp01Icon : ArrowDown01Icon
                        }
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                      />
                    </button>
                    {expandedSeason === season.seasonNumber && (
                      <div className="border-t border-border px-4">
                        {loadingSeasons.has(season.seasonNumber) ? (
                          <div className="space-y-2 py-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <Skeleton key={i} className="h-12 w-full" />
                            ))}
                          </div>
                        ) : seasonDetails[season.seasonNumber] ? (
                          seasonDetails[season.seasonNumber].episodes.length === 0 ? (
                            <EmptyState
                              title="No episodes found"
                              message="TMDB has not published an episode list for this season yet. Run Refresh metadata once it does."
                              className="py-8"
                            />
                          ) : (
                            <div className="divide-y divide-border">
                              {getVisibleEpisodes(season.seasonNumber).map((episode) => (
                                <div
                                  key={episode.id}
                                  role="group"
                                  aria-label={`Episode ${episode.episodeNumber}: ${episode.title}`}
                                  className="flex items-center gap-3 sm:gap-4 py-3 transition-colors duration-150 hover:bg-accent"
                                >
                                  <div className="readout w-6 sm:w-8 shrink-0 text-right text-xs text-muted-foreground">
                                    {episode.episodeNumber}
                                  </div>
                                  {episode.stillUrl ? (
                                    <img
                                      src={episode.stillUrl}
                                      alt={episode.title}
                                      className="h-12 w-20 shrink-0 rounded-lg object-cover hidden sm:block"
                                    />
                                  ) : (
                                    <div className="h-12 w-20 shrink-0 rounded-lg bg-muted hidden sm:block" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{episode.title}</p>
                                    <p className="readout text-xs text-muted-foreground">
                                      {episode.airDate || 'TBA'}
                                      {episode.runtime && ` • ${episode.runtime}m`}
                                    </p>
                                    {episode.episodeFile && (
                                      <p className="readout text-xs text-muted-foreground truncate">
                                        {episode.episodeFile.path}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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
                                                  size="icon-sm"
                                                  aria-label={`Play episode ${episode.episodeNumber}`}
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
                                                    className="h-4 w-4"
                                                  />
                                                </Button>
                                                <Button
                                                  variant="outline"
                                                  size="icon-sm"
                                                  asChild
                                                  aria-label={`Download episode ${episode.episodeNumber}`}
                                                >
                                                  <a
                                                    href={episode.episodeFile.downloadUrl}
                                                    download
                                                  >
                                                    <HugeiconsIcon
                                                      icon={FileDownloadIcon}
                                                      className="h-4 w-4"
                                                    />
                                                  </a>
                                                </Button>
                                              </>
                                            )}
                                            <Button
                                              variant="outline"
                                              size="icon-sm"
                                              className="text-destructive hover:text-destructive"
                                              aria-label={`Delete file for episode ${episode.episodeNumber}`}
                                              onClick={() => {
                                                const epId = episode.id
                                                const epSeasonNumber = season.seasonNumber
                                                setSelectedEpisodeForDelete({
                                                  id: epId,
                                                  title: episode.title,
                                                  seasonNumber: epSeasonNumber,
                                                })
                                                setDeleteFileDialogOpen(true)
                                              }}
                                            >
                                              <HugeiconsIcon
                                                icon={Delete01Icon}
                                                className="h-4 w-4"
                                              />
                                            </Button>
                                          </>
                                        )
                                      }

                                      // All other statuses: Use unified MediaStatusBadge + manual search
                                      return (
                                        <>
                                          {(status === 'requested' || status === 'none') && (
                                            <Button
                                              variant="outline"
                                              size="icon-sm"
                                              aria-label={`Search releases for episode ${episode.episodeNumber}`}
                                              onClick={() =>
                                                searchEpisodeReleases(
                                                  episode.id,
                                                  `${show.title} - S${season.seasonNumber.toString().padStart(2, '0')}E${episode.episodeNumber.toString().padStart(2, '0')} - ${episode.title}`
                                                )
                                              }
                                            >
                                              <HugeiconsIcon
                                                icon={Search01Icon}
                                                className="h-4 w-4"
                                              />
                                            </Button>
                                          )}
                                          <MediaStatusBadge
                                            status={status}
                                            progress={progress}
                                            isToggling={togglingEpisodes.has(episode.id)}
                                            onToggleRequest={() =>
                                              toggleEpisodeRequested(
                                                episode.id,
                                                episode.requested,
                                                season.seasonNumber
                                              )
                                            }
                                          />
                                        </>
                                      )
                                    })()}
                                  </div>
                                </div>
                              ))}
                              {hasMoreEpisodes(season.seasonNumber) && (
                                <div className="flex justify-center py-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      showMoreEpisodes(season.seasonNumber)
                                    }}
                                  >
                                    Show more (
                                    <span className="readout">
                                      {getVisibleEpisodes(season.seasonNumber).length}
                                    </span>{' '}
                                    of{' '}
                                    <span className="readout">
                                      {seasonDetails[season.seasonNumber].episodes.length}
                                    </span>
                                    )
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {show.tmdbId && <SimilarLane mediaType="tv" mediaId={show.id} tmdbId={show.tmdbId} />}
      </div>

      <DeleteMediaDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={show.title}
        mediaType="TV show"
        hasFile={false}
        mode="remove"
        onConfirm={deleteShow}
      />

      <DeleteMediaDialog
        open={deleteFileDialogOpen}
        onOpenChange={(open) => {
          setDeleteFileDialogOpen(open)
          if (!open) setSelectedEpisodeForDelete(null)
        }}
        title={selectedEpisodeForDelete?.title || 'Episode'}
        mediaType="episode"
        hasFile={true}
        mode="deleteFile"
        onConfirm={deleteEpisodeFile}
      />

      {/* Release picker dialog */}
      <Dialog open={releasePickerOpen} onOpenChange={setReleasePickerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manual Search</DialogTitle>
            <DialogDescription>{releasePickerTitle}</DialogDescription>
          </DialogHeader>
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
              <span className="ml-3 text-muted-foreground">Searching indexers...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <EmptyState
              icon={<HugeiconsIcon icon={Search01Icon} />}
              title="No releases found"
              message="Your indexers returned nothing for this title. Check that the indexers are enabled and healthy in Settings, or widen the quality profile."
            />
          ) : (
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Release</TableHead>
                    <TableHead className="w-32">Indexer</TableHead>
                    <TableHead className="w-24">Quality</TableHead>
                    <TableHead className="w-24" data-numeric>
                      Size
                    </TableHead>
                    <TableHead className="w-20" data-numeric>
                      Grabs
                    </TableHead>
                    <TableHead className="w-16">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="readout max-w-md truncate">{result.title}</TableCell>
                      <TableCell className="readout text-muted-foreground">
                        {result.indexer}
                      </TableCell>
                      <TableCell>
                        {result.quality && <Badge variant="outline">{result.quality}</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-numeric>
                        {formatFileSize(result.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-numeric>
                        {result.grabs ?? result.seeders ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          onClick={() => grabRelease(result)}
                          disabled={grabbing === result.id}
                          aria-label={`Download ${result.title}`}
                        >
                          {grabbing === result.id ? (
                            <Spinner />
                          ) : (
                            <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
