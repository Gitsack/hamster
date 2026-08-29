import { Head, Link, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  MoreVerticalIcon,
  Search01Icon,
  CdIcon,
  Calendar01Icon,
  MusicNote01Icon,
  CheckmarkCircle01Icon,
  Delete01Icon,
  FileDownloadIcon,
  PlayIcon,
  PauseIcon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { MediaHero } from '@/components/media-hero'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAudioPlayer } from '@/contexts/audio_player_context'
import { DownloadProgressCard } from '@/components/library/download-progress-card'
import { useActiveDownloads } from '@/hooks/use_active_downloads'
import { useShowMore } from '@/hooks/use_show_more'
import { DeleteMediaDialog } from '@/components/library/delete-media-dialog'
import { ReleaseList, type AnnotatedRelease } from '@/components/release-list'
import { DownloadClientIndicator } from '@/components/library/download-client-indicator'
import { MediaSpecs } from '@/components/library/media-specs'
import { useDownloadClients } from '@/hooks/use_download_clients'
import { MediaStatusBadge } from '@/components/library/media-status-badge'

interface Track {
  id: number
  title: string
  discNumber: number
  trackNumber: number
  durationMs: number | null
  hasFile: boolean
  trackFileId: number | null
}

interface TrackFile {
  id: number
  path: string
  size: number
  quality: string | null
  format: string | null
  bitrate: number | null
  downloadUrl: string
}

interface Album {
  id: number
  title: string
  artistId: number
  artistName: string
  musicbrainzId: string | null
  musicbrainzReleaseGroupId: string | null
  overview: string | null
  releaseDate: string | null
  albumType: string
  secondaryTypes: string[]
  imageUrl: string | null
  requested: boolean
  anyReleaseOk: boolean
  qualityProfile: { name: string } | null
  rootFolder: { path: string } | null
  tracks: Track[]
  trackFiles: TrackFile[]
}

export default function AlbumDetail() {
  const { url } = usePage()
  const albumId = url.split('/').pop()
  const player = useAudioPlayer()

  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchResults, setSearchResults] = useState<AnnotatedRelease[]>([])
  const [searching, setSearching] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [grabbing, setGrabbing] = useState<string | null>(null)
  const [enriching, setEnriching] = useState(false)
  const { getForAlbum } = useActiveDownloads()
  const albumDownloads = albumId ? getForAlbum(albumId) : []
  const tracksPage = useShowMore(album?.tracks ?? [])
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const { clients: downloadClients } = useDownloadClients()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false)

  useEffect(() => {
    fetchAlbum()
  }, [albumId])

  const fetchAlbum = async () => {
    try {
      const response = await fetch(`/api/v1/albums/${albumId}`)
      if (response.ok) {
        const data = await response.json()
        setAlbum(data)
      } else if (response.status === 404) {
        toast.error('Album not found')
        router.visit('/library?tab=music')
      }
    } catch (error) {
      console.error('Failed to fetch album:', error)
      toast.error('Failed to load album')
    } finally {
      setLoading(false)
    }
  }

  const toggleRequested = async () => {
    if (!album) return

    const wasRequested = album.requested

    // If unrequesting an album with files, show delete dialog
    if (wasRequested && album.trackFiles.length > 0) {
      setDeleteDialogOpen(true)
      return
    }

    try {
      const response = await fetch(`/api/v1/albums/${albumId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.deleted) {
          // Album was deleted - navigate back
          toast.success('Removed from library')
          router.visit('/library?tab=music')
        } else {
          setAlbum({ ...album, requested: !wasRequested })
          toast.success(wasRequested ? 'Album unrequested' : 'Album requested')
        }
      } else if (data.hasFile) {
        setDeleteDialogOpen(true)
      } else {
        toast.error(data.error || 'Failed to update album')
      }
    } catch (error) {
      console.error('Failed to update album:', error)
      toast.error('Failed to update album')
    }
  }

  const deleteAlbum = async (deleteFiles: boolean) => {
    const url = deleteFiles
      ? `/api/v1/albums/${albumId}?deleteFile=true`
      : `/api/v1/albums/${albumId}`

    const response = await fetch(url, { method: 'DELETE' })
    if (response.ok) {
      toast.success(deleteFiles ? 'Album and files deleted' : 'Album deleted')
      router.visit('/library?tab=music')
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to delete')
    }
    setDeleteDialogOpen(false)
  }

  const deleteAlbumFiles = async () => {
    if (!album) return

    const response = await fetch(`/api/v1/albums/${albumId}/file`, { method: 'DELETE' })
    if (response.ok) {
      toast.success('Files deleted successfully')
      setAlbum({ ...album, trackFiles: [] })
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to delete files')
    }
    setDeleteFileDialogOpen(false)
  }

  const searchReleases = async () => {
    setSearchResults([])
    setSearching(true)
    try {
      const response = await fetch(`/api/v1/albums/${albumId}/releases`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      }
    } catch (error) {
      console.error('Failed to search releases:', error)
      toast.error('Failed to search releases')
    } finally {
      setSearching(false)
    }
  }

  const searchAndDownload = async (trackId?: number) => {
    setDownloading(true)
    try {
      const url = new URL(`/api/v1/albums/${albumId}/download`, window.location.origin)
      if (trackId) {
        url.searchParams.set('trackId', trackId.toString())
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`Download started: ${data.release?.title || data.title}`)
      } else {
        const error = await response.json()
        toast.error(
          error.error || (trackId ? 'No single/EP found for this track' : 'Failed to find releases')
        )
      }
    } catch (error) {
      console.error('Failed to download:', error)
      toast.error('Failed to download')
    } finally {
      setDownloading(false)
    }
  }

  const grabRelease = async (result: AnnotatedRelease) => {
    setGrabbing(result.id)
    try {
      const response = await fetch('/api/v1/queue/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.title,
          downloadUrl: result.downloadUrl,
          size: result.size,
          albumId: album?.id,
          indexerId: result.indexerId,
          indexerName: result.indexer,
          guid: result.id,
          replaceExisting: true,
          ...(selectedClientId && { downloadClientId: selectedClientId }),
        }),
      })
      if (response.ok) {
        toast.success('Download started')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to grab release')
      }
    } catch (error) {
      console.error('Failed to grab release:', error)
      toast.error('Failed to grab release')
    } finally {
      setGrabbing(null)
    }
  }

  const enrichAlbum = async () => {
    if (!album) return

    setEnriching(true)
    try {
      const response = await fetch(`/api/v1/albums/${albumId}/enrich`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.enriched) {
          toast.success('Album enriched with MusicBrainz data')
          fetchAlbum()
        } else {
          toast.warning(data.message || 'No matching album found')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to enrich')
      }
    } catch (error) {
      console.error('Failed to enrich album:', error)
      toast.error('Failed to enrich album')
    } finally {
      setEnriching(false)
    }
  }

  const playTrack = (track: Track, index: number) => {
    if (!album || !track.hasFile) return
    player.playAlbum(album.id)
  }

  const playAlbum = () => {
    if (!album) return
    player.playAlbum(album.id)
  }

  // Calculate statistics
  const totalTracks = album?.tracks.length || 0
  const tracksWithFiles = album?.tracks.filter((t) => t.hasFile).length || 0
  const percentComplete = totalTracks > 0 ? Math.round((tracksWithFiles / totalTracks) * 100) : 0

  // Format duration
  const formatDuration = (ms: number | null) => {
    if (!ms) return '--:--'
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  if (loading) {
    return (
      <AppLayout title="Loading...">
        <Head title="Loading..." />
        <div className="space-y-6">
          <div className="flex gap-4 md:gap-6">
            <Skeleton className="w-28 sm:w-40 md:w-48 aspect-square rounded-lg shrink-0" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!album) {
    return (
      <AppLayout title="Not Found">
        <Head title="Not Found" />
        <EmptyState
          icon={<HugeiconsIcon icon={CdIcon} />}
          title="Album not found"
          message="This album is no longer in your library — it may have been removed. Head back to the music library to pick another."
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={album.title}
      headerPrefix={
        <Breadcrumbs
          items={[
            { label: 'Music', href: '/library?tab=music' },
            { label: album.artistName, href: `/artist/${album.artistId}` },
          ]}
        />
      }
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {tracksWithFiles > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={playAlbum}>
                    <HugeiconsIcon icon={PlayIcon} className="h-4 w-4" />
                    <span className="hidden md:inline">Play</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Play</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => searchAndDownload()}
                  disabled={downloading || percentComplete === 100}
                >
                  {downloading ? (
                    <Spinner />
                  ) : (
                    <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">
                    {downloading ? 'Downloading...' : 'Download'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{downloading ? 'Downloading...' : 'Download'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={searchReleases}
                  disabled={searching || percentComplete === 100}
                >
                  {searching ? (
                    <Spinner />
                  ) : (
                    <HugeiconsIcon icon={Search01Icon} className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">
                    {searching ? 'Searching...' : 'Browse releases'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{searching ? 'Searching...' : 'Browse releases'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!album.musicbrainzId && (
                <DropdownMenuItem onClick={enrichAlbum} disabled={enriching}>
                  <HugeiconsIcon
                    icon={Search01Icon}
                    className={`h-4 w-4 ${enriching ? 'animate-spin' : ''}`}
                  />
                  {enriching ? 'Enriching...' : 'Enrich from MusicBrainz'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {album.trackFiles.length > 0 && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteFileDialogOpen(true)}
                >
                  <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
                  Delete Files
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (album.trackFiles.length > 0) {
                    setDeleteDialogOpen(true)
                  } else {
                    toggleRequested()
                  }
                }}
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
                Remove from Library
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <Head title={`${album.title} - ${album.artistName}`} />

      <div className="space-y-6">
        <MediaHero
          title={album.title}
          posterUrl={album.imageUrl}
          posterAspect="square"
          posterFallback={
            <HugeiconsIcon icon={CdIcon} className="h-16 w-16 text-muted-foreground/50" />
          }
          overview={album.overview}
        >
          <div>
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold tracking-[-0.01em]">{album.title}</h1>
            </div>
            <Link
              href={`/artist/${album.artistId}`}
              className="rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-primary hover:underline outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              {album.artistName}
            </Link>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <MediaStatusBadge
              status={
                album.trackFiles.length > 0 && tracksWithFiles === totalTracks
                  ? 'downloaded'
                  : album.requested
                    ? 'requested'
                    : 'none'
              }
              onToggleRequest={toggleRequested}
            />
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {album.releaseDate && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4" />
                <span className="readout">{album.releaseDate}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              <HugeiconsIcon icon={MusicNote01Icon} className="h-4 w-4" />
              <span className="readout">{totalTracks}</span> tracks
            </div>
          </div>

          {/* Completeness — media state, so it wears the status ramp, not the accent */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <span className="readout">{tracksWithFiles}</span> of{' '}
                <span className="readout">{totalTracks}</span> tracks
              </span>
              <span className="readout font-medium">{percentComplete}%</span>
            </div>
            <Progress
              value={percentComplete}
              className="h-2 [&_[data-slot=progress-indicator]]:bg-status-complete"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">
              {album.albumType}
            </Badge>
            {album.secondaryTypes.map((type) => (
              <Badge key={type} variant="outline" className="capitalize">
                {type}
              </Badge>
            ))}
          </div>

          <MediaSpecs
            specs={[
              { label: 'Profile', value: album.qualityProfile?.name },
              { label: 'Folder', value: album.rootFolder?.path, mono: true },
            ]}
            control={
              downloadClients.length > 0 ? (
                <DownloadClientIndicator
                  clients={downloadClients}
                  selectedClientId={selectedClientId}
                  onClientChange={setSelectedClientId}
                />
              ) : undefined
            }
          />
        </MediaHero>

        {albumDownloads.length > 0 && <DownloadProgressCard downloads={albumDownloads} />}

        {/* Tabs */}
        <Tabs defaultValue="tracks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tracks">Tracks</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            {searchResults.length > 0 && (
              <TabsTrigger value="search">Search Results ({searchResults.length})</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="tracks">
            {album.tracks.length === 0 ? (
              <EmptyState
                icon={<HugeiconsIcon icon={MusicNote01Icon} />}
                title="No track listing yet"
                message="MusicBrainz has not returned tracks for this release. Refresh the artist's metadata to pull the listing in."
              />
            ) : (
              <Card className="py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <span className="sr-only">Play</span>
                      </TableHead>
                      <TableHead className="w-14" data-numeric>
                        #
                      </TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-24" data-numeric>
                        Duration
                      </TableHead>
                      <TableHead className="w-16 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tracksPage.visibleItems.map((track, index) => {
                      const isCurrentTrack = player.currentTrack?.trackId === track.id
                      const isPlaying = isCurrentTrack && player.isPlaying

                      return (
                        <TableRow
                          key={track.id}
                          className={track.hasFile ? 'cursor-pointer' : ''}
                          onClick={() => track.hasFile && playTrack(track, index)}
                        >
                          <TableCell>
                            {track.hasFile && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={
                                  isPlaying ? `Pause ${track.title}` : `Play ${track.title}`
                                }
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (isPlaying) {
                                    player.pause()
                                  } else {
                                    playTrack(track, index)
                                  }
                                }}
                              >
                                <HugeiconsIcon
                                  icon={isPlaying ? PauseIcon : PlayIcon}
                                  className="h-4 w-4"
                                />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-numeric>
                            {track.discNumber > 1
                              ? `${track.discNumber}-${track.trackNumber}`
                              : track.trackNumber}
                          </TableCell>
                          <TableCell className="font-medium">{track.title}</TableCell>
                          <TableCell className="text-muted-foreground" data-numeric>
                            {formatDuration(track.durationMs)}
                          </TableCell>
                          <TableCell className="text-center">
                            {track.hasFile ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-status-complete text-white">
                                      <HugeiconsIcon
                                        icon={CheckmarkCircle01Icon}
                                        className="size-3"
                                      />
                                      <span className="sr-only">On disk</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>On disk</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  searchAndDownload(track.id)
                                }}
                                disabled={downloading}
                                aria-label={`Search indexers for ${track.title} as a single or EP`}
                                title="Search for this track (single/EP)"
                              >
                                {downloading ? (
                                  <Spinner />
                                ) : (
                                  <HugeiconsIcon icon={Search01Icon} className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                {tracksPage.hasMore && (
                  <div className="flex justify-center border-t border-border py-3">
                    <Button variant="outline" size="sm" onClick={tracksPage.showMore}>
                      Show more (<span className="readout">{tracksPage.shownCount}</span> of{' '}
                      <span className="readout">{tracksPage.totalCount}</span>)
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="files">
            {album.trackFiles.length === 0 ? (
              <EmptyState
                icon={<HugeiconsIcon icon={FileDownloadIcon} />}
                title="No files imported yet"
                message="Nothing has landed on disk for this album. Grab a release from Browse releases, or check Activity if a download is already running."
              />
            ) : (
              <Card className="py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead className="w-24">Quality</TableHead>
                      <TableHead className="w-24">Format</TableHead>
                      <TableHead className="w-24" data-numeric>
                        Size
                      </TableHead>
                      <TableHead className="w-16">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {album.trackFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="readout truncate max-w-[200px] sm:max-w-xs">
                          {file.path}
                        </TableCell>
                        <TableCell>
                          {file.quality && <Badge variant="outline">{file.quality}</Badge>}
                        </TableCell>
                        <TableCell className="readout uppercase text-muted-foreground">
                          {file.format}
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-numeric>
                          {formatSize(file.size)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            asChild
                            aria-label={`Download ${file.path.split('/').pop()}`}
                          >
                            <a href={file.downloadUrl} download>
                              <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {searchResults.length > 0 && (
            <TabsContent value="search">
              <Card>
                <CardContent>
                  <ReleaseList
                    releases={searchResults}
                    loading={searching}
                    grabbingId={grabbing}
                    onGrab={grabRelease}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <DeleteMediaDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={album.title}
        mediaType="album"
        hasFile={album.trackFiles.length > 0}
        mode="remove"
        onConfirm={deleteAlbum}
      />

      <DeleteMediaDialog
        open={deleteFileDialogOpen}
        onOpenChange={setDeleteFileDialogOpen}
        title={album.title}
        mediaType="album"
        hasFile={album.trackFiles.length > 0}
        mode="deleteFile"
        onConfirm={deleteAlbumFiles}
      />
    </AppLayout>
  )
}
