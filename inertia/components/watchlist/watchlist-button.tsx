import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Bookmark01Icon, BookmarkCheck01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface WatchlistTitle {
  mediaType: 'movie' | 'tv'
  tmdbId: string
  title: string
  year?: number | null
  posterUrl?: string | null
  genres?: string[]
}

/**
 * Adds a film or show to the watchlist, or takes it off: for titles the user
 * wants but will watch elsewhere. `compact` hides the label below md, as the
 * other buttons in a detail page's header do.
 */
export function WatchlistButton({
  item,
  compact = false,
  className,
}: {
  item: WatchlistTitle
  compact?: boolean
  className?: string
}) {
  const [saved, setSaved] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const url = `/api/v1/watchlist/${item.mediaType}/${encodeURIComponent(item.tmdbId)}`

  useEffect(() => {
    let live = true
    setSaved(null)
    fetch(url)
      .then((res) => (res.ok ? res.json() : { saved: false }))
      .then((body: { saved?: boolean }) => live && setSaved(!!body.saved))
      .catch(() => live && setSaved(false))
    return () => {
      live = false
    }
  }, [url])

  const toggle = async () => {
    if (saved === null || busy) return
    const next = !saved
    setBusy(true)
    setSaved(next)
    try {
      const res = await fetch(url, {
        method: next ? 'PUT' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: next
          ? JSON.stringify({
              title: item.title,
              year: item.year ?? null,
              posterUrl: item.posterUrl ?? null,
              genres: (item.genres ?? []).slice(0, 20),
            })
          : undefined,
      })
      if (!res.ok) throw new Error(String(res.status))
      toast.success(
        next ? `${item.title} is on your watchlist` : `${item.title} removed from your watchlist`
      )
    } catch {
      setSaved(!next)
      toast.error(`The watchlist couldn't be updated. Try again.`)
    } finally {
      setBusy(false)
    }
  }

  const label = saved ? 'On watchlist' : 'Watchlist'
  return (
    <Button
      variant="outline"
      onClick={toggle}
      disabled={saved === null || busy}
      aria-pressed={!!saved}
      aria-label={saved ? 'On your watchlist — remove' : 'Add to watchlist'}
      title={saved ? 'On your watchlist — click to remove' : 'Add to your watchlist'}
      className={className}
    >
      <HugeiconsIcon
        icon={saved ? BookmarkCheck01Icon : Bookmark01Icon}
        className={cn('h-4 w-4', saved && 'text-primary')}
      />
      <span className={compact ? 'hidden md:inline' : undefined}>{label}</span>
    </Button>
  )
}
