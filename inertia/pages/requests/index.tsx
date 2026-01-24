import { Head, Link } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Video01Icon,
  Tv01Icon,
  Book01Icon,
  MusicNote01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'

interface RequestedAlbum {
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

interface RequestedMovie {
  id: number
  title: string
  year: number
  tmdbId: string | null
  posterUrl: string | null
  releaseDate: string | null
}

interface RequestedEpisode {
  id: number
  title: string
  seasonNumber: number
  episodeNumber: number
  tvShowId: number
  tvShowTitle: string
  posterUrl: string | null
  airDate: string | null
}

interface RequestedBook {
  id: number
  title: string
  authorId: number
  authorName: string
  openlibraryId: string | null
  releaseDate: string | null
  coverUrl: string | null
  seriesName: string | null
  seriesPosition: number | null
}

interface Pagination {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

type MediaType = 'albums' | 'movies' | 'tv' | 'books'

export default function Requests() {
  const [activeTab, setActiveTab] = useState<MediaType>('albums')
  const [albums, setAlbums] = useState<RequestedAlbum[]>([])
  const [movies, setMovies] = useState<RequestedMovie[]>([])
  const [episodes, setEpisodes] = useState<RequestedEpisode[]>([])
  const [books, setBooks] = useState<RequestedBook[]>([])
  const [pagination, setPagination] = useState<Record<MediaType, Pagination | null>>({
    albums: null,
    movies: null,
    tv: null,
    books: null,
  })
  const [counts, setCounts] = useState<Record<MediaType, number>>({
    albums: 0,
    movies: 0,
    tv: 0,
    books: 0,
  })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Fetch counts on mount
  useEffect(() => {
    fetchCounts()
  }, [])

  // Fetch data when tab or page changes
  useEffect(() => {
    fetchData()
  }, [activeTab, page])

  const fetchCounts = async () => {
    try {
      const [albumsRes, moviesRes, tvRes, booksRes] = await Promise.all([
        fetch('/api/v1/albums/requested?limit=1'),
        fetch('/api/v1/movies/requested?limit=1'),
        fetch('/api/v1/tvshows/requested?limit=1'),
        fetch('/api/v1/books/requested?limit=1'),
      ])

      const albumsData = albumsRes.ok ? await albumsRes.json() : { meta: { total: 0 } }
      const moviesData = moviesRes.ok ? await moviesRes.json() : { meta: { total: 0 } }
      const tvData = tvRes.ok ? await tvRes.json() : { meta: { total: 0 } }
      const booksData = booksRes.ok ? await booksRes.json() : { meta: { total: 0 } }

      setCounts({
        albums: albumsData.meta?.total || 0,
        movies: moviesData.meta?.total || 0,
        tv: tvData.meta?.total || 0,
        books: booksData.meta?.total || 0,
      })
    } catch (error) {
      console.error('Failed to fetch counts:', error)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const endpoint = {
        albums: '/api/v1/albums/requested',
        movies: '/api/v1/movies/requested',
        tv: '/api/v1/tvshows/requested',
        books: '/api/v1/books/requested',
      }[activeTab]

      const response = await fetch(`${endpoint}?page=${page}&limit=50`)
      if (response.ok) {
        const data = await response.json()

        switch (activeTab) {
          case 'albums':
            setAlbums(data.data)
            break
          case 'movies':
            setMovies(data.data)
            break
          case 'tv':
            setEpisodes(data.data)
            break
          case 'books':
            setBooks(data.data)
            break
        }

        setPagination((prev) => ({ ...prev, [activeTab]: data.meta }))
      }
    } catch (error) {
      console.error('Failed to fetch requested items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as MediaType)
    setPage(1)
  }

  const totalRequested = counts.albums + counts.movies + counts.tv + counts.books

  const renderEmptyState = () => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-12 w-12 text-green-500" />
        </div>
        <h3 className="text-lg font-medium mb-2">All caught up!</h3>
        <p className="text-muted-foreground">No pending requests in this category.</p>
      </CardContent>
    </Card>
  )

  const renderLoading = () => (
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
  )

  const renderPagination = (meta: Pagination | null) => {
    if (!meta || meta.lastPage <= 1) return null

    return (
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          Showing {(meta.currentPage - 1) * meta.perPage + 1} -{' '}
          {Math.min(meta.currentPage * meta.perPage, meta.total)} of {meta.total} items
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
            Page {meta.currentPage} of {meta.lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= meta.lastPage}
          >
            Next
          </Button>
        </div>
      </div>
    )
  }

  return (
    <AppLayout
      title="Requests"
      actions={
        <Button
          variant="outline"
          onClick={() => {
            fetchCounts()
            fetchData()
          }}
        >
          <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      }
    >
      <Head title="Requests" />

      {totalRequested === 0 && !loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-12 w-12 text-green-500" />
            </div>
            <h3 className="text-lg font-medium mb-2">All caught up!</h3>
            <p className="text-muted-foreground">No pending requests. Your library is complete.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="albums" className="flex items-center gap-2">
              <HugeiconsIcon icon={MusicNote01Icon} className="h-4 w-4" />
              Albums {counts.albums > 0 && <Badge variant="secondary">{counts.albums}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="movies" className="flex items-center gap-2">
              <HugeiconsIcon icon={Video01Icon} className="h-4 w-4" />
              Movies {counts.movies > 0 && <Badge variant="secondary">{counts.movies}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="tv" className="flex items-center gap-2">
              <HugeiconsIcon icon={Tv01Icon} className="h-4 w-4" />
              TV {counts.tv > 0 && <Badge variant="secondary">{counts.tv}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="books" className="flex items-center gap-2">
              <HugeiconsIcon icon={Book01Icon} className="h-4 w-4" />
              Books {counts.books > 0 && <Badge variant="secondary">{counts.books}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Albums Tab */}
          <TabsContent value="albums">
            {loading ? (
              renderLoading()
            ) : albums.length === 0 ? (
              renderEmptyState()
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
                                <Link href={`/requests/search/${album.id}`}>
                                  <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 mr-1" />
                                  Search
                                </Link>
                              </Button>
                              <Button size="sm" variant="ghost" asChild>
                                <Link href={`/album/${album.id}`}>
                                  <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
                {renderPagination(pagination.albums)}
              </>
            )}
          </TabsContent>

          {/* Movies Tab */}
          <TabsContent value="movies">
            {loading ? (
              renderLoading()
            ) : movies.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16"></TableHead>
                        <TableHead>Movie</TableHead>
                        <TableHead className="w-24">Year</TableHead>
                        <TableHead className="w-32"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movies.map((movie) => (
                        <TableRow key={movie.id}>
                          <TableCell>
                            <div className="h-12 w-12 rounded bg-muted overflow-hidden">
                              {movie.posterUrl ? (
                                <img
                                  src={movie.posterUrl}
                                  alt={movie.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <HugeiconsIcon
                                    icon={Video01Icon}
                                    className="h-6 w-6 text-muted-foreground/50"
                                  />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/movie/${movie.id}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {movie.title}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {movie.year || '-'}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/movie/${movie.id}`}>
                                <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
                {renderPagination(pagination.movies)}
              </>
            )}
          </TabsContent>

          {/* TV Tab */}
          <TabsContent value="tv">
            {loading ? (
              renderLoading()
            ) : episodes.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16"></TableHead>
                        <TableHead>Episode</TableHead>
                        <TableHead>Show</TableHead>
                        <TableHead className="w-24">Season</TableHead>
                        <TableHead className="w-32"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {episodes.map((episode) => (
                        <TableRow key={episode.id}>
                          <TableCell>
                            <div className="h-12 w-12 rounded bg-muted overflow-hidden">
                              {episode.posterUrl ? (
                                <img
                                  src={episode.posterUrl}
                                  alt={episode.tvShowTitle}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <HugeiconsIcon
                                    icon={Tv01Icon}
                                    className="h-6 w-6 text-muted-foreground/50"
                                  />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/tvshow/${episode.tvShowId}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {episode.title || `Episode ${episode.episodeNumber}`}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/tvshow/${episode.tvShowId}`}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              {episode.tvShowTitle}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            S{episode.seasonNumber.toString().padStart(2, '0')}E
                            {episode.episodeNumber.toString().padStart(2, '0')}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/tvshow/${episode.tvShowId}`}>
                                <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
                {renderPagination(pagination.tv)}
              </>
            )}
          </TabsContent>

          {/* Books Tab */}
          <TabsContent value="books">
            {loading ? (
              renderLoading()
            ) : books.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16"></TableHead>
                        <TableHead>Book</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead className="w-24">Year</TableHead>
                        <TableHead className="w-32"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {books.map((book) => (
                        <TableRow key={book.id}>
                          <TableCell>
                            <div className="h-12 w-12 rounded bg-muted overflow-hidden">
                              {book.coverUrl ? (
                                <img
                                  src={book.coverUrl}
                                  alt={book.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <HugeiconsIcon
                                    icon={Book01Icon}
                                    className="h-6 w-6 text-muted-foreground/50"
                                  />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/book/${book.id}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {book.title}
                            </Link>
                            {book.seriesName && (
                              <span className="text-sm text-muted-foreground ml-2">
                                ({book.seriesName} #{book.seriesPosition})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/author/${book.authorId}`}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              {book.authorName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {book.releaseDate?.split('-')[0] || '-'}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/book/${book.id}`}>
                                <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
                {renderPagination(pagination.books)}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </AppLayout>
  )
}
