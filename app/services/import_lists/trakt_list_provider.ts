import type { ImportListSettings } from '#models/import_list'

const TRAKT_API = 'https://api.trakt.tv'

export interface ImportListItem {
  title: string
  year: number | null
  imdbId: string | null
  tmdbId: number | null
  mediaType: 'movie' | 'show'
}

export class TraktListProvider {
  private clientId: string | null = null

  setClientId(id: string) {
    this.clientId = id
  }

  private async fetch(endpoint: string): Promise<any> {
    if (!this.clientId) {
      throw new Error('Trakt client ID not configured')
    }

    const response = await fetch(`${TRAKT_API}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': this.clientId,
      },
    })

    if (!response.ok) {
      throw new Error(`Trakt API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async fetchWatchlist(
    settings: ImportListSettings,
    mediaType: 'movies' | 'tv'
  ): Promise<ImportListItem[]> {
    const username = settings.traktUsername
    if (!username) {
      throw new Error('Trakt username is required for watchlist')
    }

    const type = mediaType === 'movies' ? 'movies' : 'shows'
    const data = await this.fetch(`/users/${encodeURIComponent(username)}/watchlist/${type}`)

    return this.parseItems(data, mediaType)
  }

  async fetchList(
    settings: ImportListSettings,
    mediaType: 'movies' | 'tv'
  ): Promise<ImportListItem[]> {
    const username = settings.traktUsername
    const listSlug = settings.traktListSlug
    if (!username || !listSlug) {
      throw new Error('Trakt username and list slug are required')
    }

    const data = await this.fetch(
      `/users/${encodeURIComponent(username)}/lists/${encodeURIComponent(listSlug)}/items`
    )

    return this.parseItems(data, mediaType)
  }

  private parseItems(data: any[], mediaType: 'movies' | 'tv'): ImportListItem[] {
    const items: ImportListItem[] = []

    for (const entry of data) {
      if (mediaType === 'movies' && entry.movie) {
        items.push({
          title: entry.movie.title,
          year: entry.movie.year,
          imdbId: entry.movie.ids?.imdb || null,
          tmdbId: entry.movie.ids?.tmdb || null,
          mediaType: 'movie',
        })
      } else if (mediaType === 'tv' && entry.show) {
        items.push({
          title: entry.show.title,
          year: entry.show.year,
          imdbId: entry.show.ids?.imdb || null,
          tmdbId: entry.show.ids?.tmdb || null,
          mediaType: 'show',
        })
      }
    }

    return items
  }
}

export const traktListProvider = new TraktListProvider()
