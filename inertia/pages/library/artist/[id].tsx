import { Head, Link, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  RefreshIcon,
  Delete01Icon,
  MusicNote01Icon,
  CdIcon,
  Calendar01Icon,
  Location01Icon,
  Loading01Icon,
  Edit01Icon,
  ViewIcon,
  ViewOffIcon,
  FileDownloadIcon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface Album {
  id: number
  title: string
  musicbrainzId: string | null
  releaseDate: string | null
  albumType: string
  imageUrl: string | null
  monitored: boolean
  trackCount: number
  fileCount: number
}

interface Artist {
  id: number
  name: string
  sortName: string
  musicbrainzId: string | null
  disambiguation: string | null
  overview: string | null
  status: string
  artistType: string | null
  country: string | null
  formedAt: string | null
  endedAt: string | null
  imageUrl: string | null
  monitored: boolean
  qualityProfile: { id: number; name: string } | null
  metadataProfile: { id: number; name: string } | null
  rootFolder: { id: number; path: string } | null
  albums: Album[]
}

export default function ArtistDetail() {
  const { url } = usePage()
  const artistId = url.split('/').pop()

  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchArtist()
  }, [artistId])

  const fetchArtist = async () => {
    try {
      const response = await fetch(`/api/v1/artists/${artistId}`)
      if (response.ok) {
        const data = await response.json()
        setArtist(data)
      } else if (response.status === 404) {
        toast.error('Artist not found')
        router.visit('/library')
      }
    } catch (error) {
      console.error('Failed to fetch artist:', error)
      toast.error('Failed to load artist')
    } finally {
      setLoading(false)
    }
  }

  const refreshArtist = async () => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/v1/artists/${artistId}/refresh`, {
        method: 'POST',
      })
      if (response.ok) {
        toast.success('Artist metadata refreshed')
        fetchArtist()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to refresh')
      }
    } catch (error) {
      console.error('Failed to refresh artist:', error)
      toast.error('Failed to refresh artist')
    } finally {
      setRefreshing(false)
    }
  }

  const toggleMonitored = async () => {
    if (!artist) return

    try {
      const response = await fetch(`/api/v1/artists/${artistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored: !artist.monitored }),
      })
      if (response.ok) {
        setArtist({ ...artist, monitored: !artist.monitored })
        toast.success(
          artist.monitored ? 'Artist unmonitored' : 'Artist monitored'
        )
      }
    } catch (error) {
      console.error('Failed to update artist:', error)
      toast.error('Failed to update artist')
    }
  }

  const deleteArtist = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/artists/${artistId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Artist deleted')
        router.visit('/library')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Failed to delete artist:', error)
      toast.error('Failed to delete artist')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  // Calculate statistics
  const totalTracks = artist?.albums.reduce((sum, a) => sum + a.trackCount, 0) || 0
  const totalFiles = artist?.albums.reduce((sum, a) => sum + a.fileCount, 0) || 0
  const percentComplete = totalTracks > 0 ? Math.round((totalFiles / totalTracks) * 100) : 0

  if (loading) {
    return (
      <AppLayout title="Loading...">
        <Head title="Loading..." />
        <div className="space-y-6">
          <div className="flex gap-6">
            <Skeleton className="h-48 w-48 rounded-lg" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!artist) {
    return (
      <AppLayout title="Not Found">
        <Head title="Not Found" />
        <div className="text-center py-12">
          <p className="text-muted-foreground">Artist not found</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={artist.name}
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
              <DropdownMenuItem onClick={toggleMonitored}>
                <HugeiconsIcon
                  icon={artist.monitored ? ViewOffIcon : ViewIcon}
                  className="h-4 w-4 mr-2"
                />
                {artist.monitored ? 'Unmonitor' : 'Monitor'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={refreshArtist} disabled={refreshing}>
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
                />
                Refresh
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
      <Head title={artist.name} />

      <div className="space-y-6">
        {/* Artist header */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Artist image */}
          <div className="w-full md:w-48 aspect-square md:aspect-auto md:h-48 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {artist.imageUrl ? (
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon
                  icon={MusicNote01Icon}
                  className="h-16 w-16 text-muted-foreground/50"
                />
              </div>
            )}
          </div>

          {/* Artist info */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{artist.name}</h1>
                {!artist.monitored && (
                  <Badge variant="secondary">Unmonitored</Badge>
                )}
              </div>
              {artist.disambiguation && (
                <p className="text-muted-foreground">{artist.disambiguation}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {artist.artistType && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={MusicNote01Icon} className="h-4 w-4" />
                  {artist.artistType}
                </div>
              )}
              {artist.country && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={Location01Icon} className="h-4 w-4" />
                  {artist.country}
                </div>
              )}
              {artist.formedAt && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4" />
                  {artist.formedAt}
                  {artist.endedAt && ` - ${artist.endedAt}`}
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {totalFiles} of {totalTracks} tracks
                </span>
                <span className="font-medium">{percentComplete}%</span>
              </div>
              <Progress value={percentComplete} className="h-2" />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {artist.qualityProfile && (
                <Badge variant="outline">{artist.qualityProfile.name}</Badge>
              )}
              {artist.metadataProfile && (
                <Badge variant="outline">{artist.metadataProfile.name}</Badge>
              )}
              <Badge variant="outline">
                {artist.albums.length} albums
              </Badge>
            </div>
          </div>
        </div>

        {/* Albums */}
        <Tabs defaultValue="monitored" className="space-y-4">
          <TabsList>
            <TabsTrigger value="monitored">
              Monitored ({artist.albums.filter((a) => a.monitored).length})
            </TabsTrigger>
            <TabsTrigger value="wanted">
              Wanted ({artist.albums.filter((a) => a.monitored && a.fileCount < a.trackCount).length})
            </TabsTrigger>
            <TabsTrigger value="all">
              All ({artist.albums.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitored" className="space-y-4">
            {artist.albums.filter((a) => a.monitored).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <HugeiconsIcon
                      icon={CdIcon}
                      className="h-12 w-12 text-muted-foreground"
                    />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No monitored albums</h3>
                  <p className="text-muted-foreground">
                    Monitor albums to track them and search for releases.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {artist.albums
                  .filter((a) => a.monitored)
                  .map((album) => (
                    <AlbumCard key={album.id} album={album} />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="wanted" className="space-y-4">
            {artist.albums.filter((a) => a.monitored && a.fileCount < a.trackCount).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <h3 className="text-lg font-medium mb-2">
                    All monitored albums complete!
                  </h3>
                  <p className="text-muted-foreground">
                    You have all tracks for monitored albums.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {artist.albums
                  .filter((a) => a.monitored && a.fileCount < a.trackCount)
                  .map((album) => (
                    <AlbumCard key={album.id} album={album} />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {artist.albums.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <HugeiconsIcon
                      icon={CdIcon}
                      className="h-12 w-12 text-muted-foreground"
                    />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No albums yet</h3>
                  <p className="text-muted-foreground">
                    Albums will appear here once metadata is refreshed.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {artist.albums.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {artist.name}?</DialogTitle>
            <DialogDescription>
              This will remove the artist and all associated metadata from your
              library. Files on disk will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteArtist}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <HugeiconsIcon
                    icon={Loading01Icon}
                    className="h-4 w-4 animate-spin mr-2"
                  />
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

function AlbumCard({ album }: { album: Album }) {
  const [downloading, setDownloading] = useState(false)

  const percentComplete =
    album.trackCount > 0
      ? Math.round((album.fileCount / album.trackCount) * 100)
      : 0

  const isComplete = percentComplete === 100
  const isWanted = album.monitored && percentComplete < 100

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setDownloading(true)
    try {
      const response = await fetch(`/api/v1/albums/${album.id}/download`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`Download started: ${data.release?.title || data.title}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'No releases found')
      }
    } catch (error) {
      console.error('Failed to download:', error)
      toast.error('Failed to download album')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Link href={`/album/${album.id}`}>
      <Card
        className={`overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group ${
          album.monitored && isComplete ? 'ring-1 ring-green-500/50' : ''
        }`}
      >
        <div className="aspect-square bg-muted relative">
          {album.imageUrl ? (
            <img
              src={album.imageUrl}
              alt={album.title}
              className={`w-full h-full object-cover ${
                !album.monitored ? 'grayscale opacity-50' : ''
              }`}
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${
              !album.monitored ? 'opacity-50' : ''
            }`}>
              <HugeiconsIcon
                icon={CdIcon}
                className="h-16 w-16 text-muted-foreground/50"
              />
            </div>
          )}
          {/* Status badge - only show for monitored albums */}
          {album.monitored && (
            <div className="absolute top-2 right-2">
              {isWanted ? (
                <Badge variant="default" className="bg-orange-500/90">
                  Wanted
                </Badge>
              ) : isComplete ? (
                <Badge variant="default" className="bg-green-500/90">
                  Complete
                </Badge>
              ) : null}
            </div>
          )}
          {/* Download button - show on hover for incomplete albums */}
          {!isComplete && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <HugeiconsIcon icon={Loading01Icon} className="h-6 w-6 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={FileDownloadIcon} className="h-6 w-6" />
                )}
              </Button>
            </div>
          )}
          {/* Progress bar at bottom - only for monitored albums */}
          {album.monitored && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-foreground/20">
              <div
                className={`h-full transition-all ${
                  isComplete ? 'bg-green-500' : 'bg-primary'
                }`}
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          )}
        </div>
        <CardContent className={`p-3 ${!album.monitored ? 'opacity-50' : ''}`}>
          <h3 className="font-medium truncate group-hover:text-primary transition-colors">
            {album.title}
          </h3>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{album.releaseDate?.split('-')[0] || 'Unknown'}</span>
            <span className="capitalize">{album.albumType}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
