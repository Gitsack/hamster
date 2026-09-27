import { useCallback, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  MusicNote01Icon,
  Film01Icon,
  Tv01Icon,
  Book01Icon,
  CdIcon,
} from '@hugeicons/core-free-icons'

type MediaType = 'music' | 'movies' | 'tv' | 'books' | 'album'

const MEDIA_ICONS: Record<MediaType, typeof MusicNote01Icon> = {
  music: MusicNote01Icon,
  movies: Film01Icon,
  tv: Tv01Icon,
  books: Book01Icon,
  album: CdIcon,
}

interface MediaImageProps {
  src: string | null | undefined
  alt: string
  mediaType: MediaType
  className?: string
  iconClassName?: string
}

export function MediaImage({
  src,
  alt,
  mediaType,
  className = '',
  iconClassName = 'h-16 w-16',
}: MediaImageProps) {
  const [hasError, setHasError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const Icon = MEDIA_ICONS[mediaType]
  // Server-rendered or cached images can finish before onLoad is attached.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true)
  }, [])

  if (!src || hasError) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-muted ${className}`}>
        <HugeiconsIcon
          icon={Icon}
          aria-hidden="true"
          className={`text-muted-foreground/50 ${iconClassName}`}
        />
      </div>
    )
  }

  // Slow covers breathe while they load instead of sitting as a flat grey box.
  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div
          aria-hidden="true"
          className="cover-loading absolute inset-0"
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`relative w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}
