import { tmdbService } from '#services/metadata/tmdb_service'
import { simklTrending } from '#services/simkl/simkl_client'
import { justwatchService } from '#services/metadata/justwatch_service'
import AppSetting from '#models/app_setting'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'

export interface RecommendationItem {
  tmdbId: number
  title: string
  year: number
  overview: string
  posterUrl: string | null
  rating: number
  genres: string[]
}

export interface RecommendationLane {
  key: string
  label: string
  source: 'tmdb' | 'simkl' | 'justwatch'
  items: RecommendationItem[]
}

export interface RecommendationSettings {
  simklEnabled: boolean
  personalizedEnabled: boolean
  maxPersonalizedLanes: number
  justwatchEnabled: boolean
}

const DEFAULT_SETTINGS: RecommendationSettings = {
  simklEnabled: false,
  personalizedEnabled: false,
  maxPersonalizedLanes: 3,
  justwatchEnabled: false,
}

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

interface CacheEntry {
  data: RecommendationLane[]
  timestamp: number
}

class RecommendationService {
  private cache = new Map<string, CacheEntry>()

  private getCached(key: string): RecommendationLane[] | null {
    const entry = this.cache.get(key)
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data
    }
    this.cache.delete(key)
    return null
  }

  private setCache(key: string, data: RecommendationLane[]): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  clearCache(): void {
    this.cache.clear()
  }

  private async getSettings(): Promise<RecommendationSettings> {
    const stored = await AppSetting.get<Partial<RecommendationSettings>>('recommendationSettings')
    return { ...DEFAULT_SETTINGS, ...stored }
  }

  private deduplicateAcrossLanes(lanes: RecommendationLane[]): RecommendationLane[] {
    const seen = new Set<number>()
    return lanes.map((lane) => ({
      ...lane,
      items: lane.items.filter((item) => {
        if (seen.has(item.tmdbId)) return false
        seen.add(item.tmdbId)
        return true
      }),
    }))
  }

  // Movie recommendation lanes

  async getMovieRecommendationLanes(source?: string): Promise<RecommendationLane[]> {
    const cacheKey = source ? `movie-lanes-${source}` : 'movie-lanes'
    const cached = this.getCached(cacheKey)
    if (cached) return cached

    const settings = await this.getSettings()
    const lanePromises: Promise<RecommendationLane | null>[] = []

    if ((!source || source === 'simkl') && settings.simklEnabled) {
      lanePromises.push(this.getSimklLane('movie', 'week'))
      lanePromises.push(this.getSimklLane('movie', 'month'))
    }

    if ((!source || source === 'justwatch') && settings.justwatchEnabled) {
      lanePromises.push(this.getJustWatchPopularMovies())
    }

    if ((!source || source === 'tmdb') && settings.personalizedEnabled) {
      const personalizedLanes = await this.buildPersonalizedMovieLanes(
        settings.maxPersonalizedLanes
      )
      lanePromises.push(...personalizedLanes)
    }

    const results = await Promise.allSettled(lanePromises)
    const lanes = results
      .filter(
        (r): r is PromiseFulfilledResult<RecommendationLane | null> => r.status === 'fulfilled'
      )
      .map((r) => r.value)
      .filter((lane): lane is RecommendationLane => lane !== null && lane.items.length > 0)

    const deduplicated = this.deduplicateAcrossLanes(lanes)
    this.setCache(cacheKey, deduplicated)
    return deduplicated
  }

  // TV recommendation lanes

  async getTvRecommendationLanes(source?: string): Promise<RecommendationLane[]> {
    const cacheKey = source ? `tv-lanes-${source}` : 'tv-lanes'
    const cached = this.getCached(cacheKey)
    if (cached) return cached

    const settings = await this.getSettings()
    const lanePromises: Promise<RecommendationLane | null>[] = []

    if ((!source || source === 'simkl') && settings.simklEnabled) {
      lanePromises.push(this.getSimklLane('tv', 'week'))
      lanePromises.push(this.getSimklLane('tv', 'month'))
    }

    if ((!source || source === 'justwatch') && settings.justwatchEnabled) {
      lanePromises.push(this.getJustWatchPopularShows())
    }

    if ((!source || source === 'tmdb') && settings.personalizedEnabled) {
      const personalizedLanes = await this.buildPersonalizedTvLanes(settings.maxPersonalizedLanes)
      lanePromises.push(...personalizedLanes)
    }

    const results = await Promise.allSettled(lanePromises)
    const lanes = results
      .filter(
        (r): r is PromiseFulfilledResult<RecommendationLane | null> => r.status === 'fulfilled'
      )
      .map((r) => r.value)
      .filter((lane): lane is RecommendationLane => lane !== null && lane.items.length > 0)

    const deduplicated = this.deduplicateAcrossLanes(lanes)
    this.setCache(cacheKey, deduplicated)
    return deduplicated
  }

  // JustWatch lanes

  private async getJustWatchPopularMovies(): Promise<RecommendationLane | null> {
    try {
      const results = await justwatchService.getPopularMovies()
      // Map JustWatch results directly - no TMDB hydration needed,
      // the GraphQL API already returns title, year, poster, etc.
      const items: RecommendationItem[] = results
        .filter((r) => r.tmdbId && r.title)
        .map((r) => ({
          tmdbId: r.tmdbId!,
          title: r.title,
          year: r.year,
          overview: '',
          posterUrl: r.posterUrl,
          rating: 0,
          genres: [],
        }))
      return {
        key: 'justwatch-popular-movies',
        label: 'Popular Streaming Movies',
        source: 'justwatch',
        items,
      }
    } catch {
      return null
    }
  }

  private async getJustWatchPopularShows(): Promise<RecommendationLane | null> {
    try {
      const results = await justwatchService.getPopularShows()
      // Map JustWatch results directly - no TMDB hydration needed
      const items: RecommendationItem[] = results
        .filter((r) => r.tmdbId && r.title)
        .map((r) => ({
          tmdbId: r.tmdbId!,
          title: r.title,
          year: r.year,
          overview: '',
          posterUrl: r.posterUrl,
          rating: 0,
          genres: [],
        }))
      return {
        key: 'justwatch-popular-shows',
        label: 'Popular Streaming Shows',
        source: 'justwatch',
        items,
      }
    } catch {
      return null
    }
  }

  // Simkl lanes — the Most Watched lists, hydrated from TMDB for posters

  private async getSimklLane(
    kind: 'movie' | 'tv',
    window: 'week' | 'month'
  ): Promise<RecommendationLane | null> {
    try {
      const rows = await simklTrending(kind === 'movie' ? 'movies' : 'tv', window)
      // The month list mostly repeats the week's; the lanes are de-duplicated
      // against each other, so the month lane draws from a deeper pool.
      const ids = rows.slice(0, window === 'week' ? 20 : 50).map((r) => r.tmdbId)
      const items = kind === 'movie' ? await this.hydrateMovies(ids) : await this.hydrateShows(ids)
      return {
        key: `simkl-${window}-${kind === 'movie' ? 'movies' : 'shows'}`,
        label: window === 'week' ? 'Trending on Simkl' : 'Popular this month',
        source: 'simkl',
        items,
      }
    } catch {
      return null
    }
  }

  // Hydrate TMDB ids into lane items with posters

  private async hydrateMovies(tmdbIds: (number | null)[]): Promise<RecommendationItem[]> {
    const validIds = tmdbIds.filter((id): id is number => id !== null)
    const results = await Promise.allSettled(validIds.map((id) => tmdbService.getMovie(id)))

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => ({
        tmdbId: r.value.id,
        title: r.value.title,
        year: r.value.year,
        overview: r.value.overview,
        posterUrl: r.value.posterPath,
        rating: r.value.voteAverage,
        genres: r.value.genres,
      }))
  }

  private async hydrateShows(tmdbIds: (number | null)[]): Promise<RecommendationItem[]> {
    const validIds = tmdbIds.filter((id): id is number => id !== null)
    const results = await Promise.allSettled(validIds.map((id) => tmdbService.getTvShow(id)))

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => ({
        tmdbId: r.value.id,
        title: r.value.name,
        year: r.value.year,
        overview: r.value.overview,
        posterUrl: r.value.posterPath,
        rating: r.value.voteAverage,
        genres: r.value.genres,
      }))
  }

  // Personalized lanes based on library content

  private async buildPersonalizedMovieLanes(
    maxLanes: number
  ): Promise<Promise<RecommendationLane | null>[]> {
    const libraryMovies = await Movie.query()
      .whereNotNull('tmdbId')
      .where('hasFile', true)
      .orderByRaw('RANDOM()')
      .limit(maxLanes)

    return libraryMovies.map((movie) =>
      this.buildPersonalizedMovieLane(movie.title, Number(movie.tmdbId))
    )
  }

  private async buildPersonalizedMovieLane(
    title: string,
    tmdbId: number
  ): Promise<RecommendationLane | null> {
    try {
      const recommendations = await tmdbService.getMovieRecommendations(tmdbId)
      const items: RecommendationItem[] = recommendations.map((m) => ({
        tmdbId: m.id,
        title: m.title,
        year: m.year,
        overview: m.overview,
        posterUrl: m.posterPath,
        rating: m.voteAverage,
        genres: m.genres,
      }))

      return {
        key: `personalized-movie-${tmdbId}`,
        label: `Because you have ${title}`,
        source: 'tmdb',
        items,
      }
    } catch {
      return null
    }
  }

  private async buildPersonalizedTvLanes(
    maxLanes: number
  ): Promise<Promise<RecommendationLane | null>[]> {
    const libraryShows = await TvShow.query()
      .whereNotNull('tmdbId')
      .orderByRaw('RANDOM()')
      .limit(maxLanes)

    return libraryShows.map((show) => this.buildPersonalizedTvLane(show.title, Number(show.tmdbId)))
  }

  private async buildPersonalizedTvLane(
    title: string,
    tmdbId: number
  ): Promise<RecommendationLane | null> {
    try {
      const recommendations = await tmdbService.getTvShowRecommendations(tmdbId)
      const items: RecommendationItem[] = recommendations.map((s) => ({
        tmdbId: s.id,
        title: s.name,
        year: s.year,
        overview: s.overview,
        posterUrl: s.posterPath,
        rating: s.voteAverage,
        genres: s.genres,
      }))

      return {
        key: `personalized-tv-${tmdbId}`,
        label: `Because you have ${title}`,
        source: 'tmdb',
        items,
      }
    } catch {
      return null
    }
  }
}

export const recommendationService = new RecommendationService()
