import { useCallback, useEffect, useState } from 'react'
import { Head, Link } from '@inertiajs/react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Bookmark01Icon,
  Book01Icon,
  CdIcon,
  Cancel01Icon,
  Delete02Icon,
  Film01Icon,
  Tv01Icon,
} from '@hugeicons/core-free-icons'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { ProviderBadges, type ForYouCard } from '@/components/dashboard/for-you-deck'
import { useMediaPreview } from '@/contexts/media_preview_context'

type ListName = 'watchlist' | 'skipped'
type MediaType = ForYouCard['mediaType']

interface ListItem {
  key: string
  mediaType: MediaType
  externalId: string
  title: string | null
  year: number | null
  posterUrl: string | null
  genres: string[]
  createdAt: string
}

const TYPE_META: Record<MediaType, { label: string; icon: typeof Film01Icon }> = {
  movie: { label: 'Movie', icon: Film01Icon },
  tv: { label: 'Series', icon: Tv01Icon },
  album: { label: 'Album', icon: CdIcon },
  book: { label: 'Book', icon: Book01Icon },
}

/** What ProviderBadges needs of a card; the rest of a deck card doesn't apply here. */
const asCard = (item: ListItem): ForYouCard => ({
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

function useList(list: ListName) {
  const [items, setItems] = useState<ListItem[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/for-you/lists/${list}`)
      if (!res.ok) throw new Error(String(res.status))
      const body: { items: ListItem[] } = await res.json()
      setItems(body.items)
      setError(false)
    } catch {
      setError(true)
    }
  }, [list])

  useEffect(() => {
    load()
  }, [load])

  /** Forget one title: it can come back in the deck, and its genres stop counting. */
  const remove = async (item: ListItem) => {
    setItems((prev) => prev?.filter((i) => i.key !== item.key) ?? prev)
    const res = await fetch(
      `/api/v1/for-you/feedback/${item.mediaType}/${encodeURIComponent(item.externalId)}`,
      { method: 'DELETE' }
    ).catch(() => null)
    if (!res?.ok) {
      toast.error(`${item.title ?? 'That title'} couldn't be removed. Try again.`)
      load()
    }
  }

  const clear = async () => {
    const before = items
    setItems([])
    const res = await fetch(`/api/v1/for-you/lists/${list}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) {
      setItems(before)
      toast.error("The list couldn't be cleared. Try again.")
    }
  }

  return { items, error, remove, clear, reload: load }
}

function Poster({ item, className }: { item: ListItem; className?: string }) {
  const [broken, setBroken] = useState(false)
  const meta = TYPE_META[item.mediaType]
  const square = item.mediaType === 'album'
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-muted ${square ? 'aspect-square' : 'aspect-[2/3]'} ${className ?? ''}`}
    >
      {item.posterUrl && !broken ? (
        <img
          src={item.posterUrl}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <HugeiconsIcon icon={meta.icon} className="size-8" />
        </div>
      )}
    </div>
  )
}

/** Where a title's details live: the preview sheet for TMDB titles, the library page otherwise. */
function useOpen() {
  const { openMoviePreview, openTvShowPreview } = useMediaPreview()
  return (item: ListItem) => {
    if (item.mediaType === 'movie') openMoviePreview(item.externalId)
    else if (item.mediaType === 'tv') openTvShowPreview(item.externalId)
  }
}

function libraryHref(item: ListItem): string | null {
  if (item.mediaType === 'album' && !item.externalId.startsWith('new:'))
    return `/album/${item.externalId}`
  if (item.mediaType === 'book') return `/book/${item.externalId}`
  return null
}

function ItemTitle({ item, open }: { item: ListItem; open: (item: ListItem) => void }) {
  const title = item.title ?? 'Untitled'
  const cls =
    'text-left text-sm font-medium leading-snug underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50'
  const href = libraryHref(item)
  if (item.mediaType === 'movie' || item.mediaType === 'tv') {
    return (
      <button type="button" className={cls} onClick={() => open(item)}>
        {title}
      </button>
    )
  }
  return href ? (
    <Link href={href} className={cls}>
      {title}
    </Link>
  ) : (
    <span className="text-sm font-medium leading-snug">{title}</span>
  )
}

function Meta({ item }: { item: ListItem }) {
  const meta = TYPE_META[item.mediaType]
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <HugeiconsIcon icon={meta.icon} className="size-3.5 shrink-0" />
      <span>{meta.label}</span>
      {item.year && (
        <>
          <span aria-hidden="true">·</span>
          <span className="readout">{item.year}</span>
        </>
      )}
    </p>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="aspect-[2/3] rounded-md" />
      ))}
    </div>
  )
}

function Watchlist() {
  const { items, error, remove, reload } = useList('watchlist')
  const open = useOpen()

  if (error && !items) return <LoadError onRetry={reload} />
  if (!items) return <LoadingGrid />
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<HugeiconsIcon icon={Bookmark01Icon} />}
        title="Nothing saved yet"
        message="Save a pick on the dashboard deck — with ↑ or the Save button — when you want it but won't request it here, say because it streams on a service you have."
      />
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0 flex-col gap-2">
          <div className="relative">
            <Poster item={item} />
            <ProviderBadges card={asCard(item)} />
          </div>
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1 space-y-0.5">
              <ItemTitle item={item} open={open} />
              <Meta item={item} />
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
  )
}

function Skipped() {
  const { items, error, remove, clear, reload } = useList('skipped')
  const open = useOpen()
  const [confirming, setConfirming] = useState(false)

  if (error && !items) return <LoadError onRetry={reload} />
  if (!items) return <LoadingGrid />
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<HugeiconsIcon icon={Cancel01Icon} />}
        title="No skips"
        message="Titles you skip on the dashboard deck show up here, so you can bring one back if you skipped it by mistake or your taste has moved on."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          Skipped titles stay out of the deck. A skip says nothing about a genre, only about that
          title — remove one to let it come back.
        </p>
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          <HugeiconsIcon icon={Delete02Icon} />
          Clear all
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 p-2 sm:p-3">
            <Poster item={item} className="w-10 shrink-0 sm:w-12" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <ItemTitle item={item} open={open} />
              <Meta item={item} />
              {item.genres.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">
                  {item.genres.slice(0, 4).join(', ')}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => remove(item)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all skips?</AlertDialogTitle>
            <AlertDialogDescription>
              All {items.length} skipped titles can show up in the deck again. Saved titles and
              requests are kept.
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
    </div>
  )
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm text-muted-foreground">The list couldn't be loaded.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export default function SavedPage() {
  const initial: ListName =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('tab') === 'skipped'
      ? 'skipped'
      : 'watchlist'
  const [tab, setTab] = useState<ListName>(initial)

  const switchTab = (value: ListName) => {
    setTab(value)
    const url = new URL(window.location.href)
    if (value === 'watchlist') url.searchParams.delete('tab')
    else url.searchParams.set('tab', value)
    window.history.replaceState(window.history.state, '', url)
  }

  return (
    <AppLayout title="Watchlist">
      <Head title="Watchlist" />
      <Tabs value={tab} onValueChange={(v) => switchTab(v as ListName)}>
        <TabsList>
          <TabsTrigger value="watchlist" className="gap-2">
            <HugeiconsIcon icon={Bookmark01Icon} className="size-4" />
            Saved
          </TabsTrigger>
          <TabsTrigger value="skipped" className="gap-2">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            Skipped
          </TabsTrigger>
        </TabsList>
        <TabsContent value="watchlist" className="mt-6">
          <Watchlist />
        </TabsContent>
        <TabsContent value="skipped" className="mt-6">
          <Skipped />
        </TabsContent>
      </Tabs>
    </AppLayout>
  )
}
