import { Head, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  MoreVerticalIcon,
  Delete01Icon,
  Film01Icon,
  Calendar01Icon,
  Search01Icon,
  Time01Icon,
  StarIcon,
  FileDownloadIcon,
  PlayIcon,
  Notification01Icon,
  NotificationOff01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { MediaStatusBadge, getMediaItemStatus } from '@/components/library/media-status-badge'
import { MediaHero } from '@/components/media-hero'
import { SimilarLane } from '@/components/library/similar-lane'
import { DownloadProgressCard } from '@/components/library/download-progress-card'
import { useActiveDownloads } from '@/hooks/use_active_downloads'
import { useAudioPlayer } from '@/contexts/audio_player_context'
import { DeleteMediaDialog } from '@/components/library/delete-media-dialog'
import { DownloadClientIndicator } from '@/components/library/download-client-indicator'
import { useDownloadClients } from '@/hooks/use_download_clients'
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

interface MovieFile {
  id: number
  path: string
  size: number
  quality: string | null
  downloadUrl: string
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

interface Movie {
  id: number
  tmdbId: string | null
  imdbId: string | null
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  releaseDate: string | null
  runtime: number | null
  status: string | null
  posterUrl: string | null
  backdropUrl: string | null
  rating: number | null
  genres: string[]
  requested: boolean
  monitored: boolean
  hasFile: boolean
  trailerUrl: string | null
  backdropImages: string[]
  qualityProfile: QualityProfile | null
  rootFolder: RootFolder | null
  movieFile: MovieFile | null
  addedAt: string | null
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

export default function MovieDetail() {
  const { url } = usePage()
  const movieId = url.split('/').pop()

  const [movie, setMovie] = useState<Movie | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [grabbing, setGrabbing] = useState<string | null>(null)
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false)
  const [releasePickerOpen, setReleasePickerOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const audioPlayer = useAudioPlayer()
  const { getForMovie } = useActiveDownloads()
  const activeDownload = movieId ? getForMovie(movieId) : null
  const { clients: downloadClients } = useDownloadClients()

  useEffect(() => {
    fetchMovie()
  }, [movieId])

  const fetchMovie = async () => {
    try {
      const response = await fetch(`/api/v1/movies/${movieId}`)
      if (response.ok) {
        const data = await response.json()
        setMovie(data)
      } else if (response.status === 404) {
        toast.error('Movie not found')
        router.visit('/library?tab=movies')
      }
    } catch (error) {
      console.error('Failed to fetch movie:', error)
      toast.error('Failed to load movie')
    } finally {
      setLoading(false)
    }
  }

  const getMovieStatus = () => {
    if (!movie) return { status: 'none' as const, progress: 0 }
    return getMediaItemStatus(movie, activeDownload)
  }

  const toggleMonitored = async () => {
    if (!movie) return

    const wasMonitored = movie.monitored
    setMovie({ ...movie, monitored: !wasMonitored })

    try {
      const response = await fetch(`/api/v1/movies/${movieId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored: !wasMonitored }),
      })
      if (response.ok) {
        toast.success(wasMonitored ? 'Monitoring disabled' : 'Monitoring enabled')
      } else {
        setMovie({ ...movie, monitored: wasMonitored })
        toast.error('Failed to update monitoring')
      }
    } catch (error) {
      console.error('Failed to update monitoring:', error)
      setMovie({ ...movie, monitored: wasMonitored })
      toast.error('Failed to update monitoring')
    }
  }

  const toggleWanted = async () => {
    if (!movie) return

    const wasRequested = movie.requested

    // If unrequesting a movie with a file, show confirmation dialog
    if (wasRequested && movie.hasFile) {
      setDeleteDialogOpen(true)
      return
    }

    // Optimistic update
    setMovie({ ...movie, requested: !wasRequested })
    setToggling(true)

    try {
      const response = await fetch(`/api/v1/movies/${movieId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.deleted) {
          // Movie was deleted (no file, unrequested)
          toast.success('Removed from library')
          router.visit('/library?tab=movies')
        } else {
          toast.success(wasRequested ? 'Movie unrequested' : 'Movie requested')
        }
      } else if (data.hasFile) {
        // Movie has a file - show confirmation dialog
        setMovie({ ...movie, requested: wasRequested }) // Revert
        setDeleteDialogOpen(true)
      } else {
        // Revert on error
        setMovie({ ...movie, requested: wasRequested })
        toast.error(data.error || 'Failed to update movie')
      }
    } catch (error) {
      console.error('Failed to update movie:', error)
      // Revert on error
      setMovie({ ...movie, requested: wasRequested })
      toast.error('Failed to update movie')
    } finally {
      setToggling(false)
    }
  }

  const deleteMovie = async (deleteFiles: boolean) => {
    const url = deleteFiles
      ? `/api/v1/movies/${movieId}?deleteFile=true`
      : `/api/v1/movies/${movieId}`

    const response = await fetch(url, { method: 'DELETE' })
    if (response.ok) {
      toast.success(deleteFiles ? 'Movie and files deleted' : 'Movie deleted')
      router.visit('/library?tab=movies')
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to delete')
    }
    setDeleteDialogOpen(false)
  }

  const downloadMovie = async () => {
    if (!movie) return

    setDownloading(true)
    try {
      const response = await fetch(`/api/v1/movies/${movieId}/download`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`Download started: ${data.release?.title || movie.title}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'No releases found')
      }
    } catch (error) {
      console.error('Failed to download:', error)
      toast.error('Failed to download movie')
    } finally {
      setDownloading(false)
    }
  }

  const searchReleases = async () => {
    setSearching(true)
    setReleasePickerOpen(true)
    try {
      const response = await fetch(`/api/v1/movies/${movieId}/releases`)
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
          movieId: movie?.id,
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

  const enrichMovie = async () => {
    if (!movie) return

    setEnriching(true)
    try {
      const response = await fetch(`/api/v1/movies/${movieId}/enrich`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.enriched) {
          toast.success('Movie enriched with TMDB data')
          fetchMovie()
        } else {
          toast.warning(data.message || 'No matching movie found')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to enrich')
      }
    } catch (error) {
      console.error('Failed to enrich movie:', error)
      toast.error('Failed to enrich movie')
    } finally {
      setEnriching(false)
    }
  }

  // One byte formatter for the whole page: two release tables and the file row all
  // have to line up under the Readout Rule.
  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  const deleteFile = async () => {
    if (!movie) return

    const response = await fetch(`/api/v1/movies/${movieId}/file`, { method: 'DELETE' })
    if (response.ok) {
      toast.success('File deleted successfully')
      setMovie({ ...movie, hasFile: false, movieFile: null })
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to delete file')
    }
    setDeleteFileDialogOpen(false)
  }

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
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

  if (!movie) {
    return (
      <AppLayout title="Not Found">
        <Head title="Not Found" />
        <EmptyState
          icon={<HugeiconsIcon icon={Film01Icon} />}
          title="Movie not found"
          message="This movie is no longer in your library — it may have been removed. Head back to the movie library to pick another."
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={movie.title}
      headerPrefix={<Breadcrumbs items={[{ label: 'Movies', href: '/library?tab=movies' }]} />}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={toggleMonitored} aria-pressed={movie.monitored}>
                  <HugeiconsIcon
                    icon={movie.monitored ? Notification01Icon : NotificationOff01Icon}
                    className="h-4 w-4"
                  />
                  <span className="hidden md:inline">
                    {movie.monitored ? 'Monitored' : 'Monitor'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{movie.monitored ? 'Monitored' : 'Monitor'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {!movie.hasFile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={downloadMovie} disabled={downloading}>
                    {downloading ? (
                      <Spinner />
                    ) : (
                      <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
                    )}
                    <span className="hidden md:inline">
                      {downloading ? 'Downloading...' : 'Download'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{downloading ? 'Downloading...' : 'Download'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
              {!movie.tmdbId && (
                <DropdownMenuItem onClick={enrichMovie} disabled={enriching}>
                  <HugeiconsIcon
                    icon={Search01Icon}
                    className={`h-4 w-4 ${enriching ? 'animate-spin' : ''}`}
                  />
                  {enriching ? 'Enriching...' : 'Enrich from TMDB'}
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
      <Head title={movie.title} />

      <div className="space-y-6">
        <MediaHero
          trailerUrl={movie.trailerUrl}
          images={
            movie.backdropImages?.length
              ? movie.backdropImages
              : movie.backdropUrl
                ? [movie.backdropUrl]
                : undefined
          }
          title={movie.title}
          posterUrl={movie.posterUrl}
          posterFallback={
            <HugeiconsIcon icon={Film01Icon} className="h-16 w-16 text-muted-foreground/50" />
          }
          overview={movie.overview}
        >
          <div>
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold tracking-[-0.01em]">{movie.title}</h1>
              {movie.year && (
                <span className="readout text-sm text-muted-foreground">({movie.year})</span>
              )}
            </div>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p className="text-sm text-muted-foreground">{movie.originalTitle}</p>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const { status, progress } = getMovieStatus()
              return (
                <MediaStatusBadge
                  status={status}
                  progress={progress}
                  isToggling={toggling}
                  onToggleRequest={toggleWanted}
                />
              )
            })()}
            {movie.status && <Badge variant="outline">{movie.status}</Badge>}
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {movie.releaseDate && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4" />
                <span className="readout">{movie.releaseDate}</span>
              </div>
            )}
            {movie.runtime && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={Time01Icon} className="h-4 w-4" />
                <span className="readout">{formatRuntime(movie.runtime)}</span>
              </div>
            )}
            {movie.rating && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={StarIcon} className="h-4 w-4" />
                <span className="readout">{movie.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {movie.genres.slice(0, 5).map((genre, i) => (
                <Badge key={i} variant="outline">
                  {genre}
                </Badge>
              ))}
            </div>
          )}

          {/* Quality, download client, and folder info */}
          <div className="flex flex-wrap gap-2 text-sm">
            {movie.qualityProfile && <Badge variant="secondary">{movie.qualityProfile.name}</Badge>}
            <DownloadClientIndicator
              clients={downloadClients}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
            />
            {movie.rootFolder && (
              <Badge variant="secondary" className="readout">
                {movie.rootFolder.path}
              </Badge>
            )}
          </div>

          {/* External links */}
          <div className="flex gap-4 text-xs">
            {movie.tmdbId && (
              <a
                href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                TMDB
              </a>
            )}
            {movie.imdbId && (
              <a
                href={`https://www.imdb.com/title/${movie.imdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                IMDB
              </a>
            )}
          </div>
        </MediaHero>

        {activeDownload && <DownloadProgressCard downloads={[activeDownload]} />}

        {/* File info */}
        {movie.movieFile && (
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-base font-semibold">File</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <HugeiconsIcon
                    icon={Film01Icon}
                    className="h-8 w-8 text-muted-foreground shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="readout text-sm font-medium truncate">
                      {movie.movieFile.path.split('/').pop()}
                    </p>
                    <p className="readout text-xs text-muted-foreground">
                      {movie.movieFile.quality && `${movie.movieFile.quality} • `}
                      {formatSize(movie.movieFile.size)}
                    </p>
                    <p className="readout text-xs text-muted-foreground truncate">
                      {movie.movieFile.path}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      audioPlayer.pause()
                      setVideoPlayerOpen(true)
                    }}
                    aria-label="Play"
                  >
                    <HugeiconsIcon icon={PlayIcon} className="h-4 w-4" />
                    <span className="hidden sm:inline">Play</span>
                  </Button>
                  <Button variant="outline" size="sm" asChild aria-label="Download">
                    <a href={movie.movieFile.downloadUrl} download>
                      <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteFileDialogOpen(true)}
                    aria-label="Delete"
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search results */}
        {searchResults.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Search Results ({searchResults.length})</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchResults([])}
                aria-label="Dismiss search results"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
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
                        {formatSize(result.size)}
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
            </CardContent>
          </Card>
        )}

        {movie.tmdbId && (
          <SimilarLane mediaType="movies" mediaId={movie.id} tmdbId={movie.tmdbId} />
        )}
      </div>

      <DeleteMediaDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={movie.title}
        mediaType="movie"
        hasFile={movie.hasFile}
        mode="remove"
        onConfirm={deleteMovie}
      />

      <DeleteMediaDialog
        open={deleteFileDialogOpen}
        onOpenChange={setDeleteFileDialogOpen}
        title={movie.title}
        mediaType="movie"
        hasFile={movie.hasFile}
        mode="deleteFile"
        onConfirm={deleteFile}
      />

      {/* Release picker dialog */}
      <Dialog open={releasePickerOpen} onOpenChange={setReleasePickerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manual Search — {movie.title}</DialogTitle>
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
                        {formatSize(result.size)}
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
      <Dialog open={videoPlayerOpen} onOpenChange={setVideoPlayerOpen}>
        <DialogContent className="max-w-6xl p-0 overflow-hidden">
          {movie?.movieFile && videoPlayerOpen && (
            <VideoPlayer mediaType="movie" mediaFileId={movie.movieFile.id} title={movie.title} />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
