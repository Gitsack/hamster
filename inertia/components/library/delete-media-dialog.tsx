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
import { Spinner } from '@/components/ui/spinner'

type DeleteMode = 'remove' | 'deleteFile'

interface DeleteMediaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Display name of the item being deleted */
  title: string
  /** Media type label for messaging (e.g. "movie", "book", "episode", "author", "album") */
  mediaType: string
  /** Whether the item has files on disk */
  hasFile: boolean
  /** Mode: 'remove' = remove item from library, 'deleteFile' = delete file only (item stays) */
  mode: DeleteMode
  /** Called when user confirms deletion. `deleteFiles` indicates whether to also delete files from disk. */
  onConfirm: (deleteFiles: boolean) => Promise<void>
}

export function DeleteMediaDialog({
  open,
  onOpenChange,
  title,
  mediaType,
  hasFile,
  mode,
  onConfirm,
}: DeleteMediaDialogProps) {
  const [loading, setLoading] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(hasFile && mode === 'remove')

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm(mode === 'deleteFile' ? true : deleteFiles)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setDeleteFiles(hasFile && mode === 'remove')
      }
    }
  }

  if (mode === 'deleteFile') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {mediaType} file?</DialogTitle>
            <DialogDescription>
              This permanently deletes the file for &ldquo;{title}&rdquo; from disk. The {mediaType}{' '}
              stays in your library and stays monitored, so the next search can grab it again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
              {loading ? (
                <>
                  <Spinner />
                  Deleting...
                </>
              ) : (
                'Delete File'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // 'remove' mode
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {hasFile ? `Remove ${mediaType} from library?` : `Delete ${title}?`}
          </DialogTitle>
          <DialogDescription>
            {hasFile
              ? `Removes “${title}” from your library and stops monitoring it. Files on disk are kept unless you tick the box below.`
              : `Removes “${title}” from your library and stops monitoring it. Nothing is on disk yet, so nothing is deleted. You can add it again from Search at any time.`}
          </DialogDescription>
        </DialogHeader>
        {hasFile && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={deleteFiles}
              onCheckedChange={(checked) => setDeleteFiles(checked === true)}
            />
            <span className="text-sm">Also delete files from disk</span>
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <Spinner />
                Deleting...
              </>
            ) : deleteFiles ? (
              'Delete Files & Remove'
            ) : (
              'Remove'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
