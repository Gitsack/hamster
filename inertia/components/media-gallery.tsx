import { useState, useRef, useEffect, useCallback, type ReactNode, type MouseEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, PlayIcon } from '@hugeicons/core-free-icons'

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

export function MediaGallery({
  trailerUrl,
  images,
  title,
  className,
  children,
}: MediaGalleryProps) {
  const [playingTrailer, setPlayingTrailer] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  // Drag state
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0, dragged: false })

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

  const goToSlide = (direction: 'prev' | 'next') => {
    const next =
      direction === 'next'
        ? (activeIndex + 1) % totalSlides
        : (activeIndex - 1 + totalSlides) % totalSlides
    scrollToSlide(next)
  }

  // Mouse drag handlers
  const onMouseDown = (e: MouseEvent) => {
    const el = scrollRef.current
    if (!el) return
    dragState.current = {
      isDown: true,
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
      dragged: false,
    }
    el.style.cursor = 'grabbing'
    el.style.scrollSnapType = 'none'
  }

  const onMouseMove = (e: MouseEvent) => {
    const ds = dragState.current
    if (!ds.isDown) return
    e.preventDefault()
    const el = scrollRef.current!
    const x = e.pageX - el.offsetLeft
    const walk = x - ds.startX
    if (Math.abs(walk) > 5) ds.dragged = true
    el.scrollLeft = ds.scrollLeft - walk
  }

  const onMouseUp = () => {
    const el = scrollRef.current
    if (!el) return
    dragState.current.isDown = false
    el.style.cursor = ''
    el.style.scrollSnapType = ''
  }

  if (totalSlides === 0) return null

  const sizeClass = className || 'aspect-video'

  return (
    <div>
      <div className={`relative overflow-hidden rounded-lg ${sizeClass} group/gallery`}>
        <div
          ref={scrollRef}
          className="flex h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory cursor-grab select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
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
                  onClick={(e) => {
                    if (dragState.current.dragged) {
                      e.preventDefault()
                      return
                    }
                    setPlayingTrailer(true)
                  }}
                  className="w-full h-full relative group cursor-pointer outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-inset"
                  aria-label={`Play ${title} trailer`}
                >
                  <img
                    src={`https://img.youtube.com/vi/${youtubeKey}/maxresdefault.jpg`}
                    alt={`${title} trailer`}
                    className="w-full h-full object-cover pointer-events-none"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement
                      if (img.src.includes('maxresdefault')) {
                        img.src = `https://img.youtube.com/vi/${youtubeKey}/hqdefault.jpg`
                      }
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors duration-150">
                    {/* Sits on artwork: fixed on-image chrome plus the poster hairline,
                        not a themed surface and not a resting shadow. */}
                    <div className="w-14 h-14 rounded-full bg-black/55 text-white flex items-center justify-center shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)] group-hover:bg-black/70 transition-colors duration-150">
                      <HugeiconsIcon icon={PlayIcon} className="w-6 h-6" />
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
                  className="w-full h-full object-cover pointer-events-none"
                  loading="lazy"
                />
              </div>
            )
          })}
        </div>

        {/* Overlay children */}
        {children}

        {/* Prev / Next buttons */}
        {totalSlides > 1 && (
          <>
            <button
              onClick={() => goToSlide('prev')}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover/gallery:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 cursor-pointer outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              aria-label="Previous slide"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-5 h-5" />
            </button>
            <button
              onClick={() => goToSlide('next')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover/gallery:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 cursor-pointer outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              aria-label="Next slide"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Dot indicators (outside the carousel) */}
      {totalSlides > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToSlide(i)}
              className={`w-2 h-2 rounded-full transition-colors duration-150 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] ${
                i === activeIndex ? 'bg-foreground' : 'bg-foreground/25 hover:bg-foreground/50'
              }`}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === activeIndex}
            />
          ))}
        </div>
      )}
    </div>
  )
}
