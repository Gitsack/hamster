import { useCallback, useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Bookmark01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ProviderBadges, type ForYouCard } from '@/components/dashboard/for-you-deck'
import {
  TitleMeta,
  TitleName,
  TitlePoster,
  type TitleItem,
} from '@/components/watchlist/title-list'

/** What ProviderBadges needs of a card; the rest of a deck card doesn't apply here. */
const asCard = (item: TitleItem): ForYouCard => ({
  key: item.key,
  mediaType: item.mediaType,
  externalId: item.externalId,
  title: item.title ?? '',
  year: item.year,
  subtitle: null,
  overview: null,
  posterUrl: item.posterUrl,
  backdropUrl: null,
  rating: null,
  genres: item.genres,
  reason: '',
  score: 0,
})

export default function WatchlistPage() {
  const [items, setItems] = useState<TitleItem[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/watchlist')
      if (!res.ok) throw new Error(String(res.status))
      const body: { items: TitleItem[] } = await res.json()
      setItems(body.items)
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (item: TitleItem) => {
    setItems((prev) => prev?.filter((i) => i.key !== item.key) ?? prev)
    const res = await fetch(
      `/api/v1/watchlist/${item.mediaType}/${encodeURIComponent(item.externalId)}`,
      { method: 'DELETE' }
    ).catch(() => null)
    if (!res?.ok) {
      toast.error(`${item.title ?? 'That title'} couldn't be removed. Try again.`)
      load()
    }
  }

  return (
    <AppLayout title="Watchlist">
      <Head title="Watchlist" />
      {error && !items ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">The watchlist couldn't be loaded.</p>
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      ) : !items ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<HugeiconsIcon icon={Bookmark01Icon} />}
          title="Nothing on your watchlist"
          message="Add films and shows you want to watch elsewhere: from a title's preview or page, or with Save on the dashboard deck."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <li key={item.key} className="flex min-w-0 flex-col gap-2">
              <div className="relative">
                <TitlePoster item={item} />
                <ProviderBadges card={asCard(item)} />
              </div>
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <TitleName item={item} />
                  <TitleMeta item={item} />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-mt-1 -mr-2 shrink-0 text-muted-foreground"
                  onClick={() => remove(item)}
                  aria-label={`Remove ${item.title ?? 'title'} from the watchlist`}
                  title="Remove from the watchlist"
                >
                  <HugeiconsIcon icon={Cancel01Icon} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  )
}
