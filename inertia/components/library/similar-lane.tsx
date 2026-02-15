import { useState, useEffect } from 'react'
import { router } from '@inertiajs/react'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaPreview } from '@/contexts/media_preview_context'
import { MediaTeaser } from '@/components/library/media-teaser'
import { useVisibleWatchProviders } from '@/hooks/use_visible_watch_providers'

interface SimilarItem {
  tmdbId: string
  title: string
  year?: number
  posterUrl?: string | null
  rating?: number
  genres?: string[]
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

export function SimilarLane({ mediaType, mediaId, tmdbId }: SimilarLaneProps) {
  const [items, setItems] = useState<SimilarItem[]>([])
  const [loading, setLoading] = useState(true)
  const { openMoviePreview, openTvShowPreview } = useMediaPreview()

  const { providers: watchProviders, loadingIds: watchProviderLoading, observerRef: watchProviderRef } = useVisibleWatchProviders(mediaType === 'movies' ? 'movie' : 'tv')

  useEffect(() => {
    if (!tmdbId) {
      setLoading(false)
      return
    }

    const endpoint = mediaId
      ? mediaType === 'movies'
        ? `/api/v1/movies/${mediaId}/similar`
        : `/api/v1/tvshows/${mediaId}/similar`
      : mediaType === 'movies'
        ? `/api/v1/movies/similar?tmdbId=${tmdbId}`
        : `/api/v1/tvshows/similar?tmdbId=${tmdbId}`

    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.results || [])
      })
      .catch(() => {
        setItems([])
      })
      .finally(() => setLoading(false))
  }, [mediaType, mediaId, tmdbId])

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
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="flex-shrink-0 w-32 aspect-[2/3] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }
  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">
        Similar {mediaType === 'movies' ? 'Movies' : 'Shows'}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
        {items.map((item) => (
          <MediaTeaser
            key={item.tmdbId}
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
        ))}
      </div>
    </div>
  )
}
