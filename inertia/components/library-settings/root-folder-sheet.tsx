import { useEffect, useId, useState } from 'react'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EDITOR_SHEET_CLASS } from '@/components/settings/editor-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { FolderBrowser } from '@/components/folder-browser'
import { SheetSection } from '@/components/settings/field-group'
import { send } from '@/components/system/system_api'
import { MEDIA_TYPE_INFO, type MediaType, type RootFolder } from './library_catalog'

interface RootFolderSheetProps {
  /** The type being edited; null closes the sheet. */
  mediaType: MediaType | null
  /** Its current folder, when it has one. */
  folder: RootFolder | null
  onOpenChange: (open: boolean) => void
  /** After a successful save, so the page can refetch folders. */
  onSaved: (folder: RootFolder | null) => void
}

/**
 * Pick the folder a media type owns. Inside Docker this is the container's
 * path, which is why the browser walks the server's filesystem rather than
 * taking a typed guess on trust.
 */
export function RootFolderSheet({
  mediaType,
  folder,
  onOpenChange,
  onSaved,
}: RootFolderSheetProps) {
  const nameId = useId()
  const [path, setPath] = useState('')
  const [name, setName] = useState('')
  const [createIfMissing, setCreateIfMissing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Keep the last type while the sheet animates closed, so the title doesn't blank.
  const [shownType, setShownType] = useState<MediaType>(mediaType ?? 'movies')

  useEffect(() => {
    if (!mediaType) return
    setShownType(mediaType)
    setPath(folder?.path ?? '')
    setName(folder?.name ?? '')
    setCreateIfMissing(false)
    setError(null)
    setSaving(false)
  }, [mediaType, folder])

  const info = MEDIA_TYPE_INFO[shownType]
  const editing = folder !== null

  const submit = async () => {
    if (saving || !mediaType) return
    if (!path.trim()) {
      setError('Pick a folder first: the library needs somewhere to look.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = { path: path.trim(), name: name.trim() || undefined, mediaType }
      const saved = editing
        ? await send<RootFolder>(`/api/v1/rootfolders/${folder.id}`, 'PUT', body)
        : await send<RootFolder>('/api/v1/rootfolders', 'POST', { ...body, createIfMissing })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The folder was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={mediaType !== null} onOpenChange={(open) => !saving && onOpenChange(open)}>
      <SheetContent className={EDITOR_SHEET_CLASS}>
        <SheetHeader className="pr-14 pb-4">
          <SheetTitle>
            {editing ? 'Change' : 'Set'} {info.noun} folder
          </SheetTitle>
          <SheetDescription>
            Hamster scans it for {info.noun} and imports into it. Inside Docker, use the container
            path.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="space-y-6 px-6 pb-6">
            <SheetSection title="Folder">
              <FolderBrowser
                value={path}
                onChange={(next) => {
                  setPath(next)
                  if (error) setError(null)
                }}
                createIfMissing={createIfMissing}
                onCreateIfMissingChange={editing ? undefined : setCreateIfMissing}
              />
            </SheetSection>
            <SheetSection title="Name">
              <div className="space-y-1.5">
                <label htmlFor={nameId} className="block text-sm font-medium">
                  Display name <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id={nameId}
                  placeholder={`${info.label} library`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-describedby={`${nameId}-help`}
                />
                <p id={`${nameId}-help`} className="text-xs text-muted-foreground">
                  Shown instead of the raw path where the folder is mentioned.
                </p>
              </div>
            </SheetSection>
          </div>
        </SheetBody>

        <SheetFooter className="flex-row flex-wrap items-center gap-2">
          {error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submit()}
              disabled={saving || !path}
            >
              {saving && <Spinner />}
              Save
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
