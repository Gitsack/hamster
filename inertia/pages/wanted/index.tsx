import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
  Search01Icon,
  CdIcon,
  CheckmarkCircle01Icon,
  ArrowRight01Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'

interface WantedAlbum {
  id: number
  title: string
  artistId: number
  artistName: string
  musicbrainzId: string | null
  releaseDate: string | null
  albumType: string
  imageUrl: string | null
  trackCount: number
}

interface Pagination {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

export default function Wanted() {
  const [albums, setAlbums] = useState<WantedAlbum[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchWanted()
  }, [page])

  const fetchWanted = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/albums/wanted?page=${page}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setAlbums(data.data)
        setPagination(data.meta)
      }
    } catch (error) {
      console.error('Failed to fetch wanted albums:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout
      title="Wanted"
      actions={
        <Button variant="outline" onClick={fetchWanted}>
          <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      }
    >
      <Head title="Wanted" />

      <div className="space-y-6">
        {loading ? (
          <Card>
            <div className="p-4 space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : albums.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="h-12 w-12 text-green-500"
                />
              </div>
              <h3 className="text-lg font-medium mb-2">All caught up!</h3>
              <p className="text-muted-foreground">
                No missing albums found. Your library is complete.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16"></TableHead>
                    <TableHead>Album</TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead className="w-24">Year</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="w-24">Tracks</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {albums.map((album) => (
                    <TableRow key={album.id}>
                      <TableCell>
                        <div className="h-12 w-12 rounded bg-muted overflow-hidden">
                          {album.imageUrl ? (
                            <img
                              src={album.imageUrl}
                              alt={album.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <HugeiconsIcon
                                icon={CdIcon}
                                className="h-6 w-6 text-muted-foreground/50"
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/album/${album.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {album.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/artist/${album.artistId}`}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {album.artistName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {album.releaseDate?.split('-')[0] || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {album.albumType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {album.trackCount}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/wanted/search/${album.id}`}>
                              <HugeiconsIcon
                                icon={Search01Icon}
                                className="h-4 w-4 mr-1"
                              />
                              Search
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/album/${album.id}`}>
                              <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                className="h-4 w-4"
                              />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination */}
            {pagination && pagination.lastPage > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(pagination.currentPage - 1) * pagination.perPage + 1} -{' '}
                  {Math.min(
                    pagination.currentPage * pagination.perPage,
                    pagination.total
                  )}{' '}
                  of {pagination.total} albums
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.currentPage} of {pagination.lastPage}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= pagination.lastPage}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
