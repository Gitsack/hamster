import { Head, Link, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
  Calendar01Icon,
  FileDownloadIcon,
  Search01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { MediaStatusBadge, getMediaItemStatus } from '@/components/library/media-status-badge'

interface Author {
  id: number
  name: string
}

interface BookFile {
  id: number
  path: string
  size: number
  format: string | null
  downloadUrl: string
}

interface Book {
  id: number
  openlibraryId: string | null
  isbn: string | null
  isbn13: string | null
  title: string
  overview: string | null
  releaseDate: string | null
  pageCount: number | null
  publisher: string | null
  coverUrl: string | null
  rating: number | null
  genres: string[]
  seriesName: string | null
  seriesPosition: number | null
  requested: boolean
  hasFile: boolean
  author: Author
  bookFile: BookFile | null
}

export default function BookDetail() {
  const { url } = usePage()
  const bookId = url.split('/').pop()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingFile, setDeletingFile] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [activeDownload, setActiveDownload] = useState<{ progress: number; status: string } | null>(
    null
  )

  useEffect(() => {
    fetchBook()
    fetchActiveDownloads()
    const interval = setInterval(fetchActiveDownloads, 5000)
    return () => clearInterval(interval)
  }, [bookId])

  const fetchBook = async () => {
    try {
      const response = await fetch(`/api/v1/books/${bookId}`)
      if (response.ok) {
        const data = await response.json()
        setBook(data)
      } else if (response.status === 404) {
        toast.error('Book not found')
        router.visit('/library?tab=books')
      }
    } catch (error) {
      console.error('Failed to fetch book:', error)
      toast.error('Failed to load book')
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveDownloads = async () => {
    try {
      const response = await fetch('/api/v1/queue')
      if (response.ok) {
        const data = await response.json()
        const download = data.find((item: any) => item.bookId === bookId)
        if (download) {
          setActiveDownload({
            progress: download.progress || 0,
            status: download.status || 'downloading',
          })
        } else {
          setActiveDownload(null)
        }
      }
    } catch (error) {
      // Silently ignore - polling will retry
    }
  }

  const getBookStatus = () => {
    if (!book) return { status: 'none' as const, progress: 0 }
    return getMediaItemStatus(book, activeDownload)
  }

  const toggleWanted = async () => {
    if (!book) return

    const wasRequested = book.requested

    // If unrequesting a book with a file, show confirmation dialog
    if (wasRequested && book.hasFile) {
      setDeleteDialogOpen(true)
      return
    }

    // Optimistic update
    setBook({ ...book, requested: !wasRequested })
    setToggling(true)

    try {
      const response = await fetch(`/api/v1/books/${bookId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.deleted) {
          // Book was deleted (no file, unrequested)
          toast.success('Removed from library')
          router.visit('/library?tab=books')
        } else {
          toast.success(wasRequested ? 'Book unrequested' : 'Book requested')
        }
      } else if (data.hasFile) {
        // Book has a file - show confirmation dialog
        setBook({ ...book, requested: wasRequested }) // Revert
        setDeleteDialogOpen(true)
      } else {
        // Revert on error
        setBook({ ...book, requested: wasRequested })
        toast.error(data.error || 'Failed to update book')
      }
    } catch (error) {
      console.error('Failed to update book:', error)
      // Revert on error
      setBook({ ...book, requested: wasRequested })
      toast.error('Failed to update book')
    } finally {
      setToggling(false)
    }
  }

  const deleteBook = async (withFile: boolean = false) => {
    setDeleting(true)
    try {
      const url = withFile ? `/api/v1/books/${bookId}?deleteFile=true` : `/api/v1/books/${bookId}`

      const response = await fetch(url, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success(withFile ? 'Book and files deleted' : 'Book deleted')
        // Author may have been deleted too - navigate to library
        router.visit('/library?tab=books')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Failed to delete book:', error)
      toast.error('Failed to delete book')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const downloadBook = async () => {
    if (!book) return

    setDownloading(true)
    try {
      const response = await fetch(`/api/v1/books/${bookId}/download`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`Download started: ${data.release?.title || book.title}`)
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

  const deleteFile = async () => {
    if (!book) return

    setDeletingFile(true)
    try {
      const response = await fetch(`/api/v1/books/${bookId}/file`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('File deleted successfully')
        setBook({ ...book, hasFile: false, bookFile: null })
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete file')
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
      toast.error('Failed to delete file')
    } finally {
      setDeletingFile(false)
      setDeleteFileDialogOpen(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <AppLayout title="Loading...">
        <Head title="Loading..." />
        <div className="space-y-6">
          <div className="flex gap-6">
            <Skeleton className="h-72 w-48 rounded-lg" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!book) {
    return (
      <AppLayout title="Not Found">
        <Head title="Not Found" />
        <div className="text-center py-12">
          <p className="text-muted-foreground">Book not found</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={book.title}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link href={book.author ? `/author/${book.author.id}` : '/library'}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Back</span>
            </Link>
          </Button>
          {!book.hasFile && (
            <Button onClick={downloadBook} disabled={downloading}>
              {downloading ? (
                <Spinner className="md:mr-2" />
              ) : (
                <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 md:mr-2" />
              )}
              <span className="hidden md:inline">Search releases</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 mr-2" />
                Remove from Library
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <Head title={book.title} />

      <div className="space-y-6">
        {/* Book header */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Book cover */}
          <div className="w-full md:w-48 aspect-[2/3] md:aspect-auto md:h-72 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon icon={Book01Icon} className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
          </div>

          {/* Book info */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{book.title}</h1>
              </div>
              {book.author && (
                <Link
                  href={`/author/${book.author.id}`}
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <HugeiconsIcon icon={UserIcon} className="h-4 w-4" />
                  {book.author.name}
                </Link>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const { status, progress } = getBookStatus()
                return (
                  <MediaStatusBadge
                    status={status}
                    progress={progress}
                    isToggling={toggling}
                    onToggleRequest={toggleWanted}
                  />
                )
              })()}
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {book.releaseDate && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4" />
                  {book.releaseDate.split('-')[0]}
                </div>
              )}
              {book.pageCount && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <HugeiconsIcon icon={Book01Icon} className="h-4 w-4" />
                  {book.pageCount} pages
                </div>
              )}
              {book.publisher && <div className="text-muted-foreground">{book.publisher}</div>}
            </div>

            {/* Series info */}
            {book.seriesName && (
              <div className="text-sm">
                <span className="text-muted-foreground">Series: </span>
                <span>{book.seriesName}</span>
                {book.seriesPosition && (
                  <span className="text-muted-foreground"> #{book.seriesPosition}</span>
                )}
              </div>
            )}

            {/* ISBN */}
            {(book.isbn || book.isbn13) && (
              <div className="text-sm text-muted-foreground">
                {book.isbn13 && <span>ISBN-13: {book.isbn13}</span>}
                {book.isbn13 && book.isbn && <span> • </span>}
                {book.isbn && <span>ISBN-10: {book.isbn}</span>}
              </div>
            )}

            {/* Genres */}
            {book.genres && book.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {book.genres.slice(0, 5).map((genre, i) => (
                  <Badge key={i} variant="outline">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overview */}
        {book.overview && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-2">Overview</h2>
              <p className="text-muted-foreground whitespace-pre-line">{book.overview}</p>
            </CardContent>
          </Card>
        )}

        {/* File info */}
        {book.bookFile && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4">File</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <HugeiconsIcon icon={Book01Icon} className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {book.bookFile.path.split('/').pop()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {book.bookFile.format && `${book.bookFile.format.toUpperCase()} • `}
                      {formatFileSize(book.bookFile.size)}
                    </p>
                    <p className="text-xs text-muted-foreground/70 truncate">
                      {book.bookFile.path}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <a href={book.bookFile.downloadUrl} download>
                      <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteFileDialogOpen(true)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {book.hasFile ? 'Remove from library?' : `Delete ${book.title}?`}
            </DialogTitle>
            <DialogDescription>
              {book.hasFile
                ? 'This will permanently delete the downloaded files from disk and remove the book from your library.'
                : 'This will remove the book from your library.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteBook(book.hasFile)}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : book.hasFile ? (
                'Delete Files & Remove'
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete file confirmation dialog */}
      <Dialog open={deleteFileDialogOpen} onOpenChange={setDeleteFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete book file?</DialogTitle>
            <DialogDescription>
              This will permanently delete the book file from disk. The book will remain in your
              library but will need to be downloaded again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteFile} disabled={deletingFile}>
              {deletingFile ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete File'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
