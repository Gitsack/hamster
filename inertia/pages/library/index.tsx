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
  Loading01Icon,
  CheckmarkCircle02Icon,
  Download01Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface Artist {
  id: number
  name: string
  sortName: string
  musicbrainzId: string | null
  status: string
  artistType: string | null
  imageUrl: string | null
  wanted: boolean
  albumCount: number
  qualityProfile: { id: number; name: string } | null
  metadataProfile: { id: number; name: string } | null
}

interface Movie {
  id: number
  title: string
  year: number | null
  overview: string | null
  posterUrl: string | null
  status: string | null
  wanted: boolean
  hasFile: boolean
  runtime: number | null
  rating: number | null
}

interface TvShow {
  id: number
  title: string
  year: number | null
  overview: string | null
  posterUrl: string | null
  status: string | null
  network: string | null
  wanted: boolean
  seasonCount: number
  episodeCount: number
}

interface Author {
  id: number
  name: string
  overview: string | null
  imageUrl: string | null
  wanted: boolean
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
type MediaType = 'music' | 'movies' | 'tv' | 'books'

const MEDIA_TYPE_CONFIG: Record<MediaType, {
  label: string
  icon: typeof MusicNote01Icon
  addUrl: string
  itemLabel: string
  countLabel: string
}> = {
  music: {
    label: 'Music',
    icon: MusicNote01Icon,
    addUrl: '/search?mode=music&type=artist',
    itemLabel: 'artist',
    countLabel: 'albums'
  },
  movies: {
    label: 'Movies',
    icon: Film01Icon,
    addUrl: '/search?mode=movies',
    itemLabel: 'movie',
    countLabel: 'movies'
  },
  tv: {
    label: 'TV Shows',
    icon: Tv01Icon,
    addUrl: '/search?mode=tv',
    itemLabel: 'show',
    countLabel: 'shows'
  },
  books: {
    label: 'Books',
    icon: Book01Icon,
    addUrl: '/search?mode=books',
    itemLabel: 'author',
    countLabel: 'books'
  },
}

export default function Library() {
  const [enabledMediaTypes, setEnabledMediaTypes] = useState<MediaType[]>(['music'])
  const [artists, setArtists] = useState<Artist[]>([])
  const [movies, setMovies] = useState<Movie[]>([])
  const [tvShows, setTvShows] = useState<TvShow[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [activeTab, setActiveTab] = useState<MediaType>('music')

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: MediaType; id: number; name: string } | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch enabled media types from settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/v1/settings')
        if (response.ok) {
          const data = await response.json()
          if (data.enabledMediaTypes?.length > 0) {
            setEnabledMediaTypes(data.enabledMediaTypes)
            setActiveTab(data.enabledMediaTypes[0])
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

      const response = await fetch(`/api/v1/${endpoints[itemToDelete.type]}/${itemToDelete.id}?deleteFiles=${deleteFiles}`, {
        method: 'DELETE',
      })

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

  // Status badge component for items
  const StatusBadge = ({ requested, hasFile, downloading }: { requested: boolean; hasFile?: boolean; downloading?: boolean }) => {
    if (downloading) {
      return (
        <Badge variant="secondary" className="gap-1">
          <HugeiconsIcon icon={Download01Icon} className="h-3 w-3 animate-pulse" />
          Downloading
        </Badge>
      )
    }
    if (hasFile) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3 w-3" />
          Downloaded
        </Badge>
      )
    }
    if (requested) {
      return (
        <Badge variant="secondary" className="gap-1">
          <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
          Requested
        </Badge>
      )
    }
    return null
  }

  // Filter and sort functions for each media type
  const getFilteredArtists = () => {
    return artists
      .filter((artist) => artist.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        switch (sortBy) {
          case 'recent': return b.id - a.id
          case 'count': return Number(b.albumCount) - Number(a.albumCount)
          default: return (a.sortName || a.name).localeCompare(b.sortName || b.name)
        }
      })
  }

  const getFilteredMovies = () => {
    return movies
      .filter((movie) => movie.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        switch (sortBy) {
          case 'recent': return b.id - a.id
          case 'year': return (b.year || 0) - (a.year || 0)
          default: return a.title.localeCompare(b.title)
        }
      })
  }

  const getFilteredTvShows = () => {
    return tvShows
      .filter((show) => show.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        switch (sortBy) {
          case 'recent': return b.id - a.id
          case 'year': return (b.year || 0) - (a.year || 0)
          case 'count': return b.episodeCount - a.episodeCount
          default: return a.title.localeCompare(b.title)
        }
      })
  }

  const getFilteredAuthors = () => {
    return authors
      .filter((author) => author.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        switch (sortBy) {
          case 'recent': return b.id - a.id
          case 'count': return Number(b.bookCount) - Number(a.bookCount)
          default: return a.name.localeCompare(b.name)
        }
      })
  }

  const getCurrentItems = () => {
    switch (activeTab) {
      case 'music': return getFilteredArtists()
      case 'movies': return getFilteredMovies()
      case 'tv': return getFilteredTvShows()
      case 'books': return getFilteredAuthors()
    }
  }

  const getTotalCount = () => {
    switch (activeTab) {
      case 'music': return artists.length
      case 'movies': return movies.length
      case 'tv': return tvShows.length
      case 'books': return authors.length
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
    setFailedImages(prev => new Set(prev).add(key))
  }, [])

  // Render grid item for any media type
  const renderGridItem = (item: {
    id: number
    name: string
    imageUrl: string | null
    subtitle?: string
    detailUrl: string
    wanted?: boolean
    hasFile?: boolean
    mediaType: MediaType
  }) => {
    const config = MEDIA_TYPE_CONFIG[item.mediaType]
    const imageKey = `${item.mediaType}-${item.id}`
    const showImage = item.imageUrl && !failedImages.has(imageKey)
    const isDownloading = queue.some(q => {
      switch (item.mediaType) {
        case 'music': return q.artistId === item.id
        case 'movies': return q.movieId === item.id
        case 'tv': return q.tvShowId === item.id
        case 'books': return q.bookId === item.id
      }
    })
    const isNotRequested = !item.wanted && !item.hasFile && !isDownloading

    return (
      <Card key={imageKey} className="overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group relative">
        <Link href={item.detailUrl}>
          <div className="aspect-[2/3] bg-muted relative">
            {showImage ? (
              <img
                src={item.imageUrl!}
                alt={item.name}
                className={`w-full h-full object-cover transition-all duration-300 ${
                  isNotRequested ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100' : ''
                }`}
                loading="lazy"
                onError={() => handleImageError(imageKey)}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
                isNotRequested ? 'opacity-40 group-hover:opacity-60' : ''
              }`}>
                <HugeiconsIcon icon={config.icon} className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
            {/* Status indicator */}
            {(item.wanted || item.hasFile || isDownloading) && (
              <div className="absolute top-2 left-2">
                <StatusBadge requested={item.wanted || false} hasFile={item.hasFile} downloading={isDownloading} />
              </div>
            )}
          </div>
          <CardContent className={`p-3 transition-opacity duration-300 ${isNotRequested ? 'opacity-60 group-hover:opacity-100' : ''}`}>
            <h3 className="font-medium truncate group-hover:text-primary transition-colors">
              {item.name}
            </h3>
            {item.subtitle && (
              <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
            )}
          </CardContent>
        </Link>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => openDeleteDialog(item.mediaType, item.id, item.name, e)}
              >
                <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 mr-2" />
                Remove from Library
              </DropdownMenuItem>
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
    wanted?: boolean
    hasFile?: boolean
    mediaType: MediaType
    badges?: string[]
  }) => {
    const config = MEDIA_TYPE_CONFIG[item.mediaType]
    const imageKey = `${item.mediaType}-${item.id}`
    const showImage = item.imageUrl && !failedImages.has(imageKey)
    const isDownloading = queue.some(q => {
      switch (item.mediaType) {
        case 'music': return q.artistId === item.id
        case 'movies': return q.movieId === item.id
        case 'tv': return q.tvShowId === item.id
        case 'books': return q.bookId === item.id
      }
    })
    const isNotRequested = !item.wanted && !item.hasFile && !isDownloading

    return (
      <Card key={imageKey} className="hover:ring-2 hover:ring-primary transition-all cursor-pointer group">
        <CardContent className="flex items-center gap-4 p-4">
          <Link href={item.detailUrl} className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-16 w-12 rounded bg-muted flex-shrink-0 overflow-hidden relative">
              {showImage ? (
                <img
                  src={item.imageUrl!}
                  alt={item.name}
                  className={`w-full h-full object-cover transition-all duration-300 ${
                    isNotRequested ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100' : ''
                  }`}
                  loading="lazy"
                  onError={() => handleImageError(imageKey)}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
                  isNotRequested ? 'opacity-40 group-hover:opacity-60' : ''
                }`}>
                  <HugeiconsIcon icon={config.icon} className="h-6 w-6 text-muted-foreground/50" />
                </div>
              )}
            </div>
            <div className={`flex-1 min-w-0 transition-opacity duration-300 ${isNotRequested ? 'opacity-60 group-hover:opacity-100' : ''}`}>
              <h3 className="font-medium truncate">{item.name}</h3>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <StatusBadge requested={item.wanted || false} hasFile={item.hasFile} downloading={isDownloading} />
            {item.badges?.map((badge, i) => (
              <Badge key={i} variant="outline">{badge}</Badge>
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => openDeleteDialog(item.mediaType, item.id, item.name, e)}
                >
                  <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 mr-2" />
                  Remove from Library
                </DropdownMenuItem>
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

    const gridItems = items.map(artist => ({
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageUrl,
      subtitle: `${artist.albumCount} ${Number(artist.albumCount) === 1 ? 'album' : 'albums'}`,
      detailUrl: `/artist/${artist.id}`,
      wanted: artist.wanted,
      mediaType: 'music' as MediaType,
    }))

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {gridItems.map(item => renderGridItem(item))}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {items.map(artist => renderListItem({
          id: artist.id,
          name: artist.name,
          imageUrl: artist.imageUrl,
          subtitle: `${artist.albumCount} ${Number(artist.albumCount) === 1 ? 'album' : 'albums'}${artist.artistType ? ` • ${artist.artistType}` : ''}`,
          detailUrl: `/artist/${artist.id}`,
          wanted: artist.wanted,
          mediaType: 'music',
          badges: artist.qualityProfile ? [artist.qualityProfile.name] : [],
        }))}
      </div>
    )
  }

  const renderMoviesContent = () => {
    const items = getFilteredMovies()
    if (items.length === 0) return renderEmptyState()

    const gridItems = items.map(movie => ({
      id: movie.id,
      name: movie.title,
      imageUrl: movie.posterUrl,
      subtitle: movie.year ? `${movie.year}${movie.runtime ? ` • ${movie.runtime} min` : ''}` : undefined,
      detailUrl: `/movie/${movie.id}`,
      wanted: movie.wanted,
      hasFile: movie.hasFile,
      mediaType: 'movies' as MediaType,
    }))

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {gridItems.map(item => renderGridItem(item))}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {items.map(movie => renderListItem({
          id: movie.id,
          name: movie.title,
          imageUrl: movie.posterUrl,
          subtitle: movie.year ? `${movie.year}${movie.runtime ? ` • ${movie.runtime} min` : ''}` : undefined,
          detailUrl: `/movie/${movie.id}`,
          wanted: movie.wanted,
          hasFile: movie.hasFile,
          mediaType: 'movies',
          badges: movie.status ? [movie.status] : [],
        }))}
      </div>
    )
  }

  const renderTvContent = () => {
    const items = getFilteredTvShows()
    if (items.length === 0) return renderEmptyState()

    const gridItems = items.map(show => ({
      id: show.id,
      name: show.title,
      imageUrl: show.posterUrl,
      subtitle: `${show.seasonCount} season${show.seasonCount !== 1 ? 's' : ''} • ${show.episodeCount} episodes`,
      detailUrl: `/tvshow/${show.id}`,
      wanted: show.wanted,
      mediaType: 'tv' as MediaType,
    }))

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {gridItems.map(item => renderGridItem(item))}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {items.map(show => renderListItem({
          id: show.id,
          name: show.title,
          imageUrl: show.posterUrl,
          subtitle: `${show.seasonCount} season${show.seasonCount !== 1 ? 's' : ''} • ${show.episodeCount} episodes`,
          detailUrl: `/tvshow/${show.id}`,
          wanted: show.wanted,
          mediaType: 'tv',
          badges: [show.network, show.status].filter(Boolean) as string[],
        }))}
      </div>
    )
  }

  const renderBooksContent = () => {
    const items = getFilteredAuthors()
    if (items.length === 0) return renderEmptyState()

    const gridItems = items.map(author => ({
      id: author.id,
      name: author.name,
      imageUrl: author.imageUrl,
      subtitle: `${author.bookCount} ${Number(author.bookCount) === 1 ? 'book' : 'books'}`,
      detailUrl: `/author/${author.id}`,
      wanted: author.wanted,
      mediaType: 'books' as MediaType,
    }))

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {gridItems.map(item => renderGridItem(item))}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {items.map(author => renderListItem({
          id: author.id,
          name: author.name,
          imageUrl: author.imageUrl,
          subtitle: `${author.bookCount} ${Number(author.bookCount) === 1 ? 'book' : 'books'}`,
          detailUrl: `/author/${author.id}`,
          wanted: author.wanted,
          mediaType: 'books',
        }))}
      </div>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'music': return renderMusicContent()
      case 'movies': return renderMoviesContent()
      case 'tv': return renderTvContent()
      case 'books': return renderBooksContent()
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
        return [...base, { value: 'year', label: 'Year' }, { value: 'count', label: 'Episode Count' }]
      case 'books':
        return [...base, { value: 'count', label: 'Book Count' }]
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
                    <DropdownMenuItem key={option.value} onClick={() => setSortBy(option.value as SortBy)}>
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
              Are you sure you want to remove this {itemToDelete ? MEDIA_TYPE_CONFIG[itemToDelete.type].itemLabel : 'item'} from your library? This action cannot be undone.
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
                  <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
