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
  LinkSquare02Icon,
  Bookmark01Icon,
  ViewOffSlashIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectItem, SelectPopup, SelectTrigger } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaPreview } from '@/contexts/media_preview_context'
import { SkippedSheet } from '@/components/dashboard/skipped-sheet'
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
  /** Released recently; the deck already favours it, the card says so. */
  isNew?: boolean
  /** An album by an artist not yet in the library. */
  albumRef?: { artistMbid: string; releaseGroupMbid: string }
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
  requestDefaults: {
    movie: RequestDefaults | null
    tv: RequestDefaults | null
    album?: RequestDefaults | null
  }
  /** The types the user last chose to see; null means all. */
  preferences?: { types: DeckMediaType[] | null; mode?: DeckMode }
  mode?: DeckMode
}

const ALL_TYPES = ['movie', 'tv', 'album', 'book'] as const

type DeckMode = 'for-you' | 'new' | 'classics' | 'top-rated'

/** What the deck is about. Taste orders the cards within every mode. */
const MODES: { value: DeckMode; label: string; hint: string }[] = [
  { value: 'for-you', label: 'Your taste', hint: 'Picked from what you like' },
  { value: 'new', label: 'New', hint: 'Released recently' },
  { value: 'classics', label: 'Classics', hint: 'Decades old and still loved' },
  {
    value: 'top-rated',
    label: 'Top rated',
    hint: 'Weighted by how many rated it · music by plays',
  },
]

/**
 * A faint tint per kind of media for covers that are missing. Hues sit between
 * the status colours, and chroma stays low, so a blank cover says "a book" at
 * a glance without reading as a state.
 */
const COVER_TINT: Record<DeckMediaType, string> = {
  movie:
    'bg-[oklch(0.95_0.025_0)] text-[oklch(0.62_0.1_0)] dark:bg-[oklch(0.3_0.035_0)] dark:text-[oklch(0.72_0.09_0)]',
  tv: 'bg-[oklch(0.95_0.025_190)] text-[oklch(0.6_0.08_190)] dark:bg-[oklch(0.3_0.03_190)] dark:text-[oklch(0.72_0.08_190)]',
  album:
    'bg-[oklch(0.95_0.03_110)] text-[oklch(0.6_0.09_110)] dark:bg-[oklch(0.3_0.035_110)] dark:text-[oklch(0.74_0.09_110)]',
  book: 'bg-[oklch(0.95_0.03_50)] text-[oklch(0.62_0.09_50)] dark:bg-[oklch(0.3_0.035_50)] dark:text-[oklch(0.74_0.08_50)]',
}

/** A card's cover, or the type's icon on a faint tint when there is none. */
function DeckCover({ card, iconClassName }: { card: ForYouCard; iconClassName: string }) {
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // An image that finished before React attached its handlers (server-rendered
  // pages, the browser cache) never fires onLoad; check once on mount.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) {
      if (img.naturalWidth <= 2) setBroken(true)
      else setLoaded(true)
    }
  }, [])

  if (card.posterUrl && !broken) {
    return (
      <div className="relative size-full">
        {/* Covers can take a while; the tile breathes until one arrives. */}
        {!loaded && <div aria-hidden="true" className="cover-loading absolute inset-0" />}
        <img
          ref={imgRef}
          src={card.posterUrl}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setBroken(true)}
          // OpenLibrary answers a missing cover with a 1×1 blank image rather
          // than an error; treat anything that small as no cover at all.
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth <= 2) setBroken(true)
            else setLoaded(true)
          }}
          className={cn(
            'pointer-events-none relative size-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>
    )
  }
  return (
    <div className={cn('flex size-full items-center justify-center', COVER_TINT[card.mediaType])}>
      <HugeiconsIcon
        icon={TYPE_META[card.mediaType].icon}
        aria-hidden="true"
        className={iconClassName}
        strokeWidth={1.5}
      />
    </div>
  )
}

/** Remember what the deck is about, like the type selection. */
function saveMode(mode: DeckMode) {
  fetch('/api/v1/for-you/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  }).catch(() => {})
}

/** Remember the user's type selection on the server, so it follows them. */
function saveTypes(types: DeckMediaType[]) {
  fetch('/api/v1/for-you/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ types: types.length > 0 ? types : null }),
  }).catch(() => {})
}

/** Save: wanted, but not from here — usually because it streams elsewhere. */
type Verdict = 'request' | 'skip' | 'save'

const TYPE_META: Record<
  DeckMediaType,
  {
    label: string
    plural: string
    icon: typeof Film01Icon
  }
> = {
  movie: { label: 'Movie', plural: 'Movies', icon: Film01Icon },
  tv: { label: 'Series', plural: 'TV', icon: Tv01Icon },
  album: { label: 'Album', plural: 'Music', icon: CdIcon },
  book: { label: 'Book', plural: 'Books', icon: Book01Icon },
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

  // An album by a new artist: add the artist (not followed) and this album.
  if (card.albumRef) {
    const d = defaults.album
    if (!d) {
      return {
        ok: false,
        error:
          'No quality profile or root folder for music. Add one in Settings → Media Management.',
      }
    }
    const res = await postJson('/api/v1/albums', 'POST', {
      musicbrainzId: card.albumRef.releaseGroupMbid,
      artistMusicbrainzId: card.albumRef.artistMbid,
      qualityProfileId: d.qualityProfileId,
      rootFolderId: d.rootFolderId,
      requested: true,
      searchForAlbum: true,
    })
    if (!res.ok && res.status !== 409) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body.error || `The server rejected ${card.title}.` }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: true, href: data.id ? `/album/${data.id}` : null }
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

function recordFeedback(card: ForYouCard, action: 'requested' | 'skipped' | 'interested') {
  return postJson('/api/v1/for-you/feedback', 'POST', {
    mediaType: card.mediaType,
    externalId: card.externalId,
    action,
    title: card.title,
    genres: card.genres.slice(0, 20),
    posterUrl: card.posterUrl,
    year: card.year,
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
  // Types the user picked; empty means everything. Restored from their saved
  // preference on the first load, saved again on every change.
  const [selected, setSelected] = useState<DeckMediaType[]>([])
  const restoredPrefs = useRef(false)
  const [announce, setAnnounce] = useState('')
  // The start stage's click is the user gesture browsers want before a video
  // may play with sound; until then the deck is a preview.
  const [session, setSession] = useState<{ sound: boolean } | null>(null)

  // What the deck is about; the server remembers the user's last choice.
  const [mode, setMode] = useState<DeckMode | null>(null)

  const load = useCallback(async (refresh = false, asMode?: DeckMode) => {
    setLoading(true)
    setFailed(false)
    try {
      const qs = new URLSearchParams()
      if (refresh) qs.set('refresh', '1')
      if (asMode) qs.set('mode', asMode)
      const res = await fetch(`/api/v1/for-you${qs.size ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error(String(res.status))
      const body: DeckResponse = await res.json()
      setData(body)
      setCards(body.cards)
      if (body.mode) setMode(body.mode)
      if (!restoredPrefs.current) {
        restoredPrefs.current = true
        setSelected(body.preferences?.types ?? [])
      }
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
    return ALL_TYPES.filter((t) => types.has(t))
  }, [cards])

  // What is actually shown: the picked types that still have cards. When none
  // of them do (their last card was just used), everything shows — without
  // forgetting the saved choice, which applies again once they have cards.
  const shown = useMemo(() => selected.filter((t) => available.includes(t)), [selected, available])

  const visible = useMemo(
    () => (shown.length === 0 ? cards : cards.filter((c) => shown.includes(c.mediaType))),
    [cards, shown]
  )

  const toggleType = (type: DeckMediaType) => {
    const next = shown.includes(type) ? shown.filter((t) => t !== type) : [...shown, type]
    // Every type picked is the same as all of them.
    const normalized = next.length >= available.length ? [] : next
    setSelected(normalized)
    saveTypes(normalized)
  }

  const showAll = () => {
    setSelected([])
    saveTypes([])
  }
  const current = visible[0] ?? null
  const next = visible[1] ?? null

  // Titles brought back from the skipped list return with the next load.
  const [skippedOpen, setSkippedOpen] = useState(false)
  const skipsChanged = useRef(false)
  const onSkippedOpenChange = (open: boolean) => {
    setSkippedOpen(open)
    if (!open && skipsChanged.current) {
      skipsChanged.current = false
      load(false, mode ?? undefined)
    }
  }

  const remove = (key: string) => setCards((prev) => prev.filter((c) => c.key !== key))
  const restore = (card: ForYouCard) =>
    setCards((prev) => (prev.some((c) => c.key === card.key) ? prev : [card, ...prev]))

  const decide = useCallback(
    async (card: ForYouCard, verdict: Verdict) => {
      if (!data) return
      remove(card.key)

      // Skipping a title after opening it on a streaming service is not a
      // "not for me": it is wanted, just not from here.
      const saved = verdict === 'save' || (verdict === 'skip' && streamingOpened.has(card.key))
      if (saved || verdict === 'skip') {
        const said = saved ? `Saved ${card.title}` : `Skipped ${card.title}`
        setAnnounce(said)
        recordFeedback(card, saved ? 'interested' : 'skipped').catch(() => {})
        toast(said, {
          description:
            saved && verdict === 'skip'
              ? 'You opened it on a streaming service, so it counts as interested.'
              : undefined,
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
            size="sm"
            onClick={() => setSkippedOpen(true)}
            aria-label="Skipped titles"
            title="Skipped titles"
          >
            <HugeiconsIcon icon={ViewOffSlashIcon} />
            <span className="hidden sm:inline">Skipped</span>
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/watchlist" aria-label="Watchlist" title="Watchlist">
              <HugeiconsIcon icon={Bookmark01Icon} />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => load(true, mode ?? undefined)}
            disabled={loading}
            aria-label="Build a fresh deck"
            title="Build a fresh deck"
          >
            <HugeiconsIcon icon={Refresh01Icon} className={cn(loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Types on the left, scrolling sideways when they do not fit; what the
          deck is about on the right, always in reach. */}
      <div className="mb-3 flex items-center gap-2">
        <div
          role="group"
          aria-label="Show these types"
          data-deck-filters
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-4 pb-0.5 [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [&::-webkit-scrollbar]:hidden"
        >
          {available.length > 1 && (
            <>
              <FilterChip active={shown.length === 0} onClick={showAll} count={cards.length}>
                All
              </FilterChip>
              {available.map((t) => (
                <FilterChip
                  key={t}
                  active={shown.includes(t)}
                  onClick={() => toggleType(t)}
                  count={cards.filter((c) => c.mediaType === t).length}
                >
                  {TYPE_META[t].plural}
                </FilterChip>
              ))}
            </>
          )}
        </div>
        <div className="shrink-0">
          <Select
            value={mode ?? 'for-you'}
            onValueChange={(value) => {
              const next = value as DeckMode
              if (next === mode) return
              setMode(next)
              saveMode(next)
              load(false, next)
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-auto gap-1 rounded-full px-3 text-xs"
              aria-label="What to show"
            >
              <span>{MODES.find((m) => m.value === (mode ?? 'for-you'))?.label}</span>
            </SelectTrigger>
            <SelectPopup>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  <span className="flex flex-col">
                    <span>{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.hint}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      </div>

      {loading && !data ? (
        <DeckSkeleton />
      ) : failed ? (
        <DeckMessage
          title="Couldn't build your deck"
          body="The recommendation sources didn't answer. TMDB may be rate-limiting, or Hamster lost its connection."
          action={
            <Button variant="outline" size="sm" onClick={() => load(true, mode ?? undefined)}>
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
            <Button variant="outline" size="sm" onClick={() => load(true, mode ?? undefined)}>
              <HugeiconsIcon icon={Refresh01Icon} />
              Build a fresh deck
            </Button>
          }
        />
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <SkippedSheet
        open={skippedOpen}
        onOpenChange={onSkippedOpenChange}
        onChanged={() => (skipsChanged.current = true)}
      />
    </section>
  )
}

/** A type toggle. Several can be on at once; none on means all. */
function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {children}
      <span className={cn('readout', active ? 'opacity-70' : 'opacity-60')}>{count}</span>
    </button>
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
  const saveStampRef = useRef<HTMLDivElement>(null)
  const stampFor = (verdict: Verdict) =>
    ({ request: requestStampRef, skip: skipStampRef, save: saveStampRef })[verdict].current
  const drag = useRef<{
    id: number
    x0: number
    y0: number
    /** Where the last real move put the card — never read from the end event. */
    dx: number
    active: boolean
  } | null>(null)
  const suppressClick = useRef(false)
  const [leaving, setLeaving] = useState<Verdict | null>(null)

  // Look the next trailer up while this one plays, so it is ready on the swipe.
  useEffect(() => {
    if (next) {
      fetchTrailerKey(next)
      fetchProviders(next)
    }
  }, [next])

  /** How far a drag must travel before letting go commits it. */
  const thresholdFor = (width: number) => Math.min(140, width * 0.3)

  /**
   * One verdict's feedback: the wash on the card follows the drag, and the
   * stamp above the stack scales in and fills solid ("armed") once letting go
   * would commit. The stamp lives outside the card, so it stays whole and on
   * screen however far the card slides.
   */
  const paintFx = (verdict: Verdict, p: number, armed: boolean, animate: boolean) => {
    // Save has no drag, so no wash: only its stamp, from a button or a key.
    const wash =
      verdict === 'request' ? requestFxRef.current : verdict === 'skip' ? skipFxRef.current : null
    const stamp = stampFor(verdict)
    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)'
    // Readable well before the commit point, not only at the end of the drag.
    const opacity = String(Math.min(1, p * 1.6))
    if (wash) {
      wash.style.transition = animate ? `opacity 200ms ${ease}` : 'none'
      wash.style.opacity = opacity
    }
    if (stamp) {
      const dir = verdict === 'request' ? -1 : verdict === 'skip' ? 1 : 0
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
      // Saved cards go up and away, to be found again later; the others fly
      // off to their side.
      const away =
        verdict === 'save'
          ? `translateY(${-el.offsetHeight * 0.5}px) scale(0.92)`
          : `translateX(${dir * width * 1.15}px) rotate(${dir * MAX_TILT * 1.5}deg)`
      // A button or arrow key gets the same stamp a swipe earns, held for a
      // beat before the card leaves; a swipe already shows it.
      const fromDrag = el.style.transform !== ''
      paintFx(verdict, 1, true, true)
      const flyOut = () => {
        el.style.transition =
          'transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 200ms cubic-bezier(0.4, 0, 1, 1)'
        el.style.transform = away
        el.style.opacity = '0'
        const stamp = stampFor(verdict)
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
          'input, textarea, select, [contenteditable], [role="dialog"], [role="slider"], [role="menu"], [data-deck-filters]'
        )
      )
        return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        commit('request')
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        commit('skip')
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        commit('save')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit])

  // Once the card is moving, keep Safari from turning the rest of the touch
  // into a page scroll (it would cancel the drag mid-swipe). Needs a
  // non-passive listener; React's touch handlers are passive.
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const onTouchMove = (e: TouchEvent) => {
      if (drag.current?.active && e.cancelable) e.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      dx: 0,
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
      // The card follows once the movement is mostly sideways. No early
      // verdict the other way: a thumb's arc often starts a little vertical,
      // and giving up on it then threw away the whole swipe. A real vertical
      // scroll is the browser's anyway — it cancels the pointer.
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return
      d.active = true
      suppressClick.current = true
      cardRef.current?.setPointerCapture(e.pointerId)
    }
    d.dx = dx
    paint(dx, false)
  }

  /**
   * The end of a drag. A cancelled one never commits: iPad Safari cancels a
   * touch when it takes it over (to scroll, say) and may report the finger at
   * x = 0, which read as a long drag to the left and skipped the card on a
   * light touch. And the distance is the last move's, not the end event's.
   */
  const onPointerEnd = (e: React.PointerEvent, cancelled = false) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId || !d.active) return
    if (cancelled) {
      paint(0, true)
      return
    }
    const dx = d.dx
    const width = cardRef.current?.offsetWidth ?? 300
    const threshold = thresholdFor(width)

    // Only a drag past the commit point counts — the point where the stamp
    // says "Release to …". Speed alone never commits: quick flicks fired far
    // too easily.
    if (dx > threshold) commit('request')
    else if (dx < -threshold) commit('skip')
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
          onPointerUp={(e) => onPointerEnd(e)}
          onPointerCancel={(e) => onPointerEnd(e, true)}
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
        <div
          ref={saveStampRef}
          aria-hidden="true"
          data-armed="false"
          style={{ opacity: 0, transform: 'translate(-50%, -50%) scale(0.72)' }}
          className="pointer-events-none absolute top-[74%] left-1/2 z-20 flex [backface-visibility:hidden] will-change-transform items-center gap-2 rounded-2xl border-[3px] border-foreground bg-foreground py-2 pr-4 pl-2 sm:gap-3 sm:py-2.5 sm:pr-5 sm:pl-2.5 text-background shadow-xl"
        >
          <span className="flex size-8 items-center justify-center rounded-full sm:size-10 bg-background text-foreground">
            <HugeiconsIcon icon={Bookmark01Icon} className="size-5 sm:size-6" strokeWidth={2.5} />
          </span>
          <span className="text-base leading-6 font-bold whitespace-nowrap sm:text-xl sm:leading-7">
            Saved
          </span>
        </div>
      </div>

      {/* Thumb-reach actions. The same verdicts as a swipe or an arrow key;
          save has no swipe — up is the page's scroll. */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-3 sm:flex sm:items-center">
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
          variant="outline"
          size="lg"
          className="h-12 sm:h-10"
          onClick={() => commit('save')}
          disabled={!!leaving}
          title="Interested, but not requesting it — say it streams elsewhere"
        >
          <HugeiconsIcon icon={Bookmark01Icon} />
          Save
          <kbd className="ml-1 hidden rounded border border-border px-1 text-xs leading-4 text-muted-foreground pointer-fine:inline">
            ↑
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
        <p className="readout col-span-3 text-center text-xs text-muted-foreground sm:ml-auto sm:text-right">
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

interface StreamingProvider {
  id: number
  name: string
  logoUrl: string
}

const providerCache = new Map<string, Promise<StreamingProvider[]>>()

/**
 * Where a film or show streams, on the services the user picked in settings —
 * the same check the Search posters make.
 */
function fetchProviders(card: ForYouCard): Promise<StreamingProvider[]> {
  if (card.mediaType !== 'movie' && card.mediaType !== 'tv') return Promise.resolve([])
  let pending = providerCache.get(card.key)
  if (!pending) {
    pending = fetch('/api/v1/watch-providers/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdbIds: [card.externalId], type: card.mediaType }),
    })
      .then((res) => (res.ok ? res.json() : { providers: {} }))
      .then(
        (body: { providers?: Record<string, StreamingProvider[]> }) =>
          body.providers?.[card.externalId] ?? []
      )
      .catch(() => [])
    providerCache.set(card.key, pending)
  }
  return pending
}

interface StreamingLink extends StreamingProvider {
  url: string
  /** A deep link into the service; otherwise TMDB's watch page for the title. */
  direct: boolean
}

const linkCache = new Map<string, Promise<StreamingLink[]>>()

/** Cards whose title the user opened on a streaming service this visit. */
const streamingOpened = new Set<string>()

/** Where to open the title on each of those services. */
function fetchLinks(card: ForYouCard): Promise<StreamingLink[]> {
  let pending = linkCache.get(card.key)
  if (!pending) {
    const params = new URLSearchParams({
      type: card.mediaType,
      tmdbId: card.externalId,
      title: card.title,
    })
    pending = fetch(`/api/v1/watch-providers/links?${params}`)
      .then((res) => (res.ok ? res.json() : { links: [] }))
      .then((body: { links?: StreamingLink[] }) => body.links ?? [])
      .catch(() => [])
    linkCache.set(card.key, pending)
  }
  return pending
}

/**
 * Streaming logos on the poster, as on the Search posters: three, then "+N".
 * One service opens it there; several offer a menu of them.
 */
export function ProviderBadges({ card }: { card: ForYouCard }) {
  const [providers, setProviders] = useState<StreamingProvider[]>([])
  const [links, setLinks] = useState<StreamingLink[] | null>(null)
  useEffect(() => {
    let live = true
    setLinks(null)
    fetchProviders(card).then((p) => {
      if (!live) return
      setProviders(p)
      // Fetched ahead of the click, so a single service opens as a plain link
      // rather than a window the browser would block after an await.
      if (p.length > 0) fetchLinks(card).then((l) => live && setLinks(l))
    })
    return () => {
      live = false
    }
  }, [card])
  if (providers.length === 0) return null
  const shown = providers.slice(0, 3)
  const extra = providers.length - shown.length
  const label = `Watch on ${providers.map((p) => p.name).join(', ')}`
  const stack = (
    <>
      {shown.map((p) => (
        <img
          key={p.id}
          src={p.logoUrl}
          alt={p.name}
          draggable={false}
          className="size-5 rounded-sm ring-1 ring-black/40 sm:size-6"
        />
      ))}
      {extra > 0 && (
        <span className="readout ml-0.5 rounded-sm bg-black/60 px-1 py-0.5 text-xs leading-4 text-white ring-1 ring-black/40">
          +{extra}
        </span>
      )}
    </>
  )
  const stackClass =
    'streaming-fade-in absolute bottom-2 left-2 z-10 flex items-center -space-x-1 rounded-md outline-none transition-transform hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none'

  const opened = () => streamingOpened.add(card.key)

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
        onClick={opened}
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
          <DropdownMenuItem key={l.id} asChild onClick={opened}>
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

/** Reduced motion or a data-saver connection get a play button, not autoplay. */
function mayAutoplay(): boolean {
  if (typeof window === 'undefined') return false
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    ?.saveData
  return !prefersReducedMotion() && !saveData
}

/**
 * Set once the player reports that the browser blocked a trailer with sound
 * (iOS Safari always does, whatever the page gesture): later cards start
 * muted instead of being refused one by one.
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
  // only until a browser has said no. Fixed for the card's life: a refusal is
  // answered by muting the running player, not by reloading it.
  const [withSound] = useState(() => soundUnlocked && !soundRefusedThisVisit)
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
    (
      func: 'playVideo' | 'pauseVideo' | 'mute' | 'unloadModule' | 'addEventListener',
      args: unknown[] = []
    ) => {
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
  // The player has answered at all; until then its silence says nothing.
  const playerReady = useRef(false)
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
      if (msg.event === 'onReady' || msg.event === 'initialDelivery') {
        if (!playerReady.current) command('addEventListener', ['onAutoplayBlocked'])
        playerReady.current = true
        tries = 31
      }
      // The browser won't play it with sound: play it muted, and start the
      // rest of the visit's trailers that way. YouTube's volume control is
      // still there to turn it up.
      if (msg.event === 'onAutoplayBlocked') {
        soundRefusedThisVisit = true
        playMuted()
      }
      if (msg.event === 'onError') setFailed(true)
    }
    const playMuted = () => {
      command('mute')
      command('playVideo')
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
  }, [loaded, command])

  useEffect(() => {
    if (!videoKey || !playing || started) return
    const t = window.setTimeout(() => setStalled(true), 5000)
    return () => window.clearTimeout(t)
  }, [videoKey, playing, started, withSound])

  // The block can be reported before the player has taken our subscription.
  // As a fallback, a player that has answered but sits unstarted for four
  // visible seconds is taken as blocked too — this trailer only. Buffering is
  // the player trying, and a trailer that won't embed or was paused out of
  // sight isn't the browser's doing.
  useEffect(() => {
    if (!loaded || started || failed || !withSound) return
    let unstarted = 0
    const t = window.setInterval(() => {
      const state = playerState.current
      const idle = state === null || state === -1 || state === 5
      if (!playerReady.current || !idle || document.hidden) return
      if (++unstarted < 4) return
      window.clearInterval(t)
      command('mute')
      command('playVideo')
    }, 1000)
    return () => window.clearInterval(t)
  }, [loaded, started, failed, withSound, command])

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
                <DeckCover card={card} iconClassName="size-10" />
              </div>
            )
          })}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <h3 className="text-xl leading-7 font-semibold">
            <span className="readout">{cards.length}</span> {cards.length === 1 ? 'pick' : 'picks'}{' '}
            ready
          </h3>
          <p className="text-sm text-muted-foreground">{opening}, one at a time.</p>
          <Button size="lg" className="mt-2 h-12 px-6 sm:h-10" onClick={onStart}>
            <HugeiconsIcon icon={PlayIcon} />
            Start matching
          </Button>
          <p className="hidden text-xs text-muted-foreground pointer-fine:block">
            <kbd className="readout rounded border border-border px-1">←</kbd> skip ·{' '}
            <kbd className="readout rounded border border-border px-1">↑</kbd> save ·{' '}
            <kbd className="readout rounded border border-border px-1">→</kbd> request
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
          'relative overflow-hidden rounded-lg bg-muted shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]',
          square ? 'aspect-square self-start' : 'aspect-[2/3]'
        )}
      >
        <DeckCover card={card} iconClassName="size-12 sm:size-14" />
        <ProviderBadges card={card} />
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <HugeiconsIcon icon={meta.icon} className="size-3.5 shrink-0" />
            <span>{meta.label}</span>
            {card.isNew && (
              <span className="rounded-full border border-border px-1.5 text-xs leading-4 font-medium text-foreground">
                New
              </span>
            )}
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
          <p className="hidden max-w-[65ch] text-sm leading-relaxed text-muted-foreground sm:line-clamp-5">
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
