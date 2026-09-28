import { useId, useState, type ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete01Icon, FlashIcon } from '@hugeicons/core-free-icons'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/** Full screen below md, a 32rem panel from md up — the anatomy's editor width. */
export const EDITOR_SHEET_CLASS = 'w-full sm:max-w-none md:w-[32rem] md:max-w-[32rem]'

interface EditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sentence case: "Add indexer", "Edit SABnzbd". */
  title: ReactNode
  description?: ReactNode
  /** SheetSections. */
  children: ReactNode
  /** Why the last save or test failed, above the buttons. */
  error?: ReactNode
  /** Save (or Add). */
  onSave: () => unknown
  saveLabel?: string
  saving?: boolean
  /** Disable Save without hiding it (nothing changed, a required field is empty). */
  saveDisabled?: boolean
  /** Offer Test beside Save. */
  onTest?: () => unknown
  testing?: boolean
  /** Offer Delete on the left, behind an AlertDialog. */
  onDelete?: () => unknown
  deleteConfirm?: { title: string; description: ReactNode }
}

/**
 * The settings editor: a Sheet with a header, sections that scroll under
 * sticky headings, and a footer with Delete on the left and Test / Save on the
 * right. Every settings entity (indexer, client, user) opens in one of these.
 */
export function EditorSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  error,
  onSave,
  saveLabel = 'Save',
  saving = false,
  saveDisabled = false,
  onTest,
  testing = false,
  onDelete,
  deleteConfirm,
}: EditorSheetProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const busy = saving || testing || deleting

  const runDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <SheetContent className={EDITOR_SHEET_CLASS}>
        <SheetHeader className="pr-14 pb-4">
          <SheetTitle className="truncate">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <SheetBody>
          <form
            className="space-y-6 px-6 pb-6"
            onSubmit={(event) => {
              event.preventDefault()
              if (!busy && !saveDisabled) void onSave()
            }}
          >
            {children}
            {/* Enter in a field submits; the visible Save lives in the footer. */}
            <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
          </form>
        </SheetBody>

        <SheetFooter className="flex-row flex-wrap items-center gap-2">
          {error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {error}
            </p>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(true)}
              disabled={busy}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {deleting ? <Spinner /> : <HugeiconsIcon icon={Delete01Icon} aria-hidden="true" />}
              Delete
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {onTest && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onTest()}
                disabled={busy}
              >
                {testing ? <Spinner /> : <HugeiconsIcon icon={FlashIcon} aria-hidden="true" />}
                Test
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => void onSave()}
              disabled={busy || saveDisabled}
            >
              {saving && <Spinner />}
              {saveLabel}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      {onDelete && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteConfirm?.title ?? 'Delete?'}</AlertDialogTitle>
              {deleteConfirm?.description && (
                <AlertDialogDescription>{deleteConfirm.description}</AlertDialogDescription>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: 'destructive' })}
                onClick={() => void runDelete()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Sheet>
  )
}

export interface SheetFieldControlProps {
  'id': string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * One labelled input inside an editor: label, the control, one line of help,
 * and the validation message. Optional fields say so; required ones don't
 * shout with asterisks.
 */
export function SheetField({
  label,
  help,
  error,
  optional = false,
  action,
  className,
  children,
}: {
  label: ReactNode
  help?: ReactNode
  error?: ReactNode
  optional?: boolean
  /** A small control beside the label ("Browse…"). */
  action?: ReactNode
  className?: string
  children: (props: SheetFieldControlProps) => ReactNode
}) {
  const id = useId()
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
          {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
        </label>
        {action}
      </div>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {help && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** A switch with its label and one line of description, inside an editor. */
export function SheetSwitch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium">
          {label}
        </label>
        {description && (
          <p id={`${id}-description`} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-description` : undefined}
        className="mt-0.5"
      />
    </div>
  )
}
