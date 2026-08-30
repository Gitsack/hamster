import { useState, type ComponentProps, type ReactNode } from 'react'
import { Link } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { MusicNote01Icon } from '@hugeicons/core-free-icons'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type MediaIcon = typeof MusicNote01Icon

export interface MediaListRowProps extends Omit<
  ComponentProps<'div'>,
  'title' | 'onClick' | 'children'
> {
  /** Artwork ratio. Posters are 2:3; artists, authors and album covers are square. */
  artworkAspect?: string
  imageUrl?: string | null
  /** Drawn in place of missing or broken artwork. */
  icon: MediaIcon
  title: ReactNode
  subtitle?: ReactNode
  /** Extra classes for the subtitle line — `readout` where it is mostly figures. */
  subtitleClassName?: string
  /** Extra lines below the subtitle — episode counts, provider badges. */
  meta?: ReactNode
  /** Trailing cluster: status badge, Add button, overflow menu. */
  actions?: ReactNode
  /** Navigation target. Makes the artwork and the title column links. */
  href?: string
  /** Click/Enter handler for rows that open a sheet instead of navigating. */
  onActivate?: () => void
  /** Whole row reads as secondary — already in the library, not requested. */
  dimmed?: boolean
  /** Artwork desaturates until hover. Used for titles with nothing on disk. */
  mutedArtwork?: boolean
  /** Panel rendered below the row, inside the same card. */
  expanded?: ReactNode
  /** Lift image-failure state to a page-level set when the same key is shared with a grid. */
  imageFailed?: boolean
  onImageError?: () => void
}

/**
 * One media row: edge-to-edge artwork at its true ratio, a padded text column, and a
 * trailing action cluster.
 *
 * The artwork is a sibling of the text column rather than its first child, so on a phone
 * it sits beside both the title and the actions instead of only the first of them, and it
 * stretches to whatever height the row settles at instead of leaving a gap under a fixed
 * thumbnail.
 *
 * Shared by the library list view and the search results so a title looks the same before
 * and after it is added.
 */
export function MediaListRow({
  artworkAspect = 'aspect-[2/3]',
  imageUrl,
  icon,
  title,
  subtitle,
  subtitleClassName,
  meta,
  actions,
  href,
  onActivate,
  dimmed = false,
  mutedArtwork = false,
  expanded,
  imageFailed,
  onImageError,
  className,
  ...rest
}: MediaListRowProps) {
  const [failedLocally, setFailedLocally] = useState(false)
  const failed = imageFailed ?? failedLocally
  const showImage = !!imageUrl && !failed

  const handleImageError = () => {
    setFailedLocally(true)
    onImageError?.()
  }

  const artwork = (
    <>
      {showImage ? (
        <img
          src={imageUrl!}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-all duration-200 ease-out',
            mutedArtwork && 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'
          )}
          loading="lazy"
          onError={handleImageError}
        />
      ) : (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out',
            mutedArtwork && 'opacity-40 group-hover:opacity-60'
          )}
        >
          <HugeiconsIcon icon={icon} className="text-muted-foreground/40 h-6 w-6" />
        </div>
      )}
    </>
  )

  const artworkClass = cn(
    artworkAspect,
    'relative min-h-24 shrink-0 self-stretch overflow-hidden bg-muted'
  )

  const textClass = cn(
    'basis-full min-w-0 outline-none transition-opacity duration-200 ease-out sm:flex-1 sm:basis-auto',
    mutedArtwork && 'opacity-60 group-hover:opacity-100'
  )

  const text = (
    <>
      <h3 className="truncate text-sm font-medium">{title}</h3>
      {subtitle && (
        <div className={cn('text-muted-foreground truncate text-xs', subtitleClassName)}>
          {subtitle}
        </div>
      )}
      {meta}
    </>
  )

  return (
    <Card
      className={cn(
        'group gap-0 overflow-hidden py-0 transition-colors duration-150 ease-out hover:bg-accent',
        href &&
          'has-[a:focus-visible]:border-primary has-[a:focus-visible]:ring-ring/50 has-[a:focus-visible]:ring-[3px]',
        onActivate &&
          'cursor-pointer focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
        dimmed && 'opacity-60',
        className
      )}
      onClick={onActivate}
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.target !== e.currentTarget) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onActivate()
              }
            }
          : undefined
      }
      {...rest}
    >
      <CardContent className="flex items-stretch p-0">
        {href ? (
          <Link href={href} tabIndex={-1} aria-hidden="true" className={artworkClass}>
            {artwork}
          </Link>
        ) : (
          <div className={artworkClass}>{artwork}</div>
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 p-3 sm:flex-nowrap sm:gap-3">
          {href ? (
            <Link href={href} className={textClass}>
              {text}
            </Link>
          ) : (
            <div className={textClass}>{text}</div>
          )}
          {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </CardContent>
      {expanded}
    </Card>
  )
}
