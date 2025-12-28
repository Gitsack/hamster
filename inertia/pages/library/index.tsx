import { Head, Link, router } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Search01Icon,
  GridIcon,
  Menu01Icon,
  FilterIcon,
  SortingIcon,
  MusicNote01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'

interface Artist {
  id: number
  name: string
  sortName: string
  musicbrainzId: string | null
  status: string
  artistType: string | null
  imageUrl: string | null
  monitored: boolean
  albumCount: number
  qualityProfile: { id: number; name: string } | null
  metadataProfile: { id: number; name: string } | null
}

type ViewMode = 'grid' | 'list'
type SortBy = 'name' | 'recent' | 'albums'

export default function Library() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('name')

  useEffect(() => {
    fetchArtists()
  }, [])

  const fetchArtists = async () => {
    try {
      const response = await fetch('/api/v1/artists')
      if (response.ok) {
        const data = await response.json()
        setArtists(data)
      }
    } catch (error) {
      console.error('Failed to fetch artists:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredArtists = artists
    .filter((artist) =>
      artist.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return b.id - a.id
        case 'albums':
          return Number(b.albumCount) - Number(a.albumCount)
        default:
          return (a.sortName || a.name).localeCompare(b.sortName || b.name)
      }
    })

  return (
    <AppLayout
      title="Library"
      actions={
        <Button asChild>
          <Link href="/library/add">
            <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
            Add Artist
          </Link>
        </Button>
      }
    >
      <Head title="Library" />

      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              placeholder="Filter artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <HugeiconsIcon icon={SortingIcon} className="h-4 w-4 mr-2" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('name')}>
                  Name {sortBy === 'name' && '(active)'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('recent')}>
                  Recently Added {sortBy === 'recent' && '(active)'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('albums')}>
                  Album Count {sortBy === 'albums' && '(active)'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <HugeiconsIcon icon={GridIcon} className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <HugeiconsIcon icon={Menu01Icon} className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Artist grid/list */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square" />
                <CardContent className="p-3">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredArtists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <HugeiconsIcon
                icon={MusicNote01Icon}
                className="h-12 w-12 text-muted-foreground"
              />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? 'No artists found' : 'Your library is empty'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'Try a different search term'
                : 'Get started by adding your first artist'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/library/add">
                  <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
                  Add Artist
                </Link>
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredArtists.map((artist) => (
              <Link key={artist.id} href={`/artist/${artist.id}`}>
                <Card className="overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer group">
                  <div className="aspect-square bg-muted relative">
                    {artist.imageUrl ? (
                      <img
                        src={artist.imageUrl}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <HugeiconsIcon
                          icon={MusicNote01Icon}
                          className="h-16 w-16 text-muted-foreground/50"
                        />
                      </div>
                    )}
                    {!artist.monitored && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary">Unmonitored</Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                      {artist.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {artist.albumCount} {Number(artist.albumCount) === 1 ? 'album' : 'albums'}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredArtists.map((artist) => (
              <Link key={artist.id} href={`/artist/${artist.id}`}>
                <Card className="hover:ring-2 hover:ring-primary transition-all cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-16 w-16 rounded bg-muted flex-shrink-0 overflow-hidden">
                      {artist.imageUrl ? (
                        <img
                          src={artist.imageUrl}
                          alt={artist.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <HugeiconsIcon
                            icon={MusicNote01Icon}
                            className="h-8 w-8 text-muted-foreground/50"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{artist.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {artist.albumCount} {Number(artist.albumCount) === 1 ? 'album' : 'albums'}
                        {artist.artistType && ` • ${artist.artistType}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!artist.monitored && (
                        <Badge variant="secondary">Unmonitored</Badge>
                      )}
                      {artist.qualityProfile && (
                        <Badge variant="outline">{artist.qualityProfile.name}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Stats bar */}
        {!loading && artists.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {filteredArtists.length} of {artists.length} artists
          </div>
        )}
      </div>
    </AppLayout>
  )
}
