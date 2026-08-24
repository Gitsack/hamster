import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

interface ReplaceFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What is being replaced, e.g. "Blade Runner 2049" or "Season 2 (10 episodes)". */
  subject: string
  /** Optional line describing what is on disk today. */
  currentSummary?: string | null
  loading?: boolean
  onConfirm: (options: { blacklistCurrent: boolean }) => void
}

/**
 * Confirm a re-download.
 *
 * The blacklist option is on by default and that is the whole point: asking for
 * a replacement almost always means "not this copy", and without blacklisting
 * the search is free to hand back the very release being rejected.
 */
export function ReplaceFileDialog({
  open,
  onOpenChange,
  subject,
  currentSummary,
  loading = false,
  onConfirm,
}: ReplaceFileDialogProps) {
  const [blacklistCurrent, setBlacklistCurrent] = useState(true)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace {subject}</DialogTitle>
          <DialogDescription>
            Hamster searches for a better release and imports it over the current file. The existing
            file stays in place until the replacement has been downloaded and imported.
          </DialogDescription>
        </DialogHeader>

        {currentSummary && (
          <p className="readout rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            On disk now: {currentSummary}
          </p>
        )}

        <div className="flex items-start gap-2">
          <Checkbox
            id="blacklist-current"
            checked={blacklistCurrent}
            onCheckedChange={(checked) => setBlacklistCurrent(checked === true)}
          />
          <div className="space-y-1">
            <Label htmlFor="blacklist-current" className="cursor-pointer font-normal">
              Don't offer the current release again
            </Label>
            <p className="text-xs text-muted-foreground">
              Blacklists the release this file came from, so the search has to find something else.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm({ blacklistCurrent })}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <Spinner className="size-4" />
                Searching…
              </>
            ) : (
              'Search & replace'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
