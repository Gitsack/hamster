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
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
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
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { MediaStatusBadge, getMediaItemStatus } from '@/components/library/media-status-badge'
import { MediaHero } from '@/components/media-hero'
import { SimilarLane } from '@/components/library/similar-lane'
import { useAudioPlayer } from '@/contexts/audio_player_context'
import { VideoPlayer } from '@/components/player/video_player'

interface QualityProfile {
  id: number
  name: string
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

export default function MovieDetail() {
  const { url } = usePage()
  const movieId = url.split('/').pop()

  const [movie, setMovie] = useState<Movie | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingFile, setDeletingFile] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [activeDownload, setActiveDownload] = useState<{ progress: number; status: string } | null>(
    null
  )
  const [enriching, setEnriching] = useState(false)
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false)
  const audioPlayer = useAudioPlayer()

  useEffect(() => {
    fetchMovie()
    fetchActiveDownloads()
    const interval = setInterval(fetchActiveDownloads, 5000)
    return () => clearInterval(interval)
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

  const fetchActiveDownloads = async () => {
    try {
      const response = await fetch('/api/v1/queue')
      if (response.ok) {
        const data = await response.json()
        const download = data.find((item: any) => item.movieId === movieId)
        if (download) {
          setActiveDownload({
            progress: download.progress || 0,
            status: download.status || 'downloading',
          })
        } else {
          setActiveDownload(null)
        }
      }
    } catch (error) {
      // Silently ignore - polling will retry
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

  const deleteMovie = async (withFile: boolean = false) => {
    setDeleting(true)
    try {
      const url = withFile
        ? `/api/v1/movies/${movieId}?deleteFile=true`
        : `/api/v1/movies/${movieId}`

      const response = await fetch(url, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success(withFile ? 'Movie and files deleted' : 'Movie deleted')
        router.visit('/library?tab=movies')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Failed to delete movie:', error)
      toast.error('Failed to delete movie')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
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

  const deleteFile = async () => {
    if (!movie) return

    setDeletingFile(true)
    try {
      const response = await fetch(`/api/v1/movies/${movieId}/file`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('File deleted successfully')
        setMovie({ ...movie, hasFile: false, movieFile: null })
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete file')
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
      toast.error('Failed to delete file')
    } finally {
      setDeletingFile(false)
      setDeleteFileDialogOpen(false)
    }
  }

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
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
        <div className="text-center py-12">
          <p className="text-muted-foreground">Movie not found</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={movie.title}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link href="/library?tab=movies">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Back</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={toggleMonitored}>
            <HugeiconsIcon
              icon={movie.monitored ? Notification01Icon : NotificationOff01Icon}
              className="h-4 w-4 md:mr-2"
            />
            <span className="hidden md:inline">{movie.monitored ? 'Monitored' : 'Monitor'}</span>
          </Button>
          {!movie.hasFile && (
            <Button onClick={downloadMovie} disabled={downloading}>
              {downloading ? (
                <Spinner className="md:mr-2" />
              ) : (
                <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 md:mr-2" />
              )}
              <span className="hidden md:inline">Search releases</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!movie.tmdbId && (
                <DropdownMenuItem onClick={enrichMovie} disabled={enriching}>
                  <HugeiconsIcon
                    icon={Search01Icon}
                    className={`h-4 w-4 mr-2 ${enriching ? 'animate-spin' : ''}`}
                  />
                  {enriching ? 'Enriching...' : 'Enrich from TMDB'}
                </DropdownMenuItem>
              )}
              {!movie.tmdbId && <DropdownMenuSeparator />}
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
      <Head title={movie.title} />

      <div className="space-y-6">
        <MediaHero
          trailerUrl={movie.trailerUrl}
          images={movie.backdropImages?.length ? movie.backdropImages : movie.backdropUrl ? [movie.backdropUrl] : undefined}
          title={movie.title}
          posterUrl={movie.posterUrl}
          posterFallback={<HugeiconsIcon icon={Film01Icon} className="h-16 w-16 text-muted-foreground/50" />}
          overview={movie.overview}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{movie.title}</h1>
              {movie.year && <span className="text-muted-foreground">({movie.year})</span>}
            </div>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p className="text-muted-foreground">{movie.originalTitle}</p>
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
                {movie.releaseDate}
              </div>
            )}
            {movie.runtime && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={Time01Icon} className="h-4 w-4" />
                {formatRuntime(movie.runtime)}
              </div>
            )}
            {movie.rating && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={StarIcon} className="h-4 w-4" />
                {movie.rating.toFixed(1)}
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

          {/* Quality and folder info */}
          <div className="flex flex-wrap gap-2 text-sm">
            {movie.qualityProfile && (
              <Badge variant="secondary">{movie.qualityProfile.name}</Badge>
            )}
            {movie.rootFolder && <Badge variant="secondary">{movie.rootFolder.path}</Badge>}
          </div>

          {/* External links */}
          <div className="flex gap-2 text-sm">
            {movie.tmdbId && (
              <a
                href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                TMDB
              </a>
            )}
            {movie.imdbId && (
              <a
                href={`https://www.imdb.com/title/${movie.imdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                IMDB
              </a>
            )}
          </div>
        </MediaHero>

        {/* File info */}
        {movie.movieFile && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4">File</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <HugeiconsIcon icon={Film01Icon} className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {movie.movieFile.path.split('/').pop()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {movie.movieFile.quality && `${movie.movieFile.quality} • `}
                      {formatFileSize(movie.movieFile.size)}
                    </p>
                    <p className="text-xs text-muted-foreground/70 truncate">
                      {movie.movieFile.path}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      audioPlayer.pause()
                      setVideoPlayerOpen(true)
                    }}
                  >
                    <HugeiconsIcon icon={PlayIcon} className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Play</span>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={movie.movieFile.downloadUrl} download>
                      <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteFileDialogOpen(true)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {movie.tmdbId && (
          <SimilarLane mediaType="movies" mediaId={movie.id} tmdbId={movie.tmdbId} />
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movie.hasFile ? 'Remove from library?' : `Delete ${movie.title}?`}
            </DialogTitle>
            <DialogDescription>
              {movie.hasFile
                ? 'This will permanently delete the downloaded files from disk and remove the movie from your library.'
                : 'This will remove the movie from your library.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMovie(movie.hasFile)}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : movie.hasFile ? (
                'Delete Files & Remove'
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete file confirmation dialog */}
      <Dialog open={deleteFileDialogOpen} onOpenChange={setDeleteFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete movie file?</DialogTitle>
            <DialogDescription>
              This will permanently delete the movie file from disk. The movie will remain in your
              library but will need to be downloaded again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteFile} disabled={deletingFile}>
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
