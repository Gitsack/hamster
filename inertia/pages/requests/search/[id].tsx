import { Head, Link, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
  ArrowLeft01Icon,
  Search01Icon,
  CdIcon,
  FileDownloadIcon,
  RefreshIcon,
  Loading01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface Album {
  id: number
  title: string
  artistId: number
  artistName: string
  releaseDate: string | null
  albumType: string
  imageUrl: string | null
}

interface SearchResult {
  id: string
  title: string
  indexer: string
  indexerId: number
  size: number
  publishDate: string
  quality?: string
  seeders?: number
  grabs?: number
  protocol: string
  source: string
}

export default function ManualSearch() {
  const { url } = usePage()
  const albumId = url.split('/').pop()

  const [album, setAlbum] = useState<Album | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetchAlbum()
  }, [albumId])

  const fetchAlbum = async () => {
    try {
      const response = await fetch(`/api/v1/albums/${albumId}`)
      if (response.ok) {
        const data = await response.json()
        setAlbum(data)
        // Auto-search on load
        searchReleases()
      }
    } catch (error) {
      console.error('Failed to fetch album:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchReleases = async () => {
    setSearching(true)
    try {
      const response = await fetch(`/api/v1/albums/${albumId}/releases`)
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      }
    } catch (error) {
      console.error('Failed to search:', error)
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const grabRelease = async (result: SearchResult) => {
    setDownloading(result.id)
    try {
      // TODO: Implement download client integration
      toast.info('Download client integration coming soon')
    } catch (error) {
      console.error('Failed to grab release:', error)
      toast.error('Failed to grab release')
    } finally {
      setDownloading(null)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <AppLayout title="Loading...">
        <Head title="Loading..." />
        <div className="space-y-6">
          <div className="flex gap-6">
            <Skeleton className="h-24 w-24 rounded-lg" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title="Manual Search"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/requests">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
              Back to Requests
            </Link>
          </Button>
          <Button onClick={searchReleases} disabled={searching}>
            {searching ? (
              <>
                <HugeiconsIcon
                  icon={Loading01Icon}
                  className="h-4 w-4 animate-spin mr-2"
                />
                Searching...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4 mr-2" />
                Re-search
              </>
            )}
          </Button>
        </div>
      }
    >
      <Head title={album ? `Search: ${album.title}` : 'Manual Search'} />

      <div className="space-y-6">
        {/* Album info */}
        {album && (
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-24 w-24 rounded bg-muted overflow-hidden flex-shrink-0">
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
                      className="h-10 w-10 text-muted-foreground/50"
                    />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{album.title}</h2>
                <Link
                  href={`/artist/${album.artistId}`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {album.artistName}
                </Link>
                <div className="flex items-center gap-2 mt-2">
                  {album.releaseDate && (
                    <Badge variant="outline">
                      {album.releaseDate.split('-')[0]}
                    </Badge>
                  )}
                  <Badge className="capitalize">{album.albumType}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search results */}
        {searching ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <HugeiconsIcon
                  icon={Loading01Icon}
                  className="h-8 w-8 animate-spin text-muted-foreground"
                />
                <p className="text-muted-foreground">Searching indexers...</p>
              </div>
            </CardContent>
          </Card>
        ) : results.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="h-12 w-12 text-muted-foreground"
                />
              </div>
              <h3 className="text-lg font-medium mb-2">No releases found</h3>
              <p className="text-muted-foreground">
                No releases found on your configured indexers. Try again later or
                check your indexer settings.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {results.length} Release{results.length !== 1 && 's'} Found
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Release</TableHead>
                  <TableHead className="w-32">Indexer</TableHead>
                  <TableHead className="w-24">Quality</TableHead>
                  <TableHead className="w-24 text-right">Size</TableHead>
                  <TableHead className="w-24 text-right">Grabs</TableHead>
                  <TableHead className="w-32">Age</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={`${result.id}-${result.indexerId}`}>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="font-medium truncate" title={result.title}>
                          {result.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.protocol === 'usenet' ? 'Usenet' : 'Torrent'}
                          {result.source === 'prowlarr' && ' (via Prowlarr)'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {result.indexer}
                    </TableCell>
                    <TableCell>
                      {result.quality ? (
                        <Badge variant="outline">{result.quality}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatSize(result.size)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {result.grabs ?? result.seeders ?? '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(result.publishDate)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => grabRelease(result)}
                        disabled={downloading === result.id}
                      >
                        {downloading === result.id ? (
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
        )}
      </div>
    </AppLayout>
  )
}
