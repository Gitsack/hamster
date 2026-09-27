import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetBody,
  SheetContent,
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
import {
  TitleMeta,
  TitleName,
  TitlePoster,
  type TitleItem,
} from '@/components/watchlist/title-list'

/**
 * The titles skipped on the deck, to bring one back after a mistaken swipe
 * or a change of mind. Removing a skip lets the title return to the deck.
 */
export function SkippedSheet({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Something was brought back: the deck may want to rebuild. */
  onChanged?: () => void
}) {
  const [items, setItems] = useState<TitleItem[] | null>(null)
  const [error, setError] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/for-you/lists/skipped')
      if (!res.ok) throw new Error(String(res.status))
      const body: { items: TitleItem[] } = await res.json()
      setItems(body.items)
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const remove = async (item: TitleItem) => {
    setItems((prev) => prev?.filter((i) => i.key !== item.key) ?? prev)
    const res = await fetch(
      `/api/v1/for-you/feedback/${item.mediaType}/${encodeURIComponent(item.externalId)}`,
      { method: 'DELETE' }
    ).catch(() => null)
    if (!res?.ok) {
      toast.error(`${item.title ?? 'That title'} couldn't be brought back. Try again.`)
      load()
      return
    }
    onChanged?.()
  }

  const clear = async () => {
    const before = items
    setItems([])
    const res = await fetch('/api/v1/for-you/lists/skipped', { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) {
      setItems(before)
      toast.error("The skips couldn't be cleared. Try again.")
      return
    }
    onChanged?.()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader className="pr-12">
          <SheetTitle>Skipped</SheetTitle>
        </SheetHeader>
        <SheetBody className="px-6 pb-6">
          {error && !items ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">The skips couldn't be loaded.</p>
              <Button variant="outline" size="sm" onClick={load}>
                Try again
              </Button>
            </div>
          ) : !items ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 rounded-md" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nothing skipped.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.key} className="flex items-center gap-3 py-2">
                  <TitlePoster item={item} className="w-10 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <TitleName item={item} />
                    <TitleMeta item={item} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(item)}>
                    Bring back
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SheetBody>
        {items && items.length > 0 && (
          <SheetFooter>
            <Button variant="outline" onClick={() => setConfirming(true)}>
              <HugeiconsIcon icon={Delete02Icon} />
              Clear all
            </Button>
          </SheetFooter>
        )}

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all skips?</AlertDialogTitle>
              <AlertDialogDescription>
                All {items?.length ?? 0} skipped titles can show up in the deck again. Your
                watchlist and requests are kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirming(false)
                  clear()
                }}
              >
                Clear all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
