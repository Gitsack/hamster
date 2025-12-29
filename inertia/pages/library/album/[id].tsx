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
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  MoreVerticalIcon,
  Search01Icon,
  CdIcon,
  Calendar01Icon,
  MusicNote01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  ViewIcon,
  ViewOffIcon,
  FileDownloadIcon,
  PlayIcon,
  PauseIcon,
  Loading01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAudioPlayer } from '@/contexts/audio_player_context'

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
  quality: string
  format: string
  bitrate: number | null
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
  monitored: boolean
  anyReleaseOk: boolean
  tracks: Track[]
  trackFiles: TrackFile[]
}

interface SearchResult {
  id: string
  title: string
  indexer: string
  indexerId: number
  size: number
  publishDate: string
  downloadUrl: string
  quality?: string
  seeders?: number
  grabs?: number
  protocol: string
}

export default function AlbumDetail() {
  const { url } = usePage()
  const albumId = url.split('/').pop()
  const player = useAudioPlayer()

  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [grabbing, setGrabbing] = useState<string | null>(null)

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
        router.visit('/library')
      }
    } catch (error) {
      console.error('Failed to fetch album:', error)
      toast.error('Failed to load album')
    } finally {
      setLoading(false)
    }
  }

  const toggleMonitored = async () => {
    if (!album) return

    try {
      const response = await fetch(`/api/v1/albums/${albumId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored: !album.monitored }),
      })
      if (response.ok) {
        setAlbum({ ...album, monitored: !album.monitored })
        toast.success(album.monitored ? 'Album unrequested' : 'Album requested')
      }
    } catch (error) {
      console.error('Failed to update album:', error)
      toast.error('Failed to update album')
    }
  }

  const searchReleases = async () => {
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
        toast.error(error.error || (trackId ? 'No single/EP found for this track' : 'Failed to find releases'))
      }
    } catch (error) {
      console.error('Failed to download:', error)
      toast.error('Failed to download')
    } finally {
      setDownloading(false)
    }
  }

  const grabRelease = async (result: SearchResult) => {
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
  const percentComplete =
    totalTracks > 0 ? Math.round((tracksWithFiles / totalTracks) * 100) : 0

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
          <div className="flex gap-6">
            <Skeleton className="h-48 w-48 rounded-lg" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/2" />
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
        <div className="text-center py-12">
          <p className="text-muted-foreground">Album not found</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={album.title}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/artist/${album.artistId}`}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
              Back to Artist
            </Link>
          </Button>
          {tracksWithFiles > 0 && (
            <Button variant="outline" onClick={playAlbum}>
              <HugeiconsIcon icon={PlayIcon} className="h-4 w-4 mr-2" />
              Play
            </Button>
          )}
          <Button onClick={searchAndDownload} disabled={downloading || percentComplete === 100}>
            {downloading ? (
              <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4 mr-2" />
            )}
            {downloading ? 'Searching...' : 'Download'}
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
                  icon={album.monitored ? ViewOffIcon : ViewIcon}
                  className="h-4 w-4 mr-2"
                />
                {album.monitored ? 'Unrequest' : 'Request'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={searchReleases} disabled={searching}>
                <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 mr-2" />
                {searching ? 'Searching...' : 'Manual Search'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <Head title={`${album.title} - ${album.artistName}`} />

      <div className="space-y-6">
        {/* Album header */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Album art */}
          <div className="w-full md:w-48 aspect-square md:aspect-auto md:h-48 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {album.imageUrl ? (
              <img
                src={album.imageUrl}
                alt={album.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon
                  icon={CdIcon}
                  className="h-16 w-16 text-muted-foreground/50"
                />
              </div>
            )}
          </div>

          {/* Album info */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{album.title}</h1>
              </div>
              <Link
                href={`/artist/${album.artistId}`}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {album.artistName}
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {album.releaseDate && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4" />
                  {album.releaseDate}
                </div>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={MusicNote01Icon} className="h-4 w-4" />
                {totalTracks} tracks
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {tracksWithFiles} of {totalTracks} tracks
                </span>
                <span className="font-medium">{percentComplete}%</span>
              </div>
              <Progress value={percentComplete} className="h-2" />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <Badge className="capitalize">{album.albumType}</Badge>
              {album.secondaryTypes.map((type) => (
                <Badge key={type} variant="outline" className="capitalize">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tracks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tracks">Tracks</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            {searchResults.length > 0 && (
              <TabsTrigger value="search">
                Search Results ({searchResults.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="tracks">
            {album.tracks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    No tracks available. Try refreshing the artist metadata.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-24 text-right">Duration</TableHead>
                      <TableHead className="w-16 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {album.tracks.map((track, index) => {
                      const isCurrentTrack = player.currentTrack?.trackId === track.id
                      const isPlaying = isCurrentTrack && player.isPlaying

                      return (
                        <TableRow
                          key={track.id}
                          className={track.hasFile ? 'cursor-pointer hover:bg-muted/50' : ''}
                          onClick={() => track.hasFile && playTrack(track, index)}
                        >
                          <TableCell>
                            {track.hasFile && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
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
                          <TableCell className="text-muted-foreground">
                            {track.discNumber > 1
                              ? `${track.discNumber}-${track.trackNumber}`
                              : track.trackNumber}
                          </TableCell>
                          <TableCell className="font-medium">
                            {track.title}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDuration(track.durationMs)}
                          </TableCell>
                          <TableCell className="text-center">
                            {track.hasFile ? (
                              <HugeiconsIcon
                                icon={CheckmarkCircle01Icon}
                                className="h-5 w-5 text-green-500 mx-auto"
                              />
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  searchAndDownload(track.id)
                                }}
                                disabled={downloading}
                                title="Search for this track (single/EP)"
                              >
                                {downloading ? (
                                  <HugeiconsIcon
                                    icon={Loading01Icon}
                                    className="h-4 w-4 animate-spin"
                                  />
                                ) : (
                                  <HugeiconsIcon
                                    icon={FileDownloadIcon}
                                    className="h-4 w-4"
                                  />
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="files">
            {album.trackFiles.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    No files imported for this album yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead className="w-24">Quality</TableHead>
                      <TableHead className="w-24">Format</TableHead>
                      <TableHead className="w-24 text-right">Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {album.trackFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-mono text-sm truncate max-w-xs">
                          {file.path}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{file.quality}</Badge>
                        </TableCell>
                        <TableCell className="uppercase text-muted-foreground">
                          {file.format}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatSize(file.size)}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Release</TableHead>
                      <TableHead className="w-32">Indexer</TableHead>
                      <TableHead className="w-24">Quality</TableHead>
                      <TableHead className="w-24 text-right">Size</TableHead>
                      <TableHead className="w-24 text-right">Grabs</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium max-w-md truncate">
                          {result.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {result.indexer}
                        </TableCell>
                        <TableCell>
                          {result.quality && (
                            <Badge variant="outline">{result.quality}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatSize(result.size)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {result.grabs ?? result.seeders ?? '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => grabRelease(result)}
                            disabled={grabbing === result.id}
                          >
                            {grabbing === result.id ? (
                              <HugeiconsIcon
                                icon={Loading01Icon}
                                className="h-4 w-4 animate-spin"
                              />
                            ) : (
                              <HugeiconsIcon
                                icon={FileDownloadIcon}
                                className="h-4 w-4"
                              />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  )
}
