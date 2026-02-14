import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { router } from '@inertiajs/react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
} from '@hugeicons/core-free-icons'
import {
  MediaStatusBadge,
  type MediaItemStatus,
} from '@/components/library/media-status-badge'
import { SimilarLane } from '@/components/library/similar-lane'
import { AddMediaDialog, type QualityProfile } from '@/components/add-media-dialog'
import { SeasonPickerDialog, type SeasonEpisodeSelection } from '@/components/season-picker-dialog'

interface StreamingOffer {
  monetizationType: string
  providerId: number
  providerName: string
  providerIconUrl: string
  presentationType: string
  url: string
  retailPrice?: number
  currency?: string
}

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
  cast?: { id: number; name: string; character: string; profileUrl?: string }[]
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
  cast?: { id: number; name: string; character: string; profileUrl?: string }[]
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

  // Add flow state
  const [rootFolders, setRootFolders] = useState<{ id: string; path: string; mediaType: string }[]>([])
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
      toast.error('Failed to load configuration')
    }
  }, [configLoaded])

  // Open movie preview
  const openMoviePreview = useCallback(async (tmdbId: string) => {
    setDetailsType('movie')
    setSheetOpen(true)
    setDetailsLoading(true)
    setMovieDetails(null)
    setTvShowDetails(null)

    try {
      const response = await fetch(`/api/v1/movies/preview?tmdbId=${tmdbId}`)
      if (response.ok) {
        const data = await response.json()
        setMovieDetails(data)
      } else {
        toast.error('Failed to load movie details')
        setSheetOpen(false)
      }
    } catch {
      toast.error('Failed to load movie details')
      setSheetOpen(false)
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  // Open TV show preview
  const openTvShowPreview = useCallback(async (tmdbId: string) => {
    setDetailsType('tv')
    setSheetOpen(true)
    setDetailsLoading(true)
    setMovieDetails(null)
    setTvShowDetails(null)

    try {
      const response = await fetch(`/api/v1/tvshows/preview?tmdbId=${tmdbId}`)
      if (response.ok) {
        const data = await response.json()
        setTvShowDetails(data)
      } else {
        toast.error('Failed to load TV show details')
        setSheetOpen(false)
      }
    } catch {
      toast.error('Failed to load TV show details')
      setSheetOpen(false)
    } finally {
      setDetailsLoading(false)
    }
  }, [])

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
        toast.error(data.error || 'Failed to update movie')
      }
    } catch {
      setMovieDetails({ ...movieDetails, requested: wasRequested })
      toast.error('Failed to update movie')
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
        toast.error('Failed to update TV show')
      }
    } catch {
      setTvShowDetails({ ...tvShowDetails, requested: wasRequested })
      toast.error('Failed to update TV show')
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
        toast.error(error.error || 'Failed to add movie')
      }
    } catch {
      toast.error('Failed to add movie')
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
        toast.error(error.error || 'Failed to add TV show')
      }
    } catch {
      toast.error('Failed to add TV show')
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

  return (
    <MediaPreviewContext.Provider value={{ openMoviePreview, openTvShowPreview }}>
      {children}

      {/* Preview Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailsLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="aspect-video w-full rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ) : detailsType === 'movie' && movieDetails ? (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-xl pr-8">{movieDetails.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-6 pb-6 overflow-y-auto">
                {/* Backdrop/Poster */}
                {(movieDetails.backdropUrl || movieDetails.posterUrl) && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                    <img
                      src={movieDetails.backdropUrl || movieDetails.posterUrl}
                      alt={movieDetails.title}
                      className="w-full h-full object-cover"
                    />
                    {movieDetails.inLibrary && (
                      <div className="absolute top-3 right-3">
                        <MediaStatusBadge
                          status={
                            movieDetails.hasFile
                              ? 'downloaded'
                              : movieDetails.requested
                                ? 'requested'
                                : 'downloaded'
                          }
                          size="sm"
                          isToggling={togglingDetails}
                          onToggleRequest={
                            !movieDetails.hasFile && movieDetails.requested
                              ? toggleMovieDetailsRequested
                              : undefined
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {movieDetails.year && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <HugeiconsIcon icon={Calendar03Icon} className="h-4 w-4" />
                      <span>{movieDetails.year}</span>
                    </div>
                  )}
                  {movieDetails.runtime && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <HugeiconsIcon icon={Time01Icon} className="h-4 w-4" />
                      <span>{movieDetails.runtime} min</span>
                    </div>
                  )}
                  {movieDetails.rating && (
                    <div className="flex items-center gap-1.5 text-yellow-500">
                      <HugeiconsIcon icon={StarIcon} className="h-4 w-4 fill-current" />
                      <span className="font-medium">{movieDetails.rating.toFixed(1)}</span>
                      {movieDetails.votes && (
                        <span className="text-muted-foreground">
                          ({movieDetails.votes.toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Genres */}
                {movieDetails.genres && movieDetails.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {movieDetails.genres.map((genre) => (
                      <Badge key={genre} variant="secondary">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Where to Watch */}
                <StreamingOffers offers={movieDetails.streamingOffers} />

                {/* Cast */}
                <CastLane cast={movieDetails.cast} />

                {/* Overview */}
                {movieDetails.overview && (
                  <div>
                    <h4 className="font-medium mb-2">Overview</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {movieDetails.overview}
                    </p>
                  </div>
                )}

                {/* Status */}
                {movieDetails.status && (
                  <div className="flex items-center gap-2 text-sm">
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      className="h-4 w-4 text-muted-foreground"
                    />
                    <span className="text-muted-foreground">Status:</span>
                    <span>{movieDetails.status}</span>
                  </div>
                )}

                {/* Similar Movies */}
                <SimilarLane mediaType="movies" tmdbId={movieDetails.tmdbId} />

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  {movieDetails.inLibrary ? (
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setSheetOpen(false)
                        router.visit(`/movie/${movieDetails.libraryId}`)
                      }}
                    >
                      <HugeiconsIcon icon={ViewIcon} className="h-4 w-4 mr-2" />
                      View in Library
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      disabled={adding}
                      onClick={handleAddToLibrary}
                    >
                      {adding ? (
                        <Spinner className="h-4 w-4 mr-2" />
                      ) : (
                        <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
                      )}
                      Add to Library
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : detailsType === 'tv' && tvShowDetails ? (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-xl pr-8">{tvShowDetails.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-6 pb-6 overflow-y-auto">
                {/* Backdrop/Poster */}
                {(tvShowDetails.backdropUrl || tvShowDetails.posterUrl) && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                    <img
                      src={tvShowDetails.backdropUrl || tvShowDetails.posterUrl}
                      alt={tvShowDetails.title}
                      className="w-full h-full object-cover"
                    />
                    {tvShowDetails.inLibrary && (
                      <div className="absolute top-3 right-3">
                        <MediaStatusBadge
                          status={tvShowDetails.requested ? 'requested' : 'downloaded'}
                          size="sm"
                          isToggling={togglingDetails}
                          onToggleRequest={
                            tvShowDetails.requested ? toggleTvShowDetailsRequested : undefined
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {tvShowDetails.year && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <HugeiconsIcon icon={Calendar03Icon} className="h-4 w-4" />
                      <span>{tvShowDetails.year}</span>
                    </div>
                  )}
                  {tvShowDetails.seasonCount && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <HugeiconsIcon icon={Tv01Icon} className="h-4 w-4" />
                      <span>
                        {tvShowDetails.seasonCount} Season
                        {tvShowDetails.seasonCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {tvShowDetails.rating && (
                    <div className="flex items-center gap-1.5 text-yellow-500">
                      <HugeiconsIcon icon={StarIcon} className="h-4 w-4 fill-current" />
                      <span className="font-medium">{tvShowDetails.rating.toFixed(1)}</span>
                      {tvShowDetails.votes && (
                        <span className="text-muted-foreground">
                          ({tvShowDetails.votes.toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Genres */}
                {tvShowDetails.genres && tvShowDetails.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tvShowDetails.genres.map((genre) => (
                      <Badge key={genre} variant="secondary">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Networks */}
                {tvShowDetails.networks && tvShowDetails.networks.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Network: {tvShowDetails.networks.join(', ')}
                  </div>
                )}

                {/* Where to Watch */}
                <StreamingOffers offers={tvShowDetails.streamingOffers} />

                {/* Cast */}
                <CastLane cast={tvShowDetails.cast} />

                {/* Overview */}
                {tvShowDetails.overview && (
                  <div>
                    <h4 className="font-medium mb-2">Overview</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tvShowDetails.overview}
                    </p>
                  </div>
                )}

                {/* Status */}
                {tvShowDetails.status && (
                  <div className="flex items-center gap-2 text-sm">
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      className="h-4 w-4 text-muted-foreground"
                    />
                    <span className="text-muted-foreground">Status:</span>
                    <span>{tvShowDetails.status}</span>
                  </div>
                )}

                {/* Similar Shows */}
                <SimilarLane mediaType="tv" tmdbId={tvShowDetails.tmdbId} />

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  {tvShowDetails.inLibrary ? (
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setSheetOpen(false)
                        router.visit(`/tvshow/${tvShowDetails.libraryId}`)
                      }}
                    >
                      <HugeiconsIcon icon={ViewIcon} className="h-4 w-4 mr-2" />
                      View in Library
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      disabled={adding}
                      onClick={handleAddToLibrary}
                    >
                      {adding ? (
                        <Spinner className="h-4 w-4 mr-2" />
                      ) : (
                        <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
                      )}
                      Add to Library
                    </Button>
                  )}
                </div>
              </div>
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
        title={`Add ${detailsType === 'movie' ? movieDetails?.title : tvShowDetails?.title}`}
        description={`Add ${detailsType === 'movie' ? movieDetails?.title : tvShowDetails?.title} to your library`}
        qualityProfiles={profiles}
        adding={adding}
        onAdd={handleAddDialogConfirm}
      />
    </MediaPreviewContext.Provider>
  )
}

// Extracted sub-components for the sheet content

function StreamingOffers({ offers }: { offers?: StreamingOffer[] }) {
  if (!offers || offers.length === 0) return null

  const flatrateOffers = offers.filter((o) => o.monetizationType === 'flatrate')
  const rentBuyOffers = offers.filter(
    (o) => o.monetizationType === 'rent' || o.monetizationType === 'buy'
  )

  return (
    <div>
      <h4 className="font-medium mb-3">Where to Watch</h4>
      {flatrateOffers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flatrateOffers.map((offer) => (
            <a
              key={`${offer.providerId}-${offer.presentationType}`}
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted transition-colors"
            >
              {offer.providerIconUrl && (
                <img
                  src={offer.providerIconUrl}
                  alt={offer.providerName}
                  className="w-6 h-6 rounded"
                />
              )}
              <span className="text-sm font-medium">{offer.providerName}</span>
              {offer.presentationType && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {offer.presentationType.toUpperCase()}
                </Badge>
              )}
            </a>
          ))}
        </div>
      )}
      {rentBuyOffers.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">Also available to rent or buy:</p>
          <div className="flex flex-wrap gap-2">
            {rentBuyOffers.map((offer) => (
              <a
                key={`${offer.providerId}-${offer.monetizationType}-${offer.presentationType}`}
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 hover:bg-muted transition-colors text-xs"
              >
                {offer.providerIconUrl && (
                  <img
                    src={offer.providerIconUrl}
                    alt={offer.providerName}
                    className="w-4 h-4 rounded"
                  />
                )}
                <span>{offer.providerName}</span>
                <span className="text-muted-foreground">
                  {offer.monetizationType === 'rent' ? 'Rent' : 'Buy'}
                  {offer.retailPrice
                    ? ` ${offer.currency || 'EUR'} ${offer.retailPrice.toFixed(2)}`
                    : ''}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CastLane({
  cast,
}: {
  cast?: { id: number; name: string; character: string; profileUrl?: string }[]
}) {
  if (!cast || cast.length === 0) return null

  return (
    <div>
      <h4 className="font-medium mb-3">Cast</h4>
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
        style={{ scrollbarWidth: 'thin' }}
      >
        {cast.map((actor) => (
          <div key={actor.id} className="flex-shrink-0 w-16 text-center">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted mb-1.5">
              {actor.profileUrl ? (
                <img
                  src={actor.profileUrl}
                  alt={actor.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg font-medium">
                  {actor.name.charAt(0)}
                </div>
              )}
            </div>
            <p className="text-[11px] font-medium leading-tight line-clamp-2">{actor.name}</p>
            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
              {actor.character}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
