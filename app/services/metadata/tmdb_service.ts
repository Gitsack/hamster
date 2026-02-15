import PQueue from 'p-queue'
import { cache, CACHE_TTL } from '#services/cache/cache_service'

// TMDB API - requires free API key from https://www.themoviedb.org/settings/api
const TMDB_API = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

// TMDB Genre ID to Name mappings (from /genre/movie/list and /genre/tv/list)
const MOVIE_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
}

const TV_GENRES: Record<number, string> = {
  10759: 'Action',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'Politics',
  37: 'Western',
}

// Rate limit: 40 requests per 10 seconds (TMDB allows ~50/10s)
const queue = new PQueue({ interval: 250, intervalCap: 1, concurrency: 8 })

export interface TmdbMovie {
  id: number
  title: string
  originalTitle: string
  overview: string
  releaseDate: string
  year: number
  runtime: number | null
  status: string
  posterPath: string | null
  backdropPath: string | null
  voteAverage: number
  voteCount: number
  genres: string[]
  imdbId: string | null
}

export interface TmdbTvShow {
  id: number
  name: string
  originalName: string
  overview: string
  firstAirDate: string
  year: number
  status: string
  posterPath: string | null
  backdropPath: string | null
  voteAverage: number
  voteCount: number
  genres: string[]
  networks: string[]
  numberOfSeasons: number
  numberOfEpisodes: number
  imdbId: string | null
  tvdbId: string | null
}

export interface TmdbSeason {
  id: number
  seasonNumber: number
  name: string
  overview: string
  airDate: string | null
  posterPath: string | null
  episodeCount: number
}

export interface TmdbEpisode {
  id: number
  seasonNumber: number
  episodeNumber: number
  name: string
  overview: string
  airDate: string | null
  stillPath: string | null
  voteAverage: number
  voteCount: number
  runtime: number | null
}

export interface TmdbVideo {
  key: string
  site: string
  type: string
  name: string
}

export interface TmdbWatchProvider {
  id: number
  name: string
  logoPath: string
}

export interface TmdbCastMember {
  id: number
  name: string
  character: string
  profilePath: string | null
  order: number
}

export class TmdbService {
  private apiKey: string | null = null

  setApiKey(key: string) {
    this.apiKey = key
  }

  private async fetch(endpoint: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured')
    }

    const url = `${TMDB_API}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${this.apiKey}`

    return queue.add(async () => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`)
      }

      return response.json()
    })
  }

  // Movies

  async searchMovies(query: string, year?: number): Promise<TmdbMovie[]> {
    let endpoint = `/search/movie?query=${encodeURIComponent(query)}`
    if (year) {
      endpoint += `&year=${year}`
    }

    const data = await this.fetch(endpoint)

    return data.results.map((m: any) => this.mapMovie(m))
  }

  async getMovie(id: number): Promise<TmdbMovie> {
    return cache.getOrSet(`tmdb:movie:${id}`, CACHE_TTL.METADATA, async () => {
      const data = await this.fetch(`/movie/${id}?append_to_response=external_ids`)
      return this.mapMovie(data, data.external_ids?.imdb_id)
    })
  }

  private mapMovie(m: any, imdbId?: string): TmdbMovie {
    // Map genre_ids to names using our mapping, or use full genre objects if available
    const genres =
      m.genres?.map((g: any) => g.name) ||
      m.genre_ids?.map((id: number) => MOVIE_GENRES[id]).filter(Boolean) ||
      []

    return {
      id: m.id,
      title: m.title,
      originalTitle: m.original_title,
      overview: m.overview || '',
      releaseDate: m.release_date || '',
      year: m.release_date ? Number.parseInt(m.release_date.substring(0, 4)) : 0,
      runtime: m.runtime || null,
      status: m.status || '',
      posterPath: m.poster_path ? `${TMDB_IMAGE_BASE}/w500${m.poster_path}` : null,
      backdropPath: m.backdrop_path ? `${TMDB_IMAGE_BASE}/original${m.backdrop_path}` : null,
      voteAverage: m.vote_average || 0,
      voteCount: m.vote_count || 0,
      genres,
      imdbId: imdbId || m.imdb_id || null,
    }
  }

  async getMovieImages(id: number, limit: number = 6): Promise<string[]> {
    return cache.getOrSet(`tmdb:movie:${id}:images`, CACHE_TTL.METADATA, async () => {
      const data = await this.fetch(`/movie/${id}/images`)
      return this.pickBackdrops(data.backdrops, limit)
    })
  }

  async getMovieCredits(id: number, limit: number = 6): Promise<TmdbCastMember[]> {
    const data = await this.fetch(`/movie/${id}/credits`)
    return this.mapCast(data.cast, limit)
  }

  async getMovieTrailerUrl(id: number): Promise<string | null> {
    return cache.getOrSet(`tmdb:movie:${id}:trailer`, CACHE_TTL.METADATA, async () => {
      const data = await this.fetch(`/movie/${id}/videos`)
      return this.pickTrailerUrl(data.results)
    })
  }

  // TV Shows

  async getTvShowImages(id: number, limit: number = 6): Promise<string[]> {
    return cache.getOrSet(`tmdb:tv:${id}:images`, CACHE_TTL.METADATA, async () => {
      const data = await this.fetch(`/tv/${id}/images`)
      return this.pickBackdrops(data.backdrops, limit)
    })
  }

  async getTvShowCredits(id: number, limit: number = 6): Promise<TmdbCastMember[]> {
    const data = await this.fetch(`/tv/${id}/credits`)
    return this.mapCast(data.cast, limit)
  }

  async getTvShowTrailerUrl(id: number): Promise<string | null> {
    return cache.getOrSet(`tmdb:tv:${id}:trailer`, CACHE_TTL.METADATA, async () => {
      const data = await this.fetch(`/tv/${id}/videos`)
      return this.pickTrailerUrl(data.results)
    })
  }

  private mapCast(cast: any[], limit: number): TmdbCastMember[] {
    if (!cast) return []
    return cast.slice(0, limit).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character || '',
      profilePath: c.profile_path ? `${TMDB_IMAGE_BASE}/w185${c.profile_path}` : null,
      order: c.order,
    }))
  }

  private pickBackdrops(backdrops: any[], limit: number): string[] {
    if (!backdrops || backdrops.length === 0) return []

    // Prefer text-free backdrops (iso_639_1 === null), then sort by vote_average
    const sorted = [...backdrops].sort((a, b) => {
      if (a.iso_639_1 === null && b.iso_639_1 !== null) return -1
      if (a.iso_639_1 !== null && b.iso_639_1 === null) return 1
      return (b.vote_average || 0) - (a.vote_average || 0)
    })

    return sorted.slice(0, limit).map((b: any) => `${TMDB_IMAGE_BASE}/original${b.file_path}`)
  }

  private pickTrailerUrl(videos: any[]): string | null {
    if (!videos || videos.length === 0) return null

    const youtubeVideos = videos.filter((v: any) => v.site === 'YouTube')
    const trailer =
      youtubeVideos.find((v: any) => v.type === 'Trailer') ||
      youtubeVideos.find((v: any) => v.type === 'Teaser') ||
      youtubeVideos[0]

    return trailer ? `https://www.youtube.com/embed/${trailer.key}` : null
  }

  async searchTvShows(query: string, year?: number): Promise<TmdbTvShow[]> {
    let endpoint = `/search/tv?query=${encodeURIComponent(query)}`
    if (year) {
      endpoint += `&first_air_date_year=${year}`
    }

    const data = await this.fetch(endpoint)

    return data.results.map((s: any) => this.mapTvShow(s))
  }

  async getTvShow(id: number): Promise<TmdbTvShow> {
    return cache.getOrSet(`tmdb:tv:${id}`, CACHE_TTL.METADATA, async () => {
      const data = await this.fetch(`/tv/${id}?append_to_response=external_ids`)
      return this.mapTvShow(data, data.external_ids)
    })
  }

  async getTvShowSeasons(id: number): Promise<TmdbSeason[]> {
    const show = await this.fetch(`/tv/${id}`)

    return (
      show.seasons?.map((s: any) => ({
        id: s.id,
        seasonNumber: s.season_number,
        name: s.name,
        overview: s.overview || '',
        airDate: s.air_date || null,
        posterPath: s.poster_path ? `${TMDB_IMAGE_BASE}/w500${s.poster_path}` : null,
        episodeCount: s.episode_count || 0,
      })) || []
    )
  }

  async getTvShowSeason(
    showId: number,
    seasonNumber: number
  ): Promise<{ season: TmdbSeason; episodes: TmdbEpisode[] }> {
    const data = await this.fetch(`/tv/${showId}/season/${seasonNumber}`)

    const season: TmdbSeason = {
      id: data.id,
      seasonNumber: data.season_number,
      name: data.name,
      overview: data.overview || '',
      airDate: data.air_date || null,
      posterPath: data.poster_path ? `${TMDB_IMAGE_BASE}/w500${data.poster_path}` : null,
      episodeCount: data.episodes?.length || 0,
    }

    const episodes: TmdbEpisode[] =
      data.episodes?.map((e: any) => ({
        id: e.id,
        seasonNumber: e.season_number,
        episodeNumber: e.episode_number,
        name: e.name,
        overview: e.overview || '',
        airDate: e.air_date || null,
        stillPath: e.still_path ? `${TMDB_IMAGE_BASE}/w300${e.still_path}` : null,
        voteAverage: e.vote_average || 0,
        voteCount: e.vote_count || 0,
        runtime: e.runtime || null,
      })) || []

    return { season, episodes }
  }

  private mapTvShow(s: any, externalIds?: any): TmdbTvShow {
    // Map genre_ids to names using our mapping, or use full genre objects if available
    const genres =
      s.genres?.map((g: any) => g.name) ||
      s.genre_ids?.map((id: number) => TV_GENRES[id]).filter(Boolean) ||
      []

    return {
      id: s.id,
      name: s.name,
      originalName: s.original_name,
      overview: s.overview || '',
      firstAirDate: s.first_air_date || '',
      year: s.first_air_date ? Number.parseInt(s.first_air_date.substring(0, 4)) : 0,
      status: s.status || '',
      posterPath: s.poster_path ? `${TMDB_IMAGE_BASE}/w500${s.poster_path}` : null,
      backdropPath: s.backdrop_path ? `${TMDB_IMAGE_BASE}/original${s.backdrop_path}` : null,
      voteAverage: s.vote_average || 0,
      voteCount: s.vote_count || 0,
      genres,
      networks: s.networks?.map((n: any) => n.name) || [],
      numberOfSeasons: s.number_of_seasons || 0,
      numberOfEpisodes: s.number_of_episodes || 0,
      imdbId: externalIds?.imdb_id || null,
      tvdbId: externalIds?.tvdb_id ? String(externalIds.tvdb_id) : null,
    }
  }

  async getTvShowAlternateTitles(id: number): Promise<string[]> {
    const cacheKey = `tmdb:tv:${id}:alt_titles`
    return cache.getOrSet(cacheKey, CACHE_TTL.METADATA, async () => {
      const data = await this.fetch(`/tv/${id}/alternative_titles`)
      const results = data.results || []
      return results.map((r: any) => r.title).filter((t: string) => t && t.length > 0)
    })
  }

  detectSeriesType(tmdbShow: TmdbTvShow): 'standard' | 'daily' | 'anime' {
    const dailyGenres = ['Talk', 'News']
    if (tmdbShow.genres.some((g) => dailyGenres.includes(g))) {
      return 'daily'
    }
    return 'standard'
  }

  // Watch Providers

  async getWatchProviders(
    type: 'movie' | 'tv',
    id: number,
    region: string
  ): Promise<TmdbWatchProvider[]> {
    const cacheKey = `tmdb:${type}:${id}:watch:${region}`
    return cache.getOrSet(cacheKey, CACHE_TTL.METADATA, async () => {
      const data = await this.fetch(`/${type}/${id}/watch/providers`)
      const regionData = data.results?.[region]
      if (!regionData) return []
      const entries = [
        ...(regionData.flatrate || []),
        ...(regionData.buy || []),
        ...(regionData.rent || []),
        ...(regionData.free || []),
        ...(regionData.ads || []),
      ]
      const seen = new Set<number>()
      return entries.reduce<TmdbWatchProvider[]>((providers, p: any) => {
        if (!seen.has(p.provider_id)) {
          seen.add(p.provider_id)
          providers.push({
            id: p.provider_id,
            name: p.provider_name,
            logoPath: `${TMDB_IMAGE_BASE}/w92${p.logo_path}`,
          })
        }
        return providers
      }, [])
    })
  }

  async getWatchProvidersForMany(
    type: 'movie' | 'tv',
    tmdbIds: number[],
    region: string
  ): Promise<Map<number, TmdbWatchProvider[]>> {
    const result = new Map<number, TmdbWatchProvider[]>()
    const promises = tmdbIds.map(async (id) => {
      try {
        const providers = await this.getWatchProviders(type, id, region)
        result.set(id, providers)
      } catch {
        result.set(id, [])
      }
    })
    await Promise.all(promises)
    return result
  }

  async getAvailableProviders(region: string): Promise<TmdbWatchProvider[]> {
    const cacheKey = `tmdb:providers:${region}`
    return cache.getOrSet(cacheKey, CACHE_TTL.METADATA, async () => {
      const [movieData, tvData] = await Promise.all([
        this.fetch(`/watch/providers/movie?watch_region=${region}`),
        this.fetch(`/watch/providers/tv?watch_region=${region}`),
      ])
      // Merge and deduplicate by provider ID
      const providerMap = new Map<number, TmdbWatchProvider>()
      for (const p of [...(movieData.results || []), ...(tvData.results || [])]) {
        if (!providerMap.has(p.provider_id)) {
          providerMap.set(p.provider_id, {
            id: p.provider_id,
            name: p.provider_name,
            logoPath: `${TMDB_IMAGE_BASE}/w92${p.logo_path}`,
          })
        }
      }
      // Sort by display priority (lower = more popular)
      return Array.from(providerMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  getImageUrl(
    path: string | null,
    size: 'w200' | 'w300' | 'w500' | 'original' = 'w500'
  ): string | null {
    if (!path) return null
    return `${TMDB_IMAGE_BASE}/${size}${path}`
  }

  // Discovery / Popular / Trending

  async getPopularMovies(page: number = 1): Promise<{ results: TmdbMovie[]; totalPages: number }> {
    const data = await this.fetch(`/movie/popular?page=${page}`)
    return { results: data.results.map((m: any) => this.mapMovie(m)), totalPages: data.total_pages }
  }

  async getNowPlayingMovies(
    page: number = 1
  ): Promise<{ results: TmdbMovie[]; totalPages: number }> {
    const data = await this.fetch(`/movie/now_playing?page=${page}`)
    return { results: data.results.map((m: any) => this.mapMovie(m)), totalPages: data.total_pages }
  }

  async getTrendingMovies(
    timeWindow: 'day' | 'week' = 'week',
    page: number = 1
  ): Promise<{ results: TmdbMovie[]; totalPages: number }> {
    const data = await this.fetch(`/trending/movie/${timeWindow}?page=${page}`)
    return { results: data.results.map((m: any) => this.mapMovie(m)), totalPages: data.total_pages }
  }

  async getPopularTvShows(
    page: number = 1
  ): Promise<{ results: TmdbTvShow[]; totalPages: number }> {
    const data = await this.fetch(`/tv/popular?page=${page}`)
    return {
      results: data.results.map((s: any) => this.mapTvShow(s)),
      totalPages: data.total_pages,
    }
  }

  async getTopRatedTvShows(
    page: number = 1
  ): Promise<{ results: TmdbTvShow[]; totalPages: number }> {
    const data = await this.fetch(`/tv/top_rated?page=${page}`)
    return {
      results: data.results.map((s: any) => this.mapTvShow(s)),
      totalPages: data.total_pages,
    }
  }

  async getOnTheAirTvShows(
    page: number = 1
  ): Promise<{ results: TmdbTvShow[]; totalPages: number }> {
    const data = await this.fetch(`/tv/on_the_air?page=${page}`)
    return {
      results: data.results.map((s: any) => this.mapTvShow(s)),
      totalPages: data.total_pages,
    }
  }

  async getTrendingTvShows(
    timeWindow: 'day' | 'week' = 'week',
    page: number = 1
  ): Promise<{ results: TmdbTvShow[]; totalPages: number }> {
    const data = await this.fetch(`/trending/tv/${timeWindow}?page=${page}`)
    return {
      results: data.results.map((s: any) => this.mapTvShow(s)),
      totalPages: data.total_pages,
    }
  }

  // Genre Discovery

  async discoverMoviesByGenre(
    genreId: number,
    sortBy: string = 'popularity.desc',
    page: number = 1
  ): Promise<{ results: TmdbMovie[]; totalPages: number }> {
    const data = await this.fetch(
      `/discover/movie?with_genres=${genreId}&sort_by=${sortBy}&page=${page}`
    )
    return { results: data.results.map((m: any) => this.mapMovie(m)), totalPages: data.total_pages }
  }

  async discoverTvShowsByGenre(
    genreId: number,
    sortBy: string = 'popularity.desc',
    page: number = 1
  ): Promise<{ results: TmdbTvShow[]; totalPages: number }> {
    const data = await this.fetch(
      `/discover/tv?with_genres=${genreId}&sort_by=${sortBy}&page=${page}`
    )
    return {
      results: data.results.map((s: any) => this.mapTvShow(s)),
      totalPages: data.total_pages,
    }
  }

  // Recommendations & Similar

  async getMovieRecommendations(movieId: number): Promise<TmdbMovie[]> {
    const data = await this.fetch(`/movie/${movieId}/recommendations`)
    return data.results.map((m: any) => this.mapMovie(m))
  }

  async getSimilarMovies(movieId: number): Promise<TmdbMovie[]> {
    const data = await this.fetch(`/movie/${movieId}/similar`)
    return data.results.map((m: any) => this.mapMovie(m))
  }

  async getTvShowRecommendations(showId: number): Promise<TmdbTvShow[]> {
    const data = await this.fetch(`/tv/${showId}/recommendations`)
    return data.results.map((s: any) => this.mapTvShow(s))
  }

  async getSimilarTvShows(showId: number): Promise<TmdbTvShow[]> {
    const data = await this.fetch(`/tv/${showId}/similar`)
    return data.results.map((s: any) => this.mapTvShow(s))
  }
}

export const tmdbService = new TmdbService()
