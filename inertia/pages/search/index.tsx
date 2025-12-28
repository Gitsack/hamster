import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Download01Icon,
  Loading01Icon,
  Link01Icon,
  SortingIcon,
  Settings02Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react'
import { toast } from 'sonner'

// Error boundary to catch rendering errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Search page error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-500 rounded bg-red-50 text-red-900">
          <h2 className="font-bold">Something went wrong</h2>
          <pre className="text-sm mt-2 whitespace-pre-wrap">{this.state.error?.message}</pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-3 py-1 bg-red-500 text-white rounded"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface SearchResult {
  id: string
  title: string
  size: number
  publishDate: string
  indexer: string
  indexerId: number
  downloadUrl: string
  infoUrl?: string
  guid: string
  category?: string
  seeders?: number
  leechers?: number
  grabs?: number
  protocol?: 'usenet' | 'torrent'
}

interface Indexer {
  id: number
  name: string
  enabled: boolean
}

interface DownloadClient {
  id: number
  name: string
  type: string
  enabled: boolean
}

type SortField = 'age' | 'title' | 'size' | 'indexer' | 'grabs' | 'category'
type SortDirection = 'asc' | 'desc'

interface ColumnConfig {
  id: string
  label: string
  visible: boolean
}

const defaultColumns: ColumnConfig[] = [
  { id: 'select', label: 'Select', visible: true },
  { id: 'protocol', label: 'Protocol', visible: true },
  { id: 'age', label: 'Age', visible: true },
  { id: 'title', label: 'Title', visible: true },
  { id: 'indexer', label: 'Indexer', visible: true },
  { id: 'size', label: 'Size', visible: true },
  { id: 'grabs', label: 'Grabs', visible: true },
  { id: 'category', label: 'Category', visible: true },
  { id: 'actions', label: 'Actions', visible: true },
]

const categoryOptions = [
  { value: '3000', label: 'Audio' },
  { value: '3010', label: 'Audio/MP3' },
  { value: '3020', label: 'Audio/Video' },
  { value: '3030', label: 'Audio/Audiobook' },
  { value: '3040', label: 'Audio/Lossless' },
  { value: '3050', label: 'Audio/Other' },
  { value: '3060', label: 'Audio/Foreign' },
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatAge(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day'
    if (diffDays < 7) return `${diffDays} days`
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return `${weeks} week${weeks > 1 ? 's' : ''}`
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `${months} month${months > 1 ? 's' : ''}`
    }
    const years = Math.floor(diffDays / 365)
    return `${years} year${years > 1 ? 's' : ''}`
  } catch {
    return dateString
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Filters
  const [indexers, setIndexers] = useState<Indexer[]>([])
  const [selectedIndexers, setSelectedIndexers] = useState<number[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Sorting
  const [sortField, setSortField] = useState<SortField>('age')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Columns
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns)

  // Selection
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set())

  // Download
  const [downloadClients, setDownloadClients] = useState<DownloadClient[]>([])
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [bulkDownloading, setBulkDownloading] = useState(false)

  // Load indexers and download clients
  useEffect(() => {
    fetch('/api/v1/indexers')
      .then((r) => r.json())
      .then((data) => setIndexers(data.filter((i: Indexer) => i.enabled)))
      .catch(console.error)

    fetch('/api/v1/downloadclients')
      .then((r) => r.json())
      .then((data) => setDownloadClients(data.filter((c: DownloadClient) => c.enabled)))
      .catch(console.error)
  }, [])

  // Sorted and filtered results
  const filteredResults = useMemo(() => {
    let results = [...searchResults]

    // Filter by category
    if (selectedCategories.length > 0) {
      results = results.filter((r) => {
        if (!r.category) return false
        return selectedCategories.some((cat) => r.category?.includes(cat))
      })
    }

    // Sort
    results.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'age':
          comparison = new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime()
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'indexer':
          comparison = a.indexer.localeCompare(b.indexer)
          break
        case 'grabs':
          comparison = (a.grabs || 0) - (b.grabs || 0)
          break
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '')
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return results
  }, [searchResults, selectedCategories, sortField, sortDirection])

  const search = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return

    setSearching(true)
    setHasSearched(true)
    setSelectedResults(new Set())

    try {
      const params = new URLSearchParams({
        query: searchQuery,
        limit: '100',
        type: 'general', // Use general search like Prowlarr (no music filter, no dedup)
      })
      if (selectedIndexers.length > 0) {
        params.set('indexerIds', selectedIndexers.join(','))
      }

      const response = await fetch(`/api/v1/indexers/search?${params}`)

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        toast.error('Search failed')
      }
    } catch (error) {
      console.error('Search failed:', error)
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      search()
    }
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const toggleColumn = (columnId: string) => {
    setColumns(
      columns.map((col) => (col.id === columnId ? { ...col, visible: !col.visible } : col))
    )
  }

  const toggleSelectAll = () => {
    if (selectedResults.size === filteredResults.length) {
      setSelectedResults(new Set())
    } else {
      setSelectedResults(new Set(filteredResults.map((r) => r.id)))
    }
  }

  const toggleSelectResult = (id: string) => {
    const newSelected = new Set(selectedResults)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedResults(newSelected)
  }

  const isColumnVisible = (id: string) => columns.find((c) => c.id === id)?.visible ?? true

  const openDownloadDialog = (result: SearchResult) => {
    setSelectedResult(result)
    setDownloadDialogOpen(true)
  }

  const grabRelease = async (result?: SearchResult) => {
    const toGrab = result || selectedResult
    if (!toGrab) return

    if (downloadClients.length === 0) {
      toast.error('No download client configured. Go to Settings > Download Clients to add one.')
      return
    }

    setDownloading(true)

    try {
      const response = await fetch('/api/v1/queue/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: toGrab.title,
          downloadUrl: toGrab.downloadUrl,
          size: toGrab.size,
          indexerId: toGrab.indexerId,
          indexerName: toGrab.indexer,
          guid: toGrab.guid,
        }),
      })

      if (response.ok) {
        toast.success(`Added "${toGrab.title}" to download queue`)
        setDownloadDialogOpen(false)
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to grab release')
        return false
      }
    } catch (error) {
      console.error('Failed to grab release:', error)
      toast.error('Failed to grab release')
      return false
    } finally {
      setDownloading(false)
    }
  }

  const grabSelected = async () => {
    if (selectedResults.size === 0) return

    setBulkDownloading(true)
    let successCount = 0
    let failCount = 0

    for (const id of selectedResults) {
      const result = filteredResults.find((r) => r.id === id)
      if (result) {
        try {
          const response = await fetch('/api/v1/queue/grab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: result.title,
              downloadUrl: result.downloadUrl,
              size: result.size,
              indexerId: result.indexerId,
              indexerName: result.indexer,
              guid: result.guid,
            }),
          })

          if (response.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch {
          failCount++
        }
      }
    }

    setBulkDownloading(false)

    if (successCount > 0) {
      toast.success(`Added ${successCount} release${successCount > 1 ? 's' : ''} to download queue`)
    }
    if (failCount > 0) {
      toast.error(`Failed to grab ${failCount} release${failCount > 1 ? 's' : ''}`)
    }

    setSelectedResults(new Set())
  }

  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField
    children: React.ReactNode
  }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field &&
          (sortDirection === 'asc' ? (
            <HugeiconsIcon icon={ArrowUp01Icon} className="h-3 w-3" />
          ) : (
            <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3" />
          ))}
      </div>
    </TableHead>
  )

  return (
    <ErrorBoundary>
      <AppLayout title="Search">
        <Head title="Search" />

        <div className="space-y-4">
        {/* Search and filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              {/* Search row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <HugeiconsIcon
                    icon={Search01Icon}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  />
                  <Input
                    placeholder="Search for music, albums, compilations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <Button onClick={search} disabled={searching || searchQuery.length < 2}>
                  {searching ? (
                    <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={Search01Icon} className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Indexers:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {selectedIndexers.length === 0
                          ? 'All'
                          : `${selectedIndexers.length} selected`}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <div className="px-2 py-1.5 text-sm font-medium">Select Indexers</div>
                      <DropdownMenuSeparator />
                      {indexers.map((indexer) => (
                        <DropdownMenuCheckboxItem
                          key={indexer.id}
                          checked={selectedIndexers.includes(indexer.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIndexers([...selectedIndexers, indexer.id])
                            } else {
                              setSelectedIndexers(selectedIndexers.filter((id) => id !== indexer.id))
                            }
                          }}
                        >
                          {indexer.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                      {selectedIndexers.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSelectedIndexers([])}>
                            Clear selection
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Categories:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {selectedCategories.length === 0
                          ? 'All'
                          : `${selectedCategories.length} selected`}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <div className="px-2 py-1.5 text-sm font-medium">Filter by Category</div>
                      <DropdownMenuSeparator />
                      {categoryOptions.map((cat) => (
                        <DropdownMenuCheckboxItem
                          key={cat.value}
                          checked={selectedCategories.includes(cat.label)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCategories([...selectedCategories, cat.label])
                            } else {
                              setSelectedCategories(
                                selectedCategories.filter((c) => c !== cat.label)
                              )
                            }
                          }}
                        >
                          {cat.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                      {selectedCategories.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSelectedCategories([])}>
                            Clear selection
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {/* Sort dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <HugeiconsIcon icon={SortingIcon} className="h-4 w-4 mr-1" />
                        Sort
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <div className="px-2 py-1.5 text-sm font-medium">Sort by</div>
                      <DropdownMenuSeparator />
                      {[
                        { field: 'age', label: 'Age' },
                        { field: 'title', label: 'Title' },
                        { field: 'size', label: 'Size' },
                        { field: 'indexer', label: 'Indexer' },
                        { field: 'grabs', label: 'Grabs' },
                        { field: 'category', label: 'Category' },
                      ].map(({ field, label }) => (
                        <DropdownMenuItem
                          key={field}
                          onClick={() => toggleSort(field as SortField)}
                        >
                          <span className="flex-1">{label}</span>
                          {sortField === field && (
                            <HugeiconsIcon
                              icon={sortDirection === 'asc' ? ArrowUp01Icon : ArrowDown01Icon}
                              className="h-4 w-4 ml-2"
                            />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Columns dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <HugeiconsIcon icon={Settings02Icon} className="h-4 w-4 mr-1" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <div className="px-2 py-1.5 text-sm font-medium">Show Columns</div>
                      <DropdownMenuSeparator />
                      {columns.map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col.id}
                          checked={col.visible}
                          onCheckedChange={() => toggleColumn(col.id)}
                        >
                          {col.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected actions bar */}
        {selectedResults.size > 0 && (
          <Card>
            <CardContent className="py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedResults.size} release{selectedResults.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedResults(new Set())}>
                  Clear selection
                </Button>
                <Button size="sm" onClick={grabSelected} disabled={bulkDownloading}>
                  {bulkDownloading ? (
                    <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <HugeiconsIcon icon={Download01Icon} className="h-4 w-4 mr-2" />
                  )}
                  Grab Selected
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search results */}
        {searching ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-6 w-12 rounded" />
                    <Skeleton className="h-4 w-16" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : filteredResults.length > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-4">
                Found {filteredResults.length} results
                {selectedCategories.length > 0 &&
                  ` (filtered from ${searchResults.length})`}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isColumnVisible('select') && (
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={
                              selectedResults.size === filteredResults.length &&
                              filteredResults.length > 0
                            }
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                      )}
                      {isColumnVisible('protocol') && (
                        <TableHead className="w-[60px]">Type</TableHead>
                      )}
                      {isColumnVisible('age') && <SortableHeader field="age">Age</SortableHeader>}
                      {isColumnVisible('title') && (
                        <SortableHeader field="title">Title</SortableHeader>
                      )}
                      {isColumnVisible('indexer') && (
                        <SortableHeader field="indexer">Indexer</SortableHeader>
                      )}
                      {isColumnVisible('size') && (
                        <SortableHeader field="size">Size</SortableHeader>
                      )}
                      {isColumnVisible('grabs') && (
                        <SortableHeader field="grabs">Grabs</SortableHeader>
                      )}
                      {isColumnVisible('category') && (
                        <SortableHeader field="category">Category</SortableHeader>
                      )}
                      {isColumnVisible('actions') && (
                        <TableHead className="w-[80px]">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map((result) => (
                      <TableRow
                        key={result.id}
                        className={selectedResults.has(result.id) ? 'bg-muted/50' : ''}
                      >
                        {isColumnVisible('select') && (
                          <TableCell>
                            <Checkbox
                              checked={selectedResults.has(result.id)}
                              onCheckedChange={() => toggleSelectResult(result.id)}
                            />
                          </TableCell>
                        )}
                        {isColumnVisible('protocol') && (
                          <TableCell>
                            <Badge
                              variant={result.protocol === 'torrent' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {result.protocol === 'torrent' ? 'torrent' : 'nzb'}
                            </Badge>
                          </TableCell>
                        )}
                        {isColumnVisible('age') && (
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {formatAge(result.publishDate)}
                          </TableCell>
                        )}
                        {isColumnVisible('title') && (
                          <TableCell>
                            <div
                              className="font-medium truncate max-w-md cursor-pointer hover:text-primary"
                              title={result.title}
                              onClick={() => openDownloadDialog(result)}
                            >
                              {result.title}
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible('indexer') && (
                          <TableCell>
                            <span className="text-muted-foreground">{result.indexer}</span>
                          </TableCell>
                        )}
                        {isColumnVisible('size') && (
                          <TableCell className="whitespace-nowrap">
                            {formatBytes(result.size)}
                          </TableCell>
                        )}
                        {isColumnVisible('grabs') && (
                          <TableCell className="text-muted-foreground">
                            {result.grabs ?? '-'}
                          </TableCell>
                        )}
                        {isColumnVisible('category') && (
                          <TableCell>
                            {result.category && (
                              <Badge variant="outline" className="text-xs">
                                {result.category}
                              </Badge>
                            )}
                          </TableCell>
                        )}
                        {isColumnVisible('actions') && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {result.infoUrl && (
                                <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                                  <a href={result.infoUrl} target="_blank" rel="noopener noreferrer">
                                    <HugeiconsIcon icon={Link01Icon} className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDownloadDialog(result)}
                                className="h-8 w-8"
                              >
                                <HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : hasSearched ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <HugeiconsIcon icon={Search01Icon} className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No results found</h3>
              <p className="text-muted-foreground">
                Try a different search term or check your indexer configuration.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Download confirmation dialog */}
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download Release</DialogTitle>
            <DialogDescription>Send this release to your download client?</DialogDescription>
          </DialogHeader>

          {selectedResult && (
            <div className="py-4 space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Title</div>
                <div className="font-medium">{selectedResult.title}</div>
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Size</div>
                  <div>{formatBytes(selectedResult.size)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Indexer</div>
                  <div>{selectedResult.indexer}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Age</div>
                  <div>{formatAge(selectedResult.publishDate)}</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => grabRelease()} disabled={downloading}>
              {downloading ? (
                <>
                  <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin mr-2" />
                  Downloading...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Download01Icon} className="h-4 w-4 mr-2" />
                  Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </AppLayout>
    </ErrorBoundary>
  )
}
