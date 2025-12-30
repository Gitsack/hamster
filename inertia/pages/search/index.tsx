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
import {
  Select,
  SelectPopup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Loading01Icon,
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
} from '@hugeicons/core-free-icons'
import { useState, useEffect, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react'
import { toast } from 'sonner'
import { SeasonPickerDialog, type SeasonEpisodeSelection } from '@/components/season-picker-dialog'

// Error boundary to catch rendering errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
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
        <div className="p-4 border border-red-500 rounded bg-red-50 text-red-900">
          <h2 className="font-bold">Something went wrong</h2>
          <pre className="text-sm mt-2 whitespace-pre-wrap">{this.state.error?.message}</pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-3 py-1 bg-red-500 text-white rounded"
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
  inLibrary: boolean
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
  inLibrary: boolean
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

interface RootFolder {
  id: string
  path: string
  mediaType?: string
}

interface QualityProfile {
  id: string
  name: string
}

interface MetadataProfile {
  id: string
  name: string
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
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const initialMode = (urlParams?.get('mode') as MediaType | 'direct') || 'music'
  const initialType = (urlParams?.get('type') as MusicSearchType) || 'artist'

  // Enabled media types from settings
  const [enabledMediaTypes, setEnabledMediaTypes] = useState<MediaType[]>(['music'])

  // Main state
  const [searchMode, setSearchMode] = useState<MediaType | 'direct'>(initialMode)
  const [musicSearchType, setMusicSearchType] = useState<MusicSearchType>(initialType)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Music search results
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([])
  const [albumResults, setAlbumResults] = useState<AlbumSearchResult[]>([])
  const [trackResults, setTrackResults] = useState<TrackSearchResult[]>([])

  // Movies search results
  const [movieResults, setMovieResults] = useState<MovieSearchResult[]>([])

  // TV search results
  const [tvShowResults, setTvShowResults] = useState<TvShowSearchResult[]>([])

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
  const [selectedIndexerResult, setSelectedIndexerResult] = useState<IndexerSearchResult | null>(null)
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [bulkDownloading, setBulkDownloading] = useState(false)

  // Add dialogs state
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([])
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [metadataProfiles, setMetadataProfiles] = useState<MetadataProfile[]>([])
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

  // TV add state
  const [selectedTvShow, setSelectedTvShow] = useState<TvShowSearchResult | null>(null)
  const [addTvShowDialogOpen, setAddTvShowDialogOpen] = useState(false)
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false)
  const [episodeSelection, setEpisodeSelection] = useState<SeasonEpisodeSelection | null>(null)
  const [addingTvShow, setAddingTvShow] = useState(false)

  // Books add state
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorSearchResult | null>(null)
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null)
  const [addAuthorDialogOpen, setAddAuthorDialogOpen] = useState(false)
  const [addBookDialogOpen, setAddBookDialogOpen] = useState(false)
  const [addingAuthor, setAddingAuthor] = useState(false)
  const [addingBook, setAddingBook] = useState(false)
  const [addBooks, setAddBooks] = useState(true)

  // Common add state
  const [selectedRootFolder, setSelectedRootFolder] = useState<string>('')
  const [selectedQualityProfile, setSelectedQualityProfile] = useState<string>('')
  const [selectedMetadataProfile, setSelectedMetadataProfile] = useState<string>('')
  const [requested, setWanted] = useState(true)
  const [searchOnAdd, setSearchOnAdd] = useState(true)
  const [addingArtist, setAddingArtist] = useState(false)
  const [addingAlbum, setAddingAlbum] = useState(false)

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
      fetch('/api/v1/rootfolders').then((r) => r.json()),
      fetch('/api/v1/qualityprofiles').then((r) => r.json()),
      fetch('/api/v1/metadataprofiles').then((r) => r.json()),
    ])
      .then(([rf, qp, mp]) => {
        setRootFolders(rf)
        setQualityProfiles(qp)
        setMetadataProfiles(mp)
        if (rf.length > 0) setSelectedRootFolder(rf[0].id)
        if (qp.length > 0) setSelectedQualityProfile(qp[0].id)
        if (mp.length > 0) setSelectedMetadataProfile(mp[0].id)
      })
      .catch(console.error)
      .finally(() => setLoadingOptions(false))
  }, [])

  // Get filtered root folders for current media type
  const filteredRootFolders = useMemo(() => {
    if (searchMode === 'direct') return rootFolders
    const filtered = rootFolders.filter((rf) => !rf.mediaType || rf.mediaType === searchMode)
    console.log('[Search] Root folders:', rootFolders.map(rf => ({ id: rf.id, path: rf.path, mediaType: rf.mediaType })))
    console.log('[Search] Search mode:', searchMode, '-> Filtered:', filtered.length)
    return filtered
  }, [rootFolders, searchMode])

  // Update selected root folder when filtered list changes
  useEffect(() => {
    if (filteredRootFolders.length > 0) {
      const currentIsValid = filteredRootFolders.some((rf) => rf.id === selectedRootFolder)
      if (!currentIsValid) {
        setSelectedRootFolder(filteredRootFolders[0].id)
      }
    }
  }, [filteredRootFolders, selectedRootFolder])

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
            const response = await fetch(`/api/v1/artists/search?q=${encodeURIComponent(searchQuery)}`)
            if (response.ok) setArtistResults(await response.json())
            break
          }
          case 'album': {
            const response = await fetch(`/api/v1/albums/search?q=${encodeURIComponent(searchQuery)}`)
            if (response.ok) setAlbumResults(await response.json())
            break
          }
          case 'track': {
            const response = await fetch(`/api/v1/tracks/search?q=${encodeURIComponent(searchQuery)}`)
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
          const response = await fetch(`/api/v1/authors/search?q=${encodeURIComponent(searchQuery)}`)
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

  // Add functions
  const addArtist = async () => {
    if (!selectedArtist || !selectedRootFolder || !selectedQualityProfile || !selectedMetadataProfile) return

    setAddingArtist(true)
    try {
      const response = await fetch('/api/v1/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicbrainzId: selectedArtist.musicbrainzId,
          rootFolderId: selectedRootFolder,
          qualityProfileId: selectedQualityProfile,
          metadataProfileId: selectedMetadataProfile,
          requested,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${selectedArtist.name} added to library`)
        setAddArtistDialogOpen(false)
        setArtistResults((prev) =>
          prev.map((r) => r.musicbrainzId === selectedArtist.musicbrainzId ? { ...r, inLibrary: true } : r)
        )
        router.visit(`/artist/${data.id}`)
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

  const addAlbum = async () => {
    if (!selectedAlbum || !selectedRootFolder || !selectedQualityProfile || !selectedMetadataProfile) return

    setAddingAlbum(true)
    try {
      const response = await fetch('/api/v1/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicbrainzId: selectedAlbum.musicbrainzId,
          artistMusicbrainzId: selectedAlbum.artistMusicbrainzId,
          rootFolderId: selectedRootFolder,
          qualityProfileId: selectedQualityProfile,
          metadataProfileId: selectedMetadataProfile,
          requested,
          searchOnAdd,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${selectedAlbum.title} added to library`)
        setAddAlbumDialogOpen(false)
        setAlbumResults((prev) =>
          prev.map((r) => r.musicbrainzId === selectedAlbum.musicbrainzId ? { ...r, inLibrary: true } : r)
        )
        router.visit(`/album/${data.id}`)
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

  const addMovie = async () => {
    if (!selectedMovie || !selectedRootFolder || !selectedQualityProfile) return

    setAddingMovie(true)
    try {
      const response = await fetch('/api/v1/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: selectedMovie.tmdbId,
          title: selectedMovie.title,
          year: selectedMovie.year,
          rootFolderId: selectedRootFolder,
          qualityProfileId: selectedQualityProfile,
          requested,
          searchOnAdd,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${selectedMovie.title} added to library`)
        setAddMovieDialogOpen(false)
        setMovieResults((prev) =>
          prev.map((r) => r.tmdbId === selectedMovie.tmdbId ? { ...r, inLibrary: true } : r)
        )
        router.visit(`/movie/${data.id}`)
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

  const addTvShow = async () => {
    if (!selectedTvShow || !selectedRootFolder || !selectedQualityProfile) return

    setAddingTvShow(true)
    try {
      const response = await fetch('/api/v1/tvshows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: selectedTvShow.tmdbId,
          title: selectedTvShow.title,
          year: selectedTvShow.year,
          rootFolderId: selectedRootFolder,
          qualityProfileId: selectedQualityProfile,
          requested: true, // Always request when adding
          searchOnAdd,
          // Pass episode selection
          selectedSeasons: episodeSelection?.selectedSeasons,
          selectedEpisodes: episodeSelection?.selectedEpisodes,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${selectedTvShow.title} added to library`)
        setAddTvShowDialogOpen(false)
        setEpisodeSelection(null)
        setTvShowResults((prev) =>
          prev.map((r) => r.tmdbId === selectedTvShow.tmdbId ? { ...r, inLibrary: true } : r)
        )
        router.visit(`/tvshow/${data.id}`)
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

  const addAuthor = async () => {
    if (!selectedAuthor || !selectedRootFolder || !selectedQualityProfile) return

    setAddingAuthor(true)
    try {
      const response = await fetch('/api/v1/authors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openlibraryId: selectedAuthor.openlibraryId,
          name: selectedAuthor.name,
          rootFolderId: selectedRootFolder,
          qualityProfileId: selectedQualityProfile,
          requested,
          addBooks,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${selectedAuthor.name} added to library`)
        setAddAuthorDialogOpen(false)
        setAuthorResults((prev) =>
          prev.map((r) => r.openlibraryId === selectedAuthor.openlibraryId ? { ...r, inLibrary: true } : r)
        )
        router.visit(`/author/${data.id}`)
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

  const addBook = async () => {
    if (!selectedBook || !selectedRootFolder || !selectedQualityProfile) return

    setAddingBook(true)
    try {
      const response = await fetch('/api/v1/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openlibraryId: selectedBook.openlibraryId,
          title: selectedBook.title,
          authorKey: selectedBook.authorKey,
          authorName: selectedBook.authorName,
          rootFolderId: selectedRootFolder,
          qualityProfileId: selectedQualityProfile,
          requested,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${selectedBook.title} added to library`)
        setAddBookDialogOpen(false)
        setBookResults((prev) =>
          prev.map((r) => r.openlibraryId === selectedBook.openlibraryId ? { ...r, inLibrary: true } : r)
        )
        router.visit(`/book/${data.id}`)
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

  // Track failed images
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const handleImageError = useCallback((key: string) => {
    setFailedImages(prev => new Set(prev).add(key))
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
    item: { id: string; name: string; subtitle?: string; extra?: string; imageUrl?: string; inLibrary: boolean },
    icon: typeof MusicNote01Icon,
    onAdd: () => void
  ) => {
    const imageKey = `search-${item.id}`
    const showImage = item.imageUrl && !failedImages.has(imageKey)

    return (
      <Card key={item.id} className={item.inLibrary ? 'opacity-60' : ''}>
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
              <Button size="sm" onClick={onAdd}>
                <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
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
          <div className="text-sm text-muted-foreground mb-4">Found {artistResults.length} artists</div>
          {artistResults.map((artist) =>
            renderResultCard(
              {
                id: artist.musicbrainzId,
                name: artist.name,
                subtitle: artist.type,
                extra: artist.country,
                inLibrary: artist.inLibrary,
              },
              MusicNote01Icon,
              () => { setSelectedArtist(artist); setAddArtistDialogOpen(true) }
            )
          )}
        </div>
      )
    }

    if (musicSearchType === 'album' && albumResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">Found {albumResults.length} albums</div>
          {albumResults.map((album) =>
            renderResultCard(
              {
                id: album.musicbrainzId,
                name: album.title,
                subtitle: album.artistName,
                extra: album.releaseDate,
                inLibrary: album.inLibrary,
              },
              Album01Icon,
              () => { setSelectedAlbum(album); setAddAlbumDialogOpen(true) }
            )
          )}
        </div>
      )
    }

    if (musicSearchType === 'track' && trackResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">Found {trackResults.length} tracks</div>
          {trackResults.map((track) =>
            renderResultCard(
              {
                id: track.musicbrainzId,
                name: track.title,
                subtitle: track.artistName,
                extra: track.albumTitle,
                inLibrary: track.inLibrary,
              },
              MusicNoteSquare01Icon,
              () => toast.info('Add the album to add this track')
            )
          )}
        </div>
      )
    }

    if (hasSearched) {
      return <NoResults />
    }

    return null
  }

  // Render movie results
  const renderMovieResults = () => {
    if (searching) return <SearchingSkeleton />

    if (movieResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">Found {movieResults.length} movies</div>
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
              () => { setSelectedMovie(movie); setAddMovieDialogOpen(true) }
            )
          )}
        </div>
      )
    }

    if (hasSearched) return <NoResults />
    return null
  }

  // Render TV results
  const renderTvResults = () => {
    if (searching) return <SearchingSkeleton />

    if (tvShowResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">Found {tvShowResults.length} TV shows</div>
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
              () => { setSelectedTvShow(show); setSeasonPickerOpen(true) }
            )
          )}
        </div>
      )
    }

    if (hasSearched) return <NoResults />
    return null
  }

  // Render books results
  const renderBooksResults = () => {
    if (searching) return <SearchingSkeleton />

    if (booksSearchType === 'author' && authorResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">Found {authorResults.length} authors</div>
          {authorResults.map((author) =>
            renderResultCard(
              {
                id: author.openlibraryId,
                name: author.name,
                subtitle: author.birthDate,
                inLibrary: author.inLibrary,
              },
              Book01Icon,
              () => { setSelectedAuthor(author); setAddAuthorDialogOpen(true) }
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
              () => { setSelectedBook(book); setAddBookDialogOpen(true) }
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-4">
              Found {filteredIndexerResults.length} results
              {selectedCategories.length > 0 && ` (filtered from ${indexerResults.length})`}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isColumnVisible('select') && (
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedResults.size === filteredIndexerResults.length && filteredIndexerResults.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    {isColumnVisible('protocol') && <TableHead className="w-[60px]">Type</TableHead>}
                    {isColumnVisible('age') && <SortableHeader field="age">Age</SortableHeader>}
                    {isColumnVisible('title') && <SortableHeader field="title">Title</SortableHeader>}
                    {isColumnVisible('indexer') && <SortableHeader field="indexer">Indexer</SortableHeader>}
                    {isColumnVisible('size') && <SortableHeader field="size">Size</SortableHeader>}
                    {isColumnVisible('grabs') && <SortableHeader field="grabs">Grabs</SortableHeader>}
                    {isColumnVisible('category') && <SortableHeader field="category">Category</SortableHeader>}
                    {isColumnVisible('actions') && <TableHead className="w-[80px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIndexerResults.map((result) => (
                    <TableRow key={result.id} className={selectedResults.has(result.id) ? 'bg-muted/50' : ''}>
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
                          <Badge variant={result.protocol === 'torrent' ? 'default' : 'secondary'} className="text-xs">
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
                            className="font-medium truncate max-w-md cursor-pointer hover:text-primary"
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
                        <TableCell className="whitespace-nowrap">{formatBytes(result.size)}</TableCell>
                      )}
                      {isColumnVisible('grabs') && (
                        <TableCell className="text-muted-foreground">{result.grabs ?? '-'}</TableCell>
                      )}
                      {isColumnVisible('category') && (
                        <TableCell>
                          {result.category && <Badge variant="outline" className="text-xs">{result.category}</Badge>}
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
                            <Button variant="ghost" size="icon" onClick={() => openDownloadDialog(result)} className="h-8 w-8">
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
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <TabsList>
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

              {/* Subtype selector for music */}
              {searchMode === 'music' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Search for:</span>
                  <Tabs value={musicSearchType} onValueChange={(v) => setMusicSearchType(v as MusicSearchType)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="artist" className="text-xs px-2 h-6">Artist</TabsTrigger>
                      <TabsTrigger value="album" className="text-xs px-2 h-6">Album</TabsTrigger>
                      <TabsTrigger value="track" className="text-xs px-2 h-6">Track</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Subtype selector for books */}
              {searchMode === 'books' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Search for:</span>
                  <Tabs value={booksSearchType} onValueChange={(v) => setBooksSearchType(v as 'author' | 'book')}>
                    <TabsList className="h-8">
                      <TabsTrigger value="author" className="text-xs px-2 h-6">Author</TabsTrigger>
                      <TabsTrigger value="book" className="text-xs px-2 h-6">Book</TabsTrigger>
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
                        <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin" />
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
                              {selectedIndexers.length === 0 ? 'All' : `${selectedIndexers.length} selected`}
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
                                <DropdownMenuItem onClick={() => setSelectedIndexers([])}>Clear</DropdownMenuItem>
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
                            {(['age', 'title', 'size', 'indexer', 'grabs'] as SortField[]).map((field) => (
                              <DropdownMenuItem key={field} onClick={() => toggleSort(field)}>
                                {field.charAt(0).toUpperCase() + field.slice(1)}
                                {sortField === field && (
                                  <HugeiconsIcon
                                    icon={sortDirection === 'asc' ? ArrowUp01Icon : ArrowDown01Icon}
                                    className="h-4 w-4 ml-2"
                                  />
                                )}
                              </DropdownMenuItem>
                            ))}
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
                    <Button variant="outline" size="sm" onClick={() => setSelectedResults(new Set())}>
                      Clear
                    </Button>
                    <Button size="sm" onClick={grabSelected} disabled={bulkDownloading}>
                      {bulkDownloading ? (
                        <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
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
            <TabsContent value="music" className="mt-4">{renderMusicResults()}</TabsContent>
            <TabsContent value="movies" className="mt-4">{renderMovieResults()}</TabsContent>
            <TabsContent value="tv" className="mt-4">{renderTvResults()}</TabsContent>
            <TabsContent value="books" className="mt-4">{renderBooksResults()}</TabsContent>
            <TabsContent value="direct" className="mt-4">{renderDirectResults()}</TabsContent>
          </Tabs>
        </div>

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
              <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => grabRelease()} disabled={downloading}>
                {downloading ? (
                  <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <HugeiconsIcon icon={Download01Icon} className="h-4 w-4 mr-2" />
                )}
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add artist dialog */}
        <Dialog open={addArtistDialogOpen} onOpenChange={setAddArtistDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {selectedArtist?.name}</DialogTitle>
              <DialogDescription>Configure how this artist will be added to your library.</DialogDescription>
            </DialogHeader>
            {loadingOptions ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Root Folder</Label>
                  <Select value={selectedRootFolder} onValueChange={setSelectedRootFolder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder">
                        {(value: string) => filteredRootFolders.find((f) => f.id === value)?.path || 'Select folder'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {filteredRootFolders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.path}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quality Profile</Label>
                  <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile">
                        {(value: string) => qualityProfiles.find((p) => p.id === value)?.name || 'Select profile'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {qualityProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Metadata Profile</Label>
                  <Select value={selectedMetadataProfile} onValueChange={setSelectedMetadataProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile">
                        {(value: string) => metadataProfiles.find((p) => p.id === value)?.name || 'Select profile'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {metadataProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddArtistDialogOpen(false)}>Cancel</Button>
              <Button onClick={addArtist} disabled={addingArtist || !selectedRootFolder || !selectedQualityProfile}>
                {addingArtist && <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />}
                Add Artist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add album dialog */}
        <Dialog open={addAlbumDialogOpen} onOpenChange={setAddAlbumDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {selectedAlbum?.title}</DialogTitle>
              <DialogDescription>This will add {selectedAlbum?.artistName} with this album.</DialogDescription>
            </DialogHeader>
            {loadingOptions ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Root Folder</Label>
                  <Select value={selectedRootFolder} onValueChange={setSelectedRootFolder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder">
                        {(value: string) => filteredRootFolders.find((f) => f.id === value)?.path || 'Select folder'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {filteredRootFolders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.path}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quality Profile</Label>
                  <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile">
                        {(value: string) => qualityProfiles.find((p) => p.id === value)?.name || 'Select profile'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {qualityProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="searchOnAdd" checked={searchOnAdd} onCheckedChange={(c) => setSearchOnAdd(c as boolean)} />
                  <Label htmlFor="searchOnAdd" className="font-normal cursor-pointer">Search for album immediately</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddAlbumDialogOpen(false)}>Cancel</Button>
              <Button onClick={addAlbum} disabled={addingAlbum || !selectedRootFolder || !selectedQualityProfile}>
                {addingAlbum && <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />}
                Add Album
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add movie dialog */}
        <Dialog open={addMovieDialogOpen} onOpenChange={setAddMovieDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {selectedMovie?.title}</DialogTitle>
              <DialogDescription>Configure how this movie will be added to your library.</DialogDescription>
            </DialogHeader>
            {loadingOptions ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredRootFolders.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">
                <p className="mb-2">No root folder configured for movies.</p>
                <p>Go to <strong>Settings → Media Management</strong> and add a root folder with media type set to <strong>Movies</strong>.</p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Root Folder</Label>
                  <Select value={selectedRootFolder} onValueChange={setSelectedRootFolder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder">
                        {(value: string) => filteredRootFolders.find((f) => f.id === value)?.path || 'Select folder'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {filteredRootFolders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.path}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quality Profile</Label>
                  <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile">
                        {(value: string) => qualityProfiles.find((p) => p.id === value)?.name || 'Select profile'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {qualityProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="movieSearch" checked={searchOnAdd} onCheckedChange={(c) => setSearchOnAdd(c as boolean)} />
                  <Label htmlFor="movieSearch" className="font-normal cursor-pointer">Search for movie immediately</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddMovieDialogOpen(false)}>Cancel</Button>
              <Button onClick={addMovie} disabled={addingMovie || !selectedRootFolder || !selectedQualityProfile || filteredRootFolders.length === 0}>
                {addingMovie && <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />}
                Add Movie
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
              setAddTvShowDialogOpen(true)
            }}
          />
        )}

        {/* Add TV show dialog */}
        <Dialog open={addTvShowDialogOpen} onOpenChange={setAddTvShowDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {selectedTvShow?.title}</DialogTitle>
              <DialogDescription>Configure how this TV show will be added to your library.</DialogDescription>
            </DialogHeader>
            {loadingOptions ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredRootFolders.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">
                <p className="mb-2">No root folder configured for TV shows.</p>
                <p>Go to <strong>Settings → Media Management</strong> and add a root folder with media type set to <strong>TV</strong>.</p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Root Folder</Label>
                  <Select value={selectedRootFolder} onValueChange={setSelectedRootFolder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder">
                        {(value: string) => filteredRootFolders.find((f) => f.id === value)?.path || 'Select folder'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {filteredRootFolders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.path}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quality Profile</Label>
                  <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile">
                        {(value: string) => qualityProfiles.find((p) => p.id === value)?.name || 'Select profile'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {qualityProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                {episodeSelection && (
                  <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/50">
                    {episodeSelection.selectedSeasons
                      ? `${episodeSelection.selectedSeasons.length} season${episodeSelection.selectedSeasons.length !== 1 ? 's' : ''} selected`
                      : episodeSelection.selectedEpisodes
                        ? `${Object.values(episodeSelection.selectedEpisodes).reduce((sum, eps) => sum + eps.length, 0)} episodes selected`
                        : 'All episodes selected'
                    }
                    <Button
                      variant="link"
                      size="sm"
                      className="ml-2 h-auto p-0"
                      onClick={() => {
                        setAddTvShowDialogOpen(false)
                        setSeasonPickerOpen(true)
                      }}
                    >
                      Change
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox id="tvSearch" checked={searchOnAdd} onCheckedChange={(c) => setSearchOnAdd(c as boolean)} />
                  <Label htmlFor="tvSearch" className="font-normal cursor-pointer">Search for episodes immediately</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddTvShowDialogOpen(false)}>Cancel</Button>
              <Button onClick={addTvShow} disabled={addingTvShow || !selectedRootFolder || !selectedQualityProfile || filteredRootFolders.length === 0}>
                {addingTvShow && <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />}
                Add TV Show
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add author dialog */}
        <Dialog open={addAuthorDialogOpen} onOpenChange={setAddAuthorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {selectedAuthor?.name}</DialogTitle>
              <DialogDescription>Configure how this author will be added to your library.</DialogDescription>
            </DialogHeader>
            {loadingOptions ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Root Folder</Label>
                  <Select value={selectedRootFolder} onValueChange={setSelectedRootFolder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder">
                        {(value: string) => filteredRootFolders.find((f) => f.id === value)?.path || 'Select folder'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {filteredRootFolders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.path}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quality Profile</Label>
                  <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile">
                        {(value: string) => qualityProfiles.find((p) => p.id === value)?.name || 'Select profile'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {qualityProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="addBooks" checked={addBooks} onCheckedChange={(c) => setAddBooks(c as boolean)} />
                  <Label htmlFor="addBooks" className="font-normal cursor-pointer">Also add author's books</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddAuthorDialogOpen(false)}>Cancel</Button>
              <Button onClick={addAuthor} disabled={addingAuthor || !selectedRootFolder || !selectedQualityProfile}>
                {addingAuthor && <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />}
                Add Author
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add book dialog */}
        <Dialog open={addBookDialogOpen} onOpenChange={setAddBookDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {selectedBook?.title}</DialogTitle>
              <DialogDescription>
                By {selectedBook?.authorName}. This will also add the author if not already in your library.
              </DialogDescription>
            </DialogHeader>
            {loadingOptions ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Root Folder</Label>
                  <Select value={selectedRootFolder} onValueChange={setSelectedRootFolder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder">
                        {(value: string) => filteredRootFolders.find((f) => f.id === value)?.path || 'Select folder'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {filteredRootFolders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.path}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quality Profile</Label>
                  <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile">
                        {(value: string) => qualityProfiles.find((p) => p.id === value)?.name || 'Select profile'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {qualityProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddBookDialogOpen(false)}>Cancel</Button>
              <Button onClick={addBook} disabled={addingBook || !selectedRootFolder || !selectedQualityProfile}>
                {addingBook && <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />}
                Add Book
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    </ErrorBoundary>
  )
}
