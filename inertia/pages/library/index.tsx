import { Head, Link, router } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Search01Icon,
  GridIcon,
  Menu01Icon,
  SortingIcon,
  MusicNote01Icon,
  Film01Icon,
  Tv01Icon,
  Book01Icon,
  MoreVerticalIcon,
  Delete02Icon,
  EyeIcon,
  CheckmarkCircle02Icon,
  Download01Icon,
  Clock01Icon,
  FolderSearchIcon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  MediaStatusBadge,
  getMediaItemStatus,
  type MediaItemStatus,
} from '@/components/library/media-status-badge'

interface Artist {
  id: number
  name: string
  sortName: string
  musicbrainzId: string | null
  status: string
  artistType: string | null
  imageUrl: string | null
  requested: boolean
  albumCount: number
  qualityProfile: { id: number; name: string } | null
  metadataProfile: { id: number; name: string } | null
}

interface Movie {
  id: number
  tmdbId: string | null
  title: string
  year: number | null
  overview: string | null
  posterUrl: string | null
  status: string | null
  requested: boolean
  hasFile: boolean
  runtime: number | null
  rating: number | null
}

interface TvShow {
  id: number
  tmdbId: string | null
  title: string
  year: number | null
  overview: string | null
  posterUrl: string | null
  status: string | null
  network: string | null
  requested: boolean
  seasonCount: number
  episodeCount: number
}

interface Author {
  id: number
  name: string
  overview: string | null
  imageUrl: string | null
  requested: boolean
  bookCount: number
}

interface QueueItem {
  id: number
  artistId: number | null
  albumId: number | null
  movieId: number | null
  tvShowId: number | null
  bookId: number | null
  progress: number
  status: string
}

type ViewMode = 'grid' | 'list'
type SortBy = 'name' | 'recent' | 'count' | 'year'
type MediaType = 'music' | 'movies' | 'tv' | 'books' | 'missing'

interface MissingItem {
  id: string
  type: 'album' | 'movie' | 'episode' | 'book'
  title: string
  subtitle?: string
  imageUrl?: string | null
  airDate?: string | null
}

const MEDIA_TYPE_CONFIG: Record<
  MediaType,
  {
    label: string
    icon: typeof MusicNote01Icon
    addUrl: string
    itemLabel: string
    countLabel: string
  }
> = {
  music: {
    label: 'Music',
    icon: MusicNote01Icon,
    addUrl: '/search?mode=music&type=artist',
    itemLabel: 'artist',
    countLabel: 'albums',
  },
  movies: {
    label: 'Movies',
    icon: Film01Icon,
    addUrl: '/search?mode=movies',
    itemLabel: 'movie',
    countLabel: 'movies',
  },
  tv: {
    label: 'TV Shows',
    icon: Tv01Icon,
    addUrl: '/search?mode=tv',
    itemLabel: 'show',
    countLabel: 'shows',
  },
  books: {
    label: 'Books',
    icon: Book01Icon,
    addUrl: '/search?mode=books',
    itemLabel: 'author',
    countLabel: 'books',
  },
  missing: {
    label: 'Missing',
    icon: Clock01Icon,
    addUrl: '/search',
    itemLabel: 'item',
    countLabel: 'items',
  },
}

export default function Library() {
  const [enabledMediaTypes, setEnabledMediaTypes] = useState<MediaType[]>(['music'])
  const [artists, setArtists] = useState<Artist[]>([])
  const [movies, setMovies] = useState<Movie[]>([])
  const [tvShows, setTvShows] = useState<TvShow[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [missingItems, setMissingItems] = useState<MissingItem[]>([])
  const [missingCounts, setMissingCounts] = useState({
    albums: 0,
    movies: 0,
    episodes: 0,
    books: 0,
  })
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  // Read initial tab from URL
  const initialTab =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('tab') as MediaType) || 'music'
      : 'music'
  const [activeTab, setActiveTabState] = useState<MediaType>(initialTab)

  // Sync active tab to URL
  const setActiveTab = useCallback((tab: MediaType) => {
    setActiveTabState(tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState({}, '', url.toString())
  }, [])

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{
    type: MediaType
    id: number
    name: string
  } | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // File deletion confirmation dialog state (for items with files)
  const [fileConfirmDialogOpen, setFileConfirmDialogOpen] = useState(false)
  const [itemWithFile, setItemWithFile] = useState<{
    type: MediaType
    id: number
    name: string
    hasFile?: boolean
  } | null>(null)
  const [deletingWithFile, setDeletingWithFile] = useState(false)

  // Library scan state
  const [scanning, setScanning] = useState(false)

  // Enriching state
  const [enrichingItems, setEnrichingItems] = useState<Set<string>>(new Set())

  // Toggling request state
  const [togglingItems, setTogglingItems] = useState<Set<string>>(new Set())

  // Fetch enabled media types from settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/v1/settings')
        if (response.ok) {
          const data = await response.json()
          if (data.enabledMediaTypes?.length > 0) {
            // Add 'missing' tab as a special always-available option
            const types = [...data.enabledMediaTypes, 'missing'] as MediaType[]
            setEnabledMediaTypes(types)
            // Only override tab if no valid tab was provided via URL
            if (!types.includes(initialTab)) {
              setActiveTab(data.enabledMediaTypes[0])
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      }
    }
    fetchSettings()
  }, [])

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Always fetch queue for status
      const queueRes = await fetch('/api/v1/queue')
      if (queueRes.ok) {
        setQueue(await queueRes.json())
      }

      // Fetch data based on active tab
      switch (activeTab) {
        case 'music': {
          const res = await fetch('/api/v1/artists')
          if (res.ok) setArtists(await res.json())
          break
        }
        case 'movies': {
          const res = await fetch('/api/v1/movies')
          if (res.ok) setMovies(await res.json())
          break
        }
        case 'tv': {
          const res = await fetch('/api/v1/tvshows')
          if (res.ok) setTvShows(await res.json())
          break
        }
        case 'books': {
          const res = await fetch('/api/v1/authors')
          if (res.ok) setAuthors(await res.json())
          break
        }
        case 'missing': {
          // Fetch all missing items from all media types
          const [albumsRes, moviesRes, episodesRes, booksRes] = await Promise.all([
            fetch('/api/v1/albums/requested?limit=100'),
            fetch('/api/v1/movies/requested?limit=100'),
            fetch('/api/v1/tvshows/requested?limit=100'),
            fetch('/api/v1/books/requested?limit=100'),
          ])

          const combined: MissingItem[] = []

          if (albumsRes.ok) {
            const data = await albumsRes.json()
            setMissingCounts((prev) => ({ ...prev, albums: data.meta?.total || 0 }))
            combined.push(
              ...data.data.map((a: any) => ({
                id: `album-${a.id}`,
                type: 'album' as const,
                title: a.title,
                subtitle: a.artistName,
                imageUrl: a.imageUrl,
              }))
            )
          }

          if (moviesRes.ok) {
            const data = await moviesRes.json()
            setMissingCounts((prev) => ({ ...prev, movies: data.meta?.total || 0 }))
            combined.push(
              ...data.data.map((m: any) => ({
                id: `movie-${m.id}`,
                type: 'movie' as const,
                title: m.title,
                subtitle: m.year?.toString(),
                imageUrl: m.posterUrl,
              }))
            )
          }

          if (episodesRes.ok) {
            const data = await episodesRes.json()
            setMissingCounts((prev) => ({ ...prev, episodes: data.meta?.total || 0 }))
            combined.push(
              ...data.data.map((e: any) => ({
                id: `episode-${e.id}`,
                type: 'episode' as const,
                title: `S${String(e.seasonNumber).padStart(2, '0')}E${String(e.episodeNumber).padStart(2, '0')} - ${e.title}`,
                subtitle: e.tvShowTitle,
                imageUrl: e.posterUrl,
                airDate: e.airDate,
              }))
            )
          }

          if (booksRes.ok) {
            const data = await booksRes.json()
            setMissingCounts((prev) => ({ ...prev, books: data.meta?.total || 0 }))
            combined.push(
              ...data.data.map((b: any) => ({
                id: `book-${b.id}`,
                type: 'book' as const,
                title: b.title,
                subtitle: b.authorName,
                imageUrl: b.coverUrl,
              }))
            )
          }

          setMissingItems(combined)
          break
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openDeleteDialog = (type: MediaType, id: number, name: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setItemToDelete({ type, id, name })
    setDeleteFiles(false)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return

    setDeleting(true)
    try {
      const endpoints: Record<MediaType, string> = {
        music: 'artists',
        movies: 'movies',
        tv: 'tvshows',
        books: 'authors',
      }

      const response = await fetch(
        `/api/v1/${endpoints[itemToDelete.type]}/${itemToDelete.id}?deleteFiles=${deleteFiles}`,
        {
          method: 'DELETE',
        }
      )

      if (response.ok) {
        toast.success(`${itemToDelete.name} removed from library`)

        // Update the appropriate state
        switch (itemToDelete.type) {
          case 'music':
            setArtists((prev) => prev.filter((a) => a.id !== itemToDelete.id))
            break
          case 'movies':
            setMovies((prev) => prev.filter((m) => m.id !== itemToDelete.id))
            break
          case 'tv':
            setTvShows((prev) => prev.filter((t) => t.id !== itemToDelete.id))
            break
          case 'books':
            setAuthors((prev) => prev.filter((a) => a.id !== itemToDelete.id))
            break
        }

        setDeleteDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to remove item')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Failed to remove item')
    } finally {
      setDeleting(false)
    }
  }

  // Scan library for the current media type
  const handleScanLibrary = async () => {
    if (scanning || activeTab === 'missing') return

    setScanning(true)

    // Map activeTab to root folder media type
    const mediaTypeMap: Record<MediaType, string> = {
      music: 'music',
      movies: 'movies',
      tv: 'tv',
      books: 'books',
      missing: '',
    }

    const mediaType = mediaTypeMap[activeTab]
    if (!mediaType) {
      setScanning(false)
      return
    }

    try {
      // First get root folders for this media type
      const rootFoldersRes = await fetch('/api/v1/rootfolders')
      if (!rootFoldersRes.ok) {
        toast.error('Failed to fetch root folders')
        return
      }

      const allRootFolders = await rootFoldersRes.json()
      const foldersToScan = allRootFolders.filter(
        (rf: { mediaType: string }) => rf.mediaType === mediaType
      )

      if (foldersToScan.length === 0) {
        toast.error(`No root folders configured for ${MEDIA_TYPE_CONFIG[activeTab].label}`)
        return
      }

      toast.info(`Scanning ${foldersToScan.length} folder(s)...`)

      // Start scan for each root folder
      const scanPromises: Promise<void>[] = []
      let errors: string[] = []

      for (const folder of foldersToScan) {
        const scanPromise = (async () => {
          try {
            // Start the scan
            const scanRes = await fetch(`/api/v1/rootfolders/${folder.id}/scan`, {
              method: 'POST',
            })

            if (!scanRes.ok) {
              const error = await scanRes.json()
              errors.push(error.error || `Failed to start scan for: ${folder.path}`)
              return
            }

            // Poll for completion
            let isScanning = true
            while (isScanning) {
              await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second

              const statusRes = await fetch(`/api/v1/rootfolders/${folder.id}/scan-status`)
              if (statusRes.ok) {
                const status = await statusRes.json()
                isScanning = status.isScanning
              } else {
                // If we can't get status, assume it's done
                isScanning = false
              }
            }
          } catch (err) {
            errors.push(
              `Error scanning ${folder.path}: ${err instanceof Error ? err.message : 'Unknown error'}`
            )
          }
        })()

        scanPromises.push(scanPromise)
      }

      // Wait for all scans to complete
      await Promise.all(scanPromises)

      // Show results
      if (errors.length > 0) {
        console.error('Scan errors:', errors)
        toast.warning(`Scan completed with ${errors.length} error(s)`)
      } else {
        toast.success('Library scan complete!')
      }

      // Refresh the library data
      await fetchData()
    } catch (error) {
      console.error('Scan failed:', error)
      toast.error('Library scan failed')
    } finally {
      setScanning(false)
    }
  }

  // Handle enriching items
  const handleEnrich = async (
    mediaType: MediaType,
    id: number,
    name: string,
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const itemKey = `${mediaType}-${id}`
    setEnrichingItems((prev) => new Set(prev).add(itemKey))

    const endpoints: Record<MediaType, string> = {
      music: 'artists',
      movies: 'movies',
      tv: 'tvshows',
      books: 'authors',
      missing: '',
    }

    try {
      const response = await fetch(`/api/v1/${endpoints[mediaType]}/${id}/enrich`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.enriched) {
          toast.success(`${name} enriched successfully`)
          // Refresh the data
          fetchData()
        } else {
          toast.warning(data.message || 'No matching entry found')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to enrich')
      }
    } catch (error) {
      console.error('Failed to enrich:', error)
      toast.error('Failed to enrich')
    } finally {
      setEnrichingItems((prev) => {
        const next = new Set(prev)
        next.delete(itemKey)
        return next
      })
    }
  }

  // Handle toggling request status
  const handleToggleRequest = async (
    mediaType: MediaType,
    id: number,
    currentlyRequested: boolean,
    hasFile?: boolean,
    name?: string,
    e?: React.MouseEvent
  ) => {
    e?.preventDefault()
    e?.stopPropagation()

    // If unrequesting an item that has a file, show confirmation dialog
    if (currentlyRequested && hasFile) {
      setItemWithFile({ type: mediaType, id, name: name || 'this item', hasFile })
      setFileConfirmDialogOpen(true)
      return
    }

    const itemKey = `${mediaType}-${id}`
    setTogglingItems((prev) => new Set(prev).add(itemKey))

    // Use the appropriate endpoint based on media type
    const getEndpoint = () => {
      switch (mediaType) {
        case 'movies':
          return `/api/v1/movies/${id}/request`
        case 'books':
          // For books, use books/:id/request, not authors/:id
          return `/api/v1/books/${id}/request`
        case 'music':
          return `/api/v1/artists/${id}`
        case 'tv':
          return `/api/v1/tvshows/${id}`
        default:
          return ''
      }
    }

    const endpoint = getEndpoint()
    const isRequestEndpoint = mediaType === 'movies' || mediaType === 'books'

    try {
      const response = await fetch(endpoint, {
        method: isRequestEndpoint ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !currentlyRequested }),
      })

      const data = await response.json()

      if (response.ok) {
        // Check if item was deleted
        if (data.deleted) {
          toast.success('Removed from library')
          // Remove item from local state
          switch (mediaType) {
            case 'movies':
              setMovies((prev) => prev.filter((m) => m.id !== id))
              break
            case 'music':
              setArtists((prev) => prev.filter((a) => a.id !== id))
              break
            case 'tv':
              setTvShows((prev) => prev.filter((t) => t.id !== id))
              break
            case 'books':
              setAuthors((prev) => prev.filter((a) => a.id !== id))
              break
          }
        } else {
          toast.success(currentlyRequested ? 'Item unrequested' : 'Item requested')
          // Update local state
          switch (mediaType) {
            case 'movies':
              setMovies((prev) =>
                prev.map((m) => (m.id === id ? { ...m, requested: !currentlyRequested } : m))
              )
              break
            case 'music':
              setArtists((prev) =>
                prev.map((a) => (a.id === id ? { ...a, requested: !currentlyRequested } : a))
              )
              break
            case 'tv':
              setTvShows((prev) =>
                prev.map((t) => (t.id === id ? { ...t, requested: !currentlyRequested } : t))
              )
              break
            case 'books':
              setAuthors((prev) =>
                prev.map((a) => (a.id === id ? { ...a, requested: !currentlyRequested } : a))
              )
              break
          }
        }
      } else if (data.hasFile) {
        // Item has a file - show confirmation dialog
        setItemWithFile({ type: mediaType, id, name: name || 'this item', hasFile: true })
        setFileConfirmDialogOpen(true)
      } else {
        toast.error(data.error || 'Failed to update request status')
      }
    } catch (error) {
      console.error('Failed to toggle request:', error)
      toast.error('Failed to update request status')
    } finally {
      setTogglingItems((prev) => {
        const next = new Set(prev)
        next.delete(itemKey)
        return next
      })
    }
  }

  // Handle deleting an item with its file
  const handleDeleteWithFile = async () => {
    if (!itemWithFile) return

    setDeletingWithFile(true)

    const getEndpoint = () => {
      switch (itemWithFile.type) {
        case 'movies':
          return `/api/v1/movies/${itemWithFile.id}?deleteFile=true`
        case 'books':
          return `/api/v1/books/${itemWithFile.id}?deleteFile=true`
        default:
          return ''
      }
    }

    const endpoint = getEndpoint()
    if (!endpoint) {
      toast.error('Cannot delete this item type')
      setDeletingWithFile(false)
      return
    }

    try {
      const response = await fetch(endpoint, { method: 'DELETE' })

      if (response.ok) {
        toast.success('Removed from library and deleted files')
        // Remove item from local state
        switch (itemWithFile.type) {
          case 'movies':
            setMovies((prev) => prev.filter((m) => m.id !== itemWithFile.id))
            break
          case 'books':
            // For books, the author might have been deleted too - refresh the page
            fetchData()
            break
        }
        setFileConfirmDialogOpen(false)
        setItemWithFile(null)
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Failed to delete')
    } finally {
      setDeletingWithFile(false)
    }
  }

  // Get status for items
  const getItemStatusInfo = (
    item: { requested?: boolean; hasFile?: boolean },
    downloadProgress?: number,
    downloadStatus?: string
  ): { status: MediaItemStatus; progress: number } => {
    return getMediaItemStatus(
      item,
      downloadProgress !== undefined
        ? { progress: downloadProgress, status: downloadStatus || 'downloading' }
        : null
    )
  }

  // Filter and sort functions for each media type
  const getFilteredArtists = () => {
    return artists
      .filter((artist) => artist.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        switch (sortBy) {
          case 'recent':
            return b.id - a.id
          case 'count':
            return Number(b.albumCount) - Number(a.albumCount)
          default:
            return (a.sortName || a.name).localeCompare(b.sortName || b.name)
        }
      })
  }

  const getFilteredMovies = () => {
    return movies
      .filter((movie) => movie.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        switch (sortBy) {
          case 'recent':
            return b.id - a.id
          case 'year':
            return (b.year || 0) - (a.year || 0)
          default:
            return a.title.localeCompare(b.title)
        }
      })
  }

  const getFilteredTvShows = () => {
    return tvShows
      .filter((show) => show.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        switch (sortBy) {
          case 'recent':
            return b.id - a.id
          case 'year':
            return (b.year || 0) - (a.year || 0)
          case 'count':
            return b.episodeCount - a.episodeCount
          default:
            return a.title.localeCompare(b.title)
        }
      })
  }

  const getFilteredAuthors = () => {
    return authors
      .filter((author) => author.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        switch (sortBy) {
          case 'recent':
            return b.id - a.id
          case 'count':
            return Number(b.bookCount) - Number(a.bookCount)
          default:
            return a.name.localeCompare(b.name)
        }
      })
  }

  const getCurrentItems = () => {
    switch (activeTab) {
      case 'music':
        return getFilteredArtists()
      case 'movies':
        return getFilteredMovies()
      case 'tv':
        return getFilteredTvShows()
      case 'books':
        return getFilteredAuthors()
    }
  }

  const getTotalCount = () => {
    switch (activeTab) {
      case 'music':
        return artists.length
      case 'movies':
        return movies.length
      case 'tv':
        return tvShows.length
      case 'books':
        return authors.length
    }
  }

  const renderEmptyState = () => {
    const config = MEDIA_TYPE_CONFIG[activeTab]
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <HugeiconsIcon icon={config.icon} className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">
          {searchQuery ? 'No items found' : `Your ${config.label.toLowerCase()} library is empty`}
        </h3>
        <p className="text-muted-foreground mb-4">
          {searchQuery
            ? 'Try a different search term'
            : `Get started by adding your first ${config.itemLabel}`}
        </p>
        {!searchQuery && (
          <Button asChild>
            <Link href={config.addUrl}>
              <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
              Add {config.itemLabel.charAt(0).toUpperCase() + config.itemLabel.slice(1)}
            </Link>
          </Button>
        )}
      </div>
    )
  }

  // Track failed images
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const handleImageError = useCallback((key: string) => {
    setFailedImages((prev) => new Set(prev).add(key))
  }, [])

  // Render grid item for any media type
  const renderGridItem = (item: {
    id: number
    name: string
    imageUrl: string | null
    subtitle?: string
    detailUrl: string
    requested?: boolean
    hasFile?: boolean
    mediaType: MediaType
    externalId?: string | null
  }) => {
    const config = MEDIA_TYPE_CONFIG[item.mediaType]
    const imageKey = `${item.mediaType}-${item.id}`
    const showImage = item.imageUrl && !failedImages.has(imageKey)
    const queueItem = queue.find((q) => {
      switch (item.mediaType) {
        case 'music':
          return q.artistId === item.id
        case 'movies':
          return q.movieId === item.id
        case 'tv':
          return q.tvShowId === item.id
        case 'books':
          return q.bookId === item.id
      }
    })
    const isDownloading = !!queueItem
    const isNotRequested = !item.requested && !item.hasFile && !isDownloading
    const isToggling = togglingItems.has(imageKey)

    // Get status info
    const { status, progress } = getItemStatusInfo(item, queueItem?.progress, queueItem?.status)

    return (
      <Card
        key={imageKey}
        className="py-0 overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group relative"
      >
        <Link href={item.detailUrl}>
          <div className="aspect-[2/3] bg-muted relative">
            {showImage ? (
              <img
                src={item.imageUrl!}
                alt={item.name}
                className={`w-full h-full object-cover transition-all duration-300 ${
                  isNotRequested
                    ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'
                    : ''
                }`}
                loading="lazy"
                onError={() => handleImageError(imageKey)}
              />
            ) : (
              <div
                className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
                  isNotRequested ? 'opacity-40 group-hover:opacity-60' : ''
                }`}
              >
                <HugeiconsIcon icon={config.icon} className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <CardContent
            className={`p-3 transition-opacity duration-300 ${isNotRequested ? 'opacity-60 group-hover:opacity-100' : ''}`}
          >
            <h3 className="font-medium truncate group-hover:text-primary transition-colors">
              {item.name}
            </h3>
            {item.subtitle && (
              <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
            )}
          </CardContent>
        </Link>
        {/* Status indicator - outside Link to prevent navigation on click */}
        {status !== 'none' && (
          <div className="absolute top-2 left-2 z-10">
            <MediaStatusBadge
              status={status}
              progress={progress}
              size="sm"
              isToggling={isToggling}
              onToggleRequest={() =>
                handleToggleRequest(
                  item.mediaType,
                  item.id,
                  item.requested ?? false,
                  item.hasFile,
                  item.name
                )
              }
              showRequestButton={false}
            />
          </div>
        )}
        {/* More menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                onClick={(e) => e.preventDefault()}
              >
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={item.detailUrl}>
                  <HugeiconsIcon icon={EyeIcon} className="h-4 w-4 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
              {!item.externalId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleEnrich(item.mediaType, item.id, item.name, e)}
                    disabled={enrichingItems.has(`${item.mediaType}-${item.id}`)}
                  >
                    <HugeiconsIcon
                      icon={Search01Icon}
                      className={`h-4 w-4 mr-2 ${enrichingItems.has(`${item.mediaType}-${item.id}`) ? 'animate-spin' : ''}`}
                    />
                    {enrichingItems.has(`${item.mediaType}-${item.id}`)
                      ? 'Enriching...'
                      : item.mediaType === 'music'
                        ? 'Enrich from MusicBrainz'
                        : 'Enrich from TMDB'}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    )
  }

  // Render list item for any media type
  const renderListItem = (item: {
    id: number
    name: string
    imageUrl: string | null
    subtitle?: string
    detailUrl: string
    requested?: boolean
    hasFile?: boolean
    mediaType: MediaType
    badges?: string[]
    externalId?: string | null
  }) => {
    const config = MEDIA_TYPE_CONFIG[item.mediaType]
    const imageKey = `${item.mediaType}-${item.id}`
    const showImage = item.imageUrl && !failedImages.has(imageKey)
    const queueItem = queue.find((q) => {
      switch (item.mediaType) {
        case 'music':
          return q.artistId === item.id
        case 'movies':
          return q.movieId === item.id
        case 'tv':
          return q.tvShowId === item.id
        case 'books':
          return q.bookId === item.id
      }
    })
    const isDownloading = !!queueItem
    const isNotRequested = !item.requested && !item.hasFile && !isDownloading
    const isToggling = togglingItems.has(imageKey)

    // Get status info
    const { status, progress } = getItemStatusInfo(item, queueItem?.progress, queueItem?.status)

    return (
      <Card
        key={imageKey}
        className="hover:ring-2 hover:ring-primary transition-all cursor-pointer group"
      >
        <CardContent className="flex items-center gap-4 p-4">
          <Link href={item.detailUrl} className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-16 w-12 rounded bg-muted flex-shrink-0 overflow-hidden relative">
              {showImage ? (
                <img
                  src={item.imageUrl!}
                  alt={item.name}
                  className={`w-full h-full object-cover transition-all duration-300 ${
                    isNotRequested
                      ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'
                      : ''
                  }`}
                  loading="lazy"
                  onError={() => handleImageError(imageKey)}
                />
              ) : (
                <div
                  className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
                    isNotRequested ? 'opacity-40 group-hover:opacity-60' : ''
                  }`}
                >
                  <HugeiconsIcon icon={config.icon} className="h-6 w-6 text-muted-foreground/50" />
                </div>
              )}
            </div>
            <div
              className={`flex-1 min-w-0 transition-opacity duration-300 ${isNotRequested ? 'opacity-60 group-hover:opacity-100' : ''}`}
            >
              <h3 className="font-medium truncate">{item.name}</h3>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {status !== 'none' && (
              <MediaStatusBadge
                status={status}
                progress={progress}
                size="sm"
                isToggling={isToggling}
                onToggleRequest={() =>
                  handleToggleRequest(
                    item.mediaType,
                    item.id,
                    item.requested ?? false,
                    item.hasFile,
                    item.name
                  )
                }
                showRequestButton={false}
              />
            )}
            {item.badges?.map((badge, i) => (
              <Badge key={i} variant="outline">
                {badge}
              </Badge>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={item.detailUrl}>
                    <HugeiconsIcon icon={EyeIcon} className="h-4 w-4 mr-2" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                {!item.externalId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => handleEnrich(item.mediaType, item.id, item.name, e)}
                      disabled={enrichingItems.has(`${item.mediaType}-${item.id}`)}
                    >
                      <HugeiconsIcon
                        icon={Search01Icon}
                        className={`h-4 w-4 mr-2 ${enrichingItems.has(`${item.mediaType}-${item.id}`) ? 'animate-spin' : ''}`}
                      />
                      {enrichingItems.has(`${item.mediaType}-${item.id}`)
                        ? 'Enriching...'
                        : item.mediaType === 'music'
                          ? 'Enrich from MusicBrainz'
                          : 'Enrich from TMDB'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderMusicContent = () => {
    const items = getFilteredArtists()
    if (items.length === 0) return renderEmptyState()

    const gridItems = items.map((artist) => ({
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageUrl,
      subtitle: `${artist.albumCount} ${Number(artist.albumCount) === 1 ? 'album' : 'albums'}`,
      detailUrl: `/artist/${artist.id}`,
      requested: artist.requested,
      mediaType: 'music' as MediaType,
      externalId: artist.musicbrainzId,
    }))

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {gridItems.map((item) => renderGridItem(item))}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {items.map((artist) =>
          renderListItem({
            id: artist.id,
            name: artist.name,
            imageUrl: artist.imageUrl,
            subtitle: `${artist.albumCount} ${Number(artist.albumCount) === 1 ? 'album' : 'albums'}${artist.artistType ? ` • ${artist.artistType}` : ''}`,
            detailUrl: `/artist/${artist.id}`,
            requested: artist.requested,
            mediaType: 'music',
            badges: artist.qualityProfile ? [artist.qualityProfile.name] : [],
            externalId: artist.musicbrainzId,
          })
        )}
      </div>
    )
  }

  const renderMoviesContent = () => {
    const items = getFilteredMovies()
    if (items.length === 0) return renderEmptyState()

    const gridItems = items.map((movie) => ({
      id: movie.id,
      name: movie.title,
      imageUrl: movie.posterUrl,
      subtitle: movie.year
        ? `${movie.year}${movie.runtime ? ` • ${movie.runtime} min` : ''}`
        : undefined,
      detailUrl: `/movie/${movie.id}`,
      requested: movie.requested,
      hasFile: movie.hasFile,
      mediaType: 'movies' as MediaType,
      externalId: movie.tmdbId,
    }))

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {gridItems.map((item) => renderGridItem(item))}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {items.map((movie) =>
          renderListItem({
            id: movie.id,
            name: movie.title,
            imageUrl: movie.posterUrl,
            subtitle: movie.year
              ? `${movie.year}${movie.runtime ? ` • ${movie.runtime} min` : ''}`
              : undefined,
            detailUrl: `/movie/${movie.id}`,
            requested: movie.requested,
            hasFile: movie.hasFile,
            mediaType: 'movies',
            badges: movie.status ? [movie.status] : [],
            externalId: movie.tmdbId,
          })
        )}
      </div>
    )
  }

  const renderTvContent = () => {
    const items = getFilteredTvShows()
    if (items.length === 0) return renderEmptyState()

    // TV shows don't show requested status at show level (it's managed at episode level)
    const gridItems = items.map((show) => ({
      id: show.id,
      name: show.title,
      imageUrl: show.posterUrl,
      subtitle: `${show.seasonCount} season${show.seasonCount !== 1 ? 's' : ''} • ${show.episodeCount} episodes`,
      detailUrl: `/tvshow/${show.id}`,
      mediaType: 'tv' as MediaType,
      externalId: show.tmdbId,
    }))

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {gridItems.map((item) => renderGridItem(item))}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {items.map((show) =>
          renderListItem({
            id: show.id,
            name: show.title,
            imageUrl: show.posterUrl,
            subtitle: `${show.seasonCount} season${show.seasonCount !== 1 ? 's' : ''} • ${show.episodeCount} episodes`,
            detailUrl: `/tvshow/${show.id}`,
            mediaType: 'tv',
            badges: [show.network, show.status].filter(Boolean) as string[],
            externalId: show.tmdbId,
          })
        )}
      </div>
    )
  }

  const renderBooksContent = () => {
    const items = getFilteredAuthors()
    if (items.length === 0) return renderEmptyState()

    const gridItems = items.map((author) => ({
      id: author.id,
      name: author.name,
      imageUrl: author.imageUrl,
      subtitle: `${author.bookCount} ${Number(author.bookCount) === 1 ? 'book' : 'books'}`,
      detailUrl: `/author/${author.id}`,
      requested: author.requested,
      mediaType: 'books' as MediaType,
    }))

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {gridItems.map((item) => renderGridItem(item))}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {items.map((author) =>
          renderListItem({
            id: author.id,
            name: author.name,
            imageUrl: author.imageUrl,
            subtitle: `${author.bookCount} ${Number(author.bookCount) === 1 ? 'book' : 'books'}`,
            detailUrl: `/author/${author.id}`,
            requested: author.requested,
            mediaType: 'books',
          })
        )}
      </div>
    )
  }

  const renderMissingContent = () => {
    if (missingItems.length === 0) {
      return (
        <div className="text-center py-12">
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            className="h-12 w-12 mx-auto text-green-500 mb-4"
          />
          <h3 className="text-lg font-medium mb-2">All caught up!</h3>
          <p className="text-muted-foreground">No missing items to download</p>
        </div>
      )
    }

    const getTypeIcon = (type: MissingItem['type']) => {
      switch (type) {
        case 'album':
          return MusicNote01Icon
        case 'movie':
          return Film01Icon
        case 'episode':
          return Tv01Icon
        case 'book':
          return Book01Icon
      }
    }

    const getTypeLabel = (type: MissingItem['type']) => {
      switch (type) {
        case 'album':
          return 'Album'
        case 'movie':
          return 'Movie'
        case 'episode':
          return 'Episode'
        case 'book':
          return 'Book'
      }
    }

    const handleSearch = async (item: MissingItem) => {
      const [type, id] = item.id.split('-')
      let endpoint = ''
      switch (type) {
        case 'album':
          endpoint = `/api/v1/albums/${id}/search`
          break
        case 'movie':
          endpoint = `/api/v1/movies/${id}/search`
          break
        case 'episode':
          endpoint = `/api/v1/tvshows/0/episodes/${id}/search`
          break
        case 'book':
          endpoint = `/api/v1/books/${id}/search`
          break
      }

      try {
        const res = await fetch(endpoint, { method: 'POST' })
        if (res.ok) {
          const data = await res.json()
          if (data.grabbed) {
            toast.success(`Download started for ${item.title}`)
          } else {
            toast.info('No results found')
          }
        } else {
          toast.error('Search failed')
        }
      } catch (error) {
        toast.error('Search failed')
      }
    }

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          {missingCounts.albums > 0 && <span className="mr-4">{missingCounts.albums} albums</span>}
          {missingCounts.movies > 0 && <span className="mr-4">{missingCounts.movies} movies</span>}
          {missingCounts.episodes > 0 && (
            <span className="mr-4">{missingCounts.episodes} episodes</span>
          )}
          {missingCounts.books > 0 && <span className="mr-4">{missingCounts.books} books</span>}
        </div>
        <div className="space-y-2">
          {missingItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="h-12 w-12 rounded overflow-hidden bg-muted flex-shrink-0">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <HugeiconsIcon
                      icon={getTypeIcon(item.type)}
                      className="h-6 w-6 text-muted-foreground"
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.title}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getTypeLabel(item.type)}
                  </Badge>
                  {item.subtitle && <span className="truncate">{item.subtitle}</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleSearch(item)}>
                <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 mr-1" />
                Search
              </Button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'music':
        return renderMusicContent()
      case 'movies':
        return renderMoviesContent()
      case 'tv':
        return renderTvContent()
      case 'books':
        return renderBooksContent()
      case 'missing':
        return renderMissingContent()
    }
  }

  const renderSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-[2/3]" />
          <CardContent className="p-3">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const getSortOptions = () => {
    const base = [
      { value: 'name', label: 'Name' },
      { value: 'recent', label: 'Recently Added' },
    ]

    switch (activeTab) {
      case 'music':
        return [...base, { value: 'count', label: 'Album Count' }]
      case 'movies':
        return [...base, { value: 'year', label: 'Year' }]
      case 'tv':
        return [
          ...base,
          { value: 'year', label: 'Year' },
          { value: 'count', label: 'Episode Count' },
        ]
      case 'books':
        return [...base, { value: 'count', label: 'Book Count' }]
      case 'missing':
        return base
      default:
        return base
    }
  }

  const config = MEDIA_TYPE_CONFIG[activeTab]
  const currentItems = getCurrentItems()
  const totalCount = getTotalCount()

  return (
    <AppLayout
      title="Library"
      actions={
        <Button asChild>
          <Link href={config.addUrl}>
            <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
            Add
          </Link>
        </Button>
      }
    >
      <Head title="Library" />

      <div className="space-y-6">
        {/* Media type tabs - only show enabled types */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MediaType)}>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <TabsList>
              {enabledMediaTypes.map((type) => {
                const typeConfig = MEDIA_TYPE_CONFIG[type]
                return (
                  <TabsTrigger key={type} value={type} className="gap-2">
                    <HugeiconsIcon icon={typeConfig.icon} className="h-4 w-4" />
                    {typeConfig.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <HugeiconsIcon icon={SortingIcon} className="h-4 w-4 mr-2" />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {getSortOptions().map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setSortBy(option.value as SortBy)}
                    >
                      {option.label} {sortBy === option.value && '✓'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <HugeiconsIcon icon={GridIcon} className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <HugeiconsIcon icon={Menu01Icon} className="h-4 w-4" />
                </Button>
              </div>

              {/* Scan Library button - hidden on missing tab */}
              {activeTab !== 'missing' && (
                <Button variant="outline" size="sm" onClick={handleScanLibrary} disabled={scanning}>
                  {scanning ? (
                    <Spinner className="h-4 w-4 mr-2" />
                  ) : (
                    <HugeiconsIcon icon={FolderSearchIcon} className="h-4 w-4 mr-2" />
                  )}
                  {scanning ? 'Scanning...' : 'Scan Library'}
                </Button>
              )}
            </div>
          </div>

          {/* Search filter */}
          <div className="relative w-full sm:w-80 mt-4">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              placeholder={`Filter ${config.label.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tab content */}
          {enabledMediaTypes.map((type) => (
            <TabsContent key={type} value={type} className="mt-6">
              {loading ? renderSkeleton() : renderContent()}
            </TabsContent>
          ))}
        </Tabs>

        {/* Stats bar */}
        {!loading && totalCount > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {currentItems.length} of {totalCount} {config.countLabel}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {itemToDelete?.name}</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this{' '}
              {itemToDelete ? MEDIA_TYPE_CONFIG[itemToDelete.type].itemLabel : 'item'} from your
              library? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="deleteFiles"
                checked={deleteFiles}
                onCheckedChange={(checked) => setDeleteFiles(checked as boolean)}
              />
              <Label htmlFor="deleteFiles" className="text-sm font-normal cursor-pointer">
                Also delete downloaded files from disk
              </Label>
            </div>
            {deleteFiles && (
              <p className="text-sm text-destructive mt-2">
                Warning: This will permanently delete all downloaded files.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File deletion confirmation dialog */}
      <Dialog
        open={fileConfirmDialogOpen}
        onOpenChange={(open) => {
          setFileConfirmDialogOpen(open)
          if (!open) setItemWithFile(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from library?</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{itemWithFile?.name}</span> has downloaded files. This
              will permanently delete the files from disk and remove the item from your library.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFileConfirmDialogOpen(false)
                setItemWithFile(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWithFile}
              disabled={deletingWithFile}
            >
              {deletingWithFile ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete Files & Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
