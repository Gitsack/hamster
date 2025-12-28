import { Head, router } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Delete02Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react'
import { toast } from 'sonner'

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
type SearchMode = 'music' | 'direct'
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
  id: number
  path: string
}

interface QualityProfile {
  id: number
  name: string
}

interface MetadataProfile {
  id: number
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

const categoryOptions = [
  { value: '3000', label: 'Audio' },
  { value: '3010', label: 'Audio/MP3' },
  { value: '3020', label: 'Audio/Video' },
  { value: '3030', label: 'Audio/Audiobook' },
  { value: '3040', label: 'Audio/Lossless' },
  { value: '3050', label: 'Audio/Other' },
  { value: '3060', label: 'Audio/Foreign' },
]

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
  const initialMode = (urlParams?.get('mode') as SearchMode) || 'music'
  const initialType = (urlParams?.get('type') as MusicSearchType) || 'artist'

  // Main state
  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode)
  const [musicSearchType, setMusicSearchType] = useState<MusicSearchType>(initialType)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Music search results
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([])
  const [albumResults, setAlbumResults] = useState<AlbumSearchResult[]>([])
  const [trackResults, setTrackResults] = useState<TrackSearchResult[]>([])

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

  // Add artist/album dialog state
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([])
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [metadataProfiles, setMetadataProfiles] = useState<MetadataProfile[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [selectedArtist, setSelectedArtist] = useState<ArtistSearchResult | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumSearchResult | null>(null)
  const [addArtistDialogOpen, setAddArtistDialogOpen] = useState(false)
  const [addAlbumDialogOpen, setAddAlbumDialogOpen] = useState(false)
  const [selectedRootFolder, setSelectedRootFolder] = useState<string>('')
  const [selectedQualityProfile, setSelectedQualityProfile] = useState<string>('')
  const [selectedMetadataProfile, setSelectedMetadataProfile] = useState<string>('')
  const [monitored, setMonitored] = useState(true)
  const [searchForAlbum, setSearchForAlbum] = useState(true)
  const [addingArtist, setAddingArtist] = useState(false)
  const [addingAlbum, setAddingAlbum] = useState(false)

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

    // Load add artist options
    Promise.all([
      fetch('/api/v1/rootfolders').then((r) => r.json()),
      fetch('/api/v1/qualityprofiles').then((r) => r.json()),
      fetch('/api/v1/metadataprofiles').then((r) => r.json()),
    ])
      .then(([rf, qp, mp]) => {
        setRootFolders(rf)
        setQualityProfiles(qp)
        setMetadataProfiles(mp)
        if (rf.length > 0) setSelectedRootFolder(String(rf[0].id))
        if (qp.length > 0) setSelectedQualityProfile(String(qp[0].id))
        if (mp.length > 0) setSelectedMetadataProfile(String(mp[0].id))
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
        // Direct indexer search
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
          const data = await response.json()
          setIndexerResults(data)
        } else {
          toast.error('Search failed')
        }
      } else {
        // Music metadata search
        switch (musicSearchType) {
          case 'artist': {
            const response = await fetch(`/api/v1/artists/search?q=${encodeURIComponent(searchQuery)}`)
            if (response.ok) {
              const data = await response.json()
              setArtistResults(data)
            }
            break
          }
          case 'album': {
            const response = await fetch(`/api/v1/albums/search?q=${encodeURIComponent(searchQuery)}`)
            if (response.ok) {
              const data = await response.json()
              setAlbumResults(data)
            } else {
              // Fallback if endpoint doesn't exist yet
              setAlbumResults([])
              toast.error('Album search coming soon')
            }
            break
          }
          case 'track': {
            const response = await fetch(`/api/v1/tracks/search?q=${encodeURIComponent(searchQuery)}`)
            if (response.ok) {
              const data = await response.json()
              setTrackResults(data)
            } else {
              // Fallback if endpoint doesn't exist yet
              setTrackResults([])
              toast.error('Track search coming soon')
            }
            break
          }
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

          if (response.ok) {
            successCount++
          } else {
            failCount++
          }
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

  // Add artist functions
  const openAddArtistDialog = (artist: ArtistSearchResult) => {
    setSelectedArtist(artist)
    setAddArtistDialogOpen(true)
  }

  // Add album functions
  const openAddAlbumDialog = (album: AlbumSearchResult) => {
    setSelectedAlbum(album)
    setAddAlbumDialogOpen(true)
  }

  const addArtist = async () => {
    if (!selectedArtist) return
    if (!selectedRootFolder || !selectedQualityProfile || !selectedMetadataProfile) {
      toast.error('Please select all required options')
      return
    }

    setAddingArtist(true)

    try {
      const response = await fetch('/api/v1/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicbrainzId: selectedArtist.musicbrainzId,
          rootFolderId: parseInt(selectedRootFolder),
          qualityProfileId: parseInt(selectedQualityProfile),
          metadataProfileId: parseInt(selectedMetadataProfile),
          monitored,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${selectedArtist.name} added to library`)
        setAddArtistDialogOpen(false)

        // Update search results
        setArtistResults((prev) =>
          prev.map((r) =>
            r.musicbrainzId === selectedArtist.musicbrainzId
              ? { ...r, inLibrary: true }
              : r
          )
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
    if (!selectedAlbum) return
    if (!selectedRootFolder || !selectedQualityProfile || !selectedMetadataProfile) {
      toast.error('Please select all required options')
      return
    }

    setAddingAlbum(true)

    try {
      const response = await fetch('/api/v1/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicbrainzId: selectedAlbum.musicbrainzId,
          artistMusicbrainzId: selectedAlbum.artistMusicbrainzId,
          rootFolderId: parseInt(selectedRootFolder),
          qualityProfileId: parseInt(selectedQualityProfile),
          metadataProfileId: parseInt(selectedMetadataProfile),
          monitored,
          searchForAlbum,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const message = searchForAlbum
          ? `${selectedAlbum.title} added to library and searching for releases...`
          : `${selectedAlbum.title} added to library`
        toast.success(message)
        setAddAlbumDialogOpen(false)

        // Update search results
        setAlbumResults((prev) =>
          prev.map((r) =>
            r.musicbrainzId === selectedAlbum.musicbrainzId
              ? { ...r, inLibrary: true }
              : r
          )
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

  // Render music search results
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
          {artistResults.map((artist) => (
            <Card key={artist.musicbrainzId} className={artist.inLibrary ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-16 w-16 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                  <HugeiconsIcon icon={MusicNote01Icon} className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">
                    {artist.name}
                    {artist.disambiguation && (
                      <span className="text-muted-foreground ml-2">({artist.disambiguation})</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    {artist.type && <span>{artist.type}</span>}
                    {artist.country && (
                      <>
                        <span>•</span>
                        <span>{artist.country}</span>
                      </>
                    )}
                    {artist.beginDate && (
                      <>
                        <span>•</span>
                        <span>
                          {artist.beginDate}
                          {artist.endDate ? ` - ${artist.endDate}` : ''}
                        </span>
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
                    <Button size="sm" onClick={() => openAddArtistDialog(artist)}>
                      <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSearchMode('direct')
                          setSearchQuery(artist.name)
                          search()
                        }}
                      >
                        <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 mr-2" />
                        Search Releases
                      </DropdownMenuItem>
                      {!artist.inLibrary && (
                        <DropdownMenuItem onClick={() => openAddArtistDialog(artist)}>
                          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
                          Add to Library
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (musicSearchType === 'album' && albumResults.length > 0) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">
            Found {albumResults.length} albums
          </div>
          {albumResults.map((album) => (
            <Card key={album.musicbrainzId} className={album.inLibrary ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-16 w-16 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                  <HugeiconsIcon icon={Album01Icon} className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{album.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span>{album.artistName}</span>
                    {album.releaseDate && (
                      <>
                        <span>•</span>
                        <span>{album.releaseDate}</span>
                      </>
                    )}
                    {album.type && (
                      <>
                        <span>•</span>
                        <span>{album.type}</span>
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
                    <Button size="sm" onClick={() => openAddAlbumDialog(album)}>
                      <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSearchMode('direct')
                          setSearchQuery(`${album.artistName} ${album.title}`)
                          search()
                        }}
                      >
                        <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 mr-2" />
                        Search Releases
                      </DropdownMenuItem>
                      {!album.inLibrary && (
                        <DropdownMenuItem onClick={() => openAddAlbumDialog(album)}>
                          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
                          Add to Library
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
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
                <div className="h-16 w-16 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                  <HugeiconsIcon icon={MusicNoteSquare01Icon} className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{track.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span>{track.artistName}</span>
                    {track.albumTitle && (
                      <>
                        <span>•</span>
                        <span>{track.albumTitle}</span>
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
                  ) : (
                    <Button size="sm" disabled title="Add album to add track">
                      <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSearchMode('direct')
                          setSearchQuery(`${track.artistName} ${track.title}`)
                          search()
                        }}
                      >
                        <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 mr-2" />
                        Search Releases
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (hasSearched) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <HugeiconsIcon icon={Search01Icon} className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try a different search term or check your spelling.
            </p>
          </CardContent>
        </Card>
      )
    }

    return null
  }

  // Render direct search results
  const renderDirectResults = () => {
    if (searching) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-12 rounded" />
                  <Skeleton className="h-4 w-16" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )
    }

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
                        <TableCell>
                          <span className="text-muted-foreground">{result.indexer}</span>
                        </TableCell>
                      )}
                      {isColumnVisible('size') && (
                        <TableCell className="whitespace-nowrap">{formatBytes(result.size)}</TableCell>
                      )}
                      {isColumnVisible('grabs') && (
                        <TableCell className="text-muted-foreground">{result.grabs ?? '-'}</TableCell>
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

    if (hasSearched) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <HugeiconsIcon icon={Search01Icon} className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try a different search term or check your indexer configuration.
            </p>
          </CardContent>
        </Card>
      )
    }

    return null
  }

  return (
    <ErrorBoundary>
      <AppLayout title="Search">
        <Head title="Search" />

        <div className="space-y-4">
          {/* Search mode tabs */}
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as SearchMode)}>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <TabsList>
                <TabsTrigger value="music" className="gap-2">
                  <HugeiconsIcon icon={MusicNote01Icon} className="h-4 w-4" />
                  Music
                </TabsTrigger>
                <TabsTrigger value="direct" className="gap-2">
                  <HugeiconsIcon icon={Globe02Icon} className="h-4 w-4" />
                  Direct Search
                </TabsTrigger>
              </TabsList>

              {/* Music search type selector */}
              {searchMode === 'music' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Search for:</span>
                  <Tabs value={musicSearchType} onValueChange={(v) => setMusicSearchType(v as MusicSearchType)}>
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
            </div>

            {/* Search input and filters */}
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  {/* Search row */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <HugeiconsIcon
                        icon={Search01Icon}
                        className="size-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 left-2"
                      />
                      <Input
                        placeholder={
                          searchMode === 'direct'
                            ? 'Search for releases on indexers...'
                            : `Search for ${musicSearchType}s on MusicBrainz...`
                        }
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
                            <div className="px-2 py-1.5 text-sm font-medium">Select Indexers</div>
                            <DropdownMenuSeparator />
                            {indexers.map((indexer) => (
                              <DropdownMenuCheckboxItem
                                key={indexer.id}
                                checked={selectedIndexers.includes(indexer.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedIndexers([...selectedIndexers, indexer.id])
                                  } else {
                                    setSelectedIndexers(selectedIndexers.filter((id) => id !== indexer.id))
                                  }
                                }}
                              >
                                {indexer.name}
                              </DropdownMenuCheckboxItem>
                            ))}
                            {selectedIndexers.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setSelectedIndexers([])}>
                                  Clear selection
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Categories:</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              {selectedCategories.length === 0 ? 'All' : `${selectedCategories.length} selected`}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <div className="px-2 py-1.5 text-sm font-medium">Filter by Category</div>
                            <DropdownMenuSeparator />
                            {categoryOptions.map((cat) => (
                              <DropdownMenuCheckboxItem
                                key={cat.value}
                                checked={selectedCategories.includes(cat.label)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedCategories([...selectedCategories, cat.label])
                                  } else {
                                    setSelectedCategories(selectedCategories.filter((c) => c !== cat.label))
                                  }
                                }}
                              >
                                {cat.label}
                              </DropdownMenuCheckboxItem>
                            ))}
                            {selectedCategories.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setSelectedCategories([])}>
                                  Clear selection
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
                            <div className="px-2 py-1.5 text-sm font-medium">Sort by</div>
                            <DropdownMenuSeparator />
                            {[
                              { field: 'age', label: 'Age' },
                              { field: 'title', label: 'Title' },
                              { field: 'size', label: 'Size' },
                              { field: 'indexer', label: 'Indexer' },
                              { field: 'grabs', label: 'Grabs' },
                              { field: 'category', label: 'Category' },
                            ].map(({ field, label }) => (
                              <DropdownMenuItem key={field} onClick={() => toggleSort(field as SortField)}>
                                <span className="flex-1">{label}</span>
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
                            <div className="px-2 py-1.5 text-sm font-medium">Show Columns</div>
                            <DropdownMenuSeparator />
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
                      Clear selection
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
            <TabsContent value="music" className="mt-4">
              {renderMusicResults()}
            </TabsContent>

            <TabsContent value="direct" className="mt-4">
              {renderDirectResults()}
            </TabsContent>
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
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Age</div>
                    <div>{formatAge(selectedIndexerResult.publishDate)}</div>
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
                  <>
                    <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={Download01Icon} className="h-4 w-4 mr-2" />
                    Download
                  </>
                )}
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
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="rootFolder">Root Folder</Label>
                  <Select value={selectedRootFolder} onValueChange={setSelectedRootFolder}>
                    <SelectTrigger id="rootFolder">
                      {selectedRootFolder
                        ? rootFolders.find((f) => String(f.id) === selectedRootFolder)?.path
                        : <span className="text-muted-foreground">Select root folder</span>}
                    </SelectTrigger>
                    <SelectPopup>
                      {rootFolders.map((folder) => (
                        <SelectItem key={folder.id} value={String(folder.id)}>
                          {folder.path}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualityProfile">Quality Profile</Label>
                  <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                    <SelectTrigger id="qualityProfile">
                      {selectedQualityProfile
                        ? qualityProfiles.find((p) => String(p.id) === selectedQualityProfile)?.name
                        : <span className="text-muted-foreground">Select quality profile</span>}
                    </SelectTrigger>
                    <SelectPopup>
                      {qualityProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={String(profile.id)}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metadataProfile">Metadata Profile</Label>
                  <Select value={selectedMetadataProfile} onValueChange={setSelectedMetadataProfile}>
                    <SelectTrigger id="metadataProfile">
                      {selectedMetadataProfile
                        ? metadataProfiles.find((p) => String(p.id) === selectedMetadataProfile)?.name
                        : <span className="text-muted-foreground">Select metadata profile</span>}
                    </SelectTrigger>
                    <SelectPopup>
                      {metadataProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={String(profile.id)}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="monitored"
                    checked={monitored}
                    onCheckedChange={(checked) => setMonitored(checked as boolean)}
                  />
                  <Label htmlFor="monitored" className="font-normal cursor-pointer">
                    Monitor artist for new releases
                  </Label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddArtistDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={addArtist}
                disabled={
                  addingArtist ||
                  loadingOptions ||
                  !selectedRootFolder ||
                  !selectedQualityProfile ||
                  !selectedMetadataProfile
                }
              >
                {addingArtist ? (
                  <>
                    <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  'Add Artist'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add album dialog */}
        <Dialog open={addAlbumDialogOpen} onOpenChange={setAddAlbumDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {selectedAlbum?.title}</DialogTitle>
              <DialogDescription>
                This will add {selectedAlbum?.artistName} to your library with this album.
              </DialogDescription>
            </DialogHeader>

            {loadingOptions ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="albumRootFolder">Root Folder</Label>
                  <Select value={selectedRootFolder} onValueChange={setSelectedRootFolder}>
                    <SelectTrigger id="albumRootFolder">
                      {selectedRootFolder
                        ? rootFolders.find((f) => String(f.id) === selectedRootFolder)?.path
                        : <span className="text-muted-foreground">Select root folder</span>}
                    </SelectTrigger>
                    <SelectPopup>
                      {rootFolders.map((folder) => (
                        <SelectItem key={folder.id} value={String(folder.id)}>
                          {folder.path}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="albumQualityProfile">Quality Profile</Label>
                  <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                    <SelectTrigger id="albumQualityProfile">
                      {selectedQualityProfile
                        ? qualityProfiles.find((p) => String(p.id) === selectedQualityProfile)?.name
                        : <span className="text-muted-foreground">Select quality profile</span>}
                    </SelectTrigger>
                    <SelectPopup>
                      {qualityProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={String(profile.id)}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="albumMetadataProfile">Metadata Profile</Label>
                  <Select value={selectedMetadataProfile} onValueChange={setSelectedMetadataProfile}>
                    <SelectTrigger id="albumMetadataProfile">
                      {selectedMetadataProfile
                        ? metadataProfiles.find((p) => String(p.id) === selectedMetadataProfile)?.name
                        : <span className="text-muted-foreground">Select metadata profile</span>}
                    </SelectTrigger>
                    <SelectPopup>
                      {metadataProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={String(profile.id)}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="albumMonitored"
                    checked={monitored}
                    onCheckedChange={(checked) => setMonitored(checked as boolean)}
                  />
                  <Label htmlFor="albumMonitored" className="font-normal cursor-pointer">
                    Monitor this album
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="searchForAlbum"
                    checked={searchForAlbum}
                    onCheckedChange={(checked) => setSearchForAlbum(checked as boolean)}
                  />
                  <Label htmlFor="searchForAlbum" className="font-normal cursor-pointer">
                    Start search for this album immediately
                  </Label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddAlbumDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={addAlbum}
                disabled={
                  addingAlbum ||
                  loadingOptions ||
                  !selectedRootFolder ||
                  !selectedQualityProfile ||
                  !selectedMetadataProfile
                }
              >
                {addingAlbum ? (
                  <>
                    <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  'Add Album'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    </ErrorBoundary>
  )
}
