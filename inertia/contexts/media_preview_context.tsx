import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { router } from '@inertiajs/react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ViewIcon,
  StarIcon,
  Time01Icon,
  Calendar03Icon,
  InformationCircleIcon,
  Tv01Icon,
  Refresh01Icon,
  LinkSquare02Icon,
} from '@hugeicons/core-free-icons'
import { MediaStatusBadge, getMediaItemStatus } from '@/components/library/media-status-badge'
import { MediaGallery } from '@/components/media-gallery'
import { AddMediaDialog, type QualityProfile } from '@/components/add-media-dialog'
import { SeasonPickerDialog, type SeasonEpisodeSelection } from '@/components/season-picker-dialog'
import { useActiveDownloads } from '@/hooks/use_active_downloads'
import type { StreamingOffer } from '@/components/library/streaming-offers'
import { CastLane, type CastMember } from '@/components/library/cast-lane'

interface MovieDetails {
  tmdbId: string
  imdbId?: string
  title: string
  originalTitle?: string
  year?: number
  overview?: string
  posterUrl?: string
  backdropUrl?: string
  releaseDate?: string
  runtime?: number
  status?: string
  rating?: number
  votes?: number
  genres?: string[]
  cast?: CastMember[]
  trailerUrl?: string
  backdropImages?: string[]
  streamingOffers?: StreamingOffer[]
  inLibrary: boolean
  libraryId?: number
  requested?: boolean
  hasFile?: boolean
}

interface TvShowDetails {
  tmdbId: string
  title: string
  originalTitle?: string
  year?: number
  overview?: string
  posterUrl?: string
  backdropUrl?: string
  firstAirDate?: string
  status?: string
  rating?: number
  votes?: number
  genres?: string[]
  networks?: string[]
  seasonCount?: number
  episodeCount?: number
  cast?: CastMember[]
  trailerUrl?: string
  backdropImages?: string[]
  streamingOffers?: StreamingOffer[]
  inLibrary: boolean
  libraryId?: number
  requested?: boolean
}

interface MediaPreviewContextType {
  openMoviePreview: (tmdbId: string) => void
  openTvShowPreview: (tmdbId: string) => void
}

const MediaPreviewContext = createContext<MediaPreviewContextType | null>(null)

export function useMediaPreview() {
  const context = useContext(MediaPreviewContext)
  if (!context) {
    throw new Error('useMediaPreview must be used within a MediaPreviewProvider')
  }
  return context
}

export function MediaPreviewProvider({ children }: { children: ReactNode }) {
  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailsType, setDetailsType] = useState<'movie' | 'tv' | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [movieDetails, setMovieDetails] = useState<MovieDetails | null>(null)
  const [tvShowDetails, setTvShowDetails] = useState<TvShowDetails | null>(null)
  const [togglingDetails, setTogglingDetails] = useState(false)
  const [previewError, setPreviewError] = useState<{ message: string; endpoint: string } | null>(
    null
  )
  const lastRequest = useRef<{ type: 'movie' | 'tv'; tmdbId: string } | null>(null)

  // Add flow state
  const [rootFolders, setRootFolders] = useState<{ id: string; path: string; mediaType: string }[]>(
    []
  )
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [configLoaded, setConfigLoaded] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false)
  const [episodeSelection, setEpisodeSelection] = useState<SeasonEpisodeSelection | null>(null)
  const [adding, setAdding] = useState(false)

  const movieProfiles = qualityProfiles.filter((p) => p.mediaType === 'movies')
  const tvProfiles = qualityProfiles.filter((p) => p.mediaType === 'tv')

  // Lazy-load config
  const ensureConfig = useCallback(async () => {
    if (configLoaded) return
    try {
      const [rf, qp] = await Promise.all([
        fetch('/api/v1/rootfolders').then((r) => r.json()),
        fetch('/api/v1/qualityprofiles').then((r) => r.json()),
      ])
      setRootFolders(rf)
      setQualityProfiles(qp)
      setConfigLoaded(true)
    } catch {
      toast.error('Could not load quality profiles and root folders. Check Settings, then retry.')
    }
  }, [configLoaded])

  // Open movie preview
  const openMoviePreview = useCallback(
    async (tmdbId: string) => {
      setDetailsType('movie')
      setSheetOpen(true)
      setDetailsLoading(true)
      setMovieDetails(null)
      setTvShowDetails(null)
      setPreviewError(null)
      lastRequest.current = { type: 'movie', tmdbId }

      const endpoint = `/api/v1/movies/preview?tmdbId=${tmdbId}`
      try {
        const response = await fetch(endpoint)
        if (response.ok) {
          const data = await response.json()
          setMovieDetails(data)
        } else {
          setPreviewError({
            message: `TMDB did not return details for this movie (HTTP ${response.status}).`,
            endpoint,
          })
        }
      } catch {
        setPreviewError({ message: 'Could not reach TMDB for movie details.', endpoint })
      } finally {
        setDetailsLoading(false)
        // Loaded once the sheet has content, so the footer can state the destination
        // before anything is committed.
        void ensureConfig()
      }
    },
    [ensureConfig]
  )

  // Open TV show preview
  const openTvShowPreview = useCallback(
    async (tmdbId: string) => {
      setDetailsType('tv')
      setSheetOpen(true)
      setDetailsLoading(true)
      setMovieDetails(null)
      setTvShowDetails(null)
      setPreviewError(null)
      lastRequest.current = { type: 'tv', tmdbId }

      const endpoint = `/api/v1/tvshows/preview?tmdbId=${tmdbId}`
      try {
        const response = await fetch(endpoint)
        if (response.ok) {
          const data = await response.json()
          setTvShowDetails(data)
        } else {
          setPreviewError({
            message: `TMDB did not return details for this show (HTTP ${response.status}).`,
            endpoint,
          })
        }
      } catch {
        setPreviewError({ message: 'Could not reach TMDB for show details.', endpoint })
      } finally {
        setDetailsLoading(false)
        // Loaded once the sheet has content, so the footer can state the destination
        // before anything is committed.
        void ensureConfig()
      }
    },
    [ensureConfig]
  )

  const retryPreview = useCallback(() => {
    const last = lastRequest.current
    if (!last) return
    if (last.type === 'movie') openMoviePreview(last.tmdbId)
    else openTvShowPreview(last.tmdbId)
  }, [openMoviePreview, openTvShowPreview])

  // Toggle movie requested
  const toggleMovieDetailsRequested = async () => {
    if (!movieDetails?.libraryId || !movieDetails?.inLibrary) return

    const wasRequested = movieDetails.requested
    if (wasRequested && movieDetails.hasFile) {
      toast.error('Movie has downloaded files. Delete files first before unrequesting.')
      return
    }

    setTogglingDetails(true)
    setMovieDetails({ ...movieDetails, requested: !wasRequested })

    try {
      const response = await fetch(`/api/v1/movies/${movieDetails.libraryId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })
      const data = await response.json()
      if (response.ok) {
        if (data.deleted) {
          toast.success('Removed from library')
          setMovieDetails({
            ...movieDetails,
            inLibrary: false,
            libraryId: undefined,
            requested: false,
          })
        } else {
          toast.success(wasRequested ? 'Movie unrequested' : 'Movie requested')
        }
      } else {
        setMovieDetails({ ...movieDetails, requested: wasRequested })
        toast.error(
          data.error || `Could not change the request state of ${movieDetails.title}. Retry.`
        )
      }
    } catch {
      setMovieDetails({ ...movieDetails, requested: wasRequested })
      toast.error(`Could not reach the server to update ${movieDetails.title}. Retry.`)
    } finally {
      setTogglingDetails(false)
    }
  }

  // Toggle TV show requested
  const toggleTvShowDetailsRequested = async () => {
    if (!tvShowDetails?.libraryId || !tvShowDetails?.inLibrary) return

    setTogglingDetails(true)
    const wasRequested = tvShowDetails.requested
    setTvShowDetails({ ...tvShowDetails, requested: !wasRequested })

    try {
      const response = await fetch(`/api/v1/tvshows/${tvShowDetails.libraryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })
      if (response.ok) {
        toast.success(wasRequested ? 'TV show unrequested' : 'TV show requested')
      } else {
        setTvShowDetails({ ...tvShowDetails, requested: wasRequested })
        toast.error(`Could not change the request state of ${tvShowDetails.title}. Retry.`)
      }
    } catch {
      setTvShowDetails({ ...tvShowDetails, requested: wasRequested })
      toast.error(`Could not reach the server to update ${tvShowDetails.title}. Retry.`)
    } finally {
      setTogglingDetails(false)
    }
  }

  // Add movie to library
  const addMovieToLibrary = async (qualityProfileId: string) => {
    if (!movieDetails) return
    const movieRootFolder = rootFolders.find((rf) => rf.mediaType === 'movies')
    if (!movieRootFolder) {
      toast.error('No root folder configured for movies. Please add one in Settings.')
      return
    }

    setAdding(true)
    try {
      const response = await fetch('/api/v1/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: movieDetails.tmdbId,
          title: movieDetails.title,
          year: movieDetails.year,
          qualityProfileId,
          rootFolderId: movieRootFolder.id,
          requested: true,
          searchOnAdd: true,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`${movieDetails.title} added to library`)
        setAddDialogOpen(false)
        setMovieDetails({
          ...movieDetails,
          inLibrary: true,
          libraryId: data.id,
          requested: true,
        })
      } else {
        const error = await response.json()
        toast.error(
          error.error || `Could not add ${movieDetails.title}. Retry, or check System > Events.`
        )
      }
    } catch {
      toast.error(`Could not reach the server to add ${movieDetails.title}. Retry.`)
    } finally {
      setAdding(false)
    }
  }

  // Add TV show to library
  const addTvShowToLibrary = async (
    qualityProfileId: string,
    selection: SeasonEpisodeSelection | null
  ) => {
    if (!tvShowDetails) return
    const tvRootFolder = rootFolders.find((rf) => rf.mediaType === 'tv')
    if (!tvRootFolder) {
      toast.error('No root folder configured for TV shows. Please add one in Settings.')
      return
    }

    setAdding(true)
    try {
      const response = await fetch('/api/v1/tvshows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: tvShowDetails.tmdbId,
          title: tvShowDetails.title,
          year: tvShowDetails.year,
          qualityProfileId,
          rootFolderId: tvRootFolder.id,
          requested: true,
          searchOnAdd: true,
          selectedSeasons: selection?.selectedSeasons,
          selectedEpisodes: selection?.selectedEpisodes,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`${tvShowDetails.title} added to library`)
        setAddDialogOpen(false)
        setEpisodeSelection(null)
        setTvShowDetails({
          ...tvShowDetails,
          inLibrary: true,
          libraryId: data.id,
          requested: true,
        })
      } else {
        const error = await response.json()
        toast.error(
          error.error || `Could not add ${tvShowDetails.title}. Retry, or check System > Events.`
        )
      }
    } catch {
      toast.error(`Could not reach the server to add ${tvShowDetails.title}. Retry.`)
    } finally {
      setAdding(false)
    }
  }

  // Handle "Add to Library" button click
  const handleAddToLibrary = async () => {
    await ensureConfig()

    if (detailsType === 'movie') {
      if (movieProfiles.length === 1) {
        addMovieToLibrary(movieProfiles[0].id)
      } else {
        setAddDialogOpen(true)
      }
    } else if (detailsType === 'tv') {
      setSeasonPickerOpen(true)
    }
  }

  const handleSeasonPickerConfirm = (selection: SeasonEpisodeSelection) => {
    setEpisodeSelection(selection)
    setSeasonPickerOpen(false)
    if (tvProfiles.length === 1) {
      addTvShowToLibrary(tvProfiles[0].id, selection)
    } else {
      setAddDialogOpen(true)
    }
  }

  const handleAddDialogConfirm = (qualityProfileId: string) => {
    if (detailsType === 'movie') {
      addMovieToLibrary(qualityProfileId)
    } else {
      addTvShowToLibrary(qualityProfileId, episodeSelection)
    }
  }

  const profiles = detailsType === 'movie' ? movieProfiles : tvProfiles

  // The badge reports what is actually true, including a grab in flight.
  const { getForMovie } = useActiveDownloads()
  const movieDownload = movieDetails?.libraryId ? getForMovie(String(movieDetails.libraryId)) : null
  const movieStatus = getMediaItemStatus(movieDetails ?? {}, movieDownload)
  const tvStatus = getMediaItemStatus(tvShowDetails ?? {})

  return (
    <MediaPreviewContext.Provider value={{ openMoviePreview, openTvShowPreview }}>
      {children}

      {/* Preview Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          {detailsLoading ? (
            <div className="space-y-4 p-6" aria-busy="true">
              <Skeleton className="h-7 w-3/4" />
              <div className="flex gap-4">
                <Skeleton className="aspect-[2/3] w-24 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
              <Skeleton className="aspect-video w-full rounded-lg" />
            </div>
          ) : previewError ? (
            <>
              <SheetHeader className="pr-12 pb-4">
                <SheetTitle>Details unavailable</SheetTitle>
              </SheetHeader>
              <SheetBody className="px-6 pb-6">
                {/* The provider being unreachable is a first-class Hamster failure, so the
                    surface stays up and says what was attempted rather than vanishing. */}
                <div className="border-border rounded-lg border p-4">
                  <p className="text-sm font-medium">{previewError.message}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Attempted <span className="readout">{previewError.endpoint}</span>. Check that
                    TMDB is reachable from the container, then retry.
                  </p>
                </div>
              </SheetBody>
              <SheetFooter>
                <Button onClick={retryPreview}>
                  <HugeiconsIcon icon={Refresh01Icon} className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </SheetFooter>
            </>
          ) : detailsType === 'movie' && movieDetails ? (
            <>
              <SheetHeader className="pr-12 pb-4">
                <SheetTitle>
                  {movieDetails.title}
                  {movieDetails.year && (
                    <span className="readout text-muted-foreground ml-2 font-normal">
                      {movieDetails.year}
                    </span>
                  )}
                </SheetTitle>
                {movieDetails.originalTitle &&
                  movieDetails.originalTitle !== movieDetails.title && (
                    <p className="text-muted-foreground text-sm">{movieDetails.originalTitle}</p>
                  )}
              </SheetHeader>

              <SheetBody className="space-y-4 px-6 pb-6">
                {/* Identity first: the operator tapped a poster, so they get the poster back,
                    with the one fact only Hamster knows — is this already here. */}
                <div className="flex gap-4">
                  <div className="bg-muted aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg">
                    {movieDetails.posterUrl ? (
                      <img
                        src={movieDetails.posterUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <HugeiconsIcon
                          icon={InformationCircleIcon}
                          className="text-muted-foreground h-6 w-6"
                        />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    {movieDetails.inLibrary && (
                      <MediaStatusBadge
                        status={movieStatus.status}
                        progress={movieStatus.progress}
                        isToggling={togglingDetails}
                        onToggleRequest={
                          movieDetails.hasFile ? undefined : toggleMovieDetailsRequested
                        }
                      />
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      {movieDetails.runtime && (
                        <div className="text-muted-foreground flex items-center gap-1.5">
                          <HugeiconsIcon icon={Time01Icon} className="h-4 w-4" />
                          <span className="readout">{movieDetails.runtime} min</span>
                        </div>
                      )}
                      {movieDetails.rating && (
                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon
                            icon={StarIcon}
                            className="text-muted-foreground h-4 w-4 fill-current"
                          />
                          <span className="readout font-medium">
                            {movieDetails.rating.toFixed(1)}
                          </span>
                          {movieDetails.votes && (
                            <span className="readout text-muted-foreground">
                              ({movieDetails.votes.toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}
                      {movieDetails.status && (
                        <span className="text-muted-foreground">{movieDetails.status}</span>
                      )}
                    </div>

                    {movieDetails.genres && movieDetails.genres.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {movieDetails.genres.slice(0, 5).map((genre) => (
                          <Badge key={genre} variant="outline">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <ExternalLinks tmdbId={movieDetails.tmdbId} imdbId={movieDetails.imdbId} />
                  </div>
                </div>

                {movieDetails.overview && (
                  <p className="text-muted-foreground max-w-[70ch] text-sm leading-relaxed">
                    {movieDetails.overview}
                  </p>
                )}

                {/* Artwork sits below the facts, the way the full detail page does it. */}
                {(movieDetails.trailerUrl ||
                  movieDetails.backdropImages?.length ||
                  movieDetails.backdropUrl) && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold">Media</h3>
                    <MediaGallery
                      trailerUrl={movieDetails.trailerUrl}
                      images={
                        movieDetails.backdropImages?.length
                          ? movieDetails.backdropImages
                          : movieDetails.backdropUrl
                            ? [movieDetails.backdropUrl]
                            : undefined
                      }
                      title={movieDetails.title}
                    />
                  </div>
                )}

                <CastLane cast={movieDetails.cast} />
              </SheetBody>

              <SheetFooter>
                {movieDetails.inLibrary ? (
                  <Button
                    onClick={() => {
                      setSheetOpen(false)
                      router.visit(`/movie/${movieDetails.libraryId}`)
                    }}
                  >
                    <HugeiconsIcon icon={ViewIcon} className="mr-2 h-4 w-4" />
                    View in Library
                  </Button>
                ) : (
                  <>
                    <AddDestination
                      profiles={movieProfiles}
                      rootFolders={rootFolders}
                      mediaType="movies"
                      configLoaded={configLoaded}
                    />
                    <Button disabled={adding} onClick={handleAddToLibrary}>
                      {adding ? (
                        <Spinner className="mr-2 h-4 w-4" />
                      ) : (
                        <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
                      )}
                      Add to Library
                    </Button>
                  </>
                )}
              </SheetFooter>
            </>
          ) : detailsType === 'tv' && tvShowDetails ? (
            <>
              <SheetHeader className="pr-12 pb-4">
                <SheetTitle>
                  {tvShowDetails.title}
                  {tvShowDetails.year && (
                    <span className="readout text-muted-foreground ml-2 font-normal">
                      {tvShowDetails.year}
                    </span>
                  )}
                </SheetTitle>
                {tvShowDetails.originalTitle &&
                  tvShowDetails.originalTitle !== tvShowDetails.title && (
                    <p className="text-muted-foreground text-sm">{tvShowDetails.originalTitle}</p>
                  )}
              </SheetHeader>

              <SheetBody className="space-y-4 px-6 pb-6">
                <div className="flex gap-4">
                  <div className="bg-muted aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg">
                    {tvShowDetails.posterUrl ? (
                      <img
                        src={tvShowDetails.posterUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <HugeiconsIcon icon={Tv01Icon} className="text-muted-foreground h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    {tvShowDetails.inLibrary && (
                      <MediaStatusBadge
                        status={tvStatus.status}
                        progress={tvStatus.progress}
                        isToggling={togglingDetails}
                        onToggleRequest={toggleTvShowDetailsRequested}
                      />
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      {tvShowDetails.seasonCount && (
                        <div className="text-muted-foreground flex items-center gap-1.5">
                          <HugeiconsIcon icon={Tv01Icon} className="h-4 w-4" />
                          <span className="readout">
                            {tvShowDetails.seasonCount} Season
                            {tvShowDetails.seasonCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {tvShowDetails.episodeCount && (
                        <span className="text-muted-foreground">
                          <span className="readout">{tvShowDetails.episodeCount}</span> episodes
                        </span>
                      )}
                      {tvShowDetails.rating && (
                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon
                            icon={StarIcon}
                            className="text-muted-foreground h-4 w-4 fill-current"
                          />
                          <span className="readout font-medium">
                            {tvShowDetails.rating.toFixed(1)}
                          </span>
                          {tvShowDetails.votes && (
                            <span className="readout text-muted-foreground">
                              ({tvShowDetails.votes.toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}
                      {tvShowDetails.networks && tvShowDetails.networks.length > 0 && (
                        <span className="text-muted-foreground">
                          Network: {tvShowDetails.networks.join(', ')}
                        </span>
                      )}
                      {tvShowDetails.status && (
                        <span className="text-muted-foreground">{tvShowDetails.status}</span>
                      )}
                    </div>

                    {tvShowDetails.genres && tvShowDetails.genres.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tvShowDetails.genres.slice(0, 5).map((genre) => (
                          <Badge key={genre} variant="outline">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <ExternalLinks tmdbId={tvShowDetails.tmdbId} mediaType="tv" />
                  </div>
                </div>

                {tvShowDetails.overview && (
                  <p className="text-muted-foreground max-w-[70ch] text-sm leading-relaxed">
                    {tvShowDetails.overview}
                  </p>
                )}

                {(tvShowDetails.trailerUrl ||
                  tvShowDetails.backdropImages?.length ||
                  tvShowDetails.backdropUrl) && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold">Media</h3>
                    <MediaGallery
                      trailerUrl={tvShowDetails.trailerUrl}
                      images={
                        tvShowDetails.backdropImages?.length
                          ? tvShowDetails.backdropImages
                          : tvShowDetails.backdropUrl
                            ? [tvShowDetails.backdropUrl]
                            : undefined
                      }
                      title={tvShowDetails.title}
                    />
                  </div>
                )}

                <CastLane cast={tvShowDetails.cast} />
              </SheetBody>

              <SheetFooter>
                {tvShowDetails.inLibrary ? (
                  <Button
                    onClick={() => {
                      setSheetOpen(false)
                      router.visit(`/tvshow/${tvShowDetails.libraryId}`)
                    }}
                  >
                    <HugeiconsIcon icon={ViewIcon} className="mr-2 h-4 w-4" />
                    View in Library
                  </Button>
                ) : (
                  <>
                    <AddDestination
                      profiles={tvProfiles}
                      rootFolders={rootFolders}
                      mediaType="tv"
                      configLoaded={configLoaded}
                    />
                    <Button disabled={adding} onClick={handleAddToLibrary}>
                      {adding ? (
                        <Spinner className="mr-2 h-4 w-4" />
                      ) : (
                        <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
                      )}
                      Choose seasons
                    </Button>
                  </>
                )}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Season Picker Dialog (TV only) */}
      {tvShowDetails && (
        <SeasonPickerDialog
          tmdbId={tvShowDetails.tmdbId}
          showTitle={tvShowDetails.title}
          open={seasonPickerOpen}
          onOpenChange={setSeasonPickerOpen}
          onConfirm={handleSeasonPickerConfirm}
        />
      )}

      {/* Add Media Dialog */}
      <AddMediaDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        mediaType={detailsType === 'movie' ? 'movie' : 'tvshow'}
        title={(detailsType === 'movie' ? movieDetails?.title : tvShowDetails?.title) ?? ''}
        description={`Add ${detailsType === 'movie' ? movieDetails?.title : tvShowDetails?.title} to your library`}
        qualityProfiles={profiles}
        adding={adding}
        onAdd={handleAddDialogConfirm}
      />
    </MediaPreviewContext.Provider>
  )
}

// Sheet-local helpers

function ExternalLinks({
  tmdbId,
  imdbId,
  mediaType = 'movie',
}: {
  tmdbId: string
  imdbId?: string
  mediaType?: 'movie' | 'tv'
}) {
  const link =
    'text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-sm'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`https://www.themoviedb.org/${mediaType}/${tmdbId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={link}
      >
        <HugeiconsIcon icon={LinkSquare02Icon} className="h-3 w-3" />
        TMDB
      </a>
      {imdbId && (
        <a
          href={`https://www.imdb.com/title/${imdbId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={link}
        >
          <HugeiconsIcon icon={LinkSquare02Icon} className="h-3 w-3" />
          IMDb
        </a>
      )}
    </div>
  )
}

/**
 * States where an Add will actually land before it is committed. The operator running two
 * root folders should never have to guess which one a single tap chose for them.
 */
function AddDestination({
  profiles,
  rootFolders,
  mediaType,
  configLoaded,
}: {
  profiles: QualityProfile[]
  rootFolders: { id: string; path: string; mediaType: string }[]
  mediaType: 'movies' | 'tv'
  configLoaded: boolean
}) {
  if (!configLoaded) {
    return <p className="text-muted-foreground text-xs">Checking destination…</p>
  }

  const folder = rootFolders.find((rf) => rf.mediaType === mediaType)
  if (!folder) {
    return (
      <p className="text-status-failed-ink text-xs">
        No root folder configured for {mediaType === 'movies' ? 'movies' : 'TV shows'}. Add one in
        Settings first.
      </p>
    )
  }

  return (
    <p className="text-muted-foreground text-xs">
      Adds to{' '}
      <span className="readout text-foreground">
        {profiles.length === 1 ? profiles[0].name : 'a profile you pick next'}
      </span>{' '}
      in <span className="readout text-foreground">{folder.path}</span>, and searches indexers
      immediately.
    </p>
  )
}
