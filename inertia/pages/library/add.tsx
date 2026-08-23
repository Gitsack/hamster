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
        toast.error(
          'Could not load quality profiles. Reload the page, or add one in Settings → Media Management.'
        )
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
      toast.error('MusicBrainz search failed. Check network access to musicbrainz.org, then retry.')
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
      toast.error('Choose a quality profile before adding this artist.')
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
        toast.error(
          error.error || `Could not add ${selectedArtist.name} — nothing was saved. Try again.`
        )
      }
    } catch (error) {
      console.error('Failed to add artist:', error)
      toast.error(`Could not reach the server — ${selectedArtist.name} was not added.`)
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
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Search MusicBrainz for an artist"
                  placeholder="Search for an artist…"
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
            <p className="text-sm text-muted-foreground mt-3">
              Results come from MusicBrainz. Adding an artist starts tracking their releases.
            </p>
          </CardContent>
        </Card>

        {/* Search results */}
        {searching ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="py-0 gap-0">
                <CardContent className="flex items-center gap-3 p-3">
                  <Skeleton className="h-16 w-16 rounded-lg" />
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
              <Card
                key={artist.musicbrainzId}
                className={`py-0 gap-0 transition-colors duration-150 ease-out ${
                  artist.inLibrary ? 'opacity-60' : 'hover:bg-accent'
                }`}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="h-16 w-16 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
                    <HugeiconsIcon
                      icon={MusicNote01Icon}
                      className="h-6 w-6 text-muted-foreground/40"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">
                      {artist.name}
                      {artist.disambiguation && (
                        <span className="text-muted-foreground ml-2">
                          ({artist.disambiguation})
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {artist.type && <span>{artist.type}</span>}
                      {artist.country && (
                        <>
                          <span aria-hidden="true">•</span>
                          <span>{artist.country}</span>
                        </>
                      )}
                      {artist.beginDate && (
                        <>
                          <span aria-hidden="true">•</span>
                          <span className="readout">
                            {artist.beginDate}
                            {artist.endDate ? ` – ${artist.endDate}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {artist.inLibrary ? (
                      <Badge className="border-transparent bg-status-complete text-white">
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
              <div className="rounded-full bg-muted p-4 mb-4">
                <HugeiconsIcon icon={Search01Icon} className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No artists match that search</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                MusicBrainz returned nothing for this term. Check the spelling, or try the name as
                it appears on the release.
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
                  <Spinner className="h-4 w-4" />
                  Adding…
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
