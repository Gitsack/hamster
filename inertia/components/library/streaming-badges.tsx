import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { LinkSquare02Icon } from '@hugeicons/core-free-icons'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface StreamingProvider {
  id: number
  name: string
  logoUrl: string
}

interface StreamingLink extends StreamingProvider {
  url: string
  /** A deep link into the service; otherwise TMDB's watch page for the title. */
  direct: boolean
}

export interface StreamingTitle {
  /** Only films and shows stream; anything else renders nothing. */
  mediaType: string
  tmdbId: string
  title: string
}

const providerCache = new Map<string, Promise<StreamingProvider[]>>()
const linkCache = new Map<string, Promise<StreamingLink[]>>()

const cacheKey = (t: StreamingTitle) => `${t.mediaType}:${t.tmdbId}`

/**
 * Where a film or show streams, on the services the user picked in settings —
 * the same check the Search posters make.
 */
export function fetchProviders(t: StreamingTitle): Promise<StreamingProvider[]> {
  if (t.mediaType !== 'movie' && t.mediaType !== 'tv') return Promise.resolve([])
  const key = cacheKey(t)
  let pending = providerCache.get(key)
  if (!pending) {
    pending = fetch('/api/v1/watch-providers/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdbIds: [t.tmdbId], type: t.mediaType }),
    })
      .then((res) => (res.ok ? res.json() : { providers: {} }))
      .then(
        (body: { providers?: Record<string, StreamingProvider[]> }) =>
          body.providers?.[t.tmdbId] ?? []
      )
      .catch(() => [])
    providerCache.set(key, pending)
  }
  return pending
}

/**
 * Hands over providers a poster lane already fetched, so a preview or detail page opened
 * from it shows them without asking again.
 */
export function primeProviders(
  mediaType: 'movie' | 'tv',
  providers: Record<string, StreamingProvider[]>
) {
  for (const [tmdbId, list] of Object.entries(providers)) {
    providerCache.set(cacheKey({ mediaType, tmdbId, title: '' }), Promise.resolve(list))
  }
}

/** Where to open the title on each of those services. */
function fetchLinks(t: StreamingTitle): Promise<StreamingLink[]> {
  const key = cacheKey(t)
  let pending = linkCache.get(key)
  if (!pending) {
    const params = new URLSearchParams({ type: t.mediaType, tmdbId: t.tmdbId, title: t.title })
    pending = fetch(`/api/v1/watch-providers/links?${params}`)
      .then((res) => (res.ok ? res.json() : { links: [] }))
      .then((body: { links?: StreamingLink[] }) => body.links ?? [])
      .catch(() => [])
    linkCache.set(key, pending)
  }
  return pending
}

const SIZES = {
  // Overlaid on a poster: a tight stack of small logos, three then "+N".
  compact: {
    max: 3,
    stack: '-space-x-1',
    logo: 'size-5 rounded-sm ring-1 ring-black/40 sm:size-6',
    extra:
      'ml-0.5 rounded-sm bg-black/60 px-1 py-0.5 text-xs leading-4 text-white ring-1 ring-black/40',
  },
  // Beside the actions on a detail surface: button-height logos, side by side.
  large: {
    max: 5,
    stack: 'gap-1.5',
    logo: 'size-9 rounded-md ring-1 ring-border',
    extra:
      'flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-1.5 text-sm text-muted-foreground',
  },
} as const

/**
 * Streaming logos for a title on the user's services. One service opens it there;
 * several offer a menu of them. Renders nothing until, and unless, there are any.
 */
export function StreamingBadges({
  size = 'compact',
  className,
  onOpen,
  ...title
}: StreamingTitle & {
  size?: keyof typeof SIZES
  className?: string
  /** Called when the user follows a link out to a service. */
  onOpen?: () => void
}) {
  const { mediaType, tmdbId } = title
  const [providers, setProviders] = useState<StreamingProvider[]>([])
  const [links, setLinks] = useState<StreamingLink[] | null>(null)
  useEffect(() => {
    let live = true
    setProviders([])
    setLinks(null)
    fetchProviders(title).then((p) => {
      if (!live) return
      setProviders(p)
      // Fetched ahead of the click, so a single service opens as a plain link
      // rather than a window the browser would block after an await.
      if (p.length > 0) fetchLinks(title).then((l) => live && setLinks(l))
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, tmdbId])

  if (providers.length === 0) return null
  const s = SIZES[size]
  const shown = providers.slice(0, s.max)
  const extra = providers.length - shown.length
  const label = `Watch on ${providers.map((p) => p.name).join(', ')}`
  // A few large logos have room to say which service each one is.
  const named = size === 'large' && providers.length <= 3
  const stack = (
    <>
      {shown.map((p) =>
        named ? (
          <span
            key={p.id}
            className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted pr-3 pl-1.5"
          >
            <img
              src={p.logoUrl}
              alt=""
              draggable={false}
              className="size-6 rounded-sm ring-1 ring-border"
            />
            <span className="text-sm font-medium whitespace-nowrap">{p.name}</span>
          </span>
        ) : (
          <img key={p.id} src={p.logoUrl} alt={p.name} draggable={false} className={s.logo} />
        )
      )}
      {extra > 0 && <span className={cn('readout', s.extra)}>+{extra}</span>}
    </>
  )
  const stackClass = cn(
    'streaming-fade-in flex items-center rounded-md outline-none transition-transform hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
    s.stack,
    named && 'flex-wrap',
    className
  )

  // Until the links arrive, and if they never do, the stack is only a picture.
  if (!links || links.length === 0) {
    return (
      <div className={cn(stackClass, 'hover:scale-100')} aria-label={label} title={label}>
        {stack}
      </div>
    )
  }

  if (links.length === 1) {
    return (
      <a
        href={links[0].url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        onClick={onOpen}
        className={stackClass}
        aria-label={`Watch on ${links[0].name}`}
        title={`Watch on ${links[0].name}`}
      >
        {stack}
      </a>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={stackClass} aria-label={label} title={label}>
        {stack}
      </DropdownMenuTrigger>
      <DropdownMenuPopup side="bottom" align="start" className="min-w-44">
        {links.map((l) => (
          <DropdownMenuItem key={l.id} asChild onClick={onOpen}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              <img src={l.logoUrl} alt="" className="size-5 rounded-sm ring-1 ring-border" />
              <span className="flex-1">{l.name}</span>
              <HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5" />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuPopup>
    </DropdownMenu>
  )
}
