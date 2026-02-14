import { Head, router } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  Download01Icon,
  Link01Icon,
  SortingIcon,
  Settings02Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  MusicNote01Icon,
  Album01Icon,
  MusicNoteSquare01Icon,
  CheckmarkCircle01Icon,
  Globe02Icon,
  Add01Icon,
  MoreVerticalIcon,
  Film01Icon,
  Tv01Icon,
  Book01Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  ViewIcon,
  Cancel01Icon,
  StarIcon,
  Time01Icon,
  Calendar03Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  Component,
  ErrorInfo,
  ReactNode,
} from 'react'
import { toast } from 'sonner'
import { SeasonPickerDialog, type SeasonEpisodeSelection } from '@/components/season-picker-dialog'
import { AddMediaDialog, type QualityProfile } from '@/components/add-media-dialog'
import {
  MediaStatusBadge,
  CardStatusBadge,
  type MediaItemStatus,
} from '@/components/library/media-status-badge'

// Error boundary to catch rendering errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Search page error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-destructive rounded bg-destructive/10 text-destructive">
          <h2 className="font-bold">Something went wrong</h2>
          <pre className="text-sm mt-2 whitespace-pre-wrap">{this.state.error?.message}</pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-3 py-1 bg-destructive text-destructive-foreground rounded"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Types
type MediaType = 'music' | 'movies' | 'tv' | 'books'
type MusicSearchType = 'artist' | 'album' | 'track'

interface IndexerSearchResult {
  id: string
  title: string
  size: number
  publishDate: string
  indexer: string
  indexerId: number
  downloadUrl: string
  infoUrl?: string
  guid: string
  category?: string
  seeders?: number
  leechers?: number
  grabs?: number
  protocol?: 'usenet' | 'torrent'
}

interface ArtistSearchResult {
  musicbrainzId: string
  name: string
  sortName: string
  disambiguation?: string
  type?: string
  country?: string
  beginDate?: string
  endDate?: string
  inLibrary: boolean
}

interface AlbumSearchResult {
  musicbrainzId: string
  title: string
  artistName: string
  artistMusicbrainzId: string
  releaseDate?: string
  type?: string
  inLibrary: boolean
}

interface TrackSearchResult {
  musicbrainzId: string
  title: string
  artistName: string
  artistMusicbrainzId: string
  albumTitle?: string
  albumMusicbrainzId?: string
  duration?: number
  inLibrary: boolean
}

interface MovieSearchResult {
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

interface TvShowSearchResult {
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

interface AuthorSearchResult {
  openlibraryId: string
  name: string
  birthDate?: string
  inLibrary: boolean
}

interface BookSearchResult {
  openlibraryId: string
  title: string
  authorName: string
  authorKey?: string
  year?: number
  coverUrl?: string
  inLibrary: boolean
}

interface Indexer {
  id: number
  name: string
  enabled: boolean
}

interface DownloadClient {
  id: number
  name: string
  type: string
  enabled: boolean
}

interface QualityProfile {
  id: string
  name: string
  mediaType?: string
}

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

interface RecommendationLane {
  key: string
  label: string
  source: 'tmdb' | 'trakt' | 'justwatch'
  items: (MovieSearchResult | TvShowSearchResult)[]
}

type SortField = 'age' | 'title' | 'size' | 'indexer' | 'grabs' | 'category'
type SortDirection = 'asc' | 'desc'

interface ColumnConfig {
  id: string
  label: string
  visible: boolean
}

const defaultColumns: ColumnConfig[] = [
  { id: 'select', label: 'Select', visible: true },
  { id: 'protocol', label: 'Protocol', visible: true },
  { id: 'age', label: 'Age', visible: true },
  { id: 'title', label: 'Title', visible: true },
  { id: 'indexer', label: 'Indexer', visible: true },
  { id: 'size', label: 'Size', visible: true },
  { id: 'grabs', label: 'Grabs', visible: true },
  { id: 'category', label: 'Category', visible: true },
  { id: 'actions', label: 'Actions', visible: true },
]

const MEDIA_TYPE_CONFIG: Record<MediaType, { label: string; icon: typeof MusicNote01Icon }> = {
  music: { label: 'Music', icon: MusicNote01Icon },
  movies: { label: 'Movies', icon: Film01Icon },
  tv: { label: 'TV Shows', icon: Tv01Icon },
  books: { label: 'Books', icon: Book01Icon },
}

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatAge(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day'
    if (diffDays < 7) return `${diffDays} days`
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return `${weeks} week${weeks > 1 ? 's' : ''}`
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `${months} month${months > 1 ? 's' : ''}`
    }
    const years = Math.floor(diffDays / 365)
    return `${years} year${years > 1 ? 's' : ''}`
  } catch {
    return dateString
  }
}

export default function SearchPage() {
  // Get initial mode from URL params
  const urlParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const initialMode = (urlParams?.get('mode') as MediaType | 'direct') || 'music'
  const initialType = (urlParams?.get('type') as MusicSearchType) || 'artist'

  // Enabled media types from settings
  const [enabledMediaTypes, setEnabledMediaTypes] = useState<MediaType[]>(['music'])

  // Main state
  const [searchMode, setSearchModeState] = useState<MediaType | 'direct'>(initialMode)
  const [musicSearchType, setMusicSearchType] = useState<MusicSearchType>(initialType)

  // Sync search mode to URL
  const setSearchMode = useCallback((mode: MediaType | 'direct') => {
    setSearchModeState(mode)
    const url = new URL(window.location.href)
    url.searchParams.set('mode', mode)
    window.history.replaceState({}, '', url.toString())
  }, [])
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Music search results
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([])
  const [albumResults, setAlbumResults] = useState<AlbumSearchResult[]>([])
  const [trackResults, setTrackResults] = useState<TrackSearchResult[]>([])

  // Movies search results
  const [movieResults, setMovieResults] = useState<MovieSearchResult[]>([])

  // Movies discover results (all categories as lanes)
  const [movieDiscoverLanes, setMovieDiscoverLanes] = useState<Record<string, MovieSearchResult[]>>(
    {}
  )
  const [loadingMovieDiscover, setLoadingMovieDiscover] = useState(false)

  // TV search results
  const [tvShowResults, setTvShowResults] = useState<TvShowSearchResult[]>([])

  // TV discover results (all categories as lanes)
  const [tvDiscoverLanes, setTvDiscoverLanes] = useState<Record<string, TvShowSearchResult[]>>({})
  const [loadingTvDiscover, setLoadingTvDiscover] = useState(false)

  // Recommendation lanes
  const [movieRecommendationLanes, setMovieRecommendationLanes] = useState<RecommendationLane[]>([])
  const [tvRecommendationLanes, setTvRecommendationLanes] = useState<RecommendationLane[]>([])
  const [loadingMovieRecs, setLoadingMovieRecs] = useState(false)
  const [loadingTvRecs, setLoadingTvRecs] = useState(false)

  // Books search results
  const [authorResults, setAuthorResults] = useState<AuthorSearchResult[]>([])
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([])
  const [booksSearchType, setBooksSearchType] = useState<'author' | 'book'>('author')

  // Direct search results
  const [indexerResults, setIndexerResults] = useState<IndexerSearchResult[]>([])

  // Filters (direct search)
  const [indexers, setIndexers] = useState<Indexer[]>([])
  const [selectedIndexers, setSelectedIndexers] = useState<number[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Sorting (direct search)
  const [sortField, setSortField] = useState<SortField>('age')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns)
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set())

  // Download clients
  const [downloadClients, setDownloadClients] = useState<DownloadClient[]>([])
  const [selectedIndexerResult, setSelectedIndexerResult] = useState<IndexerSearchResult | null>(
    null
  )
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [bulkDownloading, setBulkDownloading] = useState(false)

  // Add dialogs state
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [rootFolders, setRootFolders] = useState<{ id: string; path: string; mediaType: string }[]>(
    []
  )
  const [loadingOptions, setLoadingOptions] = useState(true)

  // Music add state
  const [selectedArtist, setSelectedArtist] = useState<ArtistSearchResult | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumSearchResult | null>(null)
  const [addArtistDialogOpen, setAddArtistDialogOpen] = useState(false)
  const [addAlbumDialogOpen, setAddAlbumDialogOpen] = useState(false)

  // Movie add state
  const [selectedMovie, setSelectedMovie] = useState<MovieSearchResult | null>(null)
  const [addMovieDialogOpen, setAddMovieDialogOpen] = useState(false)
  const [addingMovie, setAddingMovie] = useState(false)
  const [togglingMovies, setTogglingMovies] = useState<Set<string>>(new Set())

  // TV add state
  const [selectedTvShow, setSelectedTvShow] = useState<TvShowSearchResult | null>(null)
  const [addTvShowDialogOpen, setAddTvShowDialogOpen] = useState(false)
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false)
  const [episodeSelection, setEpisodeSelection] = useState<SeasonEpisodeSelection | null>(null)
  const [addingTvShow, setAddingTvShow] = useState(false)
  const [togglingTvShows, setTogglingTvShows] = useState<Set<string>>(new Set())

  // Navigation control after adding
  const [navigateAfterAdd, setNavigateAfterAdd] = useState(true)

  // Entity details sheet state
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false)
  const [detailsType, setDetailsType] = useState<'movie' | 'tv' | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [togglingDetails, setTogglingDetails] = useState(false)
  const [movieDetails, setMovieDetails] = useState<{
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
  } | null>(null)
  const [tvShowDetails, setTvShowDetails] = useState<{
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
  } | null>(null)

  // Books add state
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorSearchResult | null>(null)
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null)
  const [addAuthorDialogOpen, setAddAuthorDialogOpen] = useState(false)
  const [addBookDialogOpen, setAddBookDialogOpen] = useState(false)
  const [addingAuthor, setAddingAuthor] = useState(false)
  const [addingBook, setAddingBook] = useState(false)

  // Common add state
  const [selectedQualityProfile, setSelectedQualityProfile] = useState<string>('')
  const [requested, setWanted] = useState(true)
  const [addingArtist, setAddingArtist] = useState(false)
  const [addingAlbum, setAddingAlbum] = useState(false)
  const [addBooks, setAddBooks] = useState(true)

  // Filtered quality profiles by media type
  const movieProfiles = useMemo(
    () => qualityProfiles.filter((p) => p.mediaType === 'movies'),
    [qualityProfiles]
  )
  const tvProfiles = useMemo(
    () => qualityProfiles.filter((p) => p.mediaType === 'tv'),
    [qualityProfiles]
  )
  const musicProfiles = useMemo(
    () => qualityProfiles.filter((p) => p.mediaType === 'music'),
    [qualityProfiles]
  )
  const bookProfiles = useMemo(
    () => qualityProfiles.filter((p) => p.mediaType === 'books'),
    [qualityProfiles]
  )

  // Set default profile when dialogs open
  useEffect(() => {
    if (addMovieDialogOpen && movieProfiles.length > 0) {
      setSelectedQualityProfile(movieProfiles[0].id)
    }
  }, [addMovieDialogOpen, movieProfiles])

  useEffect(() => {
    if (addTvShowDialogOpen && tvProfiles.length > 0) {
      setSelectedQualityProfile(tvProfiles[0].id)
    }
  }, [addTvShowDialogOpen, tvProfiles])

  useEffect(() => {
    if ((addArtistDialogOpen || addAlbumDialogOpen) && musicProfiles.length > 0) {
      setSelectedQualityProfile(musicProfiles[0].id)
    }
  }, [addArtistDialogOpen, addAlbumDialogOpen, musicProfiles])

  useEffect(() => {
    if ((addAuthorDialogOpen || addBookDialogOpen) && bookProfiles.length > 0) {
      setSelectedQualityProfile(bookProfiles[0].id)
    }
  }, [addAuthorDialogOpen, addBookDialogOpen, bookProfiles])

  // Helper functions to handle add with/without dialog
  // If only one quality profile exists, add directly; otherwise show dialog
  const handleAddArtist = (artist: ArtistSearchResult) => {
    setSelectedArtist(artist)
    if (musicProfiles.length === 1) {
      // Add directly with the only profile
      addArtistWithProfile(artist, musicProfiles[0].id)
    } else {
      setAddArtistDialogOpen(true)
    }
  }

  const handleAddAlbum = (album: AlbumSearchResult, trackName?: string | null) => {
    setSelectedAlbum(album)
    if (trackName) setSelectedTrackName(trackName)
    else setSelectedTrackName(null)
    if (musicProfiles.length === 1) {
      addAlbumWithProfile(album, musicProfiles[0].id)
    } else {
      setAddAlbumDialogOpen(true)
    }
  }

  const handleAddMovie = (movie: MovieSearchResult, navigate = true) => {
    setSelectedMovie(movie)
    setNavigateAfterAdd(navigate)
    if (movieProfiles.length === 1) {
      addMovieWithProfile(movie, movieProfiles[0].id, navigate)
    } else {
      setAddMovieDialogOpen(true)
    }
  }

  const handleAddTvShow = (show: TvShowSearchResult, navigate = true) => {
    setSelectedTvShow(show)
    setNavigateAfterAdd(navigate)
    // TV shows always need season picker first
    setSeasonPickerOpen(true)
  }

  const handleAddAuthor = (author: AuthorSearchResult) => {
    setSelectedAuthor(author)
    if (bookProfiles.length === 1) {
      addAuthorWithProfile(author, bookProfiles[0].id)
    } else {
      setAddAuthorDialogOpen(true)
    }
  }

  const handleAddBook = (book: BookSearchResult) => {
    setSelectedBook(book)
    if (bookProfiles.length === 1) {
      addBookWithProfile(book, bookProfiles[0].id)
    } else {
      setAddBookDialogOpen(true)
    }
  }

  // Music exploration state
  const [expandedArtistId, setExpandedArtistId] = useState<string | null>(null)
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null)
  const [artistAlbums, setArtistAlbums] = useState<Record<string, AlbumSearchResult[]>>({})
  const [albumTracks, setAlbumTracks] = useState<Record<string, TrackSearchResult[]>>({})
  const [loadingArtistAlbums, setLoadingArtistAlbums] = useState<Set<string>>(new Set())
  const [loadingAlbumTracks, setLoadingAlbumTracks] = useState<Set<string>>(new Set())
  const [selectedTrackName, setSelectedTrackName] = useState<string | null>(null)

  // Load enabled media types
  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.enabledMediaTypes?.length > 0) {
          setEnabledMediaTypes(data.enabledMediaTypes)
          // If current mode isn't enabled, switch to first enabled
          if (!data.enabledMediaTypes.includes(searchMode) && searchMode !== 'direct') {
            setSearchMode(data.enabledMediaTypes[0])
          }
        }
      })
      .catch(console.error)
  }, [])

  // Load initial data
  useEffect(() => {
    // Load indexers
    fetch('/api/v1/indexers')
      .then((r) => r.json())
      .then((data) => setIndexers(data.filter((i: Indexer) => i.enabled)))
      .catch(console.error)

    // Load download clients
    fetch('/api/v1/downloadclients')
      .then((r) => r.json())
      .then((data) => setDownloadClients(data.filter((c: DownloadClient) => c.enabled)))
      .catch(console.error)

    // Load add options
    Promise.all([
      fetch('/api/v1/qualityprofiles').then((r) => r.json()),
      fetch('/api/v1/rootfolders').then((r) => r.json()),
    ])
      .then(([qp, rf]) => {
        setQualityProfiles(qp)
        setRootFolders(rf)
      })
      .catch(console.error)
      .finally(() => setLoadingOptions(false))
  }, [])

  // Filtered and sorted results for direct search
  const filteredIndexerResults = useMemo(() => {
    let results = [...indexerResults]

    if (selectedCategories.length > 0) {
      results = results.filter((r) => {
        if (!r.category) return false
        return selectedCategories.some((cat) => r.category?.includes(cat))
      })
    }

    results.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'age':
          comparison = new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime()
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'indexer':
          comparison = a.indexer.localeCompare(b.indexer)
          break
        case 'grabs':
          comparison = (a.grabs || 0) - (b.grabs || 0)
          break
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '')
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return results
  }, [indexerResults, selectedCategories, sortField, sortDirection])

  // Search function
  const search = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return

    setSearching(true)
    setHasSearched(true)
    setSelectedResults(new Set())

    try {
      if (searchMode === 'direct') {
        const params = new URLSearchParams({
          query: searchQuery,
          limit: '100',
          type: 'general',
        })
        if (selectedIndexers.length > 0) {
          params.set('indexerIds', selectedIndexers.join(','))
        }

        const response = await fetch(`/api/v1/indexers/search?${params}`)
        if (response.ok) {
          setIndexerResults(await response.json())
        } else {
          toast.error('Search failed')
        }
      } else if (searchMode === 'music') {
        switch (musicSearchType) {
          case 'artist': {
            const response = await fetch(
              `/api/v1/artists/search?q=${encodeURIComponent(searchQuery)}`
            )
            if (response.ok) setArtistResults(await response.json())
            break
          }
          case 'album': {
            const response = await fetch(
              `/api/v1/albums/search?q=${encodeURIComponent(searchQuery)}`
            )
            if (response.ok) setAlbumResults(await response.json())
            break
          }
          case 'track': {
            const response = await fetch(
              `/api/v1/tracks/search?q=${encodeURIComponent(searchQuery)}`
            )
            if (response.ok) setTrackResults(await response.json())
            break
          }
        }
      } else if (searchMode === 'movies') {
        const response = await fetch(`/api/v1/movies/search?q=${encodeURIComponent(searchQuery)}`)
        if (response.ok) setMovieResults(await response.json())
      } else if (searchMode === 'tv') {
        const response = await fetch(`/api/v1/tvshows/search?q=${encodeURIComponent(searchQuery)}`)
        if (response.ok) setTvShowResults(await response.json())
      } else if (searchMode === 'books') {
        if (booksSearchType === 'author') {
          const response = await fetch(
            `/api/v1/authors/search?q=${encodeURIComponent(searchQuery)}`
          )
          if (response.ok) setAuthorResults(await response.json())
        } else {
          const response = await fetch(`/api/v1/books/search?q=${encodeURIComponent(searchQuery)}`)
          if (response.ok) setBookResults(await response.json())
        }
      }
    } catch (error) {
      console.error('Search failed:', error)
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      search()
    }
  }

  // Movie discover categories config
  const movieDiscoverCategories = useMemo(
    () =>
      [
        { key: 'popular', label: 'Popular Movies' },
        { key: 'now_playing', label: 'Now in Cinemas' },
        { key: 'trending', label: 'Trending This Week' },
      ] as const,
    []
  )

  // TV discover categories config
  const tvDiscoverCategories = useMemo(
    () =>
      [
        { key: 'popular', label: 'Popular Shows' },
        { key: 'on_the_air', label: 'Currently Airing' },
        { key: 'top_rated', label: 'Top Rated' },
        { key: 'trending', label: 'Trending This Week' },
      ] as const,
    []
  )

  // Fetch all movie discover lanes (incrementally, each lane renders as it arrives)
  const fetchAllMovieDiscoverLanes = useCallback(async () => {
    setLoadingMovieDiscover(true)
    let remaining = movieDiscoverCategories.length
    movieDiscoverCategories.forEach(async (cat) => {
      try {
        const response = await fetch(`/api/v1/movies/discover?category=${cat.key}`)
        if (response.ok) {
          const data = await response.json()
          setMovieDiscoverLanes((prev) => ({ ...prev, [cat.key]: data.results }))
        }
      } catch (error) {
        console.error(`Failed to fetch movie discover ${cat.key}:`, error)
      } finally {
        remaining--
        if (remaining === 0) setLoadingMovieDiscover(false)
      }
    })
  }, [movieDiscoverCategories])

  // Fetch all TV discover lanes (incrementally, each lane renders as it arrives)
  const fetchAllTvDiscoverLanes = useCallback(async () => {
    setLoadingTvDiscover(true)
    let remaining = tvDiscoverCategories.length
    tvDiscoverCategories.forEach(async (cat) => {
      try {
        const response = await fetch(`/api/v1/tvshows/discover?category=${cat.key}`)
        if (response.ok) {
          const data = await response.json()
          setTvDiscoverLanes((prev) => ({ ...prev, [cat.key]: data.results }))
        }
      } catch (error) {
        console.error(`Failed to fetch TV discover ${cat.key}:`, error)
      } finally {
        remaining--
        if (remaining === 0) setLoadingTvDiscover(false)
      }
    })
  }, [tvDiscoverCategories])

  // Fetch movie recommendation lanes (per-source for incremental rendering)
  const fetchMovieRecommendations = useCallback(async () => {
    setLoadingMovieRecs(true)
    const sources = ['justwatch', 'trakt', 'tmdb']
    let remaining = sources.length
    sources.forEach(async (source) => {
      try {
        const response = await fetch(`/api/v1/recommendations/movies?source=${source}`)
        if (response.ok) {
          const data = await response.json()
          if (data.lanes?.length > 0) {
            setMovieRecommendationLanes((prev) => [...prev, ...data.lanes])
          }
        }
      } catch (error) {
        console.error(`Failed to fetch movie recommendations (${source}):`, error)
      } finally {
        remaining--
        if (remaining === 0) setLoadingMovieRecs(false)
      }
    })
  }, [])

  // Fetch TV recommendation lanes (per-source for incremental rendering)
  const fetchTvRecommendations = useCallback(async () => {
    setLoadingTvRecs(true)
    const sources = ['justwatch', 'trakt', 'tmdb']
    let remaining = sources.length
    sources.forEach(async (source) => {
      try {
        const response = await fetch(`/api/v1/recommendations/tv?source=${source}`)
        if (response.ok) {
          const data = await response.json()
          if (data.lanes?.length > 0) {
            setTvRecommendationLanes((prev) => [...prev, ...data.lanes])
          }
        }
      } catch (error) {
        console.error(`Failed to fetch TV recommendations (${source}):`, error)
      } finally {
        remaining--
        if (remaining === 0) setLoadingTvRecs(false)
      }
    })
  }, [])

  // Track whether discover/rec fetches have been initiated to avoid duplicate calls
  const movieDiscoverFetched = useRef(false)
  const tvDiscoverFetched = useRef(false)
  const movieRecsFetched = useRef(false)
  const tvRecsFetched = useRef(false)

  // Load discover content and recommendations when switching to movies/tv tab with no search query
  useEffect(() => {
    if (searchMode === 'movies' && !searchQuery) {
      if (!movieDiscoverFetched.current) {
        movieDiscoverFetched.current = true
        fetchAllMovieDiscoverLanes()
      }
      if (!movieRecsFetched.current) {
        movieRecsFetched.current = true
        fetchMovieRecommendations()
      }
    } else if (searchMode === 'tv' && !searchQuery) {
      if (!tvDiscoverFetched.current) {
        tvDiscoverFetched.current = true
        fetchAllTvDiscoverLanes()
      }
      if (!tvRecsFetched.current) {
        tvRecsFetched.current = true
        fetchTvRecommendations()
      }
    }
  }, [
    searchMode,
    searchQuery,
    fetchAllMovieDiscoverLanes,
    fetchAllTvDiscoverLanes,
    fetchMovieRecommendations,
    fetchTvRecommendations,
  ])

  // Direct search functions
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const toggleColumn = (columnId: string) => {
    setColumns(
      columns.map((col) => (col.id === columnId ? { ...col, visible: !col.visible } : col))
    )
  }

  const toggleSelectAll = () => {
    if (selectedResults.size === filteredIndexerResults.length) {
      setSelectedResults(new Set())
    } else {
      setSelectedResults(new Set(filteredIndexerResults.map((r) => r.id)))
    }
  }

  const toggleSelectResult = (id: string) => {
    const newSelected = new Set(selectedResults)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedResults(newSelected)
  }

  const isColumnVisible = (id: string) => columns.find((c) => c.id === id)?.visible ?? true

  const openDownloadDialog = (result: IndexerSearchResult) => {
    setSelectedIndexerResult(result)
    setDownloadDialogOpen(true)
  }

  const grabRelease = async (result?: IndexerSearchResult) => {
    const toGrab = result || selectedIndexerResult
    if (!toGrab) return

    if (downloadClients.length === 0) {
      toast.error('No download client configured. Go to Settings > Download Clients to add one.')
      return
    }

    setDownloading(true)

    try {
      const response = await fetch('/api/v1/queue/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: toGrab.title,
          downloadUrl: toGrab.downloadUrl,
          size: toGrab.size,
          indexerId: toGrab.indexerId,
          indexerName: toGrab.indexer,
          guid: toGrab.guid,
        }),
      })

      if (response.ok) {
        toast.success(`Added "${toGrab.title}" to download queue`)
        setDownloadDialogOpen(false)
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to grab release')
        return false
      }
    } catch (error) {
      console.error('Failed to grab release:', error)
      toast.error('Failed to grab release')
      return false
    } finally {
      setDownloading(false)
    }
  }

  const grabSelected = async () => {
    if (selectedResults.size === 0) return

    setBulkDownloading(true)
    let successCount = 0
    let failCount = 0

    for (const id of selectedResults) {
      const result = filteredIndexerResults.find((r) => r.id === id)
      if (result) {
        try {
          const response = await fetch('/api/v1/queue/grab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: result.title,
              downloadUrl: result.downloadUrl,
              size: result.size,
              indexerId: result.indexerId,
              indexerName: result.indexer,
              guid: result.guid,
            }),
          })

          if (response.ok) successCount++
          else failCount++
        } catch {
          failCount++
        }
      }
    }

    setBulkDownloading(false)

    if (successCount > 0) {
      toast.success(`Added ${successCount} release${successCount > 1 ? 's' : ''} to download queue`)
    }
    if (failCount > 0) {
      toast.error(`Failed to grab ${failCount} release${failCount > 1 ? 's' : ''}`)
    }

    setSelectedResults(new Set())
  }

  // Add functions - with profile parameter for direct add, or uses state for dialog-based add
  const addArtistWithProfile = async (artist: ArtistSearchResult, qualityProfileId: string) => {
    setAddingArtist(true)
    try {
      const response = await fetch('/api/v1/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicbrainzId: artist.musicbrainzId,
          qualityProfileId,
          requested,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${artist.name} added to library`)
        setAddArtistDialogOpen(false)
        setArtistResults((prev) =>
          prev.map((r) =>
            r.musicbrainzId === artist.musicbrainzId ? { ...r, inLibrary: true } : r
          )
        )
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add artist')
      }
    } catch (error) {
      console.error('Failed to add artist:', error)
      toast.error('Failed to add artist')
    } finally {
      setAddingArtist(false)
    }
  }

  const addArtist = () => {
    if (!selectedArtist || !selectedQualityProfile) return
    addArtistWithProfile(selectedArtist, selectedQualityProfile)
  }

  const addAlbumWithProfile = async (album: AlbumSearchResult, qualityProfileId: string) => {
    setAddingAlbum(true)
    try {
      const response = await fetch('/api/v1/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicbrainzId: album.musicbrainzId,
          artistMusicbrainzId: album.artistMusicbrainzId,
          qualityProfileId,
          requested,
          searchOnAdd: true, // Always search immediately
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${album.title} added to library`)
        setAddAlbumDialogOpen(false)
        setAlbumResults((prev) =>
          prev.map((r) => (r.musicbrainzId === album.musicbrainzId ? { ...r, inLibrary: true } : r))
        )
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add album')
      }
    } catch (error) {
      console.error('Failed to add album:', error)
      toast.error('Failed to add album')
    } finally {
      setAddingAlbum(false)
    }
  }

  const addAlbum = () => {
    if (!selectedAlbum || !selectedQualityProfile) return
    addAlbumWithProfile(selectedAlbum, selectedQualityProfile)
  }

  const addMovieWithProfile = async (
    movie: MovieSearchResult,
    qualityProfileId: string,
    navigate = true
  ) => {
    const movieRootFolder = rootFolders.find((rf) => rf.mediaType === 'movies')
    if (!movieRootFolder) {
      toast.error('No root folder configured for movies. Please add one in Settings.')
      return
    }

    setAddingMovie(true)
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
          requested,
          searchOnAdd: true, // Always search immediately
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${movie.title} added to library`)
        setAddMovieDialogOpen(false)
        // Update in search results
        setMovieResults((prev) =>
          prev.map((r) =>
            r.tmdbId === movie.tmdbId
              ? { ...r, inLibrary: true, libraryId: data.id, requested: true }
              : r
          )
        )
        // Update in discover lanes
        setMovieDiscoverLanes((prev) => {
          const updated: Record<string, MovieSearchResult[]> = {}
          for (const [key, lane] of Object.entries(prev)) {
            updated[key] = lane.map((m) =>
              m.tmdbId === movie.tmdbId
                ? { ...m, inLibrary: true, libraryId: data.id, requested: true }
                : m
            )
          }
          return updated
        })
        if (navigate) {
          router.visit(`/movie/${data.id}`)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add movie')
      }
    } catch (error) {
      console.error('Failed to add movie:', error)
      toast.error('Failed to add movie')
    } finally {
      setAddingMovie(false)
    }
  }

  const addMovie = () => {
    if (!selectedMovie || !selectedQualityProfile) return
    addMovieWithProfile(selectedMovie, selectedQualityProfile)
  }

  const addTvShowWithProfile = async (
    show: TvShowSearchResult,
    qualityProfileId: string,
    selection: SeasonEpisodeSelection | null,
    navigate = true
  ) => {
    const tvRootFolder = rootFolders.find((rf) => rf.mediaType === 'tv')
    if (!tvRootFolder) {
      toast.error('No root folder configured for TV shows. Please add one in Settings.')
      return
    }

    setAddingTvShow(true)
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
          searchOnAdd: true, // Always search immediately
          selectedSeasons: selection?.selectedSeasons,
          selectedEpisodes: selection?.selectedEpisodes,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${show.title} added to library`)
        setAddTvShowDialogOpen(false)
        setEpisodeSelection(null)
        // Update in search results
        setTvShowResults((prev) =>
          prev.map((r) =>
            r.tmdbId === show.tmdbId
              ? { ...r, inLibrary: true, libraryId: data.id, requested: true }
              : r
          )
        )
        // Update in discover lanes
        setTvDiscoverLanes((prev) => {
          const updated: Record<string, TvShowSearchResult[]> = {}
          for (const [key, lane] of Object.entries(prev)) {
            updated[key] = lane.map((s) =>
              s.tmdbId === show.tmdbId
                ? { ...s, inLibrary: true, libraryId: data.id, requested: true }
                : s
            )
          }
          return updated
        })
        if (navigate) {
          router.visit(`/tvshow/${data.id}`)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add TV show')
      }
    } catch (error) {
      console.error('Failed to add TV show:', error)
      toast.error('Failed to add TV show')
    } finally {
      setAddingTvShow(false)
    }
  }

  const addTvShow = () => {
    if (!selectedTvShow || !selectedQualityProfile) return
    addTvShowWithProfile(selectedTvShow, selectedQualityProfile, episodeSelection)
  }

  // Toggle movie requested state
  const toggleMovieRequested = async (movie: MovieSearchResult) => {
    if (!movie.libraryId || !movie.inLibrary) return

    const tmdbId = movie.tmdbId
    setTogglingMovies((prev) => new Set(prev).add(tmdbId))

    // Helper to update movie in all relevant state
    const updateMovie = (updater: (m: MovieSearchResult) => MovieSearchResult) => {
      setMovieResults((prev) => prev.map((m) => (m.tmdbId === tmdbId ? updater(m) : m)))
      setMovieDiscoverLanes((prev) => {
        const updated: Record<string, MovieSearchResult[]> = {}
        for (const [key, lane] of Object.entries(prev)) {
          updated[key] = lane.map((m) => (m.tmdbId === tmdbId ? updater(m) : m))
        }
        return updated
      })
    }

    const wasRequested = movie.requested

    // If unrequesting a movie with a file, show error
    if (wasRequested && movie.hasFile) {
      toast.error('Movie has downloaded files. Delete files first before unrequesting.')
      setTogglingMovies((prev) => {
        const next = new Set(prev)
        next.delete(tmdbId)
        return next
      })
      return
    }

    // Optimistic update
    updateMovie((m) => ({ ...m, requested: !wasRequested }))

    try {
      const response = await fetch(`/api/v1/movies/${movie.libraryId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.deleted) {
          // Movie was deleted - update local state to remove from library
          toast.success('Removed from library')
          updateMovie((m) => ({ ...m, inLibrary: false, libraryId: undefined, requested: false }))
        } else {
          toast.success(wasRequested ? 'Movie unrequested' : 'Movie requested')
        }
      } else if (data.hasFile) {
        // Revert on error
        updateMovie((m) => ({ ...m, requested: wasRequested }))
        toast.error('Movie has downloaded files. Delete files first before unrequesting.')
      } else {
        // Revert on error
        updateMovie((m) => ({ ...m, requested: wasRequested }))
        toast.error(data.error || 'Failed to update movie')
      }
    } catch (error) {
      console.error('Failed to update movie:', error)
      updateMovie((m) => ({ ...m, requested: wasRequested }))
      toast.error('Failed to update movie')
    } finally {
      setTogglingMovies((prev) => {
        const next = new Set(prev)
        next.delete(tmdbId)
        return next
      })
    }
  }

  // Toggle TV show requested state
  const toggleTvShowRequested = async (show: TvShowSearchResult) => {
    if (!show.libraryId || !show.inLibrary) return

    const tmdbId = show.tmdbId
    setTogglingTvShows((prev) => new Set(prev).add(tmdbId))

    // Helper to update show in all relevant state
    const updateShow = (updater: (s: TvShowSearchResult) => TvShowSearchResult) => {
      setTvShowResults((prev) => prev.map((s) => (s.tmdbId === tmdbId ? updater(s) : s)))
      setTvDiscoverLanes((prev) => {
        const updated: Record<string, TvShowSearchResult[]> = {}
        for (const [key, lane] of Object.entries(prev)) {
          updated[key] = lane.map((s) => (s.tmdbId === tmdbId ? updater(s) : s))
        }
        return updated
      })
    }

    const wasRequested = show.requested
    // Optimistic update
    updateShow((s) => ({ ...s, requested: !wasRequested }))

    try {
      const response = await fetch(`/api/v1/tvshows/${show.libraryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })
      if (response.ok) {
        toast.success(wasRequested ? 'TV show unrequested' : 'TV show requested')
      } else {
        // Revert on error
        updateShow((s) => ({ ...s, requested: wasRequested }))
        toast.error('Failed to update TV show')
      }
    } catch (error) {
      console.error('Failed to update TV show:', error)
      updateShow((s) => ({ ...s, requested: wasRequested }))
      toast.error('Failed to update TV show')
    } finally {
      setTogglingTvShows((prev) => {
        const next = new Set(prev)
        next.delete(tmdbId)
        return next
      })
    }
  }

  // Toggle movie requested state from details sheet
  const toggleMovieDetailsRequested = async () => {
    if (!movieDetails?.libraryId || !movieDetails?.inLibrary) return

    const wasRequested = movieDetails.requested

    // If unrequesting a movie with a file, show error
    if (wasRequested && movieDetails.hasFile) {
      toast.error('Movie has downloaded files. Delete files first before unrequesting.')
      return
    }

    setTogglingDetails(true)

    // Optimistic update
    setMovieDetails({ ...movieDetails, requested: !wasRequested })

    try {
      const response = await fetch(`/api/v1/movies/${movieDetails.libraryId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })

      const data = await response.json()

      if (response.ok) {
        const tmdbId = movieDetails.tmdbId
        if (data.deleted) {
          // Movie was deleted - update local state to remove from library
          toast.success('Removed from library')
          setMovieDetails({
            ...movieDetails,
            inLibrary: false,
            libraryId: undefined,
            requested: false,
          })
          setMovieResults((prev) =>
            prev.map((m) =>
              m.tmdbId === tmdbId
                ? { ...m, inLibrary: false, libraryId: undefined, requested: false }
                : m
            )
          )
          setMovieDiscoverLanes((prev) => {
            const updated: Record<string, MovieSearchResult[]> = {}
            for (const [key, lane] of Object.entries(prev)) {
              updated[key] = lane.map((m) =>
                m.tmdbId === tmdbId
                  ? { ...m, inLibrary: false, libraryId: undefined, requested: false }
                  : m
              )
            }
            return updated
          })
        } else {
          toast.success(wasRequested ? 'Movie unrequested' : 'Movie requested')
          // Also update in the search results/discover lanes
          setMovieResults((prev) =>
            prev.map((m) => (m.tmdbId === tmdbId ? { ...m, requested: !wasRequested } : m))
          )
          setMovieDiscoverLanes((prev) => {
            const updated: Record<string, MovieSearchResult[]> = {}
            for (const [key, lane] of Object.entries(prev)) {
              updated[key] = lane.map((m) =>
                m.tmdbId === tmdbId ? { ...m, requested: !wasRequested } : m
              )
            }
            return updated
          })
        }
      } else if (data.hasFile) {
        // Revert on error
        setMovieDetails({ ...movieDetails, requested: wasRequested })
        toast.error('Movie has downloaded files. Delete files first before unrequesting.')
      } else {
        // Revert on error
        setMovieDetails({ ...movieDetails, requested: wasRequested })
        toast.error(data.error || 'Failed to update movie')
      }
    } catch (error) {
      console.error('Failed to update movie:', error)
      setMovieDetails({ ...movieDetails, requested: wasRequested })
      toast.error('Failed to update movie')
    } finally {
      setTogglingDetails(false)
    }
  }

  // Toggle TV show requested state from details sheet
  const toggleTvShowDetailsRequested = async () => {
    if (!tvShowDetails?.libraryId || !tvShowDetails?.inLibrary) return

    setTogglingDetails(true)
    const wasRequested = tvShowDetails.requested

    // Optimistic update
    setTvShowDetails({ ...tvShowDetails, requested: !wasRequested })

    try {
      const response = await fetch(`/api/v1/tvshows/${tvShowDetails.libraryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })
      if (response.ok) {
        toast.success(wasRequested ? 'TV show unrequested' : 'TV show requested')
        // Also update in the search results/discover lanes
        const tmdbId = tvShowDetails.tmdbId
        setTvShowResults((prev) =>
          prev.map((s) => (s.tmdbId === tmdbId ? { ...s, requested: !wasRequested } : s))
        )
        setTvDiscoverLanes((prev) => {
          const updated: Record<string, TvShowSearchResult[]> = {}
          for (const [key, lane] of Object.entries(prev)) {
            updated[key] = lane.map((s) =>
              s.tmdbId === tmdbId ? { ...s, requested: !wasRequested } : s
            )
          }
          return updated
        })
      } else {
        // Revert on error
        setTvShowDetails({ ...tvShowDetails, requested: wasRequested })
        toast.error('Failed to update TV show')
      }
    } catch (error) {
      console.error('Failed to update TV show:', error)
      setTvShowDetails({ ...tvShowDetails, requested: wasRequested })
      toast.error('Failed to update TV show')
    } finally {
      setTogglingDetails(false)
    }
  }

  // Open movie details sheet
  const openMovieDetails = async (movie: MovieSearchResult) => {
    setDetailsType('movie')
    setDetailsSheetOpen(true)
    setDetailsLoading(true)
    setMovieDetails(null)

    try {
      const response = await fetch(`/api/v1/movies/preview?tmdbId=${movie.tmdbId}`)
      if (response.ok) {
        const data = await response.json()
        setMovieDetails(data)
      } else {
        toast.error('Failed to load movie details')
        setDetailsSheetOpen(false)
      }
    } catch (error) {
      console.error('Failed to fetch movie details:', error)
      toast.error('Failed to load movie details')
      setDetailsSheetOpen(false)
    } finally {
      setDetailsLoading(false)
    }
  }

  // Open TV show details sheet
  const openTvShowDetails = async (show: TvShowSearchResult) => {
    setDetailsType('tv')
    setDetailsSheetOpen(true)
    setDetailsLoading(true)
    setTvShowDetails(null)

    try {
      const response = await fetch(`/api/v1/tvshows/preview?tmdbId=${show.tmdbId}`)
      if (response.ok) {
        const data = await response.json()
        setTvShowDetails(data)
      } else {
        toast.error('Failed to load TV show details')
        setDetailsSheetOpen(false)
      }
    } catch (error) {
      console.error('Failed to fetch TV show details:', error)
      toast.error('Failed to load TV show details')
      setDetailsSheetOpen(false)
    } finally {
      setDetailsLoading(false)
    }
  }

  const addAuthorWithProfile = async (
    author: AuthorSearchResult,
    qualityProfileId: string,
    shouldAddBooks: boolean = true
  ) => {
    const booksRootFolder = rootFolders.find((rf) => rf.mediaType === 'books')
    if (!booksRootFolder) {
      toast.error('No root folder configured for books. Please add one in Settings.')
      return
    }

    setAddingAuthor(true)
    try {
      const response = await fetch('/api/v1/authors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openlibraryId: author.openlibraryId,
          name: author.name,
          qualityProfileId,
          rootFolderId: booksRootFolder.id,
          requested,
          addBooks: shouldAddBooks,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${author.name} added to library`)
        setAddAuthorDialogOpen(false)
        setAuthorResults((prev) =>
          prev.map((r) =>
            r.openlibraryId === author.openlibraryId ? { ...r, inLibrary: true } : r
          )
        )
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add author')
      }
    } catch (error) {
      console.error('Failed to add author:', error)
      toast.error('Failed to add author')
    } finally {
      setAddingAuthor(false)
    }
  }

  const addAuthor = () => {
    if (!selectedAuthor || !selectedQualityProfile) return
    addAuthorWithProfile(selectedAuthor, selectedQualityProfile, addBooks)
  }

  const addBookWithProfile = async (book: BookSearchResult, qualityProfileId: string) => {
    const booksRootFolder = rootFolders.find((rf) => rf.mediaType === 'books')
    if (!booksRootFolder) {
      toast.error('No root folder configured for books. Please add one in Settings.')
      return
    }

    setAddingBook(true)
    try {
      const response = await fetch('/api/v1/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openlibraryId: book.openlibraryId,
          title: book.title,
          authorKey: book.authorKey,
          authorName: book.authorName,
          qualityProfileId,
          rootFolderId: booksRootFolder.id,
          requested,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${book.title} added to library`)
        setAddBookDialogOpen(false)
        setBookResults((prev) =>
          prev.map((r) => (r.openlibraryId === book.openlibraryId ? { ...r, inLibrary: true } : r))
        )
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add book')
      }
    } catch (error) {
      console.error('Failed to add book:', error)
      toast.error('Failed to add book')
    } finally {
      setAddingBook(false)
    }
  }

  const addBook = () => {
    if (!selectedBook || !selectedQualityProfile) return
    addBookWithProfile(selectedBook, selectedQualityProfile)
  }

  // Fetch artist albums
  const fetchArtistAlbums = async (artistMbid: string) => {
    if (artistAlbums[artistMbid] || loadingArtistAlbums.has(artistMbid)) return

    setLoadingArtistAlbums((prev) => new Set(prev).add(artistMbid))
    try {
      const response = await fetch(`/api/v1/artists/${artistMbid}/albums`)
      if (response.ok) {
        const albums = await response.json()
        setArtistAlbums((prev) => ({ ...prev, [artistMbid]: albums }))
      }
    } catch (error) {
      console.error('Failed to fetch artist albums:', error)
    } finally {
      setLoadingArtistAlbums((prev) => {
        const next = new Set(prev)
        next.delete(artistMbid)
        return next
      })
    }
  }

  // Fetch album tracks
  const fetchAlbumTracks = async (albumMbid: string) => {
    if (albumTracks[albumMbid] || loadingAlbumTracks.has(albumMbid)) return

    setLoadingAlbumTracks((prev) => new Set(prev).add(albumMbid))
    try {
      const response = await fetch(`/api/v1/albums/${albumMbid}/tracks`)
      if (response.ok) {
        const tracks = await response.json()
        setAlbumTracks((prev) => ({ ...prev, [albumMbid]: tracks }))
      }
    } catch (error) {
      console.error('Failed to fetch album tracks:', error)
    } finally {
      setLoadingAlbumTracks((prev) => {
        const next = new Set(prev)
        next.delete(albumMbid)
        return next
      })
    }
  }

  // Toggle artist expansion
  const toggleArtistExpand = (artistMbid: string) => {
    if (expandedArtistId === artistMbid) {
      setExpandedArtistId(null)
    } else {
      setExpandedArtistId(artistMbid)
      fetchArtistAlbums(artistMbid)
    }
  }

  // Toggle album expansion
  const toggleAlbumExpand = (albumMbid: string) => {
    if (expandedAlbumId === albumMbid) {
      setExpandedAlbumId(null)
    } else {
      setExpandedAlbumId(albumMbid)
      fetchAlbumTracks(albumMbid)
    }
  }

  // Navigate to artist search
  const navigateToArtist = (artistName: string, artistMbid: string) => {
    setMusicSearchType('artist')
    setSearchQuery(artistName)
    // Find the artist in results or search for it
    const existingArtist = artistResults.find((a) => a.musicbrainzId === artistMbid)
    if (existingArtist) {
      setExpandedArtistId(artistMbid)
      fetchArtistAlbums(artistMbid)
    } else {
      search()
    }
  }

  // Navigate to album search
  const navigateToAlbum = (albumTitle: string, albumMbid: string) => {
    setMusicSearchType('album')
    setSearchQuery(albumTitle)
    search()
  }

  // Track failed images
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const handleImageError = useCallback((key: string) => {
    setFailedImages((prev) => new Set(prev).add(key))
  }, [])

  // Sortable header component
  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field &&
          (sortDirection === 'asc' ? (
            <HugeiconsIcon icon={ArrowUp01Icon} className="h-3 w-3" />
          ) : (
            <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3" />
          ))}
      </div>
    </TableHead>
  )

  // Render search result card
  const renderResultCard = (
    item: {
      id: string
      name: string
      subtitle?: string
      extra?: string
      imageUrl?: string
      inLibrary: boolean
    },
    icon: typeof MusicNote01Icon,
    onClick: () => void,
    onAdd: () => void
  ) => {
    const imageKey = `search-${item.id}`
    const showImage = item.imageUrl && !failedImages.has(imageKey)

    return (
      <Card
        key={item.id}
        className={`${item.inLibrary ? 'opacity-60' : ''} cursor-pointer hover:bg-muted/50 transition-colors`}
        onClick={onClick}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <div className="h-16 w-16 rounded bg-muted flex-shrink-0 overflow-hidden">
            {showImage ? (
              <img
                src={item.imageUrl!}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={() => handleImageError(imageKey)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon icon={icon} className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium">{item.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              {item.subtitle && <span>{item.subtitle}</span>}
              {item.extra && (
                <>
                  <span>•</span>
                  <span>{item.extra}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.inLibrary ? (
              <Badge variant="outline" className="gap-1">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
                In Library
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd()
                }}
              >
                <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Format duration in mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Render music results
  const renderMusicResults = () => {
    if (searching) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-16 w-16 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-9 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (musicSearchType === 'artist' && artistResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">
            Found {artistResults.length} artists
          </div>
          {artistResults.map((artist) => {
            const isExpanded = expandedArtistId === artist.musicbrainzId
            const albums = artistAlbums[artist.musicbrainzId] || []
            const isLoading = loadingArtistAlbums.has(artist.musicbrainzId)

            return (
              <Card key={artist.musicbrainzId} className={artist.inLibrary ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                      <HugeiconsIcon
                        icon={MusicNote01Icon}
                        className="h-8 w-8 text-muted-foreground/50"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{artist.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        {artist.type && <span>{artist.type}</span>}
                        {artist.country && (
                          <>
                            <span>•</span>
                            <span>{artist.country}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {artist.inLibrary ? (
                        <Badge variant="outline" className="gap-1">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
                          In Library
                        </Badge>
                      ) : (
                        <Button size="sm" onClick={() => handleAddArtist(artist)}>
                          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleArtistExpand(artist.musicbrainzId)}
                      >
                        <HugeiconsIcon icon={ViewIcon} className="h-4 w-4 mr-1" />
                        {isExpanded ? 'Hide' : 'Explore'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded albums section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3">Albums</h4>
                      {isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner />
                          Loading albums...
                        </div>
                      ) : albums.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No albums found</p>
                      ) : (
                        <div className="space-y-2">
                          {albums.map((album) => {
                            const isAlbumExpanded = expandedAlbumId === album.musicbrainzId
                            const tracks = albumTracks[album.musicbrainzId] || []
                            const isTracksLoading = loadingAlbumTracks.has(album.musicbrainzId)
                            const coverUrl = `https://coverartarchive.org/release-group/${album.musicbrainzId}/front-250`
                            const imageKey = `album-${album.musicbrainzId}`

                            return (
                              <div key={album.musicbrainzId} className="border rounded-md">
                                <div className="flex items-center gap-3 p-3">
                                  <div className="h-12 w-12 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                                    {!failedImages.has(imageKey) ? (
                                      <img
                                        src={coverUrl}
                                        alt={album.title}
                                        className="h-full w-full object-cover"
                                        onError={() => handleImageError(imageKey)}
                                      />
                                    ) : (
                                      <HugeiconsIcon
                                        icon={Album01Icon}
                                        className="h-6 w-6 text-muted-foreground/50"
                                      />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{album.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {album.releaseDate || 'Unknown date'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {album.inLibrary ? (
                                      <Badge variant="outline" className="text-xs gap-1">
                                        <HugeiconsIcon
                                          icon={CheckmarkCircle01Icon}
                                          className="h-3 w-3"
                                        />
                                        In Library
                                      </Badge>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => {
                                          handleAddAlbum(album)
                                        }}
                                      >
                                        <HugeiconsIcon icon={Add01Icon} className="h-3 w-3 mr-1" />
                                        Add
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => toggleAlbumExpand(album.musicbrainzId)}
                                    >
                                      <HugeiconsIcon
                                        icon={ArrowRight01Icon}
                                        className={`h-3 w-3 transition-transform ${isAlbumExpanded ? 'rotate-90' : ''}`}
                                      />
                                      Tracks
                                    </Button>
                                  </div>
                                </div>

                                {/* Expanded tracks section */}
                                {isAlbumExpanded && (
                                  <div className="border-t bg-muted/30 p-3">
                                    {isTracksLoading ? (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Spinner className="size-3" />
                                        Loading tracks...
                                      </div>
                                    ) : tracks.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">
                                        No tracks found
                                      </p>
                                    ) : (
                                      <div className="space-y-1">
                                        {tracks.map((track, idx) => (
                                          <div
                                            key={track.musicbrainzId}
                                            className="flex items-center gap-2 text-xs py-1 group"
                                          >
                                            <span className="text-muted-foreground w-5 text-right">
                                              {idx + 1}.
                                            </span>
                                            <span className="flex-1 truncate">{track.title}</span>
                                            {track.duration && (
                                              <span className="text-muted-foreground">
                                                {formatDuration(track.duration)}
                                              </span>
                                            )}
                                            {!album.inLibrary && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleAddAlbum(album, track.title)}
                                              >
                                                <HugeiconsIcon
                                                  icon={Add01Icon}
                                                  className="h-3 w-3"
                                                />
                                              </Button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )
    }

    if (musicSearchType === 'album' && albumResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">
            Found {albumResults.length} albums
          </div>
          {albumResults.map((album) => {
            const isExpanded = expandedAlbumId === album.musicbrainzId
            const tracks = albumTracks[album.musicbrainzId] || []
            const isLoading = loadingAlbumTracks.has(album.musicbrainzId)

            return (
              <Card key={album.musicbrainzId} className={album.inLibrary ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                      <HugeiconsIcon
                        icon={Album01Icon}
                        className="h-8 w-8 text-muted-foreground/50"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{album.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <button
                          className="hover:text-primary hover:underline transition-colors"
                          onClick={() =>
                            navigateToArtist(album.artistName, album.artistMusicbrainzId)
                          }
                        >
                          {album.artistName}
                        </button>
                        {album.releaseDate && (
                          <>
                            <span>•</span>
                            <span>{album.releaseDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {album.inLibrary ? (
                        <Badge variant="outline" className="gap-1">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
                          In Library
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            handleAddAlbum(album)
                          }}
                        >
                          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleAlbumExpand(album.musicbrainzId)}
                      >
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          className={`h-4 w-4 mr-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        {isExpanded ? 'Hide' : 'Tracks'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded tracks section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3">Tracks</h4>
                      {isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner />
                          Loading tracks...
                        </div>
                      ) : tracks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tracks found</p>
                      ) : (
                        <div className="space-y-1">
                          {tracks.map((track, idx) => (
                            <div
                              key={track.musicbrainzId}
                              className="flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-muted/50"
                            >
                              <span className="text-muted-foreground w-6 text-right">
                                {idx + 1}.
                              </span>
                              <span className="flex-1 truncate">{track.title}</span>
                              {track.duration && (
                                <span className="text-muted-foreground">
                                  {formatDuration(track.duration)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )
    }

    if (musicSearchType === 'track' && trackResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">
            Found {trackResults.length} tracks
          </div>
          {trackResults.map((track) => (
            <Card key={track.musicbrainzId} className={track.inLibrary ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-16 w-16 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                  <HugeiconsIcon
                    icon={MusicNoteSquare01Icon}
                    className="h-8 w-8 text-muted-foreground/50"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{track.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <button
                      className="hover:text-primary hover:underline transition-colors"
                      onClick={() => navigateToArtist(track.artistName, track.artistMusicbrainzId)}
                    >
                      {track.artistName}
                    </button>
                    {track.albumTitle && track.albumMusicbrainzId && (
                      <>
                        <span>•</span>
                        <button
                          className="hover:text-primary hover:underline transition-colors"
                          onClick={() =>
                            navigateToAlbum(track.albumTitle!, track.albumMusicbrainzId!)
                          }
                        >
                          {track.albumTitle}
                        </button>
                      </>
                    )}
                    {track.duration && (
                      <>
                        <span>•</span>
                        <span>{formatDuration(track.duration)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {track.inLibrary ? (
                    <Badge variant="outline" className="gap-1">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
                      In Library
                    </Badge>
                  ) : track.albumMusicbrainzId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Find the album and open add dialog
                        const album: AlbumSearchResult = {
                          musicbrainzId: track.albumMusicbrainzId!,
                          title: track.albumTitle || 'Unknown Album',
                          artistName: track.artistName,
                          artistMusicbrainzId: track.artistMusicbrainzId,
                          inLibrary: false,
                        }
                        handleAddAlbum(album, track.title)
                      }}
                    >
                      <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No album linked</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (hasSearched) {
      return <NoResults />
    }

    return null
  }

  // Horizontal scroll lane component for discover content
  const DiscoverLane = ({
    title,
    items,
    type,
    source,
    moreHref,
    onItemClick,
    onAdd,
    onToggle,
    togglingItems,
  }: {
    title: string
    items: (MovieSearchResult | TvShowSearchResult)[]
    type: 'movie' | 'tv'
    source?: 'tmdb' | 'trakt' | 'justwatch'
    moreHref?: string
    onItemClick: (item: MovieSearchResult | TvShowSearchResult) => void
    onAdd: (item: MovieSearchResult | TvShowSearchResult) => void
    onToggle: (item: MovieSearchResult | TvShowSearchResult) => void
    togglingItems: Set<string>
  }) => {
    const scrollRef = useRef<HTMLDivElement>(null)

    const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
        const scrollAmount = 400
        scrollRef.current.scrollBy({
          left: direction === 'left' ? -scrollAmount : scrollAmount,
          behavior: 'smooth',
        })
      }
    }

    if (items.length === 0) return null

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">
              {title}
              {source && (
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  {source === 'trakt' ? 'Trakt' : source === 'justwatch' ? 'JustWatch' : 'For You'}
                </Badge>
              )}
            </h3>
            {moreHref && (
              <button
                onClick={() => router.visit(moreHref)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Show more
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll('left')}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll('right')}>
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
          style={{ scrollbarWidth: 'thin' }}
        >
          {items.map((item) => {
            const imageKey = `discover-${type}-${item.tmdbId}`
            const hasImage = item.posterUrl && !failedImages.has(imageKey)

            return (
              <div
                key={item.tmdbId}
                className="flex-shrink-0 w-[150px] group cursor-pointer"
                onClick={() => onItemClick(item)}
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
                        icon={type === 'movie' ? Film01Icon : Tv01Icon}
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
                  {(() => {
                    // Determine media status for the badge
                    let status: MediaItemStatus = 'none'
                    if (item.inLibrary) {
                      if (type === 'movie') {
                        const movie = item as MovieSearchResult
                        status = movie.hasFile
                          ? 'downloaded'
                          : movie.requested
                            ? 'requested'
                            : 'downloaded'
                      } else {
                        const show = item as TvShowSearchResult
                        status = show.requested ? 'requested' : 'downloaded'
                      }
                    }
                    const isToggling = togglingItems.has(item.tmdbId)
                    // For 'none' status: add to library
                    // For 'requested' status: toggle requested state
                    // For 'downloaded' status: no action (can't unrequest downloaded items)
                    const handleToggle =
                      status === 'none'
                        ? () => onAdd(item)
                        : status === 'requested'
                          ? () => onToggle(item)
                          : undefined
                    return (
                      <div
                        className="absolute top-2 right-2 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CardStatusBadge
                          status={status}
                          size="tiny"
                          showOnHover={status === 'none'}
                          isToggling={isToggling}
                          onToggleRequest={handleToggle}
                        />
                      </div>
                    )
                  })()}
                  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-sm font-medium line-clamp-2">{item.title}</p>
                    {item.year && <p className="text-white/70 text-xs">{item.year}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Skeleton for discover lanes
  const DiscoverLaneSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="h-6 w-48" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="flex-shrink-0 w-[150px] aspect-[2/3] rounded-lg" />
        ))}
      </div>
    </div>
  )

  // Render movie results
  const renderMovieResults = () => {
    if (searching) return <SearchingSkeleton />

    // Show search results if there are any
    if (movieResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">
            Found {movieResults.length} movies
          </div>
          {movieResults.map((movie) =>
            renderResultCard(
              {
                id: movie.tmdbId,
                name: movie.title,
                subtitle: movie.year?.toString(),
                extra: movie.rating ? `${movie.rating.toFixed(1)} rating` : undefined,
                imageUrl: movie.posterUrl,
                inLibrary: movie.inLibrary,
              },
              Film01Icon,
              () => openMovieDetails(movie),
              () => handleAddMovie(movie, false)
            )
          )}
        </div>
      )
    }

    if (hasSearched) return <NoResults />

    // Show discover lanes when no search has been performed
    const externalMovieLanes = movieRecommendationLanes.filter(
      (l) => l.source === 'trakt' || l.source === 'justwatch'
    )
    const personalizedMovieLanes = movieRecommendationLanes.filter((l) => l.source === 'tmdb')

    return (
      <div className="space-y-8">
        {loadingMovieRecs && externalMovieLanes.length === 0 && (
          <>
            <DiscoverLaneSkeleton />
            <DiscoverLaneSkeleton />
          </>
        )}
        {externalMovieLanes.map((lane) => (
          <DiscoverLane
            key={lane.key}
            title={lane.label}
            source={lane.source}
            items={lane.items}
            type="movie"
            moreHref={`/discover/movies/${lane.key.replace(/-movies$/, '')}`}
            onItemClick={(item) => openMovieDetails(item as MovieSearchResult)}
            onAdd={(item) => handleAddMovie(item as MovieSearchResult, false)}
            onToggle={(item) => toggleMovieRequested(item as MovieSearchResult)}
            togglingItems={togglingMovies}
          />
        ))}
        {movieDiscoverCategories.map((cat) =>
          movieDiscoverLanes[cat.key] ? (
            <DiscoverLane
              key={cat.key}
              title={cat.label}
              items={movieDiscoverLanes[cat.key]}
              type="movie"
              moreHref={`/discover/movies/${cat.key}`}
              onItemClick={(item) => openMovieDetails(item as MovieSearchResult)}
              onAdd={(item) => handleAddMovie(item as MovieSearchResult, false)}
              onToggle={(item) => toggleMovieRequested(item as MovieSearchResult)}
              togglingItems={togglingMovies}
            />
          ) : loadingMovieDiscover ? (
            <DiscoverLaneSkeleton key={cat.key} />
          ) : null
        )}
        {!loadingMovieDiscover && Object.keys(movieDiscoverLanes).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Enter a search term to find movies</p>
          </div>
        )}
        {loadingMovieRecs && personalizedMovieLanes.length === 0 && <DiscoverLaneSkeleton />}
        {personalizedMovieLanes.map((lane) => (
          <DiscoverLane
            key={lane.key}
            title={lane.label}
            source={lane.source}
            items={lane.items}
            type="movie"
            onItemClick={(item) => openMovieDetails(item as MovieSearchResult)}
            onAdd={(item) => handleAddMovie(item as MovieSearchResult, false)}
            onToggle={(item) => toggleMovieRequested(item as MovieSearchResult)}
            togglingItems={togglingMovies}
          />
        ))}
      </div>
    )
  }

  // Render TV results
  const renderTvResults = () => {
    if (searching) return <SearchingSkeleton />

    // Show search results if there are any
    if (tvShowResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">
            Found {tvShowResults.length} TV shows
          </div>
          {tvShowResults.map((show) =>
            renderResultCard(
              {
                id: show.tmdbId,
                name: show.title,
                subtitle: show.year?.toString(),
                extra: show.status,
                imageUrl: show.posterUrl,
                inLibrary: show.inLibrary,
              },
              Tv01Icon,
              () => openTvShowDetails(show),
              () => handleAddTvShow(show, false)
            )
          )}
        </div>
      )
    }

    if (hasSearched) return <NoResults />

    // Show discover lanes when no search has been performed
    const externalTvLanes = tvRecommendationLanes.filter(
      (l) => l.source === 'trakt' || l.source === 'justwatch'
    )
    const personalizedTvLanes = tvRecommendationLanes.filter((l) => l.source === 'tmdb')

    return (
      <div className="space-y-8">
        {loadingTvRecs && externalTvLanes.length === 0 && (
          <>
            <DiscoverLaneSkeleton />
            <DiscoverLaneSkeleton />
          </>
        )}
        {externalTvLanes.map((lane) => (
          <DiscoverLane
            key={lane.key}
            title={lane.label}
            source={lane.source}
            items={lane.items}
            type="tv"
            moreHref={`/discover/tv/${lane.key.replace(/-shows$/, '')}`}
            onItemClick={(item) => openTvShowDetails(item as TvShowSearchResult)}
            onAdd={(item) => handleAddTvShow(item as TvShowSearchResult, false)}
            onToggle={(item) => toggleTvShowRequested(item as TvShowSearchResult)}
            togglingItems={togglingTvShows}
          />
        ))}
        {tvDiscoverCategories.map((cat) =>
          tvDiscoverLanes[cat.key] ? (
            <DiscoverLane
              key={cat.key}
              title={cat.label}
              items={tvDiscoverLanes[cat.key]}
              type="tv"
              moreHref={`/discover/tv/${cat.key}`}
              onItemClick={(item) => openTvShowDetails(item as TvShowSearchResult)}
              onAdd={(item) => handleAddTvShow(item as TvShowSearchResult, false)}
              onToggle={(item) => toggleTvShowRequested(item as TvShowSearchResult)}
              togglingItems={togglingTvShows}
            />
          ) : loadingTvDiscover ? (
            <DiscoverLaneSkeleton key={cat.key} />
          ) : null
        )}
        {!loadingTvDiscover && Object.keys(tvDiscoverLanes).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Enter a search term to find TV shows</p>
          </div>
        )}
        {loadingTvRecs && personalizedTvLanes.length === 0 && <DiscoverLaneSkeleton />}
        {personalizedTvLanes.map((lane) => (
          <DiscoverLane
            key={lane.key}
            title={lane.label}
            source={lane.source}
            items={lane.items}
            type="tv"
            onItemClick={(item) => openTvShowDetails(item as TvShowSearchResult)}
            onAdd={(item) => handleAddTvShow(item as TvShowSearchResult, false)}
            onToggle={(item) => toggleTvShowRequested(item as TvShowSearchResult)}
            togglingItems={togglingTvShows}
          />
        ))}
      </div>
    )
  }

  // Render books results
  const renderBooksResults = () => {
    if (searching) return <SearchingSkeleton />

    if (booksSearchType === 'author' && authorResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">
            Found {authorResults.length} authors
          </div>
          {authorResults.map((author) =>
            renderResultCard(
              {
                id: author.openlibraryId,
                name: author.name,
                subtitle: author.birthDate,
                inLibrary: author.inLibrary,
              },
              Book01Icon,
              () => handleAddAuthor(author)
            )
          )}
        </div>
      )
    }

    if (booksSearchType === 'book' && bookResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">Found {bookResults.length} books</div>
          {bookResults.map((book) =>
            renderResultCard(
              {
                id: book.openlibraryId,
                name: book.title,
                subtitle: book.authorName,
                extra: book.year?.toString(),
                imageUrl: book.coverUrl,
                inLibrary: book.inLibrary,
              },
              Book01Icon,
              () => handleAddBook(book)
            )
          )}
        </div>
      )
    }

    if (hasSearched) return <NoResults />
    return null
  }

  // Render direct search results
  const renderDirectResults = () => {
    if (searching) return <SearchingSkeleton />

    if (filteredIndexerResults.length > 0) {
      return (
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="pt-6 min-w-0">
            <div className="text-sm text-muted-foreground mb-4">
              Found {filteredIndexerResults.length} results
              {selectedCategories.length > 0 && ` (filtered from ${indexerResults.length})`}
            </div>
            <div className="overflow-x-auto -mx-6 px-6">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    {isColumnVisible('select') && (
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={
                            selectedResults.size === filteredIndexerResults.length &&
                            filteredIndexerResults.length > 0
                          }
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    {isColumnVisible('protocol') && (
                      <TableHead className="w-[60px]">Type</TableHead>
                    )}
                    {isColumnVisible('age') && <SortableHeader field="age">Age</SortableHeader>}
                    {isColumnVisible('title') && (
                      <SortableHeader field="title">Title</SortableHeader>
                    )}
                    {isColumnVisible('indexer') && (
                      <SortableHeader field="indexer">Indexer</SortableHeader>
                    )}
                    {isColumnVisible('size') && <SortableHeader field="size">Size</SortableHeader>}
                    {isColumnVisible('grabs') && (
                      <SortableHeader field="grabs">Grabs</SortableHeader>
                    )}
                    {isColumnVisible('category') && (
                      <SortableHeader field="category">Category</SortableHeader>
                    )}
                    {isColumnVisible('actions') && (
                      <TableHead className="w-[80px]">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIndexerResults.map((result) => (
                    <TableRow
                      key={result.id}
                      className={selectedResults.has(result.id) ? 'bg-muted/50' : ''}
                    >
                      {isColumnVisible('select') && (
                        <TableCell>
                          <Checkbox
                            checked={selectedResults.has(result.id)}
                            onCheckedChange={() => toggleSelectResult(result.id)}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible('protocol') && (
                        <TableCell>
                          <Badge
                            variant={result.protocol === 'torrent' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {result.protocol === 'torrent' ? 'torrent' : 'nzb'}
                          </Badge>
                        </TableCell>
                      )}
                      {isColumnVisible('age') && (
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatAge(result.publishDate)}
                        </TableCell>
                      )}
                      {isColumnVisible('title') && (
                        <TableCell>
                          <div
                            className="font-medium truncate max-w-md cursor-pointer hover:text-primary min-w-0"
                            title={result.title}
                            onClick={() => openDownloadDialog(result)}
                          >
                            {result.title}
                          </div>
                        </TableCell>
                      )}
                      {isColumnVisible('indexer') && (
                        <TableCell className="text-muted-foreground">{result.indexer}</TableCell>
                      )}
                      {isColumnVisible('size') && (
                        <TableCell className="whitespace-nowrap">
                          {formatBytes(result.size)}
                        </TableCell>
                      )}
                      {isColumnVisible('grabs') && (
                        <TableCell className="text-muted-foreground">
                          {result.grabs ?? '-'}
                        </TableCell>
                      )}
                      {isColumnVisible('category') && (
                        <TableCell>
                          {result.category && (
                            <Badge variant="outline" className="text-xs">
                              {result.category}
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible('actions') && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {result.infoUrl && (
                              <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                                <a href={result.infoUrl} target="_blank" rel="noopener noreferrer">
                                  <HugeiconsIcon icon={Link01Icon} className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDownloadDialog(result)}
                              className="h-8 w-8"
                            >
                              <HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (hasSearched) return <NoResults />
    return null
  }

  const SearchingSkeleton = () => (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 p-4">
            <Skeleton className="h-16 w-16 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-9 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const NoResults = () => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <HugeiconsIcon icon={Search01Icon} className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p className="text-muted-foreground">Try a different search term.</p>
      </CardContent>
    </Card>
  )

  const getSearchPlaceholder = () => {
    if (searchMode === 'direct') return 'Search for releases on indexers...'
    if (searchMode === 'music') return `Search for ${musicSearchType}s on MusicBrainz...`
    if (searchMode === 'movies') return 'Search for movies on TMDB...'
    if (searchMode === 'tv') return 'Search for TV shows on TMDB...'
    if (searchMode === 'books') return `Search for ${booksSearchType}s on OpenLibrary...`
    return 'Search...'
  }

  return (
    <ErrorBoundary>
      <AppLayout title="Search">
        <Head title="Search" />

        <div className="space-y-4">
          {/* Search mode tabs */}
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as MediaType | 'direct')}>
            <div className="flex flex-col gap-3">
              {/* Main media type tabs - scrollable on small screens */}
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
                <TabsList className="min-w-max">
                  {enabledMediaTypes.map((type) => {
                    const config = MEDIA_TYPE_CONFIG[type]
                    return (
                      <TabsTrigger key={type} value={type} className="gap-2">
                        <HugeiconsIcon icon={config.icon} className="h-4 w-4" />
                        {config.label}
                      </TabsTrigger>
                    )
                  })}
                  <TabsTrigger value="direct" className="gap-2">
                    <HugeiconsIcon icon={Globe02Icon} className="h-4 w-4" />
                    Direct
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Subtype selector for music */}
              {searchMode === 'music' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Search for:</span>
                  <Tabs
                    value={musicSearchType}
                    onValueChange={(v) => setMusicSearchType(v as MusicSearchType)}
                  >
                    <TabsList className="h-8">
                      <TabsTrigger value="artist" className="text-xs px-2 h-6">
                        Artist
                      </TabsTrigger>
                      <TabsTrigger value="album" className="text-xs px-2 h-6">
                        Album
                      </TabsTrigger>
                      <TabsTrigger value="track" className="text-xs px-2 h-6">
                        Track
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Subtype selector for books */}
              {searchMode === 'books' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Search for:</span>
                  <Tabs
                    value={booksSearchType}
                    onValueChange={(v) => setBooksSearchType(v as 'author' | 'book')}
                  >
                    <TabsList className="h-8">
                      <TabsTrigger value="author" className="text-xs px-2 h-6">
                        Author
                      </TabsTrigger>
                      <TabsTrigger value="book" className="text-xs px-2 h-6">
                        Book
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>

            {/* Search input */}
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <HugeiconsIcon
                        icon={Search01Icon}
                        className="size-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 left-2"
                      />
                      <Input
                        placeholder={getSearchPlaceholder()}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pl-9"
                        autoFocus
                      />
                    </div>
                    <Button onClick={search} disabled={searching || searchQuery.length < 2}>
                      {searching ? (
                        <Spinner />
                      ) : (
                        <HugeiconsIcon icon={Search01Icon} className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Direct search filters */}
                  {searchMode === 'direct' && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Indexers:</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              {selectedIndexers.length === 0
                                ? 'All'
                                : `${selectedIndexers.length} selected`}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {indexers.map((indexer) => (
                              <DropdownMenuCheckboxItem
                                key={indexer.id}
                                checked={selectedIndexers.includes(indexer.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedIndexers(
                                    checked
                                      ? [...selectedIndexers, indexer.id]
                                      : selectedIndexers.filter((id) => id !== indexer.id)
                                  )
                                }}
                              >
                                {indexer.name}
                              </DropdownMenuCheckboxItem>
                            ))}
                            {selectedIndexers.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setSelectedIndexers([])}>
                                  Clear
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="ml-auto flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <HugeiconsIcon icon={SortingIcon} className="h-4 w-4 mr-1" />
                              Sort
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(['age', 'title', 'size', 'indexer', 'grabs'] as SortField[]).map(
                              (field) => (
                                <DropdownMenuItem key={field} onClick={() => toggleSort(field)}>
                                  {field.charAt(0).toUpperCase() + field.slice(1)}
                                  {sortField === field && (
                                    <HugeiconsIcon
                                      icon={
                                        sortDirection === 'asc' ? ArrowUp01Icon : ArrowDown01Icon
                                      }
                                      className="h-4 w-4 ml-2"
                                    />
                                  )}
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <HugeiconsIcon icon={Settings02Icon} className="h-4 w-4 mr-1" />
                              Columns
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {columns.map((col) => (
                              <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={col.visible}
                                onCheckedChange={() => toggleColumn(col.id)}
                              >
                                {col.label}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Selected actions bar for direct search */}
            {searchMode === 'direct' && selectedResults.size > 0 && (
              <Card>
                <CardContent className="py-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedResults.size} release{selectedResults.size > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedResults(new Set())}
                    >
                      Clear
                    </Button>
                    <Button size="sm" onClick={grabSelected} disabled={bulkDownloading}>
                      {bulkDownloading ? (
                        <Spinner className="mr-2" />
                      ) : (
                        <HugeiconsIcon icon={Download01Icon} className="h-4 w-4 mr-2" />
                      )}
                      Grab Selected
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            <TabsContent value="music" className="mt-4">
              {renderMusicResults()}
            </TabsContent>
            <TabsContent value="movies" className="mt-4">
              {renderMovieResults()}
            </TabsContent>
            <TabsContent value="tv" className="mt-4">
              {renderTvResults()}
            </TabsContent>
            <TabsContent value="books" className="mt-4">
              {renderBooksResults()}
            </TabsContent>
            <TabsContent value="direct" className="mt-4">
              {renderDirectResults()}
            </TabsContent>
          </Tabs>
        </div>

        {/* Entity details sheet */}
        <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
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

                  {/* Where to Watch - Streaming Providers */}
                  {movieDetails.streamingOffers && movieDetails.streamingOffers.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Where to Watch</h4>
                      <div className="flex flex-wrap gap-2">
                        {movieDetails.streamingOffers
                          .filter((o) => o.monetizationType === 'flatrate')
                          .map((offer) => (
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
                      {movieDetails.streamingOffers.some(
                        (o) => o.monetizationType === 'rent' || o.monetizationType === 'buy'
                      ) && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-2">
                            Also available to rent or buy:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {movieDetails.streamingOffers
                              .filter(
                                (o) => o.monetizationType === 'rent' || o.monetizationType === 'buy'
                              )
                              .map((offer) => (
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
                  )}

                  {/* Cast */}
                  {movieDetails.cast && movieDetails.cast.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Cast</h4>
                      <div
                        className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                        style={{ scrollbarWidth: 'thin' }}
                      >
                        {movieDetails.cast.map((actor) => (
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
                            <p className="text-[11px] font-medium leading-tight line-clamp-2">
                              {actor.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                              {actor.character}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    {movieDetails.inLibrary ? (
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setDetailsSheetOpen(false)
                          router.visit(`/movie/${movieDetails.libraryId}`)
                        }}
                      >
                        <HugeiconsIcon icon={ViewIcon} className="h-4 w-4 mr-2" />
                        View in Library
                      </Button>
                    ) : (
                      <Button
                        className="flex-1"
                        disabled={addingMovie}
                        onClick={() => {
                          const movie: MovieSearchResult = {
                            tmdbId: movieDetails.tmdbId,
                            title: movieDetails.title,
                            year: movieDetails.year,
                            overview: movieDetails.overview,
                            posterUrl: movieDetails.posterUrl,
                            rating: movieDetails.rating,
                            inLibrary: false,
                          }
                          setDetailsSheetOpen(false)
                          handleAddMovie(movie, false)
                        }}
                      >
                        {addingMovie ? (
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

                  {/* Where to Watch - Streaming Providers */}
                  {tvShowDetails.streamingOffers && tvShowDetails.streamingOffers.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Where to Watch</h4>
                      <div className="flex flex-wrap gap-2">
                        {tvShowDetails.streamingOffers
                          .filter((o) => o.monetizationType === 'flatrate')
                          .map((offer) => (
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
                      {tvShowDetails.streamingOffers.some(
                        (o) => o.monetizationType === 'rent' || o.monetizationType === 'buy'
                      ) && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-2">
                            Also available to rent or buy:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {tvShowDetails.streamingOffers
                              .filter(
                                (o) => o.monetizationType === 'rent' || o.monetizationType === 'buy'
                              )
                              .map((offer) => (
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
                  )}

                  {/* Cast */}
                  {tvShowDetails.cast && tvShowDetails.cast.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Cast</h4>
                      <div
                        className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                        style={{ scrollbarWidth: 'thin' }}
                      >
                        {tvShowDetails.cast.map((actor) => (
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
                            <p className="text-[11px] font-medium leading-tight line-clamp-2">
                              {actor.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                              {actor.character}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    {tvShowDetails.inLibrary ? (
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setDetailsSheetOpen(false)
                          router.visit(`/tvshow/${tvShowDetails.libraryId}`)
                        }}
                      >
                        <HugeiconsIcon icon={ViewIcon} className="h-4 w-4 mr-2" />
                        View in Library
                      </Button>
                    ) : (
                      <Button
                        className="flex-1"
                        disabled={addingTvShow}
                        onClick={() => {
                          const show: TvShowSearchResult = {
                            tmdbId: tvShowDetails.tmdbId,
                            title: tvShowDetails.title,
                            year: tvShowDetails.year,
                            overview: tvShowDetails.overview,
                            posterUrl: tvShowDetails.posterUrl,
                            status: tvShowDetails.status,
                            rating: tvShowDetails.rating,
                            seasonCount: tvShowDetails.seasonCount,
                            episodeCount: tvShowDetails.episodeCount,
                            inLibrary: false,
                          }
                          setDetailsSheetOpen(false)
                          handleAddTvShow(show, false)
                        }}
                      >
                        {addingTvShow ? (
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

        {/* Download confirmation dialog */}
        <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Download Release</DialogTitle>
              <DialogDescription>Send this release to your download client?</DialogDescription>
            </DialogHeader>
            {selectedIndexerResult && (
              <div className="py-4 space-y-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Title</div>
                  <div className="font-medium">{selectedIndexerResult.title}</div>
                </div>
                <div className="flex gap-6">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Size</div>
                    <div>{formatBytes(selectedIndexerResult.size)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Indexer</div>
                    <div>{selectedIndexerResult.indexer}</div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => grabRelease()} disabled={downloading}>
                {downloading ? (
                  <Spinner className="mr-2" />
                ) : (
                  <HugeiconsIcon icon={Download01Icon} className="h-4 w-4 mr-2" />
                )}
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Season picker dialog */}
        {selectedTvShow && (
          <SeasonPickerDialog
            tmdbId={selectedTvShow.tmdbId}
            showTitle={selectedTvShow.title}
            open={seasonPickerOpen}
            onOpenChange={setSeasonPickerOpen}
            onConfirm={(selection) => {
              setEpisodeSelection(selection)
              setSeasonPickerOpen(false)
              // If only one TV profile, add directly; otherwise show dialog
              if (tvProfiles.length === 1) {
                addTvShowWithProfile(selectedTvShow, tvProfiles[0].id, selection)
              } else {
                setAddTvShowDialogOpen(true)
              }
            }}
          />
        )}

        {/* Unified Add Media Dialogs */}
        <AddMediaDialog
          open={addArtistDialogOpen}
          onOpenChange={setAddArtistDialogOpen}
          mediaType="artist"
          title={selectedArtist?.name || ''}
          description="Configure how this artist will be added to your library."
          qualityProfiles={musicProfiles}
          loading={loadingOptions}
          adding={addingArtist}
          onAdd={(profileId) => selectedArtist && addArtistWithProfile(selectedArtist, profileId)}
        />

        <AddMediaDialog
          open={addAlbumDialogOpen}
          onOpenChange={(open) => {
            setAddAlbumDialogOpen(open)
            if (!open) setSelectedTrackName(null)
          }}
          mediaType="album"
          title={selectedTrackName ? `"${selectedTrackName}"` : selectedAlbum?.title || ''}
          description={
            selectedTrackName
              ? `To get this track, the album "${selectedAlbum?.title}" by ${selectedAlbum?.artistName} will be added.`
              : `This will add ${selectedAlbum?.artistName} with this album.`
          }
          qualityProfiles={musicProfiles}
          loading={loadingOptions}
          adding={addingAlbum}
          onAdd={(profileId) => selectedAlbum && addAlbumWithProfile(selectedAlbum, profileId)}
        />

        <AddMediaDialog
          open={addMovieDialogOpen}
          onOpenChange={setAddMovieDialogOpen}
          mediaType="movie"
          title={selectedMovie?.title || ''}
          description="Configure how this movie will be added to your library."
          qualityProfiles={movieProfiles}
          loading={loadingOptions}
          adding={addingMovie}
          onAdd={(profileId) =>
            selectedMovie && addMovieWithProfile(selectedMovie, profileId, navigateAfterAdd)
          }
        />

        <AddMediaDialog
          open={addTvShowDialogOpen}
          onOpenChange={setAddTvShowDialogOpen}
          mediaType="tvshow"
          title={selectedTvShow?.title || ''}
          description="Configure how this TV show will be added to your library."
          qualityProfiles={tvProfiles}
          loading={loadingOptions}
          adding={addingTvShow}
          onAdd={(profileId) =>
            selectedTvShow &&
            addTvShowWithProfile(selectedTvShow, profileId, episodeSelection, navigateAfterAdd)
          }
          episodeSelectionSummary={
            episodeSelection &&
            (episodeSelection.selectedSeasons
              ? `${episodeSelection.selectedSeasons.length} season${episodeSelection.selectedSeasons.length !== 1 ? 's' : ''} selected`
              : episodeSelection.selectedEpisodes
                ? `${Object.values(episodeSelection.selectedEpisodes).reduce((sum, eps) => sum + eps.length, 0)} episodes selected`
                : 'All episodes selected')
          }
          onChangeEpisodeSelection={() => {
            setAddTvShowDialogOpen(false)
            setSeasonPickerOpen(true)
          }}
        />

        <AddMediaDialog
          open={addAuthorDialogOpen}
          onOpenChange={setAddAuthorDialogOpen}
          mediaType="author"
          title={selectedAuthor?.name || ''}
          description="Configure how this author will be added to your library."
          qualityProfiles={bookProfiles}
          loading={loadingOptions}
          adding={addingAuthor}
          onAdd={(profileId, options) =>
            selectedAuthor &&
            addAuthorWithProfile(selectedAuthor, profileId, options?.addBooks ?? true)
          }
          showAddBooksOption
        />

        <AddMediaDialog
          open={addBookDialogOpen}
          onOpenChange={setAddBookDialogOpen}
          mediaType="book"
          title={selectedBook?.title || ''}
          description={`By ${selectedBook?.authorName}. This will also add the author if not already in your library.`}
          qualityProfiles={bookProfiles}
          loading={loadingOptions}
          adding={addingBook}
          onAdd={(profileId) => selectedBook && addBookWithProfile(selectedBook, profileId)}
        />
      </AppLayout>
    </ErrorBoundary>
  )
}
