import { useState } from 'react'
import { Link } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Book01Icon, CdIcon, Film01Icon, Tv01Icon } from '@hugeicons/core-free-icons'
import { useMediaPreview } from '@/contexts/media_preview_context'
import { cn } from '@/lib/utils'

/**
 * Pieces shared by the lists of titles the user has answered — the watchlist
 * and the deck's skipped titles.
 */

export type TitleMediaType = 'movie' | 'tv' | 'album' | 'book'

export interface TitleItem {
  key: string
  mediaType: TitleMediaType
  /** TMDB id for movies and shows; our own row id for albums and books. */
  externalId: string
  title: string | null
  year: number | null
  posterUrl: string | null
  genres: string[]
  createdAt: string
}

export const TITLE_TYPE_META: Record<TitleMediaType, { label: string; icon: typeof Film01Icon }> = {
  movie: { label: 'Movie', icon: Film01Icon },
  tv: { label: 'Series', icon: Tv01Icon },
  album: { label: 'Album', icon: CdIcon },
  book: { label: 'Book', icon: Book01Icon },
}

export function TitlePoster({ item, className }: { item: TitleItem; className?: string }) {
  const [broken, setBroken] = useState(false)
  const meta = TITLE_TYPE_META[item.mediaType]
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        item.mediaType === 'album' ? 'aspect-square' : 'aspect-[2/3]',
        className
      )}
    >
      {item.posterUrl && !broken ? (
        <img
          src={item.posterUrl}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <HugeiconsIcon icon={meta.icon} className="size-8" />
        </div>
      )}
    </div>
  )
}

function libraryHref(item: TitleItem): string | null {
  if (item.mediaType === 'album' && !item.externalId.startsWith('new:'))
    return `/album/${item.externalId}`
  if (item.mediaType === 'book') return `/book/${item.externalId}`
  return null
}

/** The title, opening the preview sheet for films and shows, the library page otherwise. */
export function TitleName({ item }: { item: TitleItem }) {
  const { openMoviePreview, openTvShowPreview } = useMediaPreview()
  const title = item.title ?? 'Untitled'
  const cls =
    'text-left text-sm font-medium leading-snug underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50'
  if (item.mediaType === 'movie' || item.mediaType === 'tv') {
    const open = item.mediaType === 'movie' ? openMoviePreview : openTvShowPreview
    return (
      <button type="button" className={cls} onClick={() => open(item.externalId)}>
        {title}
      </button>
    )
  }
  const href = libraryHref(item)
  return href ? (
    <Link href={href} className={cls}>
      {title}
    </Link>
  ) : (
    <span className="text-sm font-medium leading-snug">{title}</span>
  )
}

export function TitleMeta({ item }: { item: TitleItem }) {
  const meta = TITLE_TYPE_META[item.mediaType]
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <HugeiconsIcon icon={meta.icon} className="size-3.5 shrink-0" />
      <span>{meta.label}</span>
      {item.year && (
        <>
          <span aria-hidden="true">·</span>
          <span className="readout">{item.year}</span>
        </>
      )}
    </p>
  )
}
