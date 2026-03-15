import { type ReactNode } from 'react'
import { MediaGallery } from '@/components/media-gallery'

interface MediaHeroProps {
  trailerUrl?: string | null
  images?: string[]
  title: string
  posterUrl?: string | null
  posterFallback: ReactNode
  overview?: string | null
  children: ReactNode
}

export function MediaHero({
  trailerUrl,
  images,
  title,
  posterUrl,
  posterFallback,
  overview,
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
      {/* Header: poster + metadata side by side, overview below */}
      <div className="space-y-4">
        <div className="flex gap-4 md:gap-6">
          <div className="w-48 aspect-[2/3] bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {posterImage}
          </div>
          <div className="flex-1 min-w-0 space-y-4">{children}</div>
        </div>
        {overview && (
          <p className="text-muted-foreground line-clamp-5">{overview}</p>
        )}
      </div>

      {/* Media section: trailers and images */}
      {hasGallery && (
        <div>
          <h2 className="font-semibold mb-3">Media</h2>
          <MediaGallery
            trailerUrl={trailerUrl}
            images={images}
            title={title}
          />
        </div>
      )}
    </>
  )
}
