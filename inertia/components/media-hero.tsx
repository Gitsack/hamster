import { type ReactNode } from 'react'
import { MediaGallery } from '@/components/media-gallery'
import { cn } from '@/lib/utils'

interface MediaHeroProps {
  trailerUrl?: string | null
  images?: string[]
  title: string
  posterUrl?: string | null
  posterFallback: ReactNode
  overview?: string | null
  /**
   * Artwork shape. `poster` is the 2:3 frame used by films, shows and books;
   * `square` is the 1:1 sleeve used by albums and artist portraits. Both sit in
   * the same column so every detail page opens with the same silhouette.
   */
  posterAspect?: 'poster' | 'square'
  children: ReactNode
}

export function MediaHero({
  trailerUrl,
  images,
  title,
  posterUrl,
  posterFallback,
  overview,
  posterAspect = 'poster',
  children,
}: MediaHeroProps) {
  const hasGallery = !!(trailerUrl || (images && images.length > 0))

  const posterImage = posterUrl ? (
    <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center">{posterFallback}</div>
  )

  return (
    <>
      {/* Artwork and metadata side by side; overview reads below at prose measure. */}
      <div className="space-y-4">
        <div className="flex gap-4 md:gap-6">
          <div
            className={cn(
              'w-28 sm:w-40 md:w-48 shrink-0 overflow-hidden rounded-lg bg-muted',
              posterAspect === 'square' ? 'aspect-square' : 'aspect-[2/3]'
            )}
          >
            {posterImage}
          </div>
          <div className="flex-1 min-w-0 space-y-4">{children}</div>
        </div>
        {overview && (
          <p className="max-w-[70ch] text-sm text-muted-foreground line-clamp-5">{overview}</p>
        )}
      </div>

      {/* Media section: trailers and images */}
      {hasGallery && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Media</h2>
          <MediaGallery trailerUrl={trailerUrl} images={images} title={title} />
        </div>
      )}
    </>
  )
}
