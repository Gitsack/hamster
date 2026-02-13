import { tmdbService } from '#services/metadata/tmdb_service'
import { traktService } from '#services/metadata/trakt_service'
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
  source: 'tmdb' | 'trakt' | 'justwatch'
  items: RecommendationItem[]
}

export interface RecommendationSettings {
  traktEnabled: boolean
  personalizedEnabled: boolean
  maxPersonalizedLanes: number
  justwatchEnabled: boolean
}

const DEFAULT_SETTINGS: RecommendationSettings = {
  traktEnabled: false,
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

  async getMovieRecommendationLanes(): Promise<RecommendationLane[]> {
    const cached = this.getCached('movie-lanes')
    if (cached) return cached

    const settings = await this.getSettings()
    const lanePromises: Promise<RecommendationLane | null>[] = []

    if (settings.traktEnabled) {
      lanePromises.push(this.getTraktTrendingMovies())
      lanePromises.push(this.getTraktAnticipatedMovies())
      lanePromises.push(this.getTraktRecommendedMovies())
    }

    if (settings.justwatchEnabled) {
      lanePromises.push(this.getJustWatchPopularMovies())
    }

    if (settings.personalizedEnabled) {
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
    this.setCache('movie-lanes', deduplicated)
    return deduplicated
  }

  // TV recommendation lanes

  async getTvRecommendationLanes(): Promise<RecommendationLane[]> {
    const cached = this.getCached('tv-lanes')
    if (cached) return cached

    const settings = await this.getSettings()
    const lanePromises: Promise<RecommendationLane | null>[] = []

    if (settings.traktEnabled) {
      lanePromises.push(this.getTraktTrendingShows())
      lanePromises.push(this.getTraktAnticipatedShows())
      lanePromises.push(this.getTraktRecommendedShows())
    }

    if (settings.justwatchEnabled) {
      lanePromises.push(this.getJustWatchPopularShows())
    }

    if (settings.personalizedEnabled) {
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
    this.setCache('tv-lanes', deduplicated)
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

  // Trakt movie lanes

  private async getTraktTrendingMovies(): Promise<RecommendationLane | null> {
    try {
      const trending = await traktService.getTrendingMovies()
      const items = await this.hydrateTraktMovies(trending.map((t) => t.movie.ids.tmdb))
      return { key: 'trakt-trending-movies', label: 'Trending on Trakt', source: 'trakt', items }
    } catch {
      return null
    }
  }

  private async getTraktAnticipatedMovies(): Promise<RecommendationLane | null> {
    try {
      const anticipated = await traktService.getAnticipatedMovies()
      const items = await this.hydrateTraktMovies(anticipated.map((a) => a.movie.ids.tmdb))
      return { key: 'trakt-anticipated-movies', label: 'Most Anticipated', source: 'trakt', items }
    } catch {
      return null
    }
  }

  private async getTraktRecommendedMovies(): Promise<RecommendationLane | null> {
    try {
      const recommended = await traktService.getRecommendedMovies('weekly')
      const items = await this.hydrateTraktMovies(recommended.map((r) => r.movie.ids.tmdb))
      return {
        key: 'trakt-recommended-movies',
        label: 'Community Recommended',
        source: 'trakt',
        items,
      }
    } catch {
      return null
    }
  }

  // Trakt TV lanes

  private async getTraktTrendingShows(): Promise<RecommendationLane | null> {
    try {
      const trending = await traktService.getTrendingShows()
      const items = await this.hydrateTraktShows(trending.map((t) => t.show.ids.tmdb))
      return { key: 'trakt-trending-shows', label: 'Trending on Trakt', source: 'trakt', items }
    } catch {
      return null
    }
  }

  private async getTraktAnticipatedShows(): Promise<RecommendationLane | null> {
    try {
      const anticipated = await traktService.getAnticipatedShows()
      const items = await this.hydrateTraktShows(anticipated.map((a) => a.show.ids.tmdb))
      return { key: 'trakt-anticipated-shows', label: 'Most Anticipated', source: 'trakt', items }
    } catch {
      return null
    }
  }

  private async getTraktRecommendedShows(): Promise<RecommendationLane | null> {
    try {
      const recommended = await traktService.getRecommendedShows('weekly')
      const items = await this.hydrateTraktShows(recommended.map((r) => r.show.ids.tmdb))
      return {
        key: 'trakt-recommended-shows',
        label: 'Community Recommended',
        source: 'trakt',
        items,
      }
    } catch {
      return null
    }
  }

  // Hydrate Trakt results with TMDB data for poster URLs

  private async hydrateTraktMovies(tmdbIds: (number | null)[]): Promise<RecommendationItem[]> {
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

  private async hydrateTraktShows(tmdbIds: (number | null)[]): Promise<RecommendationItem[]> {
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
