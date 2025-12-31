import { Head, Link, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Edit01Icon,
  ViewIcon,
  ViewOffIcon,
  Search01Icon,
  Add01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'

// Track from MusicBrainz
interface MusicBrainzTrack {
  musicbrainzId: string
  title: string
  position: number
  duration?: number
  artistName?: string
}

// Album from library (database)
interface LibraryAlbum {
  id: number
  title: string
  musicbrainzId: string | null
  releaseDate: string | null
  albumType: string
  imageUrl: string | null
  requested: boolean
  trackCount: number
  fileCount: number
}

// Album from MusicBrainz discography
interface DiscographyAlbum {
  musicbrainzId: string
  title: string
  artistName: string
  artistMusicbrainzId: string
  releaseDate: string | null
  type: string
  inLibrary: boolean
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
  requested: boolean
  qualityProfile: { id: number; name: string } | null
  metadataProfile: { id: number; name: string } | null
  rootFolder: { id: number; path: string } | null
  albums: LibraryAlbum[]
}

export default function ArtistDetail() {
  const { url } = usePage()
  const artistId = url.split('/').pop()

  const [artist, setArtist] = useState<Artist | null>(null)
  const [discography, setDiscography] = useState<DiscographyAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDiscography, setLoadingDiscography] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingAlbums, setAddingAlbums] = useState<Set<string>>(new Set())

  // Album detail dialog state
  const [selectedAlbum, setSelectedAlbum] = useState<{
    musicbrainzId: string
    title: string
    releaseDate: string | null
    type: string
    inLibrary: boolean
    libraryId?: number
  } | null>(null)
  const [albumTracks, setAlbumTracks] = useState<MusicBrainzTrack[]>([])
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [albumDialogOpen, setAlbumDialogOpen] = useState(false)

  useEffect(() => {
    fetchArtist()
  }, [artistId])

  // Fetch discography when artist loads and has MusicBrainz ID
  useEffect(() => {
    if (artist?.musicbrainzId) {
      fetchDiscography(artist.musicbrainzId)
    }
  }, [artist?.musicbrainzId])

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

  const fetchDiscography = async (mbid: string) => {
    setLoadingDiscography(true)
    try {
      const response = await fetch(`/api/v1/artists/${mbid}/albums`)
      if (response.ok) {
        const data = await response.json()
        setDiscography(data)
      }
    } catch (error) {
      console.error('Failed to fetch discography:', error)
    } finally {
      setLoadingDiscography(false)
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
        // Re-fetch discography as well
        if (artist?.musicbrainzId) {
          fetchDiscography(artist.musicbrainzId)
        }
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

  const toggleRequested = async () => {
    if (!artist) return

    try {
      const response = await fetch(`/api/v1/artists/${artistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !artist.requested }),
      })
      if (response.ok) {
        setArtist({ ...artist, requested: !artist.requested })
        toast.success(
          artist.requested ? 'Artist unrequested' : 'Artist requested'
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

  // Add album from discography to library
  const addAlbum = async (album: DiscographyAlbum) => {
    if (!artist) return

    setAddingAlbums((prev) => new Set(prev).add(album.musicbrainzId))

    try {
      const response = await fetch('/api/v1/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicbrainzId: album.musicbrainzId,
          artistMusicbrainzId: artist.musicbrainzId,
          rootFolderId: String(artist.rootFolder?.id),
          qualityProfileId: String(artist.qualityProfile?.id),
          metadataProfileId: String(artist.metadataProfile?.id),
          requested: true,
          searchForAlbum: true,
        }),
      })

      if (response.ok) {
        toast.success(`Added "${album.title}" to library`)
        // Refresh both artist and discography
        fetchArtist()
        if (artist.musicbrainzId) {
          fetchDiscography(artist.musicbrainzId)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add album')
      }
    } catch (error) {
      console.error('Failed to add album:', error)
      toast.error('Failed to add album')
    } finally {
      setAddingAlbums((prev) => {
        const next = new Set(prev)
        next.delete(album.musicbrainzId)
        return next
      })
    }
  }

  // Open album dialog and fetch tracks
  const openAlbumDialog = async (album: {
    musicbrainzId: string
    title: string
    releaseDate: string | null
    type: string
    inLibrary: boolean
    libraryId?: number
  }) => {
    setSelectedAlbum(album)
    setAlbumDialogOpen(true)
    setLoadingTracks(true)
    setAlbumTracks([])

    try {
      const response = await fetch(`/api/v1/albums/${album.musicbrainzId}/tracks`)
      if (response.ok) {
        const tracks = await response.json()
        setAlbumTracks(tracks)
      }
    } catch (error) {
      console.error('Failed to fetch tracks:', error)
      toast.error('Failed to load tracks')
    } finally {
      setLoadingTracks(false)
    }
  }

  // Format duration (seconds to mm:ss)
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Merge library albums with discography for complete view
  const mergedAlbums = useMemo(() => {
    const libraryMap = new Map(
      artist?.albums.map((a) => [a.musicbrainzId, a]) || []
    )

    // Map discography albums, enriching with library data if available
    const merged = discography.map((d) => {
      const libraryAlbum = libraryMap.get(d.musicbrainzId)
      return {
        musicbrainzId: d.musicbrainzId,
        title: d.title,
        releaseDate: d.releaseDate,
        type: d.type,
        inLibrary: d.inLibrary || !!libraryAlbum,
        libraryId: libraryAlbum?.id,
        requested: libraryAlbum?.requested || false,
        trackCount: libraryAlbum?.trackCount || 0,
        fileCount: libraryAlbum?.fileCount || 0,
        imageUrl: libraryAlbum?.imageUrl,
      }
    })

    // Add any library albums not in discography (edge case)
    for (const album of artist?.albums || []) {
      if (!discography.find((d) => d.musicbrainzId === album.musicbrainzId)) {
        merged.push({
          musicbrainzId: album.musicbrainzId || '',
          title: album.title,
          releaseDate: album.releaseDate,
          type: album.albumType,
          inLibrary: true,
          libraryId: album.id,
          requested: album.requested,
          trackCount: album.trackCount,
          fileCount: album.fileCount,
          imageUrl: album.imageUrl,
        })
      }
    }

    // Sort by release date (newest first)
    return merged.sort((a, b) => {
      if (!a.releaseDate) return 1
      if (!b.releaseDate) return -1
      return b.releaseDate.localeCompare(a.releaseDate)
    })
  }, [artist?.albums, discography])

  // Filter albums by category
  const inLibraryAlbums = mergedAlbums.filter((a) => a.inLibrary)
  const downloadedAlbums = mergedAlbums.filter((a) => a.inLibrary && a.fileCount > 0)
  const requestedAlbums = mergedAlbums.filter((a) => a.inLibrary && a.requested && a.fileCount === 0)
  const notInLibraryAlbums = mergedAlbums.filter((a) => !a.inLibrary)

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
              <DropdownMenuItem onClick={toggleRequested}>
                <HugeiconsIcon
                  icon={artist.requested ? ViewOffIcon : ViewIcon}
                  className="h-4 w-4 mr-2"
                />
                {artist.requested ? 'Unrequest' : 'Request'}
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

        {/* Albums / Discography */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">
              Discography ({mergedAlbums.length})
              {loadingDiscography && <Spinner className="ml-2 h-3 w-3" />}
            </TabsTrigger>
            <TabsTrigger value="library">
              In Library ({inLibraryAlbums.length})
            </TabsTrigger>
            <TabsTrigger value="downloaded">
              Downloaded ({downloadedAlbums.length})
            </TabsTrigger>
            <TabsTrigger value="requested">
              Requested ({requestedAlbums.length})
            </TabsTrigger>
            {notInLibraryAlbums.length > 0 && (
              <TabsTrigger value="available">
                Available ({notInLibraryAlbums.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {mergedAlbums.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <HugeiconsIcon
                      icon={CdIcon}
                      className="h-12 w-12 text-muted-foreground"
                    />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No albums found</h3>
                  <p className="text-muted-foreground">
                    {loadingDiscography ? 'Loading discography...' : 'Try refreshing to fetch albums from MusicBrainz.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {mergedAlbums.map((album) => (
                  <MergedAlbumCard
                    key={album.musicbrainzId}
                    album={album}
                    isAdding={addingAlbums.has(album.musicbrainzId)}
                    onAdd={() => addAlbum({ ...album, artistName: artist.name, artistMusicbrainzId: artist.musicbrainzId! })}
                    onShowTracks={() => openAlbumDialog(album)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="space-y-4">
            {inLibraryAlbums.length === 0 ? (
              <EmptyState message="No albums in library yet" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {inLibraryAlbums.map((album) => (
                  <MergedAlbumCard
                    key={album.musicbrainzId}
                    album={album}
                    isAdding={addingAlbums.has(album.musicbrainzId)}
                    onAdd={() => addAlbum({ ...album, artistName: artist.name, artistMusicbrainzId: artist.musicbrainzId! })}
                    onShowTracks={() => openAlbumDialog(album)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="downloaded" className="space-y-4">
            {downloadedAlbums.length === 0 ? (
              <EmptyState message="No downloaded albums yet" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {downloadedAlbums.map((album) => (
                  <MergedAlbumCard
                    key={album.musicbrainzId}
                    album={album}
                    isAdding={false}
                    onAdd={() => {}}
                    onShowTracks={() => openAlbumDialog(album)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requested" className="space-y-4">
            {requestedAlbums.length === 0 ? (
              <EmptyState message="No requested albums" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {requestedAlbums.map((album) => (
                  <MergedAlbumCard
                    key={album.musicbrainzId}
                    album={album}
                    isAdding={false}
                    onAdd={() => {}}
                    onShowTracks={() => openAlbumDialog(album)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="available" className="space-y-4">
            {notInLibraryAlbums.length === 0 ? (
              <EmptyState message="All albums are in library" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {notInLibraryAlbums.map((album) => (
                  <MergedAlbumCard
                    key={album.musicbrainzId}
                    album={album}
                    isAdding={addingAlbums.has(album.musicbrainzId)}
                    onAdd={() => addAlbum({ ...album, artistName: artist.name, artistMusicbrainzId: artist.musicbrainzId! })}
                    onShowTracks={() => openAlbumDialog(album)}
                  />
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
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Album detail dialog */}
      <Dialog open={albumDialogOpen} onOpenChange={setAlbumDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={`https://coverartarchive.org/release-group/${selectedAlbum?.musicbrainzId}/front-250`}
                  alt={selectedAlbum?.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{selectedAlbum?.title}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedAlbum?.releaseDate?.split('-')[0] || 'Unknown year'} · {selectedAlbum?.type}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6">
            {loadingTracks ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-8 w-8" />
              </div>
            ) : albumTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <HugeiconsIcon icon={MusicNote01Icon} className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No tracks found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-20 text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {albumTracks.map((track) => (
                    <TableRow key={track.musicbrainzId}>
                      <TableCell className="text-muted-foreground">{track.position}</TableCell>
                      <TableCell className="font-medium">
                        {track.title}
                        {track.artistName && track.artistName !== artist?.name && (
                          <span className="text-muted-foreground text-sm ml-2">
                            ({track.artistName})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDuration(track.duration)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter className="mt-4">
            {selectedAlbum?.inLibrary && selectedAlbum?.libraryId ? (
              <Button asChild>
                <Link href={`/album/${selectedAlbum.libraryId}`}>
                  View Album
                </Link>
              </Button>
            ) : selectedAlbum && !selectedAlbum.inLibrary ? (
              <Button
                onClick={() => {
                  addAlbum({
                    musicbrainzId: selectedAlbum.musicbrainzId,
                    title: selectedAlbum.title,
                    releaseDate: selectedAlbum.releaseDate,
                    type: selectedAlbum.type,
                    inLibrary: false,
                    artistName: artist!.name,
                    artistMusicbrainzId: artist!.musicbrainzId!,
                  })
                  setAlbumDialogOpen(false)
                }}
                disabled={addingAlbums.has(selectedAlbum.musicbrainzId)}
              >
                {addingAlbums.has(selectedAlbum.musicbrainzId) ? (
                  <>
                    <Spinner className="mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
                    Add to Library
                  </>
                )}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

// Empty state component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <HugeiconsIcon icon={CdIcon} className="h-12 w-12 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}

// Merged album type for unified display
interface MergedAlbum {
  musicbrainzId: string
  title: string
  releaseDate: string | null
  type: string
  inLibrary: boolean
  libraryId?: number
  requested: boolean
  trackCount: number
  fileCount: number
  imageUrl?: string | null
}

interface MergedAlbumCardProps {
  album: MergedAlbum
  isAdding: boolean
  onAdd: () => void
  onShowTracks: () => void
}

function MergedAlbumCard({ album, isAdding, onAdd, onShowTracks }: MergedAlbumCardProps) {
  const [downloading, setDownloading] = useState(false)
  const [imageError, setImageError] = useState(false)

  const percentComplete =
    album.trackCount > 0
      ? Math.round((album.fileCount / album.trackCount) * 100)
      : 0

  const isComplete = album.inLibrary && percentComplete === 100
  const isRequested = album.inLibrary && album.requested && !isComplete
  const isNotInLibrary = !album.inLibrary

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!album.libraryId) return

    setDownloading(true)
    try {
      const response = await fetch(`/api/v1/albums/${album.libraryId}/download`, {
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

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onAdd()
  }

  const handleCardClick = () => {
    // Always open the dialog to show tracks - both for library and non-library albums
    onShowTracks()
  }

  // Get cover URL - use library image if available, otherwise generate from MusicBrainz
  const coverUrl = album.imageUrl || (album.musicbrainzId
    ? `https://coverartarchive.org/release-group/${album.musicbrainzId}/front-500`
    : null)
  const showImage = coverUrl && !imageError

  return (
    <div onClick={handleCardClick}>
      <Card
        className={`py-0 overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group ${
          isComplete ? 'ring-1 ring-green-500/50' : ''
        } ${isNotInLibrary ? 'opacity-70' : ''}`}
      >
        <div className="aspect-square bg-muted relative">
          {showImage ? (
            <img
              src={coverUrl!}
              alt={album.title}
              className={`w-full h-full object-cover ${
                isNotInLibrary ? 'grayscale' : ''
              }`}
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HugeiconsIcon
                icon={CdIcon}
                className="h-16 w-16 text-muted-foreground/50"
              />
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2 right-2">
            {isComplete && (
              <Badge variant="default" className="bg-green-600 text-white">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3 mr-1" />
                Downloaded
              </Badge>
            )}
            {isRequested && (
              <Badge variant="secondary" className="bg-yellow-600 text-white">
                <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3 mr-1" />
                Requested
              </Badge>
            )}
          </div>

          {/* Action button overlay */}
          {!isComplete && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              {isNotInLibrary ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={handleAdd}
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
                  )}
                  Add to Library
                </Button>
              ) : album.libraryId ? (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Spinner className="h-6 w-6" />
                  ) : (
                    <HugeiconsIcon icon={Search01Icon} className="h-6 w-6" />
                  )}
                </Button>
              ) : null}
            </div>
          )}

          {/* Progress bar at bottom */}
          {album.inLibrary && album.requested && (
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
        <CardContent className={`p-3 ${isNotInLibrary ? 'opacity-70' : ''}`}>
          <h3 className="font-medium truncate group-hover:text-primary transition-colors">
            {album.title}
          </h3>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{album.releaseDate?.split('-')[0] || 'Unknown'}</span>
            <span className="capitalize">{album.type}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
