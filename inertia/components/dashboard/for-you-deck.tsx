import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, router } from '@inertiajs/react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Film01Icon,
  Tv01Icon,
  CdIcon,
  Book01Icon,
  Cancel01Icon,
  Add01Icon,
  Refresh01Icon,
  SparklesIcon,
  StarIcon,
  PlayIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MediaImage } from '@/components/library/media-image'
import { useMediaPreview } from '@/contexts/media_preview_context'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types — mirror app/services/recommendations/for_you_service.ts
// ---------------------------------------------------------------------------

type DeckMediaType = 'movie' | 'tv' | 'album' | 'book'

export interface ForYouCard {
  key: string
  mediaType: DeckMediaType
  externalId: string
  title: string
  year: number | null
  subtitle: string | null
  overview: string | null
  posterUrl: string | null
  backdropUrl: string | null
  rating: number | null
  genres: string[]
  reason: string
  score: number
}

interface RequestDefaults {
  qualityProfileId: string
  rootFolderId: string
}

interface DeckResponse {
  cards: ForYouCard[]
  signals: {
    /** Every taste provider the server knows, whether contributing or not. */
    sources: {
      id: string
      label: string
      state: 'active' | 'off' | 'error'
      detail: string | null
    }[]
    requests: number
    library: number
  }
  requestDefaults: { movie: RequestDefaults | null; tv: RequestDefaults | null }
}

type Filter = 'all' | DeckMediaType
type Verdict = 'request' | 'skip'

const TYPE_META: Record<
  DeckMediaType,
  {
    label: string
    plural: string
    icon: typeof Film01Icon
    imageType: 'movies' | 'tv' | 'album' | 'books'
  }
> = {
  movie: { label: 'Movie', plural: 'Movies', icon: Film01Icon, imageType: 'movies' },
  tv: { label: 'Series', plural: 'TV', icon: Tv01Icon, imageType: 'tv' },
  album: { label: 'Album', plural: 'Music', icon: CdIcon, imageType: 'album' },
  book: { label: 'Book', plural: 'Books', icon: Book01Icon, imageType: 'books' },
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// ---------------------------------------------------------------------------
// Requests — each type goes through the endpoint its own page already uses
// ---------------------------------------------------------------------------

async function postJson(url: string, method: string, body: unknown) {
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function requestCard(
  card: ForYouCard,
  defaults: DeckResponse['requestDefaults']
): Promise<{ ok: true; href: string | null } | { ok: false; error: string }> {
  if (card.mediaType === 'movie' || card.mediaType === 'tv') {
    const d = defaults[card.mediaType]
    if (!d) {
      return {
        ok: false,
        error: `No quality profile or root folder for ${card.mediaType === 'movie' ? 'movies' : 'TV'}. Add one in Settings → Media Management.`,
      }
    }
    const res = await postJson(
      card.mediaType === 'movie' ? '/api/v1/movies' : '/api/v1/tvshows',
      'POST',
      {
        tmdbId: card.externalId,
        title: card.title,
        year: card.year ?? undefined,
        qualityProfileId: d.qualityProfileId,
        rootFolderId: d.rootFolderId,
        requested: true,
        searchOnAdd: true,
        ...(card.mediaType === 'tv' ? { selectedSeasons: [1] } : {}),
      }
    )
    if (res.status === 409) return { ok: true, href: null } // added elsewhere since the deck was built
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body.error || `The server rejected ${card.title}.` }
    }
    const data = await res.json().catch(() => ({}))
    const base = card.mediaType === 'movie' ? '/movie' : '/tvshow'
    return { ok: true, href: data.id ? `${base}/${data.id}` : null }
  }

  const res =
    card.mediaType === 'album'
      ? await postJson(`/api/v1/albums/${card.externalId}`, 'PUT', { requested: true })
      : await postJson(`/api/v1/books/${card.externalId}/request`, 'POST', { requested: true })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, error: body.error || `The server rejected ${card.title}.` }
  }
  return { ok: true, href: `/${card.mediaType}/${card.externalId}` }
}

function recordFeedback(card: ForYouCard, action: 'requested' | 'skipped') {
  return postJson('/api/v1/for-you/feedback', 'POST', {
    mediaType: card.mediaType,
    externalId: card.externalId,
    action,
    title: card.title,
    genres: card.genres.slice(0, 20),
  })
}

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

export function ForYouDeck() {
  const [data, setData] = useState<DeckResponse | null>(null)
  const [cards, setCards] = useState<ForYouCard[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [announce, setAnnounce] = useState('')
  // The start stage's click is the user gesture browsers want before a video
  // may play with sound; until then the deck is a preview.
  const [session, setSession] = useState<{ sound: boolean } | null>(null)

  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/v1/for-you${refresh ? '?refresh=1' : ''}`)
      if (!res.ok) throw new Error(String(res.status))
      const body: DeckResponse = await res.json()
      setData(body)
      setCards(body.cards)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const available = useMemo(() => {
    const types = new Set(cards.map((c) => c.mediaType))
    return (['movie', 'tv', 'album', 'book'] as const).filter((t) => types.has(t))
  }, [cards])

  // A filter whose last card was just used falls back to everything.
  useEffect(() => {
    if (filter !== 'all' && !available.includes(filter)) setFilter('all')
  }, [available, filter])

  const visible = useMemo(
    () => (filter === 'all' ? cards : cards.filter((c) => c.mediaType === filter)),
    [cards, filter]
  )
  const current = visible[0] ?? null
  const next = visible[1] ?? null

  const remove = (key: string) => setCards((prev) => prev.filter((c) => c.key !== key))
  const restore = (card: ForYouCard) =>
    setCards((prev) => (prev.some((c) => c.key === card.key) ? prev : [card, ...prev]))

  const decide = useCallback(
    async (card: ForYouCard, verdict: Verdict) => {
      if (!data) return
      remove(card.key)

      if (verdict === 'skip') {
        setAnnounce(`Skipped ${card.title}`)
        recordFeedback(card, 'skipped').catch(() => {})
        toast(`Skipped ${card.title}`, {
          duration: 4000,
          action: {
            label: 'Undo',
            onClick: () => {
              restore(card)
              fetch(
                `/api/v1/for-you/feedback/${card.mediaType}/${encodeURIComponent(card.externalId)}`,
                { method: 'DELETE' }
              ).catch(() => {})
            },
          },
        })
        return
      }

      setAnnounce(`Requesting ${card.title}`)
      try {
        const result = await requestCard(card, data.requestDefaults)
        if (!result.ok) {
          restore(card)
          toast.error(`${card.title} not requested — ${result.error}`)
          return
        }
        recordFeedback(card, 'requested').catch(() => {})
        toast.success(
          card.mediaType === 'tv'
            ? `${card.title} season 1 requested — searching`
            : `${card.title} requested — searching`,
          result.href
            ? { action: { label: 'Open', onClick: () => router.visit(result.href!) } }
            : undefined
        )
      } catch {
        restore(card)
        toast.error(`${card.title} not requested — Hamster is unreachable. Try again.`)
      }
    },
    [data]
  )

  return (
    <section aria-labelledby="for-you-heading" className="min-w-0">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="for-you-heading" className="text-lg font-semibold leading-7">
            For you
          </h2>
          <SignalLine data={data} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => load(true)}
            disabled={loading}
            aria-label="Build a fresh deck"
            title="Build a fresh deck"
          >
            <HugeiconsIcon icon={Refresh01Icon} className={cn(loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {available.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Show"
          className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0"
        >
          {(['all', ...available] as Filter[]).map((f) => {
            const count = f === 'all' ? cards.length : cards.filter((c) => c.mediaType === f).length
            const active = filter === f
            return (
              <button
                key={f}
                role="radio"
                aria-checked={active}
                onClick={() => setFilter(f)}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {f === 'all' ? 'All' : TYPE_META[f].plural}
                <span className={cn('readout', active ? 'opacity-70' : 'opacity-60')}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading && !data ? (
        <DeckSkeleton />
      ) : failed ? (
        <DeckMessage
          title="Couldn't build your deck"
          body="The recommendation sources didn't answer. TMDB may be rate-limiting, or Hamster lost its connection."
          action={
            <Button variant="outline" size="sm" onClick={() => load(true)}>
              Try again
            </Button>
          }
        />
      ) : current && !session ? (
        <StartStage
          cards={visible}
          onStart={() => {
            setSession({ sound: true })
            setAnnounce(`Matching started. ${current.title}.`)
          }}
        />
      ) : current ? (
        <Stack
          key={current.key}
          card={current}
          next={next}
          remaining={visible.length}
          soundUnlocked={!!session?.sound}
          onDecide={decide}
        />
      ) : (
        <DeckMessage
          title="You're through the deck"
          body="Everything here has been requested or skipped. A fresh deck walks out from what you just picked."
          action={
            <Button variant="outline" size="sm" onClick={() => load(true)}>
              <HugeiconsIcon icon={Refresh01Icon} />
              Build a fresh deck
            </Button>
          }
        />
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </section>
  )
}

/**
 * Where the picks come from, in one quiet line: each active taste source's
 * own summary, then what the deck learnt here. Sources that are off get a
 * single nudge; one that failed says so in the alarm colour.
 */
function SignalLine({ data }: { data: DeckResponse | null }) {
  if (!data) return <p className="text-xs text-muted-foreground">Reading your taste…</p>
  const { sources, requests } = data.signals
  const parts = sources.filter((s) => s.state === 'active' && s.detail).map((s) => s.detail!)
  if (requests > 0) parts.push(`${requests} ${requests === 1 ? 'request' : 'requests'} here`)
  parts.push('your library')
  const basis = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]
  const failing = sources.filter((s) => s.state === 'error')
  const nothingConnected = !sources.some((s) => s.state === 'active')

  return (
    <p className="text-xs text-muted-foreground">
      Picked from {basis}.
      {failing.map((s) => (
        <span key={s.id} className="text-status-failed-ink">
          {' '}
          {s.detail ?? `${s.label} did not answer.`}
        </span>
      ))}
      {nothingConnected && sources.length > 0 && (
        <>
          {' '}
          <Link href="/settings/media-management" className="text-primary hover:underline">
            Connect {sources.map((s) => s.label).join(' or ')}
          </Link>{' '}
          to learn from what you watch.
        </>
      )}
    </p>
  )
}

// ---------------------------------------------------------------------------
// The card stack: drag, fling, or press
// ---------------------------------------------------------------------------

/**
 * A flick commits short of the full drag distance only when it is clearly
 * meant: fast over the last ~100 ms (not one jittery pointer sample), still
 * heading the way it travelled, and at least half-way to the commit point.
 */
const FLING_VELOCITY = 1 // px per ms
const FLING_WINDOW_MS = 100
const FLING_MIN_SHARE = 0.5
const FLING_MIN_PX = 80
const MAX_TILT = 6 // degrees

function Stack({
  card,
  next,
  remaining,
  soundUnlocked,
  onDecide,
}: {
  card: ForYouCard
  next: ForYouCard | null
  remaining: number
  soundUnlocked: boolean
  onDecide: (card: ForYouCard, verdict: Verdict) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const requestFxRef = useRef<HTMLDivElement>(null)
  const skipFxRef = useRef<HTMLDivElement>(null)
  const requestStampRef = useRef<HTMLDivElement>(null)
  const skipStampRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    id: number
    x0: number
    y0: number
    /** Recent positions, for the velocity over the last FLING_WINDOW_MS. */
    samples: { x: number; t: number }[]
    active: boolean
  } | null>(null)
  const suppressClick = useRef(false)
  const [leaving, setLeaving] = useState<Verdict | null>(null)

  // Look the next trailer up while this one plays, so it is ready on the swipe.
  useEffect(() => {
    if (next) fetchTrailerKey(next)
  }, [next])

  /** How far a drag must travel before letting go commits it. */
  const thresholdFor = (width: number) => Math.min(140, width * 0.3)

  /**
   * One verdict's overlay: the wash and the stamp follow the drag, and the
   * stamp fills solid ("armed") once letting go would commit.
   */
  /**
   * One verdict's feedback: the wash on the card follows the drag, and the
   * stamp above the stack scales in and fills solid ("armed") once letting go
   * would commit. The stamp lives outside the card, so it stays whole and on
   * screen however far the card slides.
   */
  const paintFx = (verdict: Verdict, p: number, armed: boolean, animate: boolean) => {
    const wash = verdict === 'request' ? requestFxRef.current : skipFxRef.current
    const stamp = verdict === 'request' ? requestStampRef.current : skipStampRef.current
    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)'
    // Readable well before the commit point, not only at the end of the drag.
    const opacity = String(Math.min(1, p * 1.6))
    if (wash) {
      wash.style.transition = animate ? `opacity 200ms ${ease}` : 'none'
      wash.style.opacity = opacity
    }
    if (stamp) {
      const dir = verdict === 'request' ? -1 : 1
      stamp.style.transition = animate ? `opacity 200ms ${ease}, transform 200ms ${ease}` : 'none'
      stamp.style.opacity = opacity
      stamp.dataset.armed = String(armed)
      stamp.style.transform = `translate(-50%, -50%) rotate(${dir * 7}deg) scale(${0.72 + 0.28 * p + (armed ? 0.06 : 0)})`
    }
  }

  const paint = (dx: number, animate: boolean) => {
    const el = cardRef.current
    if (!el) return
    const width = el.offsetWidth || 1
    el.style.transition = animate ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
    el.style.transform = dx === 0 ? '' : `translateX(${dx}px) rotate(${(dx / width) * MAX_TILT}deg)`
    const threshold = thresholdFor(width)
    const p = Math.min(1, Math.abs(dx) / threshold)
    const armed = Math.abs(dx) >= threshold
    paintFx('request', dx > 0 ? p : 0, dx > 0 && armed, animate)
    paintFx('skip', dx < 0 ? p : 0, dx < 0 && armed, animate)
  }

  const commit = useCallback(
    (verdict: Verdict) => {
      if (leaving) return
      setLeaving(verdict)
      const el = cardRef.current
      if (!el || prefersReducedMotion()) {
        onDecide(card, verdict)
        return
      }
      const width = el.offsetWidth
      const dir = verdict === 'request' ? 1 : -1
      // A button or arrow key gets the same stamp a swipe earns, held for a
      // beat before the card leaves; a swipe already shows it.
      const fromDrag = el.style.transform !== ''
      paintFx(verdict, 1, true, true)
      const flyOut = () => {
        el.style.transition =
          'transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 200ms cubic-bezier(0.4, 0, 1, 1)'
        el.style.transform = `translateX(${dir * width * 1.15}px) rotate(${dir * MAX_TILT * 1.5}deg)`
        el.style.opacity = '0'
        const stamp = verdict === 'request' ? requestStampRef.current : skipStampRef.current
        if (stamp) {
          stamp.style.transition = 'opacity 200ms ease-in'
          stamp.style.opacity = '0'
        }
        window.setTimeout(() => onDecide(card, verdict), 190)
      }
      if (fromDrag) flyOut()
      else window.setTimeout(flyOut, 180)
    },
    [card, leaving, onDecide]
  )

  // Arrow keys work anywhere on the page that is not a text field or another widget.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target instanceof Element ? e.target : null
      if (
        target?.closest(
          'input, textarea, select, [contenteditable], [role="dialog"], [role="slider"], [role="radiogroup"]'
        )
      )
        return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        commit('request')
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        commit('skip')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit])

  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      samples: [{ x: e.clientX, t: e.timeStamp }],
      active: false,
    }
    suppressClick.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (!d.active) {
      // Vertical intent belongs to the page scroll.
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null
        return
      }
      if (Math.abs(dx) < 8) return
      d.active = true
      suppressClick.current = true
      cardRef.current?.setPointerCapture(e.pointerId)
    }
    d.samples.push({ x: e.clientX, t: e.timeStamp })
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > FLING_WINDOW_MS) {
      d.samples.shift()
    }
    paint(dx, false)
  }

  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId || !d.active) return
    const dx = e.clientX - d.x0
    const width = cardRef.current?.offsetWidth ?? 300
    const threshold = thresholdFor(width)

    const first = d.samples[0]
    const span = e.timeStamp - first.t
    const v = span > 0 ? (e.clientX - first.x) / span : 0
    const flingReach = Math.max(FLING_MIN_PX, threshold * FLING_MIN_SHARE)
    const flung = (dir: 1 | -1) => dir * v > FLING_VELOCITY && dir * dx > flingReach

    if (dx > threshold || flung(1)) commit('request')
    else if (dx < -threshold || flung(-1)) commit('skip')
    else paint(0, true)
  }

  return (
    <div>
      <div className="relative">
        {/* The next card peeks out underneath, so the deck reads as a deck. */}
        {next && (
          <div
            aria-hidden="true"
            className="absolute inset-x-3 -bottom-2 top-2 rounded-xl border border-border bg-muted/60 dark:bg-card/60"
          />
        )}

        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClickCapture={(e) => {
            if (suppressClick.current) {
              e.preventDefault()
              e.stopPropagation()
              suppressClick.current = false
            }
          }}
          className="relative touch-pan-y select-none overflow-hidden rounded-xl border border-border bg-card will-change-transform"
          aria-roledescription="recommendation"
          aria-label={`${card.title}${card.year ? `, ${card.year}` : ''}. ${card.reason}.`}
        >
          <TrailerStrip card={card} soundUnlocked={soundUnlocked} />
          <CardBody card={card} />

          {/* Verdict washes, from the side the card travels towards. */}
          <div
            ref={requestFxRef}
            aria-hidden="true"
            style={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
          >
            <div className="absolute inset-0 bg-gradient-to-l from-primary/50 via-primary/15 to-transparent" />
          </div>
          <div
            ref={skipFxRef}
            aria-hidden="true"
            style={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-foreground/40 via-foreground/10 to-transparent" />
          </div>
        </div>

        {/* Verdict stamps: outside the card so they stay whole and on screen, over
            the details rather than the trailer — Safari can paint a playing
            video frame above anything layered on top of it. */}
        <div
          ref={requestStampRef}
          aria-hidden="true"
          data-armed="false"
          style={{ opacity: 0, transform: 'translate(-50%, -50%) rotate(-7deg) scale(0.72)' }}
          className="group/stamp pointer-events-none absolute top-[74%] left-1/2 z-20 flex [backface-visibility:hidden] will-change-transform items-center gap-2 rounded-2xl border-[3px] border-primary bg-card/95 py-2 pr-4 pl-2 sm:gap-3 sm:py-2.5 sm:pr-5 sm:pl-2.5 text-primary shadow-xl transition-colors duration-150 data-[armed=true]:bg-primary data-[armed=true]:text-primary-foreground"
        >
          <span className="flex size-8 items-center justify-center rounded-full sm:size-10 bg-primary text-primary-foreground transition-colors duration-150 group-data-[armed=true]/stamp:bg-primary-foreground group-data-[armed=true]/stamp:text-primary">
            <HugeiconsIcon icon={Add01Icon} className="size-5 sm:size-6" strokeWidth={2.5} />
          </span>
          <span className="text-base leading-6 font-bold whitespace-nowrap sm:text-xl sm:leading-7">
            <span className="group-data-[armed=true]/stamp:hidden">Request</span>
            <span className="hidden group-data-[armed=true]/stamp:inline">Release to request</span>
          </span>
        </div>
        <div
          ref={skipStampRef}
          aria-hidden="true"
          data-armed="false"
          style={{ opacity: 0, transform: 'translate(-50%, -50%) rotate(7deg) scale(0.72)' }}
          className="group/stamp pointer-events-none absolute top-[74%] left-1/2 z-20 flex [backface-visibility:hidden] will-change-transform items-center gap-2 rounded-2xl border-[3px] border-foreground bg-card/95 py-2 pr-4 pl-2 sm:gap-3 sm:py-2.5 sm:pr-5 sm:pl-2.5 text-foreground shadow-xl transition-colors duration-150 data-[armed=true]:bg-foreground data-[armed=true]:text-background"
        >
          <span className="flex size-8 items-center justify-center rounded-full sm:size-10 bg-foreground text-background transition-colors duration-150 group-data-[armed=true]/stamp:bg-background group-data-[armed=true]/stamp:text-foreground">
            <HugeiconsIcon icon={Cancel01Icon} className="size-5 sm:size-6" strokeWidth={2.5} />
          </span>
          <span className="text-base leading-6 font-bold whitespace-nowrap sm:text-xl sm:leading-7">
            <span className="group-data-[armed=true]/stamp:hidden">Skip</span>
            <span className="hidden group-data-[armed=true]/stamp:inline">Release to skip</span>
          </span>
        </div>
      </div>

      {/* Thumb-reach actions. The same verdicts as a swipe or an arrow key. */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:flex sm:items-center">
        <Button
          variant="outline"
          size="lg"
          className="h-12 sm:h-10"
          onClick={() => commit('skip')}
          disabled={!!leaving}
        >
          <HugeiconsIcon icon={Cancel01Icon} />
          Skip
          <kbd className="ml-1 hidden rounded border border-border px-1 text-xs leading-4 text-muted-foreground pointer-fine:inline">
            ←
          </kbd>
        </Button>
        <Button
          size="lg"
          className="h-12 sm:h-10"
          onClick={() => commit('request')}
          disabled={!!leaving}
        >
          <HugeiconsIcon icon={Add01Icon} />
          Request
          <kbd className="ml-1 hidden rounded border border-primary-foreground/40 px-1 text-xs leading-4 pointer-fine:inline">
            →
          </kbd>
        </Button>
        <p className="readout col-span-2 text-center text-xs text-muted-foreground sm:ml-auto sm:text-right">
          {remaining} left
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trailer — a muted, looping YouTube embed across the top of the card
// ---------------------------------------------------------------------------

interface CastMember {
  name: string
  character: string
  photo: string | null
}

interface CardExtras {
  key: string | null
  cast: CastMember[]
}

const NO_EXTRAS: CardExtras = { key: null, cast: [] }
const extrasCache = new Map<string, Promise<CardExtras>>()

/** Trailer and cast for one card, fetched once and shared by everything on it. */
function fetchExtras(card: ForYouCard): Promise<CardExtras> {
  if (card.mediaType !== 'movie' && card.mediaType !== 'tv') return Promise.resolve(NO_EXTRAS)
  let pending = extrasCache.get(card.key)
  if (!pending) {
    pending = fetch(`/api/v1/for-you/extras/${card.mediaType}/${card.externalId}`)
      .then((res) => (res.ok ? res.json() : NO_EXTRAS))
      .then((body: Partial<CardExtras>) => ({ key: body.key ?? null, cast: body.cast ?? [] }))
      .catch(() => NO_EXTRAS)
    extrasCache.set(card.key, pending)
  }
  return pending
}

const fetchTrailerKey = (card: ForYouCard) => fetchExtras(card).then((e) => e.key)

/** Reduced motion or a data-saver connection get a play button, not autoplay. */
function mayAutoplay(): boolean {
  if (typeof window === 'undefined') return false
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    ?.saveData
  return !prefersReducedMotion() && !saveData
}

/**
 * Set once a browser refuses a trailer with sound (iOS Safari always does,
 * whatever the page gesture): later cards go straight to muted instead of
 * waiting out the same refusal each time.
 */
let soundRefusedThisVisit = false

function TrailerStrip({ card, soundUnlocked }: { card: ForYouCard; soundUnlocked: boolean }) {
  const hasVideo = card.mediaType === 'movie' || card.mediaType === 'tv'
  const [videoKey, setVideoKey] = useState<string | null | undefined>(hasVideo ? undefined : null)
  const [playing, setPlaying] = useState(mayAutoplay)
  const [loaded, setLoaded] = useState(false)
  // Only once the player says it is actually playing does the backdrop give
  // way; an embed-disabled or region-blocked video never gets that far.
  const [started, setStarted] = useState(false)
  const [failed, setFailed] = useState(false)
  // Autoplay can be refused without a word (iOS Low Power Mode, some
  // blockers). After a few seconds without playback the player is shown as it
  // is, with YouTube's own play button.
  const [stalled, setStalled] = useState(false)
  // Autoplay with sound is attempted only after the start stage's click, and
  // only until a browser has said no.
  const [soundRefused, setSoundRefused] = useState(soundRefusedThisVisit)
  const withSound = soundUnlocked && !soundRefused
  const stripRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let live = true
    fetchTrailerKey(card).then((key) => live && setVideoKey(key))
    return () => {
      live = false
    }
  }, [card])

  const command = useCallback(
    (func: 'playVideo' | 'pauseVideo' | 'unloadModule', args: unknown[] = []) => {
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      )
    },
    []
  )

  // The player's last reported state, so scrolling back resumes a trailer
  // only if it was playing when it scrolled away — never one the user paused.
  const playerState = useRef<number | null>(null)
  const resumeOnReturn = useRef(false)
  const captionsCleared = useRef(false)

  // Scrolled away or tab hidden: pause, rather than play on to nobody.
  useEffect(() => {
    const el = stripRef.current
    if (!el || !loaded || typeof IntersectionObserver === 'undefined') return
    let visible = true
    const sync = () => {
      if (visible && !document.hidden) {
        if (resumeOnReturn.current) command('playVideo')
        resumeOnReturn.current = false
      } else if (playerState.current === 1) {
        resumeOnReturn.current = true
        command('pauseVideo')
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    observer.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [loaded, command])

  useEffect(() => {
    if (!loaded) return
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow || typeof e.data !== 'string') return
      let msg: { event?: string; info?: unknown }
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      const state =
        msg.event === 'onStateChange'
          ? msg.info
          : msg.event === 'infoDelivery'
            ? (msg.info as { playerState?: number } | null)?.playerState
            : undefined
      if (typeof state === 'number') playerState.current = state
      if (state === 1) {
        setStarted(true)
        // Captions follow the viewer's YouTube settings or a language
        // mismatch; start without them. The CC button still turns them on.
        if (!captionsCleared.current) {
          captionsCleared.current = true
          command('unloadModule', ['captions'])
          command('unloadModule', ['cc'])
        }
      }
      if (msg.event === 'onReady' || msg.event === 'initialDelivery') tries = 31
      if (msg.event === 'onError') setFailed(true)
    }
    window.addEventListener('message', onMessage)
    // Ask the player to report its state back. It ignores the request until it
    // has booted, so keep asking until it answers or plainly never will.
    let tries = 0
    const listen = window.setInterval(() => {
      if (++tries > 30) return window.clearInterval(listen)
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        '*'
      )
    }, 250)
    return () => {
      window.clearInterval(listen)
      window.removeEventListener('message', onMessage)
    }
  }, [loaded])

  useEffect(() => {
    if (!videoKey || !playing || started) return
    const t = window.setTimeout(() => setStalled(true), 5000)
    return () => window.clearTimeout(t)
  }, [videoKey, playing, started, withSound])

  // A browser that blocks sound simply never starts the video. Once the player
  // has loaded, give it four seconds; then reload the same trailer muted — it
  // plays, and YouTube's own volume control takes it from there.
  useEffect(() => {
    if (!loaded || started || !withSound) return
    const t = window.setTimeout(() => {
      soundRefusedThisVisit = true
      setSoundRefused(true)
      captionsCleared.current = false
      setLoaded(false)
      setStalled(false)
    }, 4000)
    return () => window.clearTimeout(t)
  }, [loaded, started, withSound])

  // A click on YouTube's controls moves keyboard focus into the player, where
  // the deck's arrow keys would never arrive. Hand focus back to the page
  // once the click has landed; the controls keep working with the mouse.
  useEffect(() => {
    const onBlur = () => {
      window.setTimeout(() => {
        if (document.activeElement === frameRef.current) frameRef.current?.blur()
      }, 150)
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])

  const backdrop = card.backdropUrl?.replace('/original/', '/w780/') ?? null
  if (!hasVideo || (videoKey === null && !backdrop)) return null

  const onLoad = () => setLoaded(true)

  const src =
    videoKey &&
    `https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=${withSound ? 0 : 1}&controls=1&cc_load_policy=0&playsinline=1&loop=1&playlist=${videoKey}&rel=0&iv_load_policy=3&disablekb=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`

  return (
    <div
      ref={stripRef}
      // The trailer is YouTube's to control — pause, seek, volume, fullscreen
      // — so a drag that starts here never swipes the card; the details
      // below are the swipe area.
      onPointerDown={(e) => e.stopPropagation()}
      className="relative flex aspect-video max-h-[clamp(12rem,38svh,22rem)] w-full justify-center overflow-hidden border-b border-border bg-black"
    >
      {/* The stage is always the player's own 16:9 at the strip's full height,
          centred: nothing is cropped. A wide card that caps the height gets
          black side bars; YouTube letterboxes scope trailers inside it. */}
      <div className="relative aspect-video h-full max-w-full">
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            draggable={false}
            className={cn(
              'absolute inset-0 size-full object-contain transition-opacity duration-500',
              (started || stalled) && !failed ? 'opacity-0' : 'opacity-100'
            )}
          />
        )}

        {src && playing && !failed && (
          <iframe
            key={src}
            ref={frameRef}
            src={src}
            title={`${card.title} trailer`}
            tabIndex={-1}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={onLoad}
            className={cn(
              'absolute inset-0 size-full border-0 transition-opacity duration-500',
              started || stalled ? 'opacity-100' : 'opacity-0'
            )}
          />
        )}

        {videoKey === undefined && !backdrop && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}
      </div>

      {src && !playing && !failed && (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 flex items-center justify-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
          aria-label={`Play ${card.title} trailer`}
        >
          <span className="flex h-10 items-center gap-2 rounded-full bg-black/70 pr-4 pl-3 text-sm font-medium text-white transition-colors group-hover:bg-black/85">
            <HugeiconsIcon icon={PlayIcon} className="size-5" />
            Play trailer
          </span>
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Start stage — the click that lets trailers play with sound
// ---------------------------------------------------------------------------

/**
 * Browsers only let a video start with sound after the user has interacted
 * with the page. Starting the deck is that interaction, so it gets a stage of
 * its own: a glance at what is waiting, and one button. (iOS Safari still
 * insists on a tap inside the player; the trailer falls back to muted there.)
 */
function StartStage({ cards, onStart }: { cards: ForYouCard[]; onStart: () => void }) {
  const fan = cards.slice(0, 3)
  const types = new Set(cards.map((c) => c.mediaType))
  const MIX_WORDS = { movie: 'movies', tv: 'TV', album: 'music', book: 'books' } as const
  const mix = (['movie', 'tv', 'album', 'book'] as const)
    .filter((t) => types.has(t))
    .map((t) => MIX_WORDS[t])
  const listed = mix.length > 1 ? `${mix.slice(0, -1).join(', ')} and ${mix.at(-1)}` : mix[0]
  const opening = listed ? listed[0].toUpperCase() + listed.slice(1) : 'Picks'
  const hasTrailers = types.has('movie') || types.has('tv')

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col items-center gap-7 sm:flex-row sm:gap-10">
        {/* A fanned hand of the first picks — what is waiting, at a glance. */}
        <div aria-hidden="true" className="relative h-44 w-56 shrink-0 sm:h-52 sm:w-64">
          {fan.map((card, i) => {
            const offset = i - (fan.length - 1) / 2
            return (
              <div
                key={card.key}
                className="absolute top-0 left-1/2 aspect-[2/3] h-full overflow-hidden rounded-lg border-2 border-card bg-muted ring-1 ring-border"
                style={{
                  transform: `translateX(-50%) translateX(${offset * 34}px) rotate(${offset * 7}deg)`,
                  transformOrigin: '50% 90%',
                  zIndex: fan.length - Math.abs(Math.round(offset * 2)),
                }}
              >
                <MediaImage
                  src={card.posterUrl}
                  alt=""
                  mediaType={TYPE_META[card.mediaType].imageType}
                  iconClassName="size-8"
                />
              </div>
            )
          })}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <h3 className="text-xl leading-7 font-semibold">
            <span className="readout">{cards.length}</span> {cards.length === 1 ? 'pick' : 'picks'}{' '}
            ready
          </h3>
          <p className="max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            {opening}, one at a time{hasTrailers ? ' — films and shows with their trailer' : ''}.
            Request what you want, skip what you don’t: every choice sharpens the next picks.
          </p>
          <Button size="lg" className="mt-2 h-12 px-6 sm:h-10" onClick={onStart}>
            <HugeiconsIcon icon={PlayIcon} />
            Start matching
          </Button>
          <p className="hidden text-xs text-muted-foreground pointer-fine:block">
            Then <kbd className="readout rounded border border-border px-1">←</kbd> skips and{' '}
            <kbd className="readout rounded border border-border px-1">→</kbd> requests.
          </p>
        </div>
      </div>
    </div>
  )
}

function CardBody({ card }: { card: ForYouCard }) {
  const { openMoviePreview, openTvShowPreview } = useMediaPreview()
  const meta = TYPE_META[card.mediaType]
  const square = card.mediaType === 'album'

  const openDetails = () => {
    if (card.mediaType === 'movie') openMoviePreview(card.externalId)
    else if (card.mediaType === 'tv') openTvShowPreview(card.externalId)
    else router.visit(`/${card.mediaType}/${card.externalId}`)
  }

  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 p-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-5 sm:p-4 lg:grid-cols-[10rem_minmax(0,1fr)]">
      <div
        className={cn(
          'overflow-hidden rounded-lg bg-muted shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]',
          square ? 'aspect-square self-start' : 'aspect-[2/3]'
        )}
      >
        <MediaImage
          src={card.posterUrl}
          alt=""
          mediaType={meta.imageType}
          iconClassName="size-10"
          className="pointer-events-none"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <HugeiconsIcon icon={meta.icon} className="size-3.5 shrink-0" />
            <span>{meta.label}</span>
            {card.year && (
              <>
                <span aria-hidden="true">·</span>
                <span className="readout">{card.year}</span>
              </>
            )}
            {card.rating !== null && card.rating > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <HugeiconsIcon icon={StarIcon} className="size-3 shrink-0" />
                <span className="readout">{card.rating.toFixed(1)}</span>
              </>
            )}
          </p>
          <h3 className="text-base font-semibold leading-snug text-balance sm:text-xl sm:leading-7">
            <button
              type="button"
              onClick={openDetails}
              className="text-left underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {card.title}
            </button>
          </h3>
          {card.subtitle && (
            <p className="truncate text-sm text-muted-foreground">{card.subtitle}</p>
          )}
        </div>

        <p className="flex items-start gap-1.5 text-xs font-medium text-foreground/80 sm:text-sm">
          <HugeiconsIcon
            icon={SparklesIcon}
            className="mt-px size-3.5 shrink-0 text-primary sm:mt-0.5 sm:size-4"
          />
          <span>{card.reason}</span>
        </p>

        {card.genres.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Genres">
            {card.genres.slice(0, 4).map((g) => (
              <li
                key={g}
                className="rounded-full border border-border px-2 py-px text-xs leading-4 text-muted-foreground"
              >
                {g}
              </li>
            ))}
          </ul>
        )}

        {card.overview && (
          <p className="hidden max-w-[65ch] text-sm leading-relaxed text-muted-foreground sm:line-clamp-5 sm:block">
            {card.overview}
          </p>
        )}
      </div>

      {card.overview && (
        <p className="col-span-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:hidden">
          {card.overview}
        </p>
      )}

      <CastRow card={card} />
    </div>
  )
}

/** How long the row waits after the user touched it before moving on its own. */
const CAST_IDLE_MS = 8000
const CAST_STEP_MS = 3200

/**
 * The top-billed cast, small: a face, a name and a role, two and a half at a
 * time on a phone (the cut-off one says "there is more"), four on wider cards. It drifts along on its own, one person at a time, and stops the
 * moment the user hovers, touches or scrolls it. Its gestures are its own —
 * grabbing it never starts a swipe of the card.
 */
function CastRow({ card }: { card: ForYouCard }) {
  const [cast, setCast] = useState<CastMember[]>([])
  const listRef = useRef<HTMLUListElement>(null)
  const pausedUntil = useRef(0)

  useEffect(() => {
    let live = true
    fetchExtras(card).then((e) => live && setCast(e.cast))
    return () => {
      live = false
    }
  }, [card])

  useEffect(() => {
    if (cast.length === 0 || prefersReducedMotion()) return
    const t = window.setInterval(() => {
      const el = listRef.current
      if (!el || Date.now() < pausedUntil.current || document.hidden) return
      if (el.scrollWidth <= el.clientWidth + 1) return
      const first = el.firstElementChild as HTMLElement | null
      const step = (first?.offsetWidth ?? 120) + 12
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: step, behavior: 'smooth' })
      }
    }, CAST_STEP_MS)
    return () => window.clearInterval(t)
  }, [cast])

  if (cast.length === 0) return null
  const hold = (ms = CAST_IDLE_MS) => {
    pausedUntil.current = Date.now() + ms
  }

  return (
    <section aria-label="Cast" className="col-span-2 min-w-0 border-t border-border pt-3">
      <ul
        ref={listRef}
        onPointerDown={(e) => {
          e.stopPropagation()
          hold()
        }}
        onPointerEnter={() => hold()}
        onPointerLeave={() => hold(1500)}
        onWheel={() => hold()}
        onFocus={() => hold()}
        className="-my-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [touch-action:pan-x_pan-y] [&::-webkit-scrollbar]:hidden"
      >
        {cast.map((person) => (
          <li
            key={`${person.name}-${person.character}`}
            className="flex w-[calc((100%-1.5rem)/2.5)] min-w-0 shrink-0 snap-start items-center gap-2 sm:w-[calc((100%-2.25rem)/4)]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {person.photo ? (
                <img
                  src={person.photo}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="size-8 rounded-full object-cover"
                />
              ) : (
                person.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.6875rem] leading-4 font-medium">
                {person.name}
              </span>
              {person.character && (
                <span className="block truncate text-[0.6875rem] leading-4 text-muted-foreground">
                  {person.character}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DeckSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading recommendations">
      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 rounded-xl border border-border p-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:p-4 lg:grid-cols-[10rem_minmax(0,1fr)]">
        <Skeleton className="aspect-[2/3] w-full rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="hidden h-20 w-full sm:block" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:flex">
        <Skeleton className="h-12 sm:h-10 sm:w-28" />
        <Skeleton className="h-12 sm:h-10 sm:w-32" />
      </div>
    </div>
  )
}

function DeckMessage({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon icon={SparklesIcon} className="size-6 text-muted-foreground" />
      </div>
      <p className="text-base font-medium">{title}</p>
      <p className="max-w-[44ch] text-sm text-muted-foreground">{body}</p>
      <div className="mt-2">{action}</div>
    </div>
  )
}
