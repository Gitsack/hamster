import { Head, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectPopup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HugeiconsIcon } from '@hugeicons/react'
import { Film01Icon, Tv01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { CardStatusBadge, type MediaItemStatus } from '@/components/library/media-status-badge'
import { AddMediaDialog, type QualityProfile } from '@/components/add-media-dialog'
import { SeasonPickerDialog, type SeasonEpisodeSelection } from '@/components/season-picker-dialog'
import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useMediaPreview } from '@/contexts/media_preview_context'

interface MovieResult {
  tmdbId: string
  title: string
  year?: number
  overview?: string
  posterUrl?: string
  releaseDate?: string
  rating?: number
  genres?: string[]
  inLibrary: boolean
  libraryId?: number
  requested?: boolean
  hasFile?: boolean
}

interface TvShowResult {
  tmdbId: string
  title: string
  year?: number
  overview?: string
  posterUrl?: string
  firstAirDate?: string
  status?: string
  rating?: number
  seasonCount?: number
  episodeCount?: number
  genres?: string[]
  inLibrary: boolean
  libraryId?: number
  requested?: boolean
}

type DiscoverItem = MovieResult | TvShowResult

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  movies: {
    'popular': 'Popular Movies',
    'now_playing': 'Now in Cinemas',
    'trending': 'Trending Movies',
    'trakt-trending': 'Trending on Trakt',
    'trakt-anticipated': 'Most Anticipated',
    'trakt-recommended': 'Community Recommended',
    'justwatch-popular': 'Popular Streaming Movies',
  },
  tv: {
    'popular': 'Popular Shows',
    'on_the_air': 'Currently Airing',
    'top_rated': 'Top Rated Shows',
    'trending': 'Trending Shows',
    'trakt-trending': 'Trending on Trakt',
    'trakt-anticipated': 'Most Anticipated',
    'trakt-recommended': 'Community Recommended',
    'justwatch-popular': 'Popular Streaming Shows',
  },
}

const MOVIE_GENRE_NAMES: Record<string, string> = {
  '28': 'Action',
  '12': 'Adventure',
  '16': 'Animation',
  '35': 'Comedy',
  '80': 'Crime',
  '99': 'Documentary',
  '18': 'Drama',
  '10751': 'Family',
  '14': 'Fantasy',
  '36': 'History',
  '27': 'Horror',
  '10402': 'Music',
  '9648': 'Mystery',
  '10749': 'Romance',
  '878': 'Sci-Fi',
  '10770': 'TV Movie',
  '53': 'Thriller',
  '10752': 'War',
  '37': 'Western',
}

const TV_GENRE_NAMES: Record<string, string> = {
  '10759': 'Action',
  '16': 'Animation',
  '35': 'Comedy',
  '80': 'Crime',
  '99': 'Documentary',
  '18': 'Drama',
  '10751': 'Family',
  '10762': 'Kids',
  '9648': 'Mystery',
  '10763': 'News',
  '10764': 'Reality',
  '10765': 'Sci-Fi',
  '10766': 'Soap',
  '10767': 'Talk',
  '10768': 'Politics',
  '37': 'Western',
}

// Map recommendation lane keys to API source params
const RECOMMENDATION_SOURCES: Record<string, string> = {
  'trakt-trending': 'trakt',
  'trakt-anticipated': 'trakt',
  'trakt-recommended': 'trakt',
  'justwatch-popular': 'justwatch',
}

// Map recommendation lane keys to their specific lane key in the API response
const RECOMMENDATION_LANE_KEYS: Record<string, Record<string, string>> = {
  movies: {
    'trakt-trending': 'trakt-trending-movies',
    'trakt-anticipated': 'trakt-anticipated-movies',
    'trakt-recommended': 'trakt-recommended-movies',
    'justwatch-popular': 'justwatch-popular-movies',
  },
  tv: {
    'trakt-trending': 'trakt-trending-shows',
    'trakt-anticipated': 'trakt-anticipated-shows',
    'trakt-recommended': 'trakt-recommended-shows',
    'justwatch-popular': 'justwatch-popular-shows',
  },
}

export default function DiscoverPage() {
  const { url } = usePage()
  // Parse /discover/:type/:category from URL
  const segments = url.split('?')[0].split('/')
  const discoverIdx = segments.indexOf('discover')
  const type = segments[discoverIdx + 1] || 'movies'
  const category = segments[discoverIdx + 2] || 'popular'
  const mediaType = type as 'movies' | 'tv'

  // Parse query params for genre discovery
  const urlParams = new URLSearchParams(url.split('?')[1] || '')
  const genreId = urlParams.get('genreId')
  const initialSortBy = urlParams.get('sortBy') || 'popularity.desc'

  const isGenre = category === 'genre' && !!genreId
  const genreNames = mediaType === 'movies' ? MOVIE_GENRE_NAMES : TV_GENRE_NAMES
  const genreName = isGenre ? genreNames[genreId!] || 'Genre' : ''
  const genreTitle = isGenre
    ? `${genreName} ${mediaType === 'movies' ? 'Movies' : 'Shows'}`
    : ''

  const pageTitle = isGenre
    ? genreTitle
    : CATEGORY_LABELS[mediaType]?.[category] || 'Discover'
  const isRecommendation = category in RECOMMENDATION_SOURCES
  const apiBase = mediaType === 'movies' ? '/api/v1/movies/discover' : '/api/v1/tvshows/discover'
  const recApiBase =
    mediaType === 'movies' ? '/api/v1/recommendations/movies' : '/api/v1/recommendations/tv'

  const [items, setItems] = useState<DiscoverItem[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const [togglingItems, setTogglingItems] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState(initialSortBy)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Add dialog state
  const [rootFolders, setRootFolders] = useState<{ id: string; path: string; mediaType: string }[]>(
    []
  )
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [selectedItem, setSelectedItem] = useState<DiscoverItem | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  // TV show season picker state
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false)
  const [episodeSelection, setEpisodeSelection] = useState<SeasonEpisodeSelection | null>(null)

  const profiles = qualityProfiles.filter(
    (p) => p.mediaType === (mediaType === 'movies' ? 'movies' : 'tv')
  )

  // Sort options
  const sortOptions = [
    { value: 'popularity.desc', label: 'Popular' },
    {
      value: mediaType === 'movies' ? 'primary_release_date.desc' : 'first_air_date.desc',
      label: 'Newest',
    },
    { value: 'vote_average.desc', label: 'Top Rated' },
    ...(mediaType === 'movies' ? [{ value: 'revenue.desc', label: 'Revenue' }] : []),
  ]

  // Fetch config on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/v1/rootfolders').then((r) => r.json()),
      fetch('/api/v1/qualityprofiles').then((r) => r.json()),
    ]).then(([rf, qp]) => {
      setRootFolders(rf)
      setQualityProfiles(qp)
    })
  }, [])

  // Fetch a TMDB discover page (paginated)
  const fetchPage = useCallback(
    async (pageNum: number) => {
      if (loading || pageNum > totalPages) return
      setLoading(true)
      try {
        let fetchUrl = `${apiBase}?category=${category}&page=${pageNum}`
        if (isGenre && genreId) {
          fetchUrl += `&genreId=${genreId}&sortBy=${sortBy}`
        }
        const response = await fetch(fetchUrl)
        if (response.ok) {
          const data = await response.json()
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.tmdbId))
            const newItems = data.results.filter((i: DiscoverItem) => !existingIds.has(i.tmdbId))
            return [...prev, ...newItems]
          })
          setTotalPages(data.totalPages)
          setPage(pageNum)
        }
      } catch (error) {
        console.error('Failed to fetch discover page:', error)
      } finally {
        setLoading(false)
        setInitialLoading(false)
      }
    },
    [apiBase, category, loading, totalPages, isGenre, genreId, sortBy]
  )

  // Fetch recommendation lane (single page, no pagination)
  const fetchRecommendations = useCallback(async () => {
    setLoading(true)
    try {
      const source = RECOMMENDATION_SOURCES[category]
      const laneKey = RECOMMENDATION_LANE_KEYS[mediaType]?.[category]
      const response = await fetch(`${recApiBase}?source=${source}`)
      if (response.ok) {
        const data = await response.json()
        const lane = data.lanes?.find((l: { key: string }) => l.key === laneKey)
        if (lane) {
          setItems(lane.items)
        }
        setTotalPages(1) // No pagination for recommendations
        setPage(1)
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [recApiBase, category, mediaType])

  // Initial load
  useEffect(() => {
    if (isRecommendation) {
      fetchRecommendations()
    } else {
      fetchPage(1)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle sort change for genre pages
  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy)
    setItems([])
    setPage(0)
    setTotalPages(1)
    setInitialLoading(true)
  }

  // Re-fetch when sort changes (for genre pages)
  useEffect(() => {
    if (isGenre && sortBy !== initialSortBy) {
      fetchPage(1)
    }
  }, [sortBy]) // eslint-disable-line react-hooks/exhaustive-deps

  // Intersection observer for infinite scroll (only for TMDB discover)
  useEffect(() => {
    if (isRecommendation) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && page < totalPages) {
          fetchPage(page + 1)
        }
      },
      { rootMargin: '400px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [isRecommendation, page, totalPages, loading, fetchPage])

  const handleImageError = useCallback((key: string) => {
    setFailedImages((prev) => new Set(prev).add(key))
  }, [])

  const updateItem = (tmdbId: string, updater: (item: DiscoverItem) => DiscoverItem) => {
    setItems((prev) => prev.map((i) => (i.tmdbId === tmdbId ? updater(i) : i)))
  }

  // Add movie to library
  const addMovieWithProfile = async (movie: MovieResult, qualityProfileId: string) => {
    const movieRootFolder = rootFolders.find((rf) => rf.mediaType === 'movies')
    if (!movieRootFolder) {
      toast.error('No root folder configured for movies. Please add one in Settings.')
      return
    }
    setAddingItem(true)
    try {
      const response = await fetch('/api/v1/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: movie.tmdbId,
          title: movie.title,
          year: movie.year,
          qualityProfileId,
          rootFolderId: movieRootFolder.id,
          requested: true,
          searchOnAdd: true,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`${movie.title} added to library`)
        setAddDialogOpen(false)
        updateItem(movie.tmdbId, (m) => ({
          ...m,
          inLibrary: true,
          libraryId: data.id,
          requested: true,
        }))
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add movie')
      }
    } catch {
      toast.error('Failed to add movie')
    } finally {
      setAddingItem(false)
    }
  }

  // Add TV show to library
  const addTvShowWithProfile = async (
    show: TvShowResult,
    qualityProfileId: string,
    selection: SeasonEpisodeSelection | null
  ) => {
    const tvRootFolder = rootFolders.find((rf) => rf.mediaType === 'tv')
    if (!tvRootFolder) {
      toast.error('No root folder configured for TV shows. Please add one in Settings.')
      return
    }
    setAddingItem(true)
    try {
      const response = await fetch('/api/v1/tvshows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: show.tmdbId,
          title: show.title,
          year: show.year,
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
        toast.success(`${show.title} added to library`)
        setAddDialogOpen(false)
        setEpisodeSelection(null)
        updateItem(show.tmdbId, (s) => ({
          ...s,
          inLibrary: true,
          libraryId: data.id,
          requested: true,
        }))
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add TV show')
      }
    } catch {
      toast.error('Failed to add TV show')
    } finally {
      setAddingItem(false)
    }
  }

  const handleAdd = (item: DiscoverItem) => {
    setSelectedItem(item)
    if (mediaType === 'tv') {
      setSeasonPickerOpen(true)
    } else if (profiles.length === 1) {
      addMovieWithProfile(item as MovieResult, profiles[0].id)
    } else {
      setAddDialogOpen(true)
    }
  }

  const handleSeasonPickerConfirm = (selection: SeasonEpisodeSelection) => {
    setEpisodeSelection(selection)
    setSeasonPickerOpen(false)
    if (profiles.length === 1) {
      addTvShowWithProfile(selectedItem as TvShowResult, profiles[0].id, selection)
    } else {
      setAddDialogOpen(true)
    }
  }

  const handleAddDialogConfirm = (qualityProfileId: string) => {
    if (!selectedItem) return
    if (mediaType === 'movies') {
      addMovieWithProfile(selectedItem as MovieResult, qualityProfileId)
    } else {
      addTvShowWithProfile(selectedItem as TvShowResult, qualityProfileId, episodeSelection)
    }
  }

  const toggleRequested = async (item: DiscoverItem) => {
    if (!item.libraryId || !item.inLibrary) return
    const tmdbId = item.tmdbId
    setTogglingItems((prev) => new Set(prev).add(tmdbId))

    const wasRequested = item.requested
    if (mediaType === 'movies' && wasRequested && (item as MovieResult).hasFile) {
      toast.error('Movie has downloaded files. Delete files first before unrequesting.')
      setTogglingItems((prev) => {
        const next = new Set(prev)
        next.delete(tmdbId)
        return next
      })
      return
    }

    updateItem(tmdbId, (i) => ({ ...i, requested: !wasRequested }))

    const endpoint =
      mediaType === 'movies'
        ? `/api/v1/movies/${item.libraryId}/request`
        : `/api/v1/tvshows/${item.libraryId}`
    const body =
      mediaType === 'movies' ? { requested: !wasRequested } : { requested: !wasRequested }
    const method = mediaType === 'movies' ? 'POST' : 'PUT'

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (response.ok) {
        if (data.deleted) {
          toast.success('Removed from library')
          updateItem(tmdbId, (i) => ({
            ...i,
            inLibrary: false,
            libraryId: undefined,
            requested: false,
          }))
        } else {
          toast.success(wasRequested ? 'Unrequested' : 'Requested')
        }
      } else {
        updateItem(tmdbId, (i) => ({ ...i, requested: wasRequested }))
        toast.error(data.error || 'Failed to update')
      }
    } catch {
      updateItem(tmdbId, (i) => ({ ...i, requested: wasRequested }))
      toast.error('Failed to update')
    } finally {
      setTogglingItems((prev) => {
        const next = new Set(prev)
        next.delete(tmdbId)
        return next
      })
    }
  }

  const { openMoviePreview, openTvShowPreview } = useMediaPreview()

  const handleItemClick = (item: DiscoverItem) => {
    if (item.inLibrary && item.libraryId) {
      const path = mediaType === 'movies' ? `/movie/${item.libraryId}` : `/tvshow/${item.libraryId}`
      router.visit(path)
    } else {
      if (mediaType === 'movies') openMoviePreview(item.tmdbId)
      else openTvShowPreview(item.tmdbId)
    }
  }

  const isMovie = mediaType === 'movies'
  const IconComponent = isMovie ? Film01Icon : Tv01Icon

  return (
    <AppLayout>
      <Head title={pageTitle} />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.visit(`/search?mode=${mediaType === 'movies' ? 'movies' : 'tv'}`)}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          {isGenre && (
            <div className="ml-auto">
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder={sortOptions.find((o) => o.value === sortBy)?.label ?? 'Sort by'}>
                    {sortOptions.find((o) => o.value === sortBy)?.label ?? 'Sort by'}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          )}
        </div>

        {/* Grid */}
        {initialLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item) => {
              const imageKey = `discover-${item.tmdbId}`
              const hasImage = item.posterUrl && !failedImages.has(imageKey)

              let status: MediaItemStatus = 'none'
              if (item.inLibrary) {
                if (isMovie) {
                  const movie = item as MovieResult
                  status = movie.hasFile
                    ? 'downloaded'
                    : movie.requested
                      ? 'requested'
                      : 'downloaded'
                } else {
                  const show = item as TvShowResult
                  status = show.requested ? 'requested' : 'downloaded'
                }
              }

              const handleToggle =
                status === 'none'
                  ? () => handleAdd(item)
                  : status === 'requested'
                    ? () => toggleRequested(item)
                    : undefined

              return (
                <div
                  key={item.tmdbId}
                  className="group cursor-pointer"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                    {hasImage ? (
                      <img
                        src={item.posterUrl!}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        onError={() => handleImageError(imageKey)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <HugeiconsIcon
                          icon={IconComponent}
                          className="h-12 w-12 text-muted-foreground/30"
                        />
                      </div>
                    )}
                    {item.genres && item.genres.length > 0 && (
                      <Badge
                        className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 bg-black/40 backdrop-blur-sm text-white/90 border-0"
                        variant="secondary"
                      >
                        {item.genres[0].toUpperCase()}
                      </Badge>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <div
                      className="absolute top-2 right-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CardStatusBadge
                        status={status}
                        size="tiny"
                        showOnHover={status === 'none'}
                        isToggling={togglingItems.has(item.tmdbId)}
                        onToggleRequest={handleToggle}
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-sm font-medium line-clamp-2">{item.title}</p>
                      {item.year && <p className="text-white/70 text-xs">{item.year}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {/* Loading more indicator */}
        {loading && !initialLoading && (
          <div className="flex justify-center py-4">
            <Spinner className="h-6 w-6" />
          </div>
        )}

        {/* End of results */}
        {!loading && page >= totalPages && items.length > 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">No more results</p>
        )}
      </div>

      {/* Season Picker Dialog (TV only) */}
      {selectedItem && mediaType === 'tv' && (
        <SeasonPickerDialog
          tmdbId={selectedItem.tmdbId}
          showTitle={selectedItem.title}
          open={seasonPickerOpen}
          onOpenChange={setSeasonPickerOpen}
          onConfirm={handleSeasonPickerConfirm}
        />
      )}

      {/* Add Media Dialog */}
      {selectedItem && (
        <AddMediaDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          mediaType={isMovie ? 'movie' : 'tvshow'}
          title={`Add ${selectedItem.title}`}
          description={`Add ${selectedItem.title} to your library`}
          qualityProfiles={profiles}
          adding={addingItem}
          onAdd={(qualityProfileId) => handleAddDialogConfirm(qualityProfileId)}
        />
      )}
    </AppLayout>
  )
}
