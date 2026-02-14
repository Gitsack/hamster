import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'

interface MediaGalleryProps {
  trailerUrl?: string | null
  images?: string[]
  title: string
  /** CSS class for slide sizing, e.g. "h-48 md:h-64" or "aspect-video" (default) */
  className?: string
  children?: ReactNode
}

function extractYouTubeKey(embedUrl: string): string | null {
  const match = embedUrl.match(/\/embed\/([^?/]+)/)
  return match ? match[1] : null
}

export function MediaGallery({ trailerUrl, images, title, className, children }: MediaGalleryProps) {
  const [playingTrailer, setPlayingTrailer] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  const youtubeKey = trailerUrl ? extractYouTubeKey(trailerUrl) : null
  const hasTrailer = !!youtubeKey
  const imageList = images?.filter(Boolean) ?? []
  const totalSlides = (hasTrailer ? 1 : 0) + imageList.length

  // Track active slide via IntersectionObserver
  useEffect(() => {
    if (totalSlides <= 1) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = slideRefs.current.indexOf(entry.target as HTMLDivElement)
            if (index !== -1) setActiveIndex(index)
          }
        }
      },
      { root: scrollRef.current, threshold: 0.6 }
    )

    for (const ref of slideRefs.current) {
      if (ref) observer.observe(ref)
    }

    return () => observer.disconnect()
  }, [totalSlides])

  const setSlideRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      slideRefs.current[index] = el
    },
    []
  )

  const scrollToSlide = (index: number) => {
    slideRefs.current[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    })
  }

  if (totalSlides === 0) return null

  const sizeClass = className || 'aspect-video'

  return (
    <div className={`relative overflow-hidden rounded-lg ${sizeClass}`}>
      <div
        ref={scrollRef}
        className="flex h-full overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Trailer slide */}
        {hasTrailer && (
          <div
            ref={setSlideRef(0)}
            className="min-w-full h-full snap-start bg-muted relative flex-shrink-0"
          >
            {playingTrailer ? (
              <iframe
                src={`${trailerUrl}?autoplay=1`}
                title="Trailer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            ) : (
              <button
                onClick={() => setPlayingTrailer(true)}
                className="w-full h-full relative group cursor-pointer"
              >
                <img
                  src={`https://img.youtube.com/vi/${youtubeKey}/maxresdefault.jpg`}
                  alt={`${title} trailer`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement
                    if (img.src.includes('maxresdefault')) {
                      img.src = `https://img.youtube.com/vi/${youtubeKey}/hqdefault.jpg`
                    }
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-8 h-8 text-black ml-1"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Image slides */}
        {imageList.map((url, i) => {
          const slideIndex = hasTrailer ? i + 1 : i
          return (
            <div
              key={url}
              ref={setSlideRef(slideIndex)}
              className="min-w-full h-full snap-start bg-muted relative flex-shrink-0"
            >
              <img
                src={url}
                alt={`${title} backdrop ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )
        })}
      </div>

      {/* Overlay children (e.g. MediaStatusBadge) */}
      {children}

      {/* Dot indicators */}
      {totalSlides > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToSlide(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === activeIndex ? 'bg-white' : 'bg-white/50'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
