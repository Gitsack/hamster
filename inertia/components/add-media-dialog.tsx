import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'

export type MediaType = 'artist' | 'album' | 'movie' | 'tvshow' | 'author' | 'book'

export interface QualityProfile {
  id: string
  name: string
  mediaType: string
  minSizeMb?: number | null
  maxSizeMb?: number | null
}

export interface AddMediaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mediaType: MediaType
  title: string
  description: string
  qualityProfiles: QualityProfile[]
  loading?: boolean
  adding?: boolean
  onAdd: (qualityProfileId: string, options?: { addBooks?: boolean }) => void
  // TV show specific
  episodeSelectionSummary?: React.ReactNode
  onChangeEpisodeSelection?: () => void
  // Author specific
  showAddBooksOption?: boolean
}

const mediaTypeLabels: Record<MediaType, string> = {
  artist: 'Artist',
  album: 'Album',
  movie: 'Movie',
  tvshow: 'TV Show',
  author: 'Author',
  book: 'Book',
}

export function AddMediaDialog({
  open,
  onOpenChange,
  mediaType,
  title,
  description,
  qualityProfiles,
  loading = false,
  adding = false,
  onAdd,
  episodeSelectionSummary,
  onChangeEpisodeSelection,
  showAddBooksOption = false,
}: AddMediaDialogProps) {
  const [selectedQualityProfile, setSelectedQualityProfile] = useState<string>('')
  const [addBooks, setAddBooks] = useState(true)

  // Set default profile when dialog opens
  useEffect(() => {
    if (open && qualityProfiles.length > 0) {
      setSelectedQualityProfile(qualityProfiles[0].id)
    }
  }, [open, qualityProfiles])

  const handleAdd = () => {
    if (!selectedQualityProfile) return
    onAdd(selectedQualityProfile, { addBooks })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quality Profile</Label>
              <Select value={selectedQualityProfile} onValueChange={setSelectedQualityProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="Select profile">
                    {(value: string) =>
                      qualityProfiles.find((p) => p.id === value)?.name || 'Select profile'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {qualityProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            {episodeSelectionSummary && (
              <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/50">
                {episodeSelectionSummary}
                {onChangeEpisodeSelection && (
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-2 h-auto p-0"
                    onClick={onChangeEpisodeSelection}
                  >
                    Change
                  </Button>
                )}
              </div>
            )}
            {showAddBooksOption && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="addBooks"
                  checked={addBooks}
                  onCheckedChange={(c) => setAddBooks(c as boolean)}
                />
                <Label htmlFor="addBooks" className="font-normal cursor-pointer">
                  Also add author's books
                </Label>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={adding || !selectedQualityProfile}>
            {adding && <Spinner className="mr-2" />}
            Add {mediaTypeLabels[mediaType]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
