import { useState, useEffect, useRef, useCallback } from 'react'
import { router } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaPreview } from '@/contexts/media_preview_context'
import { MediaTeaser } from '@/components/library/media-teaser'
import { useVisibleWatchProviders } from '@/hooks/use_visible_watch_providers'
import { useInViewport } from '@/hooks/use_in_viewport'

interface SimilarItem {
  tmdbId: string
  title: string
  year?: number
  posterUrl?: string | null
  rating?: number
  genres?: string[]
  /** Why the recommender surfaced it — "Directed by …", "Part of …", "With …". */
  reason?: string
  inLibrary: boolean
  libraryId?: number
  requested?: boolean
  hasFile?: boolean
}

interface SimilarLaneProps {
  mediaType: 'movies' | 'tv'
  mediaId?: number
  tmdbId: string | null
}

/**
 * Titles like this one, as a horizontal carousel.
 *
 * It is the last thing on a detail surface and costs a TMDB round trip plus a batch of
 * provider lookups, so it does not fetch until it is actually on screen — on a phone, a
 * poster tap should not pay for a lane the operator may never scroll to.
 *
 * The lane contains its own over-scroll: without that, an over-swipe inside a sheet hands
 * the gesture to the browser and navigates back out of the page.
 */
export function SimilarLane({ mediaType, mediaId, tmdbId }: SimilarLaneProps) {
  const [items, setItems] = useState<SimilarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { openMoviePreview, openTvShowPreview } = useMediaPreview()
  const { ref: viewportRef, inViewport } = useInViewport<HTMLDivElement>()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const {
    providers: watchProviders,
    loadingIds: watchProviderLoading,
    observerRef: watchProviderRef,
  } = useVisibleWatchProviders(mediaType === 'movies' ? 'movie' : 'tv')

  useEffect(() => {
    if (!tmdbId || !inViewport) return

    const endpoint = mediaId
      ? mediaType === 'movies'
        ? `/api/v1/movies/${mediaId}/similar`
        : `/api/v1/tvshows/${mediaId}/similar`
      : mediaType === 'movies'
        ? `/api/v1/movies/similar?tmdbId=${tmdbId}`
        : `/api/v1/tvshows/similar?tmdbId=${tmdbId}`

    let cancelled = false
    setLoading(true)
    setFailed(false)

    fetch(endpoint)
      .then((r) => {
        if (!r.ok) throw new Error(`Similar titles request failed (HTTP ${r.status})`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        setItems(data.results || [])
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [mediaType, mediaId, tmdbId, inViewport, attempt])

  // Arrows appear only when there is something off-screen to reach, and each end of the
  // travel disables its own arrow rather than leaving a control that does nothing.
  const measure = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setOverflows(max > 8)
    setAtStart(el.scrollLeft <= 8)
    setAtEnd(el.scrollLeft >= max - 8)
  }, [])

  useEffect(() => {
    measure()
    if (typeof ResizeObserver === 'undefined' || !scrollRef.current) return
    const observer = new ResizeObserver(measure)
    observer.observe(scrollRef.current)
    return () => observer.disconnect()
  }, [items, measure])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    // One screenful less a card, so the card at the edge stays as the anchor.
    const amount = Math.max(el.clientWidth - 140, 140)
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  const handleClick = (item: SimilarItem) => {
    if (item.inLibrary && item.libraryId) {
      const path = mediaType === 'movies' ? `/movie/${item.libraryId}` : `/tvshow/${item.libraryId}`
      router.visit(path)
    } else {
      if (mediaType === 'movies') openMoviePreview(item.tmdbId)
      else openTvShowPreview(item.tmdbId)
    }
  }

  if (!tmdbId) return null

  const heading = `Similar ${mediaType === 'movies' ? 'Movies' : 'Shows'}`

  if (loading) {
    return (
      <div ref={viewportRef} className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-32 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // A provider that could not be reached says so; silently rendering nothing makes an
  // unreachable TMDB look identical to a title with no similar entries.
  if (failed) {
    return (
      <div ref={viewportRef} className="space-y-2">
        <h3 className="text-base font-semibold">{heading}</h3>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>Could not reach TMDB for similar titles.</span>
          <Button variant="ghost" size="sm" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div ref={viewportRef} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{heading}</h3>
        {overflows && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => scroll('left')}
              disabled={atStart}
              aria-label={`Scroll ${heading.toLowerCase()} left`}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => scroll('right')}
              disabled={atEnd}
              aria-label={`Scroll ${heading.toLowerCase()} right`}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        onScroll={measure}
        className="-mx-1 flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--scrollbar-thumb)] [&::-webkit-scrollbar-track]:bg-[var(--scrollbar-track)]"
      >
        {items.map((item) => (
          <div key={item.tmdbId} className="w-32 shrink-0 snap-start space-y-1.5">
            <MediaTeaser
              tmdbId={item.tmdbId}
              title={item.title}
              year={item.year}
              posterUrl={item.posterUrl}
              genres={item.genres}
              mediaType={mediaType === 'movies' ? 'movie' : 'tv'}
              status={item.inLibrary ? 'downloaded' : 'none'}
              streamingProviders={watchProviders[item.tmdbId]}
              isLoadingProviders={watchProviderLoading.has(item.tmdbId)}
              observerRef={watchProviderRef(item.tmdbId)}
              onClick={() => handleClick(item)}
              size="small"
            />
            {/* The reason is the difference between a lane of posters and a suggestion:
                it says on what grounds this title is next to the one being read. */}
            {item.reason && (
              <p className="text-muted-foreground line-clamp-2 text-[11px] leading-tight">
                {item.reason}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
