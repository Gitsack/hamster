import { Head, Link, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
  Delete01Icon,
  Book01Icon,
  ViewIcon,
  ViewOffIcon,
  Add01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CardStatusBadge, type MediaItemStatus } from '@/components/library/media-status-badge'

interface Book {
  id: number
  title: string
  releaseDate: string | null
  coverUrl: string | null
  requested: boolean
  hasFile: boolean
  seriesName: string | null
  seriesPosition: number | null
}

interface Author {
  id: number
  name: string
  openlibraryId: string | null
  overview: string | null
  imageUrl: string | null
  requested: boolean
  qualityProfile: { id: number; name: string } | null
  rootFolder: { id: number; path: string } | null
  books: Book[]
  addedAt: string | null
}

export default function AuthorDetail() {
  const { url } = usePage()
  const authorId = url.split('/').pop()

  const [author, setAuthor] = useState<Author | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeDownloads, setActiveDownloads] = useState<Map<number, { progress: number; status: string }>>(new Map())
  const [togglingBooks, setTogglingBooks] = useState<Set<number>>(new Set())
  const [requestingAll, setRequestingAll] = useState(false)

  useEffect(() => {
    fetchAuthor()
    fetchActiveDownloads()
    const interval = setInterval(fetchActiveDownloads, 5000)
    return () => clearInterval(interval)
  }, [authorId])

  const fetchActiveDownloads = async () => {
    try {
      const response = await fetch('/api/v1/queue')
      if (response.ok) {
        const data = await response.json()
        const downloads = new Map<number, { progress: number; status: string }>()
        for (const item of data) {
          if (item.bookId) {
            downloads.set(item.bookId, {
              progress: item.progress || 0,
              status: item.status || 'downloading',
            })
          }
        }
        setActiveDownloads(downloads)
      }
    } catch (error) {
      // Silently ignore - polling will retry
    }
  }

  const fetchAuthor = async () => {
    try {
      const response = await fetch(`/api/v1/authors/${authorId}`)
      if (response.ok) {
        const data = await response.json()
        setAuthor(data)
      } else if (response.status === 404) {
        toast.error('Author not found')
        router.visit('/library')
      }
    } catch (error) {
      console.error('Failed to fetch author:', error)
      toast.error('Failed to load author')
    } finally {
      setLoading(false)
    }
  }

  const toggleWanted = async () => {
    if (!author) return

    try {
      const response = await fetch(`/api/v1/authors/${authorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !author.requested }),
      })
      if (response.ok) {
        setAuthor({ ...author, requested: !author.requested })
        toast.success(author.requested ? 'Author unrequested' : 'Author requested')
      }
    } catch (error) {
      console.error('Failed to update author:', error)
      toast.error('Failed to update author')
    }
  }

  const deleteAuthor = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/authors/${authorId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Author deleted')
        router.visit('/library')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Failed to delete author:', error)
      toast.error('Failed to delete author')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const toggleBookRequested = async (bookId: number, currentlyRequested: boolean) => {
    if (!author) return

    // Optimistically update UI immediately
    setAuthor({
      ...author,
      books: author.books.map((b) =>
        b.id === bookId ? { ...b, requested: !currentlyRequested } : b
      ),
    })

    setTogglingBooks((prev) => new Set(prev).add(bookId))

    try {
      const response = await fetch(`/api/v1/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !currentlyRequested }),
      })
      if (response.ok) {
        toast.success(currentlyRequested ? 'Book unrequested' : 'Book requested')
      } else {
        // Revert on error
        setAuthor({
          ...author,
          books: author.books.map((b) =>
            b.id === bookId ? { ...b, requested: currentlyRequested } : b
          ),
        })
        toast.error('Failed to update book')
      }
    } catch (error) {
      console.error('Failed to update book:', error)
      // Revert on error
      setAuthor({
        ...author,
        books: author.books.map((b) =>
          b.id === bookId ? { ...b, requested: currentlyRequested } : b
        ),
      })
      toast.error('Failed to update book')
    } finally {
      setTogglingBooks((prev) => {
        const next = new Set(prev)
        next.delete(bookId)
        return next
      })
    }
  }

  const requestAllBooks = async () => {
    if (!author) return

    const booksToRequest = author.books.filter((b) => !b.requested && !b.hasFile)
    if (booksToRequest.length === 0) {
      toast.info('All books are already requested or downloaded')
      return
    }

    // Optimistically update UI
    setAuthor({
      ...author,
      books: author.books.map((b) => ({
        ...b,
        requested: b.hasFile ? b.requested : true,
      })),
    })

    setRequestingAll(true)

    try {
      // Request all books in parallel
      const results = await Promise.all(
        booksToRequest.map((book) =>
          fetch(`/api/v1/books/${book.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requested: true }),
          })
        )
      )

      const failedCount = results.filter((r) => !r.ok).length
      if (failedCount === 0) {
        toast.success(`Requested ${booksToRequest.length} books`)
      } else if (failedCount < booksToRequest.length) {
        toast.warning(`Requested ${booksToRequest.length - failedCount} books, ${failedCount} failed`)
      } else {
        toast.error('Failed to request books')
        // Revert on complete failure
        fetchAuthor()
      }
    } catch (error) {
      console.error('Failed to request all books:', error)
      toast.error('Failed to request books')
      fetchAuthor()
    } finally {
      setRequestingAll(false)
    }
  }

  // Calculate statistics
  const totalBooks = author?.books.length || 0
  const downloadedBooks = author?.books.filter((b) => b.hasFile).length || 0
  const requestedBooks = author?.books.filter((b) => b.requested && !b.hasFile).length || 0

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

  if (!author) {
    return (
      <AppLayout title="Not Found">
        <Head title="Not Found" />
        <div className="text-center py-12">
          <p className="text-muted-foreground">Author not found</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={author.name}
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
              <DropdownMenuItem onClick={toggleWanted}>
                <HugeiconsIcon
                  icon={author.requested ? ViewOffIcon : ViewIcon}
                  className="h-4 w-4 mr-2"
                />
                {author.requested ? 'Unrequest' : 'Request'}
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
      <Head title={author.name} />

      <div className="space-y-6">
        {/* Author header */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Author image */}
          <div className="w-full md:w-48 aspect-square md:aspect-auto md:h-48 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {author.imageUrl ? (
              <img
                src={author.imageUrl}
                alt={author.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon
                  icon={Book01Icon}
                  className="h-16 w-16 text-muted-foreground/50"
                />
              </div>
            )}
          </div>

          {/* Author info */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{author.name}</h1>
              </div>
            </div>

            {author.overview && (
              <p className="text-muted-foreground line-clamp-3">{author.overview}</p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{totalBooks} books</Badge>
              </div>
              {downloadedBooks > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">
                    {downloadedBooks} downloaded
                  </Badge>
                </div>
              )}
              {requestedBooks > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{requestedBooks} requested</Badge>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {author.qualityProfile && (
                <Badge variant="outline">{author.qualityProfile.name}</Badge>
              )}
              {author.rootFolder && (
                <Badge variant="outline">{author.rootFolder.path}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Books */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Books</h2>
              {author.books.some((b) => !b.requested && !b.hasFile) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestAllBooks}
                  disabled={requestingAll}
                >
                  {requestingAll ? (
                    <>
                      <Spinner className="mr-2" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
                      Request All
                    </>
                  )}
                </Button>
              )}
            </div>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({totalBooks})</TabsTrigger>
            <TabsTrigger value="requested">Requested ({requestedBooks})</TabsTrigger>
            <TabsTrigger value="downloaded">Downloaded ({downloadedBooks})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {author.books.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <HugeiconsIcon icon={Book01Icon} className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No books yet</h3>
                  <p className="text-muted-foreground">
                    Books will appear here once added.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {author.books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    downloadInfo={activeDownloads.get(book.id)}
                    isToggling={togglingBooks.has(book.id)}
                    onToggleRequest={toggleBookRequested}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requested" className="space-y-4">
            {requestedBooks === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="text-lg font-medium mb-2">No requested books</h3>
                <p className="text-muted-foreground">
                  All books are either downloaded or not requested.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {author.books
                  .filter((b) => b.requested && !b.hasFile)
                  .map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      downloadInfo={activeDownloads.get(book.id)}
                      isToggling={togglingBooks.has(book.id)}
                      onToggleRequest={toggleBookRequested}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="downloaded" className="space-y-4">
            {downloadedBooks === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="text-lg font-medium mb-2">No downloaded books</h3>
                <p className="text-muted-foreground">
                  Downloaded books will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {author.books
                  .filter((b) => b.hasFile)
                  .map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      downloadInfo={activeDownloads.get(book.id)}
                      isToggling={togglingBooks.has(book.id)}
                      onToggleRequest={toggleBookRequested}
                    />
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {author.name}?</DialogTitle>
            <DialogDescription>
              This will remove the author and all associated books from your library.
              Files on disk will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteAuthor} disabled={deleting}>
              {deleting ? (
                <>
                <Spinner />
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

interface BookCardProps {
  book: Book
  downloadInfo?: { progress: number; status: string }
  isToggling?: boolean
  onToggleRequest?: (bookId: number, currentlyRequested: boolean) => void
}

function BookCard({ book, downloadInfo, isToggling, onToggleRequest }: BookCardProps) {
  const getBookStatus = (): MediaItemStatus => {
    if (book.hasFile) return 'downloaded'
    if (downloadInfo) {
      if (downloadInfo.status === 'importing') return 'importing'
      return 'downloading'
    }
    if (book.requested) return 'requested'
    return 'none'
  }

  const status = getBookStatus()
  const isNotRequested = status === 'none'

  const handleToggleRequest = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    onToggleRequest?.(book.id, book.requested)
  }

  return (
    <Link href={`/library/book/${book.id}`}>
      <Card className="overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group">
        <div className="aspect-[2/3] bg-muted relative">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className={`w-full h-full object-cover transition-all duration-300 ${
                isNotRequested ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100' : ''
              }`}
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
              isNotRequested ? 'opacity-40 group-hover:opacity-60' : ''
            }`}>
              <HugeiconsIcon icon={Book01Icon} className="h-16 w-16 text-muted-foreground/50" />
            </div>
          )}
          {/* Status badge / Request button */}
          <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
            <CardStatusBadge
              status={status}
              progress={downloadInfo?.progress || 0}
              isToggling={isToggling}
              onToggleRequest={handleToggleRequest}
              showOnHover={status === 'none'}
            />
          </div>
        </div>
        <CardContent className={`p-3 transition-opacity duration-300 ${isNotRequested ? 'opacity-60 group-hover:opacity-100' : ''}`}>
          <h3 className="font-medium truncate group-hover:text-primary transition-colors">
            {book.title}
          </h3>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{book.releaseDate?.split('-')[0] || 'Unknown'}</span>
            {book.seriesName && (
              <span className="truncate ml-2">
                {book.seriesName} #{book.seriesPosition}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
