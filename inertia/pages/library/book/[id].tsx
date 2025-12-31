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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  MoreVerticalIcon,
  Delete01Icon,
  Book01Icon,
  Loading01Icon,
  ViewIcon,
  ViewOffIcon,
  Clock01Icon,
  Calendar01Icon,
  FileDownloadIcon,
  Search01Icon,
  UserIcon,
  Cancel01Icon,
  Download01Icon,
  PackageMovingIcon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { StatusBadge, type ItemStatus } from '@/components/library/status-badge'

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
  const [activeDownload, setActiveDownload] = useState<{ progress: number; status: string } | null>(null)

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
        router.visit('/library')
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

  const getBookStatus = (): { status: ItemStatus | 'importing'; progress: number } => {
    if (book?.hasFile) {
      return { status: 'downloaded', progress: 100 }
    }
    if (activeDownload) {
      if (activeDownload.status === 'importing') {
        return { status: 'importing', progress: 100 }
      }
      return { status: 'downloading', progress: activeDownload.progress }
    }
    if (book?.requested) {
      return { status: 'requested', progress: 0 }
    }
    return { status: 'none', progress: 0 }
  }

  const toggleWanted = async () => {
    if (!book) return

    const wasRequested = book.requested
    // Optimistic update
    setBook({ ...book, requested: !wasRequested })
    setToggling(true)

    try {
      const response = await fetch(`/api/v1/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: !wasRequested }),
      })
      if (response.ok) {
        toast.success(wasRequested ? 'Book unrequested' : 'Book requested')
      } else {
        // Revert on error
        setBook({ ...book, requested: wasRequested })
        toast.error('Failed to update book')
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

  const deleteBook = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/books/${bookId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Book deleted')
        if (book?.author?.id) {
          router.visit(`/author/${book.author.id}`)
        } else {
          router.visit('/library')
        }
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
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={book.author ? `/author/${book.author.id}` : '/library'}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          {!book.hasFile && (
            <Button onClick={downloadBook} disabled={downloading}>
              {downloading ? (
                <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <HugeiconsIcon icon={Search01Icon} className="h-4 w-4 mr-2" />
              )}
              Search releases
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleWanted}>
                <HugeiconsIcon
                  icon={book.requested ? ViewOffIcon : ViewIcon}
                  className="h-4 w-4 mr-2"
                />
                {book.requested ? 'Unrequest' : 'Request'}
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
      <Head title={book.title} />

      <div className="space-y-6">
        {/* Book header */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Book cover */}
          <div className="w-full md:w-48 aspect-[2/3] md:aspect-auto md:h-72 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
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

                if (status === 'downloaded') {
                  return <StatusBadge status="downloaded" />
                }

                if (status === 'downloading') {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="default"
                            className="gap-1 cursor-pointer bg-blue-600 hover:bg-destructive text-white transition-colors group"
                            onClick={toggleWanted}
                          >
                            <HugeiconsIcon icon={Download01Icon} className="h-3 w-3 group-hover:hidden" />
                            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 hidden group-hover:block" />
                            <span className="group-hover:hidden">{Math.round(progress)}%</span>
                            <span className="hidden group-hover:inline">Cancel</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Click to cancel download</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }

                if (status === 'importing') {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="default"
                            className="gap-1 cursor-pointer bg-purple-600 hover:bg-destructive text-white transition-colors group"
                            onClick={toggleWanted}
                          >
                            <HugeiconsIcon icon={PackageMovingIcon} className="h-3 w-3 group-hover:hidden animate-pulse" />
                            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 hidden group-hover:block" />
                            <span className="group-hover:hidden">Importing</span>
                            <span className="hidden group-hover:inline">Cancel</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Processing download, click to cancel</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }

                if (toggling) {
                  return (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground gap-1">
                      <HugeiconsIcon icon={Loading01Icon} className="h-3 w-3 animate-spin" />
                      {book.requested ? 'Unrequesting...' : 'Requesting...'}
                    </Badge>
                  )
                }

                if (status === 'requested') {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="gap-1 cursor-pointer bg-yellow-600 hover:bg-destructive text-white transition-colors group"
                            onClick={toggleWanted}
                          >
                            <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3 group-hover:hidden" />
                            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 hidden group-hover:block" />
                            <span className="group-hover:hidden">Requested</span>
                            <span className="hidden group-hover:inline">Unrequest</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Click to unrequest</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }

                return null
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
              {book.publisher && (
                <div className="text-muted-foreground">{book.publisher}</div>
              )}
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
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <HugeiconsIcon icon={Book01Icon} className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium truncate max-w-md">{book.bookFile.path.split('/').pop()}</p>
                    <p className="text-sm text-muted-foreground">
                      {book.bookFile.format && `${book.bookFile.format.toUpperCase()} • `}
                      {formatFileSize(book.bookFile.size)}
                    </p>
                    <p className="text-xs text-muted-foreground/70 truncate max-w-md">
                      {book.bookFile.path}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={book.bookFile.downloadUrl} download>
                      <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteFileDialogOpen(true)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 mr-2" />
                    Delete
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
            <DialogTitle>Delete {book.title}?</DialogTitle>
            <DialogDescription>
              This will remove the book from your library. Files on disk will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteBook} disabled={deleting}>
              {deleting ? (
                <>
                  <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
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
                  <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
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
