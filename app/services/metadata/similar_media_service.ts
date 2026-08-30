import {
  tmdbService,
  type TmdbMovie,
  type TmdbTvShow,
  type TmdbLink,
} from '#services/metadata/tmdb_service'
import { cache, CACHE_TTL } from '#services/cache/cache_service'

/**
 * Where a suggestion came from. The order of the weights below is the editorial claim:
 * another entry in the same franchise is the most obvious "more like this", what other
 * viewers went on to watch is next, and the maker and the cast beat a bare genre match.
 */
export type SimilarSource =
  | 'collection'
  | 'recommendations'
  | 'director'
  | 'creator'
  | 'cast'
  | 'keywords'
  | 'similar'

const SOURCE_WEIGHTS: Record<SimilarSource, number> = {
  collection: 130,
  recommendations: 100,
  director: 85,
  creator: 85,
  cast: 62,
  keywords: 52,
  similar: 45,
}

/** TV genres that are a person's day job rather than their work: talk, news, reality. */
const TV_NOISE_GENRES = ['Talk', 'News', 'Reality']

export interface SimilarCandidate {
  tmdbId: number
  title: string
  year: number
  posterUrl: string | null
  rating: number
  votes: number
  genres: string[]
  source: SimilarSource
  /** Position within the source's own list. Later entries count for less. */
  rank: number
  reason: string
}

export interface SimilarTitle {
  tmdbId: number
  title: string
  year: number
  posterUrl: string | null
  rating: number
  votes: number
  genres: string[]
  score: number
  /** The strongest single explanation, for the caption under the poster. */
  reason: string
  /** Every explanation that contributed, strongest first. */
  reasons: string[]
}

export interface BlendOptions {
  /** The title being viewed — never suggest it back. */
  excludeTmdbId: number
  /** Its genres, for the overlap bonus. */
  sourceGenres?: string[]
  limit?: number
  /** Below this vote count a title is noise, whatever surfaced it. */
  minVotes?: number
}

/** A rank-based decay, so the tenth entry of a list counts for roughly half the first. */
function rankDecay(rank: number): number {
  return 1 / (1 + rank * 0.09)
}

function genreOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const left = new Set(a)
  const shared = b.filter((genre) => left.has(genre)).length
  return shared / new Set([...a, ...b]).size
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Merge candidates from every source into one ranked list.
 *
 * A title that shows up in several sources is the point of the exercise: the same film
 * arriving as "directed by" and as "viewers also liked" is a far better suggestion than
 * either list's own top entry, so contributions add up and corroboration pays a bonus on
 * top. Kept pure so the ranking can be tested without touching TMDB.
 */
export function blendSimilar(
  candidates: SimilarCandidate[],
  { excludeTmdbId, sourceGenres = [], limit = 20, minVotes = 40 }: BlendOptions
): SimilarTitle[] {
  const merged = new Map<
    number,
    {
      candidate: SimilarCandidate
      score: number
      sources: Map<SimilarSource, { weight: number; reason: string }>
    }
  >()

  for (const candidate of candidates) {
    if (candidate.tmdbId === excludeTmdbId) continue
    // The poster carries the whole lane; a card with an icon in it is not a suggestion.
    if (!candidate.posterUrl) continue
    // Franchise entries are exempt: the next film in a series is relevant on day one,
    // before it has collected any votes.
    if (candidate.source !== 'collection' && candidate.votes < minVotes) continue

    const contribution = SOURCE_WEIGHTS[candidate.source] * rankDecay(candidate.rank)
    const existing = merged.get(candidate.tmdbId)

    if (!existing) {
      merged.set(candidate.tmdbId, {
        candidate,
        score: contribution,
        sources: new Map([[candidate.source, { weight: contribution, reason: candidate.reason }]]),
      })
      continue
    }

    const previous = existing.sources.get(candidate.source)
    if (previous) {
      // Same source, better position (a person credited twice, say) — keep the stronger.
      if (contribution > previous.weight) {
        existing.score += contribution - previous.weight
        existing.sources.set(candidate.source, {
          weight: contribution,
          reason: candidate.reason,
        })
      }
      continue
    }

    existing.score += contribution
    existing.sources.set(candidate.source, { weight: contribution, reason: candidate.reason })
  }

  return Array.from(merged.values())
    .map(({ candidate, score, sources }) => {
      // Corroboration: agreement between independent sources is the strongest signal
      // there is, and neither list alone would have ranked it this high.
      const corroboration = 18 * (sources.size - 1)
      const overlap = genreOverlap(sourceGenres, candidate.genres) * 35
      // A title the audience rated well, with enough votes to mean it.
      const quality = clamp((candidate.rating - 6) * 6, -18, 18)
      const confidence = clamp(Math.log10(candidate.votes + 1) / 4, 0, 1) * 10

      const ranked = Array.from(sources.values()).sort((a, b) => b.weight - a.weight)

      return {
        tmdbId: candidate.tmdbId,
        title: candidate.title,
        year: candidate.year,
        posterUrl: candidate.posterUrl,
        rating: candidate.rating,
        votes: candidate.votes,
        genres: candidate.genres,
        score: Math.round((score + corroboration + overlap + quality + confidence) * 10) / 10,
        reason: ranked[0].reason,
        reasons: ranked.map((entry) => entry.reason),
      }
    })
    .sort((a, b) => b.score - a.score || b.votes - a.votes)
    .slice(0, limit)
}

function movieCandidates(
  movies: TmdbMovie[],
  source: SimilarSource,
  reason: string
): SimilarCandidate[] {
  return movies.map((movie, rank) => ({
    tmdbId: movie.id,
    title: movie.title,
    year: movie.year,
    posterUrl: movie.posterPath,
    rating: movie.voteAverage,
    votes: movie.voteCount,
    genres: movie.genres,
    source,
    rank,
    reason,
  }))
}

function tvCandidates(
  shows: TmdbTvShow[],
  source: SimilarSource,
  reason: string
): SimilarCandidate[] {
  return shows
    .filter((show) => !show.genres.some((genre) => TV_NOISE_GENRES.includes(genre)))
    .map((show, rank) => ({
      tmdbId: show.id,
      title: show.name,
      year: show.year,
      posterUrl: show.posterPath,
      rating: show.voteAverage,
      votes: show.voteCount,
      genres: show.genres,
      source,
      rank,
      reason,
    }))
}

/** An empty with_genres would be sent as a bare `with_genres=`, so leave it out instead. */
function withGenres(genreIds: number[] | undefined): Record<string, string> {
  const ids = (genreIds ?? []).slice(0, 2)
  return ids.length > 0 ? { with_genres: ids.join(',') } : {}
}

/** TMDB's keyword filter takes a pipe-joined list as OR. */
function orIds(links: TmdbLink[]): string {
  return links.map((link) => link.id).join('|')
}

/**
 * Run every source, keep what came back. One failed facet costs that facet; every facet
 * failing means TMDB is unreachable, and that is reported rather than dressed up as a
 * title with no neighbours.
 */
async function settled(tasks: Promise<SimilarCandidate[]>[]): Promise<SimilarCandidate[]> {
  const results = await Promise.allSettled(tasks)
  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<SimilarCandidate[]> => r.status === 'fulfilled'
  )

  if (fulfilled.length === 0 && results.length > 0) {
    throw new Error('No TMDB source answered')
  }

  return fulfilled.flatMap((r) => r.value)
}

/**
 * "More like this", blended from several TMDB views of the same title.
 *
 * TMDB's own /similar endpoint is a keyword-and-genre match and, on its own, is famously
 * weak — it will answer a Villeneuve film with unrelated sci-fi that happens to share a
 * tag. So it becomes one voice among several: the franchise, what other viewers went on
 * to watch, the director's or creator's other work, the billed cast's other work, and the
 * keyword neighbourhood. Sources that fail are simply dropped, so a missing keyword list
 * costs a facet rather than the lane.
 */
class SimilarMediaService {
  async getSimilarMovies(tmdbId: number, limit = 20): Promise<SimilarTitle[]> {
    return cache.getOrSet(`similar:movie:${tmdbId}:${limit}`, CACHE_TTL.METADATA, async () => {
      const facets = await tmdbService.getMovieFacets(tmdbId).catch(() => null)

      const tasks: Promise<SimilarCandidate[]>[] = [
        tmdbService
          .getMovieRecommendations(tmdbId)
          .then((movies) => movieCandidates(movies, 'recommendations', 'Viewers also liked')),
        tmdbService
          .getSimilarMovies(tmdbId)
          .then((movies) => movieCandidates(movies, 'similar', 'Similar genre mix')),
      ]

      if (facets?.collection) {
        tasks.push(
          tmdbService
            .getCollectionMovies(facets.collection.id)
            .then((movies) =>
              movieCandidates(movies, 'collection', `Part of ${facets.collection!.name}`)
            )
        )
      }

      // One query per person rather than an OR of all of them: TMDB does not say which
      // name matched, and a caption that credits the wrong actor is worse than none.
      const director = facets?.directors[0]
      if (director) {
        tasks.push(
          tmdbService
            .discoverMovies({
              'with_crew': String(director.id),
              'sort_by': 'vote_count.desc',
              'vote_count.gte': 50,
            })
            .then((movies) => movieCandidates(movies, 'director', `Directed by ${director.name}`))
        )
      }

      for (const actor of facets?.cast.slice(0, 2) ?? []) {
        tasks.push(
          tmdbService
            .discoverMovies({
              'with_cast': String(actor.id),
              'sort_by': 'vote_count.desc',
              'vote_count.gte': 100,
            })
            .then((movies) => movieCandidates(movies, 'cast', `With ${actor.name}`))
        )
      }

      const keywords = facets?.keywords.slice(0, 3) ?? []
      if (keywords.length > 0) {
        tasks.push(
          tmdbService
            .discoverMovies({
              'with_keywords': orIds(keywords),
              // Keywords alone drift — "based on a novel" spans every genre there is.
              ...withGenres(facets?.genreIds),
              'sort_by': 'vote_count.desc',
              'vote_count.gte': 100,
            })
            .then((movies) => movieCandidates(movies, 'keywords', 'Shared themes'))
        )
      }

      const candidates = await settled(tasks)

      return blendSimilar(candidates, {
        excludeTmdbId: tmdbId,
        sourceGenres: facets?.genres ?? [],
        limit,
      })
    })
  }

  async getSimilarTvShows(tmdbId: number, limit = 20): Promise<SimilarTitle[]> {
    return cache.getOrSet(`similar:tv:${tmdbId}:${limit}`, CACHE_TTL.METADATA, async () => {
      const facets = await tmdbService.getTvFacets(tmdbId).catch(() => null)

      const tasks: Promise<SimilarCandidate[]>[] = [
        tmdbService
          .getTvShowRecommendations(tmdbId)
          .then((shows) => tvCandidates(shows, 'recommendations', 'Viewers also liked')),
        tmdbService
          .getSimilarTvShows(tmdbId)
          .then((shows) => tvCandidates(shows, 'similar', 'Similar genre mix')),
      ]

      const creator = facets?.creators[0]
      if (creator) {
        tasks.push(
          tmdbService
            .getPersonTvShows(creator.id, 'crew')
            .then((shows) => tvCandidates(shows, 'creator', `Created by ${creator.name}`))
        )
      }

      const lead = facets?.cast[0]
      if (lead) {
        tasks.push(
          tmdbService
            .getPersonTvShows(lead.id, 'cast')
            .then((shows) => tvCandidates(shows, 'cast', `With ${lead.name}`))
        )
      }

      const keywords = facets?.keywords.slice(0, 3) ?? []
      if (keywords.length > 0) {
        tasks.push(
          tmdbService
            .discoverTvShows({
              'with_keywords': orIds(keywords),
              ...withGenres(facets?.genreIds),
              'sort_by': 'vote_count.desc',
              'vote_count.gte': 50,
            })
            .then((shows) => tvCandidates(shows, 'keywords', 'Shared themes'))
        )
      }

      const candidates = await settled(tasks)

      // Shows collect far fewer votes than films, so the noise floor sits lower.
      return blendSimilar(candidates, {
        excludeTmdbId: tmdbId,
        sourceGenres: facets?.genres ?? [],
        limit,
        minVotes: 20,
      })
    })
  }
}

export const similarMediaService = new SimilarMediaService()
