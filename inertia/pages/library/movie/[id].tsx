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
  Loading01Icon,
  ViewIcon,
  ViewOffIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Calendar01Icon,
  FileDownloadIcon,
  Time01Icon,
  StarIcon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

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
  quality: string
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
  wanted: boolean
  hasFile: boolean
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
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)

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
        router.visit('/library')
      }
    } catch (error) {
      console.error('Failed to fetch movie:', error)
      toast.error('Failed to load movie')
    } finally {
      setLoading(false)
    }
  }

  const toggleWanted = async () => {
    if (!movie) return

    try {
      const response = await fetch(`/api/v1/movies/${movieId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wanted: !movie.wanted }),
      })
      if (response.ok) {
        setMovie({ ...movie, wanted: !movie.wanted })
        toast.success(movie.wanted ? 'Movie unwanted' : 'Movie wanted')
      }
    } catch (error) {
      console.error('Failed to update movie:', error)
      toast.error('Failed to update movie')
    }
  }

  const deleteMovie = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/movies/${movieId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Movie deleted')
        router.visit('/library')
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
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/library">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          {!movie.hasFile && (
            <Button onClick={downloadMovie} disabled={downloading}>
              {downloading ? (
                <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4 mr-2" />
              )}
              Download
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleWanted}>
                <HugeiconsIcon
                  icon={movie.wanted ? ViewOffIcon : ViewIcon}
                  className="h-4 w-4 mr-2"
                />
                {movie.wanted ? 'Unwant' : 'Want'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <Head title={movie.title} />

      <div className="space-y-6">
        {/* Backdrop */}
        {movie.backdropUrl && (
          <div className="relative h-48 md:h-64 -mx-4 -mt-4 mb-6 overflow-hidden">
            <img
              src={movie.backdropUrl}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}

        {/* Movie header */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Movie poster */}
          <div className="w-full md:w-48 aspect-[2/3] md:aspect-auto md:h-72 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {movie.posterUrl ? (
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon
                  icon={Film01Icon}
                  className="h-16 w-16 text-muted-foreground/50"
                />
              </div>
            )}
          </div>

          {/* Movie info */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{movie.title}</h1>
                {movie.year && (
                  <span className="text-muted-foreground">({movie.year})</span>
                )}
              </div>
              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="text-muted-foreground">{movie.originalTitle}</p>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              {movie.hasFile ? (
                <Badge variant="default" className="bg-green-600 gap-1">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3 w-3" />
                  Downloaded
                </Badge>
              ) : movie.wanted ? (
                <Badge variant="secondary" className="gap-1">
                  <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                  Requested
                </Badge>
              ) : null}
              {movie.status && (
                <Badge variant="outline">{movie.status}</Badge>
              )}
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
              {movie.rootFolder && (
                <Badge variant="secondary">{movie.rootFolder.path}</Badge>
              )}
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
          </div>
        </div>

        {/* Overview */}
        {movie.overview && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-2">Overview</h2>
              <p className="text-muted-foreground">{movie.overview}</p>
            </CardContent>
          </Card>
        )}

        {/* File info */}
        {movie.movieFile && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4">File</h2>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <HugeiconsIcon icon={Film01Icon} className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium truncate max-w-md">
                      {movie.movieFile.path.split('/').pop()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {movie.movieFile.quality} • {formatFileSize(movie.movieFile.size)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {movie.title}?</DialogTitle>
            <DialogDescription>
              This will remove the movie from your library. Files on disk will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteMovie} disabled={deleting}>
              {deleting ? (
                <>
                  <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
