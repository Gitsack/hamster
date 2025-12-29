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
  Tv01Icon,
  Loading01Icon,
  ViewIcon,
  ViewOffIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Calendar01Icon,
  StarIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
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

interface Season {
  id: number
  seasonNumber: number
  title: string
  episodeCount: number
  wanted: boolean
  posterUrl: string | null
}

interface Episode {
  id: number
  episodeNumber: number
  title: string
  overview: string | null
  airDate: string | null
  runtime: number | null
  stillUrl: string | null
  wanted: boolean
  hasFile: boolean
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
  wanted: boolean
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
  wanted: boolean
  episodes: Episode[]
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
        router.visit('/library')
      }
    } catch (error) {
      console.error('Failed to fetch show:', error)
      toast.error('Failed to load TV show')
    } finally {
      setLoading(false)
    }
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

  const toggleWanted = async () => {
    if (!show) return

    try {
      const response = await fetch(`/api/v1/tvshows/${showId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wanted: !show.wanted }),
      })
      if (response.ok) {
        setShow({ ...show, wanted: !show.wanted })
        toast.success(show.wanted ? 'TV show unwanted' : 'TV show wanted')
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
        router.visit('/library')
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
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/library">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleWanted}>
                <HugeiconsIcon
                  icon={show.wanted ? ViewOffIcon : ViewIcon}
                  className="h-4 w-4 mr-2"
                />
                {show.wanted ? 'Unwant' : 'Want'}
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
      <Head title={show.title} />

      <div className="space-y-6">
        {/* Backdrop */}
        {show.backdropUrl && (
          <div className="relative h-48 md:h-64 -mx-4 -mt-4 mb-6 overflow-hidden">
            <img
              src={show.backdropUrl}
              alt={show.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}

        {/* Show header */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Show poster */}
          <div className="w-full md:w-48 aspect-[2/3] md:aspect-auto md:h-72 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {show.posterUrl ? (
              <img
                src={show.posterUrl}
                alt={show.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon
                  icon={Tv01Icon}
                  className="h-16 w-16 text-muted-foreground/50"
                />
              </div>
            )}
          </div>

          {/* Show info */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{show.title}</h1>
                {show.year && (
                  <span className="text-muted-foreground">({show.year})</span>
                )}
              </div>
              {show.originalTitle && show.originalTitle !== show.title && (
                <p className="text-muted-foreground">{show.originalTitle}</p>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {show.wanted && (
                <Badge variant="secondary" className="gap-1">
                  <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                  Requested
                </Badge>
              )}
              {show.status && (
                <Badge variant="outline">{show.status}</Badge>
              )}
              {show.network && (
                <Badge variant="outline">{show.network}</Badge>
              )}
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
                {show.seasonCount} seasons • {show.episodeCount} episodes
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
              {show.qualityProfile && (
                <Badge variant="secondary">{show.qualityProfile.name}</Badge>
              )}
              {show.rootFolder && (
                <Badge variant="secondary">{show.rootFolder.path}</Badge>
              )}
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
          </div>
        </div>

        {/* Overview */}
        {show.overview && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-2">Overview</h2>
              <p className="text-muted-foreground">{show.overview}</p>
            </CardContent>
          </Card>
        )}

        {/* Seasons */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-4">Seasons</h2>
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
                          <HugeiconsIcon icon={Tv01Icon} className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{season.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {season.episodeCount} episodes
                        </p>
                      </div>
                      {season.wanted && (
                        <Badge variant="secondary">Requested</Badge>
                      )}
                      <HugeiconsIcon
                        icon={expandedSeason === season.seasonNumber ? ArrowUp01Icon : ArrowDown01Icon}
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
                                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                              >
                                <div className="w-8 text-center font-mono text-muted-foreground">
                                  {episode.episodeNumber}
                                </div>
                                {episode.stillUrl ? (
                                  <img
                                    src={episode.stillUrl}
                                    alt={episode.title}
                                    className="h-12 w-20 rounded object-cover"
                                  />
                                ) : (
                                  <div className="h-12 w-20 rounded bg-muted" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{episode.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {episode.airDate || 'TBA'}
                                    {episode.runtime && ` • ${episode.runtime}m`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {episode.hasFile ? (
                                    <Badge variant="default" className="bg-green-600 gap-1">
                                      <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3 w-3" />
                                      Downloaded
                                    </Badge>
                                  ) : episode.wanted ? (
                                    <Badge variant="secondary" className="gap-1">
                                      <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                                      Requested
                                    </Badge>
                                  ) : null}
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
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {show.title}?</DialogTitle>
            <DialogDescription>
              This will remove the TV show and all seasons/episodes from your library.
              Files on disk will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteShow} disabled={deleting}>
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
