import { useState, useEffect } from 'react'
import { router } from '@inertiajs/react'
import { Skeleton } from '@/components/ui/skeleton'
import { HugeiconsIcon } from '@hugeicons/react'
import { Film01Icon, Tv01Icon } from '@hugeicons/core-free-icons'
import { useMediaPreview } from '@/contexts/media_preview_context'

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

  const iconComponent = mediaType === 'movies' ? Film01Icon : Tv01Icon

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">
        Similar {mediaType === 'movies' ? 'Movies' : 'Shows'}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
        {items.map((item) => (
          <div
            key={item.tmdbId}
            className="flex-shrink-0 w-32 group cursor-pointer"
            onClick={() => handleClick(item)}
          >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
              {item.posterUrl ? (
                <img
                  src={item.posterUrl}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <HugeiconsIcon
                    icon={iconComponent}
                    className="h-8 w-8 text-muted-foreground/30"
                  />
                </div>
              )}
              {item.inLibrary && (
                <div className="absolute top-1.5 right-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs font-medium line-clamp-2">{item.title}</p>
                {item.year && <p className="text-white/70 text-[10px]">{item.year}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
