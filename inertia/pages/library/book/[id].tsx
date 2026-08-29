import { Head, Link, router, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
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
  Delete01Icon,
  Book01Icon,
  Calendar01Icon,
  FileDownloadIcon,
  Search01Icon,
  UserIcon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { MediaHero } from '@/components/media-hero'
import { MediaSpecs } from '@/components/library/media-specs'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { MediaStatusBadge, getMediaItemStatus } from '@/components/library/media-status-badge'
import { DownloadProgressCard } from '@/components/library/download-progress-card'
import { useActiveDownloads } from '@/hooks/use_active_downloads'
import { DeleteMediaDialog } from '@/components/library/delete-media-dialog'
import { ReleaseList, type AnnotatedRelease } from '@/components/release-list'
import { MediaFileCard } from '@/components/library/media-file-card'

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
  qualityProfile: { name: string } | null
  rootFolder: { path: string } | null
  bookFile: BookFile | null
}

export default function BookDetail() {
  const { url } = usePage()
  const bookId = url.split('/').pop()

  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [searchResults, setSearchResults] = useState<AnnotatedRelease[]>([])
  const [searching, setSearching] = useState(false)
  const [grabbing, setGrabbing] = useState<string | null>(null)

  const { getForBook } = useActiveDownloads()
  const activeDownload = bookId ? getForBook(bookId) : null

  useEffect(() => {
    fetchBook()
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

  const deleteBook = async (deleteFiles: boolean) => {
    const url = deleteFiles ? `/api/v1/books/${bookId}?deleteFile=true` : `/api/v1/books/${bookId}`

    const response = await fetch(url, { method: 'DELETE' })
    if (response.ok) {
      toast.success(deleteFiles ? 'Book and files deleted' : 'Book deleted')
      router.visit('/library?tab=books')
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to delete')
    }
    setDeleteDialogOpen(false)
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

  const enrichBook = async () => {
    if (!book) return

    setEnriching(true)
    try {
      const response = await fetch(`/api/v1/books/${bookId}/enrich`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.enriched) {
          toast.success('Book enriched with OpenLibrary data')
          fetchBook()
        } else {
          toast.warning(data.message || 'No matching book found')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to enrich')
      }
    } catch (error) {
      console.error('Failed to enrich book:', error)
      toast.error('Failed to enrich book')
    } finally {
      setEnriching(false)
    }
  }

  const searchReleases = async () => {
    setSearchResults([])
    setSearching(true)
    try {
      const response = await fetch(`/api/v1/books/${bookId}/releases`)
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
          bookId: book?.id,
          indexerId: result.indexerId,
          indexerName: result.indexer,
          guid: result.id,
          replaceExisting: true,
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

  // One byte formatter for the whole page so the release table and the file row
  // line up under the Readout Rule.
  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  const deleteFile = async () => {
    if (!book) return

    const response = await fetch(`/api/v1/books/${bookId}/file`, { method: 'DELETE' })
    if (response.ok) {
      toast.success('File deleted successfully')
      setBook({ ...book, hasFile: false, bookFile: null })
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to delete file')
    }
    setDeleteFileDialogOpen(false)
  }

  if (loading) {
    return (
      <AppLayout title="Loading...">
        <Head title="Loading..." />
        <div className="space-y-6">
          <div className="flex gap-4 md:gap-6">
            <Skeleton className="w-28 sm:w-40 md:w-48 aspect-[2/3] rounded-lg shrink-0" />
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
        <EmptyState
          icon={<HugeiconsIcon icon={Book01Icon} />}
          title="Book not found"
          message="This book is no longer in your library — it may have been removed. Head back to the book library to pick another."
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={book.title}
      headerPrefix={
        <Breadcrumbs
          items={[
            { label: 'Books', href: '/library?tab=books' },
            ...(book.author
              ? [{ label: book.author.name, href: `/author/${book.author.id}` }]
              : []),
          ]}
        />
      }
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {!book.hasFile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={downloadBook} disabled={downloading}>
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
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={searchReleases} disabled={searching}>
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
              <DropdownMenuItem onClick={enrichBook} disabled={enriching}>
                <HugeiconsIcon
                  icon={Search01Icon}
                  className={`h-4 w-4 ${enriching ? 'animate-spin' : ''}`}
                />
                {enriching ? 'Refreshing...' : 'Refresh metadata'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
                Remove from Library
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <Head title={book.title} />

      <div className="space-y-6">
        <MediaHero
          title={book.title}
          posterUrl={book.coverUrl}
          posterFallback={
            <HugeiconsIcon icon={Book01Icon} className="h-16 w-16 text-muted-foreground/50" />
          }
          overview={book.overview}
        >
          <div>
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold tracking-[-0.01em]">{book.title}</h1>
              {book.releaseDate && (
                <span className="readout text-sm text-muted-foreground">
                  ({book.releaseDate.split('-')[0]})
                </span>
              )}
            </div>
            {book.author && (
              <Link
                href={`/author/${book.author.id}`}
                className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-primary hover:underline outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
                <span className="readout">{book.releaseDate}</span>
              </div>
            )}
            {book.pageCount && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={Book01Icon} className="h-4 w-4" />
                <span className="readout">{book.pageCount}</span> pages
              </div>
            )}
            {book.publisher && <div className="text-muted-foreground">{book.publisher}</div>}
            {book.seriesName && (
              <div className="text-muted-foreground">
                {book.seriesName}
                {book.seriesPosition && <span className="readout"> #{book.seriesPosition}</span>}
              </div>
            )}
          </div>

          {/* Identifiers */}
          {(book.isbn || book.isbn13) && (
            <div className="readout text-xs text-muted-foreground">
              {book.isbn13 && <span>ISBN-13 {book.isbn13}</span>}
              {book.isbn13 && book.isbn && <span> • </span>}
              {book.isbn && <span>ISBN-10 {book.isbn}</span>}
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

          <MediaSpecs
            specs={[
              { label: 'Profile', value: book.qualityProfile?.name },
              { label: 'Folder', value: book.rootFolder?.path, mono: true },
            ]}
          />
        </MediaHero>

        {activeDownload && <DownloadProgressCard downloads={[activeDownload]} />}

        {/* Search results */}
        {searchResults.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Search Results ({searchResults.length})</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchResults([])}
                aria-label="Dismiss search results"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ReleaseList
                releases={searchResults}
                loading={searching}
                grabbingId={grabbing}
                onGrab={grabRelease}
              />
            </CardContent>
          </Card>
        )}

        {/* File info */}
        {book.bookFile && (
          <MediaFileCard
            path={book.bookFile.path}
            specs={[
              { label: 'Format', value: book.bookFile.format?.toUpperCase() },
              { label: 'Size', value: formatSize(book.bookFile.size), mono: true },
            ]}
            actions={
              <>
                <Button variant="outline" size="sm" asChild aria-label="Download">
                  <a href={book.bookFile.downloadUrl} download>
                    <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteFileDialogOpen(true)}
                  aria-label="Delete"
                >
                  <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </>
            }
          />
        )}
      </div>

      <DeleteMediaDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={book.title}
        mediaType="book"
        hasFile={book.hasFile}
        mode="remove"
        onConfirm={deleteBook}
      />

      <DeleteMediaDialog
        open={deleteFileDialogOpen}
        onOpenChange={setDeleteFileDialogOpen}
        title={book.title}
        mediaType="book"
        hasFile={book.hasFile}
        mode="deleteFile"
        onConfirm={deleteFile}
      />
    </AppLayout>
  )
}
