import db from '@adonisjs/lucid/services/db'
import AppSetting from '#models/app_setting'
import type { MediaType } from '#models/app_setting'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import RecommendationFeedback from '#models/recommendation_feedback'
import type { FeedbackMediaType } from '#models/recommendation_feedback'
import { tmdbService } from '#services/metadata/tmdb_service'
import type { TmdbMovie, TmdbTvShow } from '#services/metadata/tmdb_service'
import { tasteProviders } from '#services/taste/registry'
import { bookLanguages, titleSpeaks } from '#services/library/book_languages'
import { openLibraryService } from '#services/metadata/openlibrary_service'
import { listenBrainz, coverUrl } from '#services/music/listenbrainz_client'
import type { ArtistGenre } from '#services/music/listenbrainz_client'
import type { TastePick, TasteProviderStatus, TasteSeed } from '#services/taste/types'
import { recommendationService } from '#services/metadata/recommendation_service'
import { cache } from '#services/cache/cache_service'

/**
 * The dashboard's "For you" deck: one card at a time, request or skip.
 *
 * Movies and shows are found by walking TMDB recommendations out from what the
 * user has shown they like — every taste provider in `#services/taste` (Simkl
 * ratings, media-server watch history, …), titles they requested from this
 * deck, and what is already on disk — then ranked by how
 * many of those seeds point at a title and how well its genres match what was
 * kept versus skipped. Albums and books are the unowned studio albums and
 * books by artists and authors already in the library, weighted by how much of
 * each the user already has.
 */

export interface ForYouCard {
  key: string
  mediaType: FeedbackMediaType
  /** TMDB id for movies and shows; our own row id for albums and books. */
  externalId: string
  title: string
  year: number | null
  /** Artist or author for albums and books. */
  subtitle: string | null
  overview: string | null
  posterUrl: string | null
  backdropUrl: string | null
  /** TMDB audience score, 0–10. */
  rating: number | null
  genres: string[]
  reason: string
  score: number
  /** Released recently: boosted in the deck and tagged on the card. */
  isNew: boolean
  /**
   * An album by an artist not yet in the library: requesting it adds the
   * artist (as a container, not followed) and this one album.
   */
  albumRef?: { artistMbid: string; releaseGroupMbid: string }
}

export interface ForYouDeck {
  cards: ForYouCard[]
  signals: {
    /** One entry per taste provider, active or not. */
    sources: TasteProviderStatus[]
    requests: number
    library: number
  }
}

interface Seed {
  tmdbId: number
  title: string
  weight: number
  reason: string
}

interface Candidate {
  item: TmdbMovie | TmdbTvShow
  score: number
  best: { contribution: number; reason: string }
  seedCount: number
}

interface TasteProfile {
  movieSeeds: Seed[]
  tvSeeds: Seed[]
  /** Genre slug → affinity in [-1, 1]. */
  genres: Map<string, number>
  exclude: { movie: Set<string>; tv: Set<string> }
  /** Titles providers suggest outright — a watchlist, say. */
  picks: { movie: TastePick[]; tv: TastePick[] }
  sources: TasteProviderStatus[]
  counts: { requests: number; library: number }
}

const DECK_TTL = 30 * 60 * 1000
const DECK_SIZE = 48
const SEEDS_PER_TYPE = 8
const RECS_PER_SEED = 20
/** Obscure titles with a handful of votes are mostly noise in TMDB's graph. */
const MIN_VOTES = 80

const slug = (genre: string) =>
  genre
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function sample<T>(items: T[], n: number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

/**
 * Owning more than a dozen records by someone says no more than owning a
 * dozen; past that a mis-scanned "artist" (a folder called Old holding 800
 * albums) would crowd everyone else out of the deck.
 */
const AFFINITY_CAP = 12

const normalizeTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const NON_LATIN_LETTER = /(?!\p{Script=Latin})\p{L}/u
const BUNDLE = /\b(collection|box ?set|books? set|bundle|omnibus|\d+\s*books?)\b|\s\/\s/i

const ENGLISH_WORDS = /\b(the|of|and|to|in|for|with|your|you|is|how|why|what)\b/i
const FOREIGN_WORDS =
  /\b(la|le|les|el|los|las|del|della|di|che|il|der|die|das|und|het|een|des|du|est|es|un|una|sobre|con|para|por|pour|sur|dans|avec|mit|och|ist|ein|eine|von|zu)\b/i
const FOREIGN_LETTERS = /[ñáíóúàèìòùâêîôûäöüßçõãğışøå]/i

function looksForeign(title: string): boolean {
  if (ENGLISH_WORDS.test(title)) return false
  return FOREIGN_WORDS.test(title) || FOREIGN_LETTERS.test(title)
}

/**
 * Author bibliographies from OpenLibrary are full of other-language editions
 * and retailer bundles of books the user already has; neither is a new book.
 */
export function isWorthSuggestingBook(title: string, owned: string[]): boolean {
  if (BUNDLE.test(title)) return false
  const ownedLatin = owned.every((o) => !NON_LATIN_LETTER.test(o))
  if (ownedLatin && NON_LATIN_LETTER.test(title)) return false
  // Every book row has a null language, so guess: a title that reads as
  // another language, from an author none of whose owned titles do, is a
  // translation of something the user already has.
  if (looksForeign(title) && !owned.some(looksForeign)) return false
  const t = normalizeTitle(title)
  if (!t) return false
  return !owned.some((o) => {
    const n = normalizeTitle(o)
    return n.length >= 4 && (t.startsWith(n) || n.startsWith(t))
  })
}

/**
 * How long something counts as new, per kind of media. Albums and books reach
 * people more slowly than films and shows.
 */
const NEW_WINDOW_DAYS: Record<FeedbackMediaType, number> = {
  movie: 365,
  tv: 365,
  album: 730,
  book: 540,
}

/**
 * New releases rise in the deck without taking it over: a boost that fades
 * over the window, on top of everything else that decides a card's place —
 * not a lane of their own. Tagged "new" in the first half of the window.
 */
export function freshness(
  released: string | Date | null | undefined,
  mediaType: FeedbackMediaType,
  now = Date.now()
): { boost: number; isNew: boolean } {
  if (!released) return { boost: 0, isNew: false }
  const time = new Date(released).getTime()
  if (Number.isNaN(time)) return { boost: 0, isNew: false }
  const age = (now - time) / 86_400_000
  const window = NEW_WINDOW_DAYS[mediaType]
  if (age < 0 || age > window) return { boost: 0, isNew: false }
  return { boost: 0.1 + 0.4 * (1 - age / window), isNew: age <= window / 2 }
}

/**
 * OpenLibrary subjects are free text in any language, with machine tags mixed
 * in ("nyt:combined-print-and-e-book-fiction=2020-10-18"). Keep a few short,
 * readable ones — for the card and for learning what the user skips.
 */
export function cleanSubjects(subjects: string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of subjects ?? []) {
    const subject = raw.trim()
    if (!subject || /[:=]/.test(subject) || subject.length > 28) continue
    if (/bestseller|reviewed|popular works|accessible book|protected daisy/i.test(subject)) continue
    const key = subject.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(subject)
    if (out.length === 6) break
  }
  return out
}

/** a1, b1, a2, b2, … — both lists stay represented near the top. */
function alternate<T>(a: T[], b: T[]): T[] {
  const out: T[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i])
    if (i < b.length) out.push(b[i])
  }
  return out
}

/** Albums that are really compilations, live records or reissues. */
const NOT_A_STUDIO_ALBUM =
  /\b(live|remix(es)?|remaster(ed)?|greatest|best of|collection|anthology|essential|hits|deluxe|edition|sessions?)\b/i

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase())

function isMovie(item: TmdbMovie | TmdbTvShow): item is TmdbMovie {
  return 'title' in item
}

class ForYouService {
  deckCacheKey(userId: string) {
    return `for-you:${userId}`
  }

  invalidate(userId: string) {
    cache.delete(this.deckCacheKey(userId))
  }

  /** After a settings change that affects every user's taste profile. */
  invalidateAll() {
    cache.deleteByPrefix('for-you:')
  }

  async getDeck(userId: string, { refresh = false } = {}): Promise<ForYouDeck> {
    if (refresh) this.invalidate(userId)
    const deck = await cache.getOrSet(this.deckCacheKey(userId), DECK_TTL, () =>
      this.buildDeck(userId)
    )

    // The deck is cached, swipes are not: drop anything acted on since.
    const acted = await RecommendationFeedback.query()
      .where('userId', userId)
      .select('mediaType', 'externalId')
    const seen = new Set(acted.map((f) => `${f.mediaType}:${f.externalId}`))
    return { ...deck, cards: deck.cards.filter((c) => !seen.has(c.key)) }
  }

  private async buildDeck(userId: string): Promise<ForYouDeck> {
    const enabled = new Set(
      (await AppSetting.get<MediaType[]>('enabledMediaTypes', ['movies'])) ?? ['movies']
    )
    const taste = await this.buildTasteProfile(userId)

    const [movies, shows, albums, books] = await Promise.all([
      enabled.has('movies') ? this.movieCards(taste) : [],
      enabled.has('tv') ? this.tvCards(taste) : [],
      enabled.has('music')
        ? Promise.all([
            this.albumCards(userId),
            this.newArtistCards(userId, taste).catch(() => [] as ForYouCard[]),
          ]).then(([owned, discovered]) => alternate(owned, discovered))
        : [],
      enabled.has('books') ? this.bookCards(userId, taste) : [],
    ])

    return {
      cards: this.interleave([
        { cards: movies, weight: 3 },
        { cards: shows, weight: 2 },
        { cards: albums, weight: 2 },
        { cards: books, weight: 1 },
      ]),
      signals: { sources: taste.sources, ...taste.counts },
    }
  }

  // ---------------------------------------------------------------------------
  // Taste
  // ---------------------------------------------------------------------------

  private async buildTasteProfile(userId: string): Promise<TasteProfile> {
    const genres = new Map<string, number>()
    const bump = (list: string[], by: number) => {
      for (const g of list) genres.set(slug(g), (genres.get(slug(g)) ?? 0) + by)
    }

    const exclude = { movie: new Set<string>(), tv: new Set<string>() }
    const movieSeeds: Seed[] = []
    const tvSeeds: Seed[] = []

    // Every taste provider, each on its own: one failing never sinks the deck.
    // Seen titles are never suggested; seeds pull neighbours in; picks go in
    // directly.
    const picks = { movie: [] as TastePick[], tv: [] as TastePick[] }
    const sources: TasteProviderStatus[] = await Promise.all(
      tasteProviders.map(async (provider) => {
        const base = { id: provider.id, label: provider.label }
        try {
          const snapshot = await provider.collect()
          if (!snapshot) return { ...base, state: 'off' as const, detail: null }
          for (const seen of snapshot.seen) exclude[seen.kind].add(String(seen.tmdbId))
          for (const seed of snapshot.seeds) {
            ;(seed.kind === 'movie' ? movieSeeds : tvSeeds).push(this.toSeed(seed))
          }
          for (const pick of snapshot.picks) picks[pick.kind].push(pick)
          return { ...base, state: 'active' as const, detail: provider.describe(snapshot, null) }
        } catch (error) {
          return { ...base, state: 'error' as const, detail: provider.describe(null, error) }
        }
      })
    )

    // What the user asked for from this deck, and what they turned down.
    const feedback = await RecommendationFeedback.query()
      .where('userId', userId)
      .orderBy('createdAt', 'desc')
      .limit(500)
    let requestCount = 0
    for (const f of feedback) {
      if (f.action === 'skipped') {
        bump(f.genres, -0.35)
        continue
      }
      requestCount++
      bump(f.genres, 0.6)
      const seed = {
        tmdbId: Number(f.externalId),
        title: f.title ?? 'a title',
        weight: 0.7,
        reason: `Because you requested ${f.title}`,
      }
      if (f.mediaType === 'movie') movieSeeds.push(seed)
      if (f.mediaType === 'tv') tvSeeds.push(seed)
    }

    // What is on disk. Weaker than a rating: owning is not the same as liking.
    const [libraryMovies, libraryShows] = await Promise.all([
      Movie.query().whereNotNull('tmdbId').select('tmdbId', 'title', 'hasFile', 'genres'),
      TvShow.query().whereNotNull('tmdbId').select('tmdbId', 'title', 'genres'),
    ])
    for (const m of libraryMovies) {
      exclude.movie.add(String(m.tmdbId))
      if (m.hasFile) bump(m.genres ?? [], 0.15)
    }
    for (const s of libraryShows) {
      exclude.tv.add(String(s.tmdbId))
      bump(s.genres ?? [], 0.15)
    }
    const ownedMovies = libraryMovies.filter((m) => m.hasFile)
    movieSeeds.push(
      ...sample(ownedMovies, 4).map((m) => ({
        tmdbId: Number(m.tmdbId),
        title: m.title,
        weight: 0.45,
        reason: `Because you have ${m.title}`,
      }))
    )
    tvSeeds.push(
      ...sample(libraryShows, 4).map((s) => ({
        tmdbId: Number(s.tmdbId),
        title: s.title,
        weight: 0.45,
        reason: `Because you have ${s.title}`,
      }))
    )

    // Rated titles pull their genres along, both ways.
    const max = Math.max(1, ...[...genres.values()].map(Math.abs))
    for (const [k, v] of genres) genres.set(k, v / max)

    return {
      movieSeeds: this.pickSeeds(movieSeeds),
      tvSeeds: this.pickSeeds(tvSeeds),
      genres,
      exclude,
      picks,
      sources,
      counts: {
        requests: requestCount,
        library: ownedMovies.length + libraryShows.length,
      },
    }
  }

  private toSeed(seed: TasteSeed): Seed {
    return { tmdbId: seed.tmdbId, title: seed.title, weight: seed.weight, reason: seed.reason }
  }

  /**
   * A handful of seeds per refresh, favouring the strongest but rotating
   * through the rest so the deck does not show the same neighbourhood forever.
   */
  private pickSeeds(seeds: Seed[]): Seed[] {
    const unique = new Map<number, Seed>()
    for (const s of seeds) {
      const prev = unique.get(s.tmdbId)
      if (!prev || prev.weight < s.weight) unique.set(s.tmdbId, s)
    }
    const all = [...unique.values()]
    const strong = all.filter((s) => s.weight >= 0.7)
    const rest = all.filter((s) => s.weight < 0.7)
    const picked = sample(strong, Math.ceil(SEEDS_PER_TYPE * 0.6))
    return [...picked, ...sample(rest, SEEDS_PER_TYPE - picked.length)]
  }

  private genreAffinity(genres: string[], taste: TasteProfile): number {
    if (genres.length === 0) return 0
    const total = genres.reduce((sum, g) => sum + (taste.genres.get(slug(g)) ?? 0), 0)
    return total / genres.length
  }

  // ---------------------------------------------------------------------------
  // Movies and shows
  // ---------------------------------------------------------------------------

  private async movieCards(taste: TasteProfile): Promise<ForYouCard[]> {
    const candidates = await this.walk(taste.movieSeeds, taste.exclude.movie, (id) =>
      tmdbService.getMovieRecommendations(id)
    )
    await this.addPicks(candidates, taste.exclude.movie, taste.picks.movie, (id) =>
      tmdbService.getMovie(id)
    )
    await this.addPopular(candidates, taste.exclude.movie, 'movie')
    return this.rank(candidates, taste, 'movie')
  }

  private async tvCards(taste: TasteProfile): Promise<ForYouCard[]> {
    const candidates = await this.walk(taste.tvSeeds, taste.exclude.tv, (id) =>
      tmdbService.getTvShowRecommendations(id)
    )
    await this.addPicks(candidates, taste.exclude.tv, taste.picks.tv, (id) =>
      tmdbService.getTvShow(id)
    )
    await this.addPopular(candidates, taste.exclude.tv, 'tv')
    return this.rank(candidates, taste, 'tv')
  }

  private async walk(
    seeds: Seed[],
    exclude: Set<string>,
    fetchRecs: (id: number) => Promise<(TmdbMovie | TmdbTvShow)[]>
  ): Promise<Map<number, Candidate>> {
    const candidates = new Map<number, Candidate>()
    const results = await Promise.allSettled(seeds.map((s) => fetchRecs(s.tmdbId)))
    results.forEach((result, i) => {
      if (result.status !== 'fulfilled') return
      const seed = seeds[i]
      result.value.slice(0, RECS_PER_SEED).forEach((item, rank) => {
        if (exclude.has(String(item.id))) return
        const contribution = seed.weight * (1 - rank / (RECS_PER_SEED * 1.5))
        const existing = candidates.get(item.id)
        if (existing) {
          existing.score += contribution
          existing.seedCount++
          if (contribution > existing.best.contribution) {
            existing.best = { contribution, reason: seed.reason }
          }
        } else {
          candidates.set(item.id, {
            item,
            score: contribution,
            best: { contribution, reason: seed.reason },
            seedCount: 1,
          })
        }
      })
    })
    return candidates
  }

  /**
   * Titles a provider suggests outright (a watchlist): hydrated from TMDB and
   * weighted by the provider, on top of anything the walk already found.
   */
  private async addPicks(
    candidates: Map<number, Candidate>,
    exclude: Set<string>,
    picks: TastePick[],
    hydrate: (id: number) => Promise<TmdbMovie | TmdbTvShow>
  ) {
    const chosen = sample(
      picks.filter((p) => !exclude.has(String(p.tmdbId))),
      20
    )
    const hydrated = await Promise.allSettled(
      chosen.map((p) => (candidates.has(p.tmdbId) ? Promise.resolve(null) : hydrate(p.tmdbId)))
    )
    chosen.forEach(({ tmdbId: id, weight, reason }, rank) => {
      const contribution = weight
      const existing = candidates.get(id)
      if (existing) {
        existing.score += contribution
        existing.seedCount++
        if (contribution > existing.best.contribution) existing.best = { contribution, reason }
        return
      }
      const result = hydrated[rank]
      if (result.status !== 'fulfilled' || !result.value) return
      candidates.set(id, {
        item: result.value,
        score: contribution,
        best: { contribution, reason },
        seedCount: 1,
      })
    })
  }

  /** Trending titles fill the deck when there is little to go on. */
  private async addPopular(
    candidates: Map<number, Candidate>,
    exclude: Set<string>,
    kind: 'movie' | 'tv'
  ) {
    const lanes =
      kind === 'movie'
        ? await recommendationService.getMovieRecommendationLanes().catch(() => [])
        : await recommendationService.getTvRecommendationLanes().catch(() => [])

    for (const lane of lanes) {
      if (lane.source === 'tmdb') continue // personalized lanes; we already walk the library
      const reason = lane.source === 'simkl' ? `${lane.label}` : 'Popular on streaming right now'
      for (const [rank, item] of lane.items.slice(0, 15).entries()) {
        if (exclude.has(String(item.tmdbId)) || candidates.has(item.tmdbId)) continue
        const contribution = 0.25 * (1 - rank / 30)
        const base = {
          id: item.tmdbId,
          overview: item.overview,
          year: item.year,
          posterPath: item.posterUrl,
          backdropPath: null,
          voteAverage: item.rating,
          // Lane items come pre-filtered by popularity; do not drop them for vote count.
          voteCount: MIN_VOTES,
          genres: item.genres,
          releaseDate: '',
        }
        candidates.set(item.tmdbId, {
          item: (kind === 'movie'
            ? { ...base, title: item.title }
            : { ...base, name: item.title, firstAirDate: '' }) as unknown as TmdbMovie | TmdbTvShow,
          score: contribution,
          best: { contribution, reason },
          seedCount: 1,
        })
      }
    }
  }

  private rank(
    candidates: Map<number, Candidate>,
    taste: TasteProfile,
    mediaType: 'movie' | 'tv'
  ): ForYouCard[] {
    const today = new Date().toISOString().slice(0, 10)
    const cards: ForYouCard[] = []

    for (const c of candidates.values()) {
      const item = c.item
      if (!item.posterPath) continue
      if ((item.voteCount ?? 0) < MIN_VOTES) continue
      const released = isMovie(item) ? item.releaseDate : (item as TmdbTvShow).firstAirDate
      if (released && released > today) continue

      const affinity = this.genreAffinity(item.genres ?? [], taste)
      const quality = ((item.voteAverage ?? 6) - 6.5) * 0.06
      const agreement = Math.log2(c.seedCount) * 0.25
      const fresh = freshness(released, mediaType)
      const score =
        c.score + agreement + affinity * 0.45 + quality + fresh.boost + Math.random() * 0.08

      // Several seeds agreeing is the better explanation than any one of them.
      const reason =
        c.seedCount >= 3 ? `${c.best.reason} and ${c.seedCount - 1} more you liked` : c.best.reason

      const title = isMovie(item) ? item.title : (item as TmdbTvShow).name
      cards.push({
        key: `${mediaType}:${item.id}`,
        mediaType,
        externalId: String(item.id),
        title,
        year: item.year || null,
        subtitle: null,
        overview: item.overview || null,
        posterUrl: item.posterPath,
        backdropUrl: item.backdropPath,
        rating: item.voteAverage || null,
        genres: item.genres ?? [],
        reason,
        score,
        isNew: fresh.isNew,
      })
    }

    // Genre scores below this mean "you keep skipping these".
    return cards
      .filter((card) => this.genreAffinity(card.genres, taste) > -0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, DECK_SIZE)
  }

  // ---------------------------------------------------------------------------
  // Albums and books — from artists and authors already in the library
  // ---------------------------------------------------------------------------

  private async albumCards(userId: string): Promise<ForYouCard[]> {
    const { rows } = await db.rawQuery(
      `
      WITH owned AS (
        SELECT a.artist_id, COUNT(DISTINCT a.id)::int AS n, ARRAY_AGG(DISTINCT lower(a.title)) AS titles
        FROM albums a
        WHERE EXISTS (SELECT 1 FROM track_files tf WHERE tf.album_id = a.id)
        GROUP BY a.artist_id
      ),
      ranked AS (
        SELECT a.id, a.title, a.album_type, a.release_date, a.image_url, a.overview,
               ar.name AS artist_name, owned.n,
               ROW_NUMBER() OVER (PARTITION BY a.artist_id ORDER BY random()) AS pick
        FROM albums a
        JOIN owned ON owned.artist_id = a.artist_id
        JOIN artists ar ON ar.id = a.artist_id
        WHERE a.requested = false
          AND a.album_type IN ('album', 'ep')
          AND cardinality(a.secondary_types) = 0
          AND a.release_date IS NOT NULL
          AND a.release_date <= now()
          AND NOT (lower(a.title) = ANY(owned.titles))
          AND NOT EXISTS (SELECT 1 FROM track_files tf WHERE tf.album_id = a.id)
          AND NOT EXISTS (
            SELECT 1 FROM recommendation_feedback f
            WHERE f.user_id = ? AND f.media_type = 'album' AND f.external_id = a.id::text
          )
      )
      SELECT * FROM ranked WHERE pick <= 2
      `,
      [userId]
    )

    return (rows as any[])
      .map((r) => {
        const n = Number(r.n)
        const date = r.release_date ? new Date(r.release_date) : null
        const fresh = freshness(date, 'album')
        const score =
          Math.log2(1 + Math.min(n, AFFINITY_CAP)) * 0.5 +
          fresh.boost +
          (r.album_type === 'album' ? 0.2 : 0) +
          (r.image_url ? 0.1 : -0.3) +
          Math.random() * 0.3
        return {
          key: `album:${r.id}`,
          mediaType: 'album' as const,
          externalId: String(r.id),
          title: r.title,
          year: date ? date.getFullYear() : null,
          subtitle: r.artist_name,
          overview: r.overview ?? null,
          posterUrl: r.image_url ?? null,
          backdropUrl: null,
          rating: null,
          genres: [],
          reason:
            n === 1
              ? `You have an album by ${r.artist_name}`
              : `You have ${n} albums by ${r.artist_name}`,
          score,
          isNew: fresh.isNew,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, DECK_SIZE)
  }

  private async bookCards(userId: string, taste: TasteProfile): Promise<ForYouCard[]> {
    const { rows } = await db.rawQuery(
      `
      WITH owned AS (
        SELECT author_id, COUNT(*)::int AS n, ARRAY_AGG(title) AS titles
        FROM books WHERE has_file = true GROUP BY author_id
      ),
      ranked AS (
        SELECT b.id, b.title, b.release_date, b.cover_url, b.overview, b.rating, b.genres,
               b.series_name, b.series_position, b.language, b.openlibrary_id,
               au.name AS author_name, owned.n, owned.titles AS owned_titles,
               ROW_NUMBER() OVER (PARTITION BY b.author_id ORDER BY random()) AS pick
        FROM books b
        JOIN owned ON owned.author_id = b.author_id
        JOIN authors au ON au.id = b.author_id
        WHERE b.requested = false
          AND b.has_file = false
          -- Coverless rows are almost all OpenLibrary edition stubs.
          AND b.cover_url IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM recommendation_feedback f
            WHERE f.user_id = ? AND f.media_type = 'book' AND f.external_id = b.id::text
          )
      )
      SELECT * FROM ranked WHERE pick <= 8
      `,
      [userId]
    )

    // Only books in a language the user reads: the languages of what they have
    // on disk or requested. Looked up (once, then stored) only for the
    // candidates that would otherwise make the deck, two per author.
    const readable = await bookLanguages.owned()
    const perAuthor = new Map<string, number>()
    const chosen: any[] = []
    for (const r of rows as any[]) {
      if (!isWorthSuggestingBook(r.title, r.owned_titles ?? [])) continue
      if ((perAuthor.get(r.author_name) ?? 0) >= 2) continue
      if (readable.size > 0) {
        const language = await bookLanguages.of(r)
        if (language && !readable.has(language)) continue
        // Language unknown even to OpenLibrary: let the title decide.
        if (!language && !titleSpeaks(r.title, readable)) continue
      }
      perAuthor.set(r.author_name, (perAuthor.get(r.author_name) ?? 0) + 1)
      chosen.push(r)
    }

    await this.fillPublishYears(chosen)

    // OpenLibrary sometimes holds the same book as two works ("Gut" twice, one
    // dated 1676). One card per author and title, the latest-dated one.
    const byTitle = new Map<string, any>()
    for (const r of chosen) {
      const key = `${r.author_name}|${normalizeTitle(r.title)}`
      const prev = byTitle.get(key)
      const year = (x: any) => (x?.release_date ? new Date(x.release_date).getFullYear() : 0)
      if (!prev || year(r) > year(prev)) byTitle.set(key, r)
    }

    return [...byTitle.values()]
      .map((r) => {
        const n = Number(r.n)
        const date = r.release_date ? new Date(r.release_date) : null
        const fresh = freshness(date, 'book')
        const genres = cleanSubjects(r.genres)
        // Subjects learn from swipes the way film genres do: requested books
        // pull theirs up, skipped ones push theirs down.
        const affinity = this.genreAffinity(genres, taste)
        const score =
          Math.log2(1 + Math.min(n, AFFINITY_CAP)) * 0.5 +
          fresh.boost +
          affinity * 0.5 +
          (r.cover_url ? 0.1 : -0.3) +
          Math.random() * 0.3
        const series = r.series_name
          ? ` · ${r.series_name}${r.series_position ? ` #${r.series_position}` : ''}`
          : ''
        return {
          key: `book:${r.id}`,
          mediaType: 'book' as const,
          externalId: String(r.id),
          title: r.title,
          year: date ? date.getFullYear() : null,
          subtitle: `${r.author_name}${series}`,
          overview: r.overview ?? null,
          posterUrl: r.cover_url ?? null,
          backdropUrl: null,
          rating: r.rating ? Number(r.rating) * 2 : null,
          genres,
          reason:
            n === 1
              ? `You have a book by ${r.author_name}`
              : `You have ${n} books by ${r.author_name}`,
          score,
          isNew: fresh.isNew,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, DECK_SIZE)
  }

  /**
   * Albums by artists who are not in the library yet. Listeners of the
   * artists the user owns — weighted by how much of each they own — also play
   * these (ListenBrainz similarity); artists whose genres match the library's
   * rise, and so do those the user's swipes favour. Each is offered through
   * its most played album, or a recent one that is getting real plays.
   */
  private async newArtistCards(userId: string, taste: TasteProfile): Promise<ForYouCard[]> {
    const { rows: ownedRows } = await db.rawQuery(`
      SELECT ar.musicbrainz_id AS mbid, ar.name, COUNT(DISTINCT a.id)::int AS n
      FROM artists ar JOIN albums a ON a.artist_id = ar.id
      WHERE ar.musicbrainz_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM track_files tf WHERE tf.album_id = a.id)
      GROUP BY ar.musicbrainz_id, ar.name
    `)
    const owned = (ownedRows as { mbid: string; name: string; n: number }[]).map((r) => ({
      ...r,
      weight: Math.log2(1 + Math.min(Number(r.n), AFFINITY_CAP)) / Math.log2(1 + AFFINITY_CAP),
    }))
    if (owned.length === 0) return []

    const inLibrary = new Set(
      (
        (await db.from('artists').whereNotNull('musicbrainz_id').select('musicbrainz_id')) as {
          musicbrainz_id: string
        }[]
      ).map((r) => r.musicbrainz_id)
    )
    const acted = new Set(
      (
        (await db
          .from('recommendation_feedback')
          .where('user_id', userId)
          .where('media_type', 'album')
          .whereLike('external_id', 'new:%')
          .select('external_id')) as { external_id: string }[]
      ).map((r) => r.external_id.slice(4))
    )

    // The strongest shelves every time, plus a few others so the deck moves.
    const byWeight = [...owned].sort((a, b) => b.weight - a.weight)
    const seeds = [...byWeight.slice(0, 6), ...sample(byWeight.slice(6), 4)]
    const lists = await Promise.allSettled(seeds.map((s) => listenBrainz.similarArtists(s.mbid)))

    const found = new Map<
      string,
      { name: string; score: number; best: string; bestC: number; seeds: number }
    >()
    lists.forEach((result, i) => {
      if (result.status !== 'fulfilled' || result.value.length === 0) return
      const seed = seeds[i]
      const top = result.value[0].score || 1
      for (const artist of result.value) {
        if (inLibrary.has(artist.mbid) || acted.has(artist.mbid)) continue
        const c = seed.weight * (artist.score / top)
        const entry = found.get(artist.mbid)
        if (entry) {
          entry.score += c
          entry.seeds++
          if (c > entry.bestC) Object.assign(entry, { best: seed.name, bestC: c })
        } else {
          found.set(artist.mbid, {
            name: artist.name,
            score: c,
            best: seed.name,
            bestC: c,
            seeds: 1,
          })
        }
      }
    })
    if (found.size === 0) return []

    // Genre fit: the candidate's genres against the library's, weighted by
    // how much of each artist the user owns.
    const shortlist = [...found.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 30)
    const genres = await listenBrainz
      .artistGenres([...owned.map((o) => o.mbid), ...shortlist.map(([mbid]) => mbid)])
      .catch(() => new Map<string, ArtistGenre[]>())
    const profile = new Map<string, number>()
    for (const o of owned) {
      const list = genres.get(o.mbid) ?? []
      const max = list[0]?.count || 1
      for (const g of list.slice(0, 8)) {
        profile.set(g.genre, (profile.get(g.genre) ?? 0) + o.weight * (g.count / max))
      }
    }
    const profileMax = Math.max(1e-9, ...profile.values())

    const ranked = shortlist
      .map(([mbid, f]) => {
        const own = (genres.get(mbid) ?? []).slice(0, 5)
        const fit = own.length
          ? own.reduce((sum, g) => sum + (profile.get(g.genre) ?? 0) / profileMax, 0) / own.length
          : 0
        const labels = own.slice(0, 3).map((g) => titleCase(g.genre))
        const swipes = this.genreAffinity(labels, taste)
        return {
          mbid,
          ...f,
          labels,
          rank: f.score + Math.log2(f.seeds) * 0.2 + fit * 0.6 + swipes * 0.4,
        }
      })
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 14)

    const albums = await Promise.allSettled(ranked.map((r) => listenBrainz.topAlbums(r.mbid)))
    const cards: ForYouCard[] = []
    ranked.forEach((r, i) => {
      const result = albums[i]
      if (result.status !== 'fulfilled') return
      const studio = result.value.filter(
        (a) => a.type === 'Album' && a.name && !NOT_A_STUDIO_ALBUM.test(a.name)
      )
      const top = studio[0]
      if (!top) return
      // A new album that people are actually playing beats the classic.
      const recent = studio.find(
        (a) => freshness(a.date, 'album').boost > 0 && a.listens >= top.listens * 0.05
      )
      const pick = recent ?? top
      const fresh = freshness(pick.date, 'album')
      cards.push({
        key: `album:new:${r.mbid}`,
        mediaType: 'album',
        externalId: `new:${r.mbid}`,
        title: pick.name,
        year: pick.date ? new Date(pick.date).getFullYear() : null,
        subtitle: r.name,
        overview: null,
        posterUrl: coverUrl(pick.coverReleaseMbid),
        backdropUrl: null,
        rating: null,
        genres: r.labels,
        reason:
          r.seeds >= 3
            ? `Similar to ${r.best} and ${r.seeds - 1} more you have`
            : `Similar to ${r.best}`,
        score: r.rank + fresh.boost + Math.random() * 0.1,
        isNew: fresh.isNew,
        albumRef: { artistMbid: r.mbid, releaseGroupMbid: pick.releaseGroupMbid },
      })
    })
    return cards.sort((a, b) => b.score - a.score)
  }

  /**
   * Suggested books usually arrive from an author's OpenLibrary bibliography
   * without a date. Look the first publication year up for the ones about to
   * be shown — one request for all of them — and keep it, stored the way the
   * rest of the app stores book years (1 January of that year).
   */
  private async fillPublishYears(rows: any[]) {
    const missing = rows.filter((r) => !r.release_date && r.openlibrary_id)
    if (missing.length === 0) return
    const years = await openLibraryService
      .getFirstPublishYears(missing.map((r) => r.openlibrary_id))
      .catch(() => new Map<string, number>())
    for (const r of missing) {
      const key = r.openlibrary_id.startsWith('/works/')
        ? r.openlibrary_id
        : `/works/${r.openlibrary_id}`
      const year = years.get(key)
      if (!year) continue
      r.release_date = `${year}-01-01`
      await db.from('books').where('id', r.id).update({ release_date: r.release_date })
    }
  }

  // ---------------------------------------------------------------------------

  /**
   * Weighted round-robin, so the deck alternates media types instead of
   * showing forty movies before the first album.
   */
  private interleave(sources: { cards: ForYouCard[]; weight: number }[]): ForYouCard[] {
    const queues = sources.filter((s) => s.cards.length > 0).map((s) => ({ ...s, i: 0 }))
    const out: ForYouCard[] = []
    while (out.length < DECK_SIZE && queues.some((q) => q.i < q.cards.length)) {
      for (const q of queues) {
        for (let n = 0; n < q.weight && q.i < q.cards.length; n++) out.push(q.cards[q.i++])
      }
    }
    return out.slice(0, DECK_SIZE)
  }
}

export const forYouService = new ForYouService()
