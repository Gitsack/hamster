import PQueue from 'p-queue'

const TRAKT_API = 'https://api.trakt.tv'

// Rate limit: ~3 requests per second
const queue = new PQueue({ interval: 350, intervalCap: 1 })

export interface TraktMovie {
  title: string
  year: number
  ids: {
    trakt: number
    slug: string
    imdb: string | null
    tmdb: number | null
  }
}

export interface TraktShow {
  title: string
  year: number
  ids: {
    trakt: number
    slug: string
    imdb: string | null
    tmdb: number | null
    tvdb: number | null
  }
}

export interface TraktTrendingMovie {
  watchers: number
  movie: TraktMovie
}

export interface TraktAnticipatedMovie {
  list_count: number
  movie: TraktMovie
}

export interface TraktRecommendedMovie {
  user_count: number
  movie: TraktMovie
}

export interface TraktTrendingShow {
  watchers: number
  show: TraktShow
}

export interface TraktAnticipatedShow {
  list_count: number
  show: TraktShow
}

export interface TraktRecommendedShow {
  user_count: number
  show: TraktShow
}

export type TraktPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'

export class TraktService {
  private clientId: string | null = null

  setClientId(id: string) {
    this.clientId = id
  }

  private async fetch(endpoint: string): Promise<any> {
    if (!this.clientId) {
      throw new Error('Trakt client ID not configured')
    }

    const url = `${TRAKT_API}${endpoint}`

    return queue.add(async () => {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': this.clientId!,
        },
      })

      if (!response.ok) {
        throw new Error(`Trakt API error: ${response.status} ${response.statusText}`)
      }

      return response.json()
    })
  }

  // Movies

  async getTrendingMovies(): Promise<TraktTrendingMovie[]> {
    return this.fetch('/movies/trending')
  }

  async getAnticipatedMovies(): Promise<TraktAnticipatedMovie[]> {
    return this.fetch('/movies/anticipated')
  }

  async getRecommendedMovies(period: TraktPeriod = 'weekly'): Promise<TraktRecommendedMovie[]> {
    return this.fetch(`/movies/recommended/${period}?limit=20`)
  }

  // TV Shows

  async getTrendingShows(): Promise<TraktTrendingShow[]> {
    return this.fetch('/shows/trending')
  }

  async getAnticipatedShows(): Promise<TraktAnticipatedShow[]> {
    return this.fetch('/shows/anticipated')
  }

  async getRecommendedShows(period: TraktPeriod = 'weekly'): Promise<TraktRecommendedShow[]> {
    return this.fetch(`/shows/recommended/${period}?limit=20`)
  }
}

export const traktService = new TraktService()
