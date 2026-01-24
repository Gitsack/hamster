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
  RefreshIcon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { CardStatusBadge, type MediaItemStatus } from '@/components/library/media-status-badge'

// Book from library (database)
interface LibraryBook {
  id: number
  title: string
  releaseDate: string | null
  coverUrl: string | null
  requested: boolean
  hasFile: boolean
  seriesName: string | null
  seriesPosition: number | null
}

// Book from OpenLibrary bibliography
interface BibliographyBook {
  openlibraryId: string
  title: string
  description: string | null
  coverUrl: string | null
  subjects: string[] | null
  inLibrary: boolean
  bookId: number | null
  requested: boolean
  hasFile: boolean
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
  books: LibraryBook[]
  addedAt: string | null
}

export default function AuthorDetail() {
  const { url } = usePage()
  const authorId = url.split('/').pop()

  const [author, setAuthor] = useState<Author | null>(null)
  const [bibliography, setBibliography] = useState<BibliographyBook[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBibliography, setLoadingBibliography] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeDownloads, setActiveDownloads] = useState<
    Map<number, { progress: number; status: string }>
  >(new Map())
  const [togglingBooks, setTogglingBooks] = useState<Set<number>>(new Set())
  const [addingBooks, setAddingBooks] = useState<Set<string>>(new Set())
  const [requestingAll, setRequestingAll] = useState(false)

  useEffect(() => {
    fetchAuthor()
    fetchActiveDownloads()
    const interval = setInterval(fetchActiveDownloads, 5000)
    return () => clearInterval(interval)
  }, [authorId])

  // Fetch bibliography when author loads and has OpenLibrary ID
  useEffect(() => {
    if (author?.openlibraryId) {
      fetchBibliography(author.openlibraryId)
    }
  }, [author?.openlibraryId])

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

  const fetchBibliography = async (openlibraryId: string) => {
    setLoadingBibliography(true)
    try {
      const response = await fetch(`/api/v1/authors/${encodeURIComponent(openlibraryId)}/works`)
      if (response.ok) {
        const data = await response.json()
        setBibliography(data)
      }
    } catch (error) {
      console.error('Failed to fetch bibliography:', error)
    } finally {
      setLoadingBibliography(false)
    }
  }

  const refreshAuthor = async () => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/v1/authors/${authorId}/refresh`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(
          `Author refreshed${data.booksAdded > 0 ? `, ${data.booksAdded} books added` : ''}`
        )
        fetchAuthor()
        if (author?.openlibraryId) {
          fetchBibliography(author.openlibraryId)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to refresh')
      }
    } catch (error) {
      console.error('Failed to refresh author:', error)
      toast.error('Failed to refresh author')
    } finally {
      setRefreshing(false)
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

  // Add book from bibliography to library
  const addBook = async (book: BibliographyBook) => {
    if (!author) return

    setAddingBooks((prev) => new Set(prev).add(book.openlibraryId))

    try {
      const response = await fetch('/api/v1/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openlibraryId: book.openlibraryId,
          authorId: String(author.id),
          title: book.title,
          rootFolderId: String(author.rootFolder?.id),
          qualityProfileId: author.qualityProfile?.id
            ? String(author.qualityProfile.id)
            : undefined,
          requested: true,
        }),
      })

      if (response.ok) {
        toast.success(`Added "${book.title}" to library`)
        // Refresh both author and bibliography
        fetchAuthor()
        if (author.openlibraryId) {
          fetchBibliography(author.openlibraryId)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add book')
      }
    } catch (error) {
      console.error('Failed to add book:', error)
      toast.error('Failed to add book')
    } finally {
      setAddingBooks((prev) => {
        const next = new Set(prev)
        next.delete(book.openlibraryId)
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
        toast.warning(
          `Requested ${booksToRequest.length - failedCount} books, ${failedCount} failed`
        )
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

  // Merge library books with bibliography for complete view
  const mergedBooks = useMemo(() => {
    const libraryMap = new Map(author?.books.map((b) => [b.id, b]) || [])

    // Map bibliography books, enriching with library data if available
    const merged = bibliography.map((b) => {
      const libraryBook = b.bookId ? libraryMap.get(b.bookId) : undefined
      return {
        openlibraryId: b.openlibraryId,
        title: b.title,
        description: b.description,
        coverUrl: b.coverUrl || libraryBook?.coverUrl,
        inLibrary: b.inLibrary,
        libraryId: b.bookId,
        requested: b.requested || libraryBook?.requested || false,
        hasFile: b.hasFile || libraryBook?.hasFile || false,
        seriesName: libraryBook?.seriesName,
        seriesPosition: libraryBook?.seriesPosition,
      }
    })

    // Add any library books not in bibliography (edge case)
    for (const book of author?.books || []) {
      if (!bibliography.find((b) => b.bookId === book.id)) {
        merged.push({
          openlibraryId: '',
          title: book.title,
          description: null,
          coverUrl: book.coverUrl,
          inLibrary: true,
          libraryId: book.id,
          requested: book.requested,
          hasFile: book.hasFile,
          seriesName: book.seriesName,
          seriesPosition: book.seriesPosition,
        })
      }
    }

    // Sort alphabetically by title
    return merged.sort((a, b) => a.title.localeCompare(b.title))
  }, [author?.books, bibliography])

  // Filter books by category
  const inLibraryBooks = mergedBooks.filter((b) => b.inLibrary)
  const downloadedBooksFiltered = mergedBooks.filter((b) => b.inLibrary && b.hasFile)
  const requestedBooksFiltered = mergedBooks.filter((b) => b.inLibrary && b.requested && !b.hasFile)
  const notInLibraryBooks = mergedBooks.filter((b) => !b.inLibrary)

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
              <DropdownMenuItem onClick={refreshAuthor} disabled={refreshing}>
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
      <Head title={author.name} />

      <div className="space-y-6">
        {/* Author header */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Author image */}
          <div className="w-full md:w-48 aspect-square md:aspect-auto md:h-48 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {author.imageUrl ? (
              <img src={author.imageUrl} alt={author.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon icon={Book01Icon} className="h-16 w-16 text-muted-foreground/50" />
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
              {author.rootFolder && <Badge variant="outline">{author.rootFolder.path}</Badge>}
            </div>
          </div>
        </div>

        {/* Books / Bibliography */}
        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">
                Bibliography ({mergedBooks.length})
                {loadingBibliography && <Spinner className="ml-2 h-3 w-3" />}
              </TabsTrigger>
              <TabsTrigger value="library">In Library ({inLibraryBooks.length})</TabsTrigger>
              <TabsTrigger value="downloaded">
                Downloaded ({downloadedBooksFiltered.length})
              </TabsTrigger>
              <TabsTrigger value="requested">
                Requested ({requestedBooksFiltered.length})
              </TabsTrigger>
              {notInLibraryBooks.length > 0 && (
                <TabsTrigger value="available">Available ({notInLibraryBooks.length})</TabsTrigger>
              )}
            </TabsList>
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
                    Request All in Library
                  </>
                )}
              </Button>
            )}
          </div>

          <TabsContent value="all" className="space-y-4">
            {mergedBooks.length === 0 ? (
              <EmptyState
                message={
                  loadingBibliography
                    ? 'Loading bibliography...'
                    : 'No books found. Try refreshing to fetch from OpenLibrary.'
                }
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {mergedBooks.map((book) => (
                  <MergedBookCard
                    key={book.openlibraryId || book.libraryId}
                    book={book}
                    downloadInfo={book.libraryId ? activeDownloads.get(book.libraryId) : undefined}
                    isToggling={book.libraryId ? togglingBooks.has(book.libraryId) : false}
                    isAdding={addingBooks.has(book.openlibraryId)}
                    onToggleRequest={toggleBookRequested}
                    onAdd={() =>
                      addBook({
                        openlibraryId: book.openlibraryId,
                        title: book.title,
                        description: book.description,
                        coverUrl: book.coverUrl,
                        subjects: null,
                        inLibrary: book.inLibrary,
                        bookId: book.libraryId || null,
                        requested: book.requested,
                        hasFile: book.hasFile,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="space-y-4">
            {inLibraryBooks.length === 0 ? (
              <EmptyState message="No books in library yet" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {inLibraryBooks.map((book) => (
                  <MergedBookCard
                    key={book.openlibraryId || book.libraryId}
                    book={book}
                    downloadInfo={book.libraryId ? activeDownloads.get(book.libraryId) : undefined}
                    isToggling={book.libraryId ? togglingBooks.has(book.libraryId) : false}
                    isAdding={false}
                    onToggleRequest={toggleBookRequested}
                    onAdd={() => {}}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="downloaded" className="space-y-4">
            {downloadedBooksFiltered.length === 0 ? (
              <EmptyState message="No downloaded books yet" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {downloadedBooksFiltered.map((book) => (
                  <MergedBookCard
                    key={book.openlibraryId || book.libraryId}
                    book={book}
                    downloadInfo={book.libraryId ? activeDownloads.get(book.libraryId) : undefined}
                    isToggling={book.libraryId ? togglingBooks.has(book.libraryId) : false}
                    isAdding={false}
                    onToggleRequest={toggleBookRequested}
                    onAdd={() => {}}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requested" className="space-y-4">
            {requestedBooksFiltered.length === 0 ? (
              <EmptyState message="No requested books" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {requestedBooksFiltered.map((book) => (
                  <MergedBookCard
                    key={book.openlibraryId || book.libraryId}
                    book={book}
                    downloadInfo={book.libraryId ? activeDownloads.get(book.libraryId) : undefined}
                    isToggling={book.libraryId ? togglingBooks.has(book.libraryId) : false}
                    isAdding={false}
                    onToggleRequest={toggleBookRequested}
                    onAdd={() => {}}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="available" className="space-y-4">
            {notInLibraryBooks.length === 0 ? (
              <EmptyState message="All books are in library" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {notInLibraryBooks.map((book) => (
                  <MergedBookCard
                    key={book.openlibraryId || book.libraryId}
                    book={book}
                    downloadInfo={undefined}
                    isToggling={false}
                    isAdding={addingBooks.has(book.openlibraryId)}
                    onToggleRequest={toggleBookRequested}
                    onAdd={() =>
                      addBook({
                        openlibraryId: book.openlibraryId,
                        title: book.title,
                        description: book.description,
                        coverUrl: book.coverUrl,
                        subjects: null,
                        inLibrary: book.inLibrary,
                        bookId: book.libraryId || null,
                        requested: book.requested,
                        hasFile: book.hasFile,
                      })
                    }
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
            <DialogTitle>Delete {author.name}?</DialogTitle>
            <DialogDescription>
              This will remove the author and all associated books from your library. Files on disk
              will not be deleted.
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

// Empty state component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <HugeiconsIcon icon={Book01Icon} className="h-12 w-12 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}

// Merged book type for unified display
interface MergedBook {
  openlibraryId: string
  title: string
  description: string | null
  coverUrl: string | null
  inLibrary: boolean
  libraryId?: number | null
  requested: boolean
  hasFile: boolean
  seriesName?: string | null
  seriesPosition?: number | null
}

interface MergedBookCardProps {
  book: MergedBook
  downloadInfo?: { progress: number; status: string }
  isToggling: boolean
  isAdding: boolean
  onToggleRequest: (bookId: number, currentlyRequested: boolean) => void
  onAdd: () => void
}

function MergedBookCard({
  book,
  downloadInfo,
  isToggling,
  isAdding,
  onToggleRequest,
  onAdd,
}: MergedBookCardProps) {
  const [downloading, setDownloading] = useState(false)

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
  const isNotInLibrary = !book.inLibrary
  const isComplete = book.hasFile

  const handleToggleRequest = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (book.libraryId) {
      onToggleRequest(book.libraryId, book.requested)
    }
  }

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onAdd()
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!book.libraryId) return

    setDownloading(true)
    try {
      const response = await fetch(`/api/v1/books/${book.libraryId}/download`, {
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
      toast.error('Failed to download book')
    } finally {
      setDownloading(false)
    }
  }

  const CardWrapper = book.libraryId
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={`/book/${book.libraryId}`}>{children}</Link>
      )
    : ({ children }: { children: React.ReactNode }) => <>{children}</>

  return (
    <CardWrapper>
      <Card
        className={`py-0 overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group ${
          isComplete ? 'ring-1 ring-green-500/50' : ''
        } ${isNotInLibrary ? 'opacity-70' : ''}`}
      >
        <div className="aspect-2/3 bg-muted relative">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className={`w-full h-full object-cover transition-all duration-300 ${
                isNotInLibrary ? 'grayscale' : ''
              }`}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HugeiconsIcon icon={Book01Icon} className="h-16 w-16 text-muted-foreground/50" />
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
            {!isComplete && book.inLibrary && book.requested && (
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
              ) : book.libraryId ? (
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
        </div>
        <CardContent className={`p-3 ${isNotInLibrary ? 'opacity-70' : ''}`}>
          <h3 className="font-medium truncate group-hover:text-primary transition-colors">
            {book.title}
          </h3>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            {book.seriesName ? (
              <span className="truncate">
                {book.seriesName} #{book.seriesPosition}
              </span>
            ) : (
              <span>&nbsp;</span>
            )}
          </div>
        </CardContent>
      </Card>
    </CardWrapper>
  )
}
