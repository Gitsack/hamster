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
  MoreVerticalIcon,
  Delete02Icon,
  EyeIcon,
  Loading01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  StatusBadge,
  StatusProgressOverlay,
  StatusIndicator,
  getItemStatus,
  type ItemStatus,
} from '@/components/library/status-badge'

interface Artist {
  id: number
  name: string
  sortName: string
  musicbrainzId: string | null
  status: string
  artistType: string | null
  imageUrl: string | null
  monitored: boolean
  albumCount: number
  qualityProfile: { id: number; name: string } | null
  metadataProfile: { id: number; name: string } | null
}

interface QueueItem {
  id: number
  artistId: number | null
  albumId: number | null
  progress: number
  status: string
}

type ViewMode = 'grid' | 'list'
type SortBy = 'name' | 'recent' | 'albums'
type MediaType = 'music' | 'movies' | 'tv'

// Media types configuration - in the future this can come from settings API
const MEDIA_TYPES: { id: MediaType; label: string; icon: typeof MusicNote01Icon; enabled: boolean }[] = [
  { id: 'music', label: 'Music', icon: MusicNote01Icon, enabled: true },
  { id: 'movies', label: 'Movies', icon: Film01Icon, enabled: false },
  { id: 'tv', label: 'TV', icon: Tv01Icon, enabled: false },
]

export default function Library() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [activeTab, setActiveTab] = useState<MediaType>('music')

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [artistToDelete, setArtistToDelete] = useState<Artist | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const enabledMediaTypes = MEDIA_TYPES.filter((mt) => mt.enabled)

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch data based on active tab
      if (activeTab === 'music') {
        const [artistsRes, queueRes] = await Promise.all([
          fetch('/api/v1/artists'),
          fetch('/api/v1/queue'),
        ])

        if (artistsRes.ok) {
          const data = await artistsRes.json()
          setArtists(data)
        }

        if (queueRes.ok) {
          const data = await queueRes.json()
          setQueue(data)
        }
      }
      // Movies and TV will be implemented later
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openDeleteDialog = (artist: Artist, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setArtistToDelete(artist)
    setDeleteFiles(false)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!artistToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/artists/${artistToDelete.id}?deleteFiles=${deleteFiles}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success(`${artistToDelete.name} removed from library`)
        setArtists((prev) => prev.filter((a) => a.id !== artistToDelete.id))
        setDeleteDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to remove artist')
      }
    } catch (error) {
      console.error('Failed to delete artist:', error)
      toast.error('Failed to remove artist')
    } finally {
      setDeleting(false)
    }
  }

  const getArtistStatus = (artist: Artist): { status: ItemStatus; progress: number } => {
    // Check if any download is active for this artist
    const artistDownload = queue.find((q) => q.artistId === artist.id)
    if (artistDownload) {
      return { status: 'downloading', progress: artistDownload.progress }
    }

    // For now, we'll consider artists with albumCount > 0 and monitored as "potentially downloaded"
    // In a real implementation, we'd check if albums have track files
    // This is a simplified version - a full implementation would need album file counts
    if (artist.monitored) {
      return { status: 'requested', progress: 0 }
    }

    return { status: 'none', progress: 0 }
  }

  const filteredArtists = artists
    .filter((artist) =>
      artist.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return b.id - a.id
        case 'albums':
          return Number(b.albumCount) - Number(a.albumCount)
        default:
          return (a.sortName || a.name).localeCompare(b.sortName || b.name)
      }
    })

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <HugeiconsIcon
          icon={activeTab === 'music' ? MusicNote01Icon : activeTab === 'movies' ? Film01Icon : Tv01Icon}
          className="h-12 w-12 text-muted-foreground"
        />
      </div>
      <h3 className="text-lg font-medium mb-2">
        {searchQuery ? 'No items found' : `Your ${activeTab} library is empty`}
      </h3>
      <p className="text-muted-foreground mb-4">
        {searchQuery
          ? 'Try a different search term'
          : activeTab === 'music'
            ? 'Get started by adding your first artist'
            : `${activeTab === 'movies' ? 'Movies' : 'TV'} support coming soon`}
      </p>
      {!searchQuery && activeTab === 'music' && (
        <Button asChild>
          <Link href="/search?mode=music&type=artist">
            <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
            Add Artist
          </Link>
        </Button>
      )}
    </div>
  )

  const renderMusicGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {filteredArtists.map((artist) => {
        const { status, progress } = getArtistStatus(artist)
        return (
          <Card key={artist.id} className="overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group relative">
            <Link href={`/artist/${artist.id}`}>
              <div className="aspect-square bg-muted relative">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <HugeiconsIcon
                      icon={MusicNote01Icon}
                      className="h-16 w-16 text-muted-foreground/50"
                    />
                  </div>
                )}
                {/* Status indicator */}
                <StatusIndicator status={status} progress={progress} position="top-right" />
                {/* Progress overlay for downloading items */}
                <StatusProgressOverlay status={status} progress={progress} />
                {!artist.monitored && status === 'none' && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary">Unmonitored</Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                  {artist.name}
                </h3>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {artist.albumCount} {Number(artist.albumCount) === 1 ? 'album' : 'albums'}
                  </p>
                </div>
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
                    <Link href={`/artist/${artist.id}`}>
                      <HugeiconsIcon icon={EyeIcon} className="h-4 w-4 mr-2" />
                      View Details
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => openDeleteDialog(artist, e)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 mr-2" />
                    Remove from Library
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        )
      })}
    </div>
  )

  const renderMusicList = () => (
    <div className="space-y-2">
      {filteredArtists.map((artist) => {
        const { status, progress } = getArtistStatus(artist)
        return (
          <Card key={artist.id} className="hover:ring-2 hover:ring-primary transition-all cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <Link href={`/artist/${artist.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-16 w-16 rounded bg-muted flex-shrink-0 overflow-hidden relative">
                  {artist.imageUrl ? (
                    <img
                      src={artist.imageUrl}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HugeiconsIcon
                        icon={MusicNote01Icon}
                        className="h-8 w-8 text-muted-foreground/50"
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{artist.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {artist.albumCount} {Number(artist.albumCount) === 1 ? 'album' : 'albums'}
                    {artist.artistType && ` • ${artist.artistType}`}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <StatusBadge status={status} progress={progress} />
                {!artist.monitored && status === 'none' && (
                  <Badge variant="secondary">Unmonitored</Badge>
                )}
                {artist.qualityProfile && (
                  <Badge variant="outline">{artist.qualityProfile.name}</Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/artist/${artist.id}`}>
                        <HugeiconsIcon icon={EyeIcon} className="h-4 w-4 mr-2" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => openDeleteDialog(artist, e)}
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
      })}
    </div>
  )

  const renderComingSoon = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <HugeiconsIcon
          icon={activeTab === 'movies' ? Film01Icon : Tv01Icon}
          className="h-12 w-12 text-muted-foreground"
        />
      </div>
      <h3 className="text-lg font-medium mb-2">
        {activeTab === 'movies' ? 'Movies' : 'TV Shows'} Coming Soon
      </h3>
      <p className="text-muted-foreground">
        This feature is currently in development.
      </p>
    </div>
  )

  return (
    <AppLayout
      title="Library"
      actions={
        <Button asChild>
          <Link href="/search?mode=music&type=artist">
            <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
            Add
          </Link>
        </Button>
      }
    >
      <Head title="Library" />

      <div className="space-y-6">
        {/* Media type tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MediaType)}>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <TabsList>
              {MEDIA_TYPES.map((mediaType) => (
                <TabsTrigger
                  key={mediaType.id}
                  value={mediaType.id}
                  disabled={!mediaType.enabled}
                  className="gap-2"
                >
                  <HugeiconsIcon icon={mediaType.icon} className="h-4 w-4" />
                  {mediaType.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Toolbar - only show for music tab */}
            {activeTab === 'music' && (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <HugeiconsIcon icon={SortingIcon} className="h-4 w-4 mr-2" />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortBy('name')}>
                      Name {sortBy === 'name' && '(active)'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('recent')}>
                      Recently Added {sortBy === 'recent' && '(active)'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('albums')}>
                      Album Count {sortBy === 'albums' && '(active)'}
                    </DropdownMenuItem>
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
            )}
          </div>

          {/* Search filter - only for music */}
          {activeTab === 'music' && (
            <div className="relative w-full sm:w-80 mt-4">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <Input
                placeholder="Filter artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* Tab content */}
          <TabsContent value="music" className="mt-6">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="aspect-square" />
                    <CardContent className="p-3">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredArtists.length === 0 ? (
              renderEmptyState()
            ) : viewMode === 'grid' ? (
              renderMusicGrid()
            ) : (
              renderMusicList()
            )}
          </TabsContent>

          <TabsContent value="movies" className="mt-6">
            {renderComingSoon()}
          </TabsContent>

          <TabsContent value="tv" className="mt-6">
            {renderComingSoon()}
          </TabsContent>
        </Tabs>

        {/* Stats bar */}
        {!loading && activeTab === 'music' && artists.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {filteredArtists.length} of {artists.length} artists
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {artistToDelete?.name}</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this artist from your library? This action cannot be
              undone.
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
                Warning: This will permanently delete all downloaded files for this artist.
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
