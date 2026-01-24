import { useState } from 'react'
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
  const Icon = MEDIA_ICONS[mediaType]

  if (!src || hasError) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <HugeiconsIcon icon={Icon} className={`text-muted-foreground/50 ${iconClassName}`} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}
