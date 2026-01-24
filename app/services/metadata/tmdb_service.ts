import PQueue from 'p-queue'

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

// Rate limit: 40 requests per 10 seconds
const queue = new PQueue({ interval: 250, intervalCap: 1 })

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
    const data = await this.fetch(`/movie/${id}?append_to_response=external_ids`)
    return this.mapMovie(data, data.external_ids?.imdb_id)
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
      year: m.release_date ? parseInt(m.release_date.substring(0, 4)) : 0,
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

  async getMovieCredits(id: number, limit: number = 6): Promise<TmdbCastMember[]> {
    const data = await this.fetch(`/movie/${id}/credits`)
    return this.mapCast(data.cast, limit)
  }

  // TV Shows

  async getTvShowCredits(id: number, limit: number = 6): Promise<TmdbCastMember[]> {
    const data = await this.fetch(`/tv/${id}/credits`)
    return this.mapCast(data.cast, limit)
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

  async searchTvShows(query: string, year?: number): Promise<TmdbTvShow[]> {
    let endpoint = `/search/tv?query=${encodeURIComponent(query)}`
    if (year) {
      endpoint += `&first_air_date_year=${year}`
    }

    const data = await this.fetch(endpoint)

    return data.results.map((s: any) => this.mapTvShow(s))
  }

  async getTvShow(id: number): Promise<TmdbTvShow> {
    const data = await this.fetch(`/tv/${id}`)
    return this.mapTvShow(data)
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

  private mapTvShow(s: any): TmdbTvShow {
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
      year: s.first_air_date ? parseInt(s.first_air_date.substring(0, 4)) : 0,
      status: s.status || '',
      posterPath: s.poster_path ? `${TMDB_IMAGE_BASE}/w500${s.poster_path}` : null,
      backdropPath: s.backdrop_path ? `${TMDB_IMAGE_BASE}/original${s.backdrop_path}` : null,
      voteAverage: s.vote_average || 0,
      voteCount: s.vote_count || 0,
      genres,
      networks: s.networks?.map((n: any) => n.name) || [],
      numberOfSeasons: s.number_of_seasons || 0,
      numberOfEpisodes: s.number_of_episodes || 0,
    }
  }

  getImageUrl(
    path: string | null,
    size: 'w200' | 'w300' | 'w500' | 'original' = 'w500'
  ): string | null {
    if (!path) return null
    return `${TMDB_IMAGE_BASE}/${size}${path}`
  }

  // Discovery / Popular / Trending

  async getPopularMovies(): Promise<TmdbMovie[]> {
    const data = await this.fetch('/movie/popular')
    return data.results.map((m: any) => this.mapMovie(m))
  }

  async getNowPlayingMovies(): Promise<TmdbMovie[]> {
    const data = await this.fetch('/movie/now_playing')
    return data.results.map((m: any) => this.mapMovie(m))
  }

  async getUpcomingMovies(): Promise<TmdbMovie[]> {
    const data = await this.fetch('/movie/upcoming')
    return data.results.map((m: any) => this.mapMovie(m))
  }

  async getTrendingMovies(timeWindow: 'day' | 'week' = 'week'): Promise<TmdbMovie[]> {
    const data = await this.fetch(`/trending/movie/${timeWindow}`)
    return data.results.map((m: any) => this.mapMovie(m))
  }

  async getPopularTvShows(): Promise<TmdbTvShow[]> {
    const data = await this.fetch('/tv/popular')
    return data.results.map((s: any) => this.mapTvShow(s))
  }

  async getTopRatedTvShows(): Promise<TmdbTvShow[]> {
    const data = await this.fetch('/tv/top_rated')
    return data.results.map((s: any) => this.mapTvShow(s))
  }

  async getOnTheAirTvShows(): Promise<TmdbTvShow[]> {
    const data = await this.fetch('/tv/on_the_air')
    return data.results.map((s: any) => this.mapTvShow(s))
  }

  async getTrendingTvShows(timeWindow: 'day' | 'week' = 'week'): Promise<TmdbTvShow[]> {
    const data = await this.fetch(`/trending/tv/${timeWindow}`)
    return data.results.map((s: any) => this.mapTvShow(s))
  }
}

export const tmdbService = new TmdbService()
