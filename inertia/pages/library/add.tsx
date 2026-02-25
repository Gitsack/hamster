import { Head, Link, router } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  MusicNote01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface SearchResult {
  musicbrainzId: string
  name: string
  sortName: string
  disambiguation?: string
  type?: string
  country?: string
  beginDate?: string
  endDate?: string
  inLibrary: boolean
}

interface QualityProfile {
  id: string
  name: string
  minSizeMb?: number | null
  maxSizeMb?: number | null
}

export default function AddArtist() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [selectedArtist, setSelectedArtist] = useState<SearchResult | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Add form state
  const [selectedQualityProfile, setSelectedQualityProfile] = useState<string>('')
  const [monitored, setMonitored] = useState(true)
  const [adding, setAdding] = useState(false)

  // Load options on mount
  useEffect(() => {
    fetch('/api/v1/qualityprofiles')
      .then((r) => r.json())
      .then((qp) => {
        setQualityProfiles(qp)
        // Set default
        if (qp.length > 0) setSelectedQualityProfile(qp[0].id)
      })
      .catch((error) => {
        console.error('Failed to load options:', error)
        toast.error('Failed to load configuration options')
      })
      .finally(() => setLoadingOptions(false))
  }, [])

  const search = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return

    setSearching(true)
    setHasSearched(true)

    try {
      const response = await fetch(`/api/v1/artists/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      }
    } catch (error) {
      console.error('Search failed:', error)
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      search()
    }
  }

  const openAddDialog = (artist: SearchResult) => {
    setSelectedArtist(artist)
    setDialogOpen(true)
  }

  const addArtist = async () => {
    if (!selectedArtist) return
    if (!selectedQualityProfile) {
      toast.error('Please select a quality profile')
      return
    }

    setAdding(true)

    try {
      const response = await fetch('/api/v1/artists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          musicbrainzId: selectedArtist.musicbrainzId,
          qualityProfileId: selectedQualityProfile,
          monitored,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${selectedArtist.name} added to library`)
        setDialogOpen(false)

        // Update search results to mark this artist as in library
        setSearchResults((prev) =>
          prev.map((r) =>
            r.musicbrainzId === selectedArtist.musicbrainzId ? { ...r, inLibrary: true } : r
          )
        )

        // Navigate to artist page
        router.visit(`/artist/${data.id}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add artist')
      }
    } catch (error) {
      console.error('Failed to add artist:', error)
      toast.error('Failed to add artist')
    } finally {
      setAdding(false)
    }
  }

  return (
    <AppLayout
      title="Add Artist"
      actions={
        <Button variant="outline" asChild>
          <Link href="/library">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
            Back to Library
          </Link>
        </Button>
      }
    >
      <Head title="Add Artist" />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Search box */}
        <Card>
          <CardHeader>
            <CardTitle>Search MusicBrainz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                />
                <Input
                  placeholder="Search for an artist..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button onClick={search} disabled={searching || searchQuery.length < 2}>
                {searching ? <Spinner /> : 'Search'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Search for artists on MusicBrainz to add them to your library.
            </p>
          </CardContent>
        </Card>

        {/* Search results */}
        {searching ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Skeleton className="h-16 w-16 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-2">
            {searchResults.map((artist) => (
              <Card key={artist.musicbrainzId} className={artist.inLibrary ? 'opacity-60' : ''}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-16 w-16 rounded bg-muted flex-shrink-0 flex items-center justify-center">
                    <HugeiconsIcon
                      icon={MusicNote01Icon}
                      className="h-8 w-8 text-muted-foreground/50"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">
                      {artist.name}
                      {artist.disambiguation && (
                        <span className="text-muted-foreground ml-2">
                          ({artist.disambiguation})
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      {artist.type && <span>{artist.type}</span>}
                      {artist.country && (
                        <>
                          <span>•</span>
                          <span>{artist.country}</span>
                        </>
                      )}
                      {artist.beginDate && (
                        <>
                          <span>•</span>
                          <span>
                            {artist.beginDate}
                            {artist.endDate ? ` - ${artist.endDate}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {artist.inLibrary ? (
                      <Badge variant="outline" className="gap-1">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3 w-3" />
                        In Library
                      </Badge>
                    ) : (
                      <Button size="sm" onClick={() => openAddDialog(artist)}>
                        Add
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : hasSearched ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <HugeiconsIcon icon={Search01Icon} className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No artists found</h3>
              <p className="text-muted-foreground">
                Try a different search term or check your spelling.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {selectedArtist?.name}</DialogTitle>
            <DialogDescription>
              Configure how this artist will be added to your library.
            </DialogDescription>
          </DialogHeader>

          {loadingOptions ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="qualityProfile">Quality Profile</Label>
                <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                  <SelectTrigger id="qualityProfile">
                    {selectedQualityProfile ? (
                      qualityProfiles.find((p) => p.id === selectedQualityProfile)?.name
                    ) : (
                      <span className="text-muted-foreground">Select quality profile</span>
                    )}
                  </SelectTrigger>
                  <SelectPopup>
                    {qualityProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={String(profile.id)}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="monitored"
                  checked={monitored}
                  onCheckedChange={(checked) => setMonitored(checked as boolean)}
                />
                <Label htmlFor="monitored" className="font-normal cursor-pointer">
                  Automatically request new releases
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={addArtist}
              disabled={adding || loadingOptions || !selectedQualityProfile}
            >
              {adding ? (
                <>
                  <Spinner className="mr-2" />
                  Adding...
                </>
              ) : (
                'Add Artist'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
