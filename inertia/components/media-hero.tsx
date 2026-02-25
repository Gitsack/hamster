import { type ReactNode } from 'react'
import { MediaGallery } from '@/components/media-gallery'
import { Card, CardContent } from '@/components/ui/card'

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

  if (!hasGallery) {
    return (
      <>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-48 aspect-[2/3] md:aspect-auto md:h-72 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {posterImage}
          </div>
          <div className="flex-1 space-y-4">{children}</div>
        </div>
        {overview && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-2">Overview</h2>
              <p className="text-muted-foreground">{overview}</p>
            </CardContent>
          </Card>
        )}
      </>
    )
  }

  return (
    <>
      {/* Gallery with desktop hero overlay */}
      <div className="-mx-4 -mt-4 mb-6">
        <MediaGallery
          trailerUrl={trailerUrl}
          images={images}
          title={title}
          className="h-48 md:h-auto md:aspect-video"
        >
          {/* Desktop gradient */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
          {/* Desktop content overlay */}
          <div className="hidden md:flex absolute inset-x-0 bottom-0 p-6 lg:p-8 pointer-events-none">
            <div className="dark pointer-events-auto flex gap-6 w-full items-end">
              <div className="w-36 lg:w-44 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 shadow-xl bg-black/20">
                {posterImage}
              </div>
              <div className="flex-1 min-w-0 space-y-2 pb-2">
                {children}
                {overview && (
                  <p className="text-sm text-muted-foreground line-clamp-3 max-w-3xl">{overview}</p>
                )}
              </div>
            </div>
          </div>
        </MediaGallery>
      </div>

      {/* Mobile: poster + metadata */}
      <div className="flex flex-col gap-6 md:hidden">
        <div className="w-full aspect-[2/3] bg-muted rounded-lg overflow-hidden">
          {posterImage}
        </div>
        <div className="space-y-4">{children}</div>
      </div>

      {/* Mobile overview card */}
      {overview && (
        <Card className="md:hidden">
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-2">Overview</h2>
            <p className="text-muted-foreground">{overview}</p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
