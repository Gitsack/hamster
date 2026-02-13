import PQueue from 'p-queue'

const JUSTWATCH_GRAPHQL = 'https://apis.justwatch.com/graphql'
const JUSTWATCH_IMAGE_BASE = 'https://images.justwatch.com'

// Conservative rate limiting for unofficial API (~2 req/s)
const queue = new PQueue({ interval: 500, intervalCap: 1 })

export interface JustWatchProvider {
  id: number
  technicalName: string
  clearName: string
  iconUrl: string
}

export interface JustWatchOffer {
  monetizationType: 'flatrate' | 'rent' | 'buy' | 'free' | 'ads'
  providerId: number
  providerName: string
  providerIconUrl: string
  presentationType: string
  url: string
  retailPrice?: number
  currency?: string
}

export interface JustWatchResult {
  jwId: number
  title: string
  year: number
  tmdbId?: number
  imdbId?: string
  posterUrl: string | null
  offers: JustWatchOffer[]
}

const POPULAR_TITLES_QUERY = `
query GetPopularTitles(
  $country: Country!
  $language: Language!
  $first: Int!
  $filter: TitleFilter
  $sortBy: PopularTitlesSorting!
) {
  popularTitles(
    country: $country
    language: $language
    first: $first
    filter: $filter
    sortBy: $sortBy
    sortRandomSeed: 0
  ) {
    edges {
      node {
        id
        objectId
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
          posterUrl
          externalIds {
            imdbId
            tmdbId
          }
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          presentationType
          retailPrice(language: $language)
          currency
          standardWebURL
          package {
            packageId
            clearName
            technicalName
            icon(profile: S100)
          }
        }
      }
    }
  }
}
`

export class JustWatchService {
  private locale: string = 'en_US'

  setLocale(locale: string) {
    this.locale = locale
  }

  private get country(): string {
    return this.locale.split('_')[1] || 'US'
  }

  private get language(): string {
    return this.locale.split('_')[0] || 'en'
  }

  private safeParseResponse<T>(data: any, parser: (d: any) => T, fallback: T): T {
    try {
      return parser(data)
    } catch (error) {
      console.warn('[JustWatch] Response parsing failed, API may have changed:', error)
      return fallback
    }
  }

  private async graphqlQuery(query: string, variables: Record<string, any>): Promise<any> {
    return queue.add(async () => {
      const response = await fetch(JUSTWATCH_GRAPHQL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      })

      if (!response.ok) {
        throw new Error(`JustWatch GraphQL error: ${response.status} ${response.statusText}`)
      }

      const result: any = await response.json()
      if (result.errors && result.errors.length > 0) {
        console.warn('[JustWatch] GraphQL errors:', JSON.stringify(result.errors))
        // Still return data if available (partial results)
        if (!result.data) {
          throw new Error(`JustWatch GraphQL errors: ${result.errors[0]?.message}`)
        }
      }

      return result.data
    })
  }

  private buildPosterUrl(posterTemplate: string | null | undefined): string | null {
    if (!posterTemplate || typeof posterTemplate !== 'string') return null
    const path = posterTemplate.replace('{profile}', 's332')
    return `${JUSTWATCH_IMAGE_BASE}${path.startsWith('/') ? '' : '/'}${path}`
  }

  private buildIconUrl(iconPath: string | null | undefined): string {
    if (!iconPath || typeof iconPath !== 'string') return ''
    return `${JUSTWATCH_IMAGE_BASE}${iconPath.startsWith('/') ? '' : '/'}${iconPath}`
  }

  private mapPresentationType(pt: string | null | undefined): string {
    if (!pt) return 'sd'
    const map: Record<string, string> = {
      '_4K': '4k',
      'FOUR_K': '4k',
      '4K': '4k',
      'HD': 'hd',
      'SD': 'sd',
      'BLURAY': 'hd',
    }
    return map[pt] || pt.toLowerCase()
  }

  private mapMonetizationType(
    mt: string | null | undefined
  ): 'flatrate' | 'rent' | 'buy' | 'free' | 'ads' {
    if (!mt) return 'buy'
    const map: Record<string, 'flatrate' | 'rent' | 'buy' | 'free' | 'ads'> = {
      FLATRATE: 'flatrate',
      RENT: 'rent',
      BUY: 'buy',
      FREE: 'free',
      ADS: 'ads',
    }
    return map[mt] || 'buy'
  }

  private mapNode(node: any): JustWatchResult | null {
    try {
      if (!node?.content?.title) return null

      const content = node.content
      const year = content.originalReleaseYear
      if (typeof year !== 'number') return null

      const objectId = typeof node.objectId === 'number' ? node.objectId : 0

      // Extract TMDB and IMDB IDs from externalIds
      let tmdbId: number | undefined
      let imdbId: string | undefined

      if (content.externalIds) {
        if (content.externalIds.tmdbId !== null && content.externalIds.tmdbId !== undefined) {
          const parsed =
            typeof content.externalIds.tmdbId === 'number'
              ? content.externalIds.tmdbId
              : Number.parseInt(String(content.externalIds.tmdbId))
          if (!Number.isNaN(parsed)) tmdbId = parsed
        }
        if (content.externalIds.imdbId && typeof content.externalIds.imdbId === 'string') {
          imdbId = content.externalIds.imdbId
        }
      }

      const posterUrl = this.buildPosterUrl(content.posterUrl)
      const offers = this.mapNodeOffers(node.offers)

      return {
        jwId: objectId,
        title: content.title,
        year,
        tmdbId,
        imdbId,
        posterUrl,
        offers,
      }
    } catch (error) {
      console.warn('[JustWatch] Failed to map node:', error)
      return null
    }
  }

  private mapNodeOffers(rawOffers: any[] | undefined | null): JustWatchOffer[] {
    if (!Array.isArray(rawOffers)) return []

    const validTypes = new Set(['FLATRATE', 'FREE', 'ADS', 'RENT', 'BUY'])

    // Group by provider+monetizationType and pick best presentation
    const grouped = new Map<string, JustWatchOffer>()
    const presentationRank: Record<string, number> = { '4k': 3, 'hd': 2, 'sd': 1 }

    for (const offer of rawOffers) {
      try {
        if (!offer?.package?.packageId) continue
        if (!offer.monetizationType || !validTypes.has(offer.monetizationType)) continue

        const pkg = offer.package
        const monetizationType = this.mapMonetizationType(offer.monetizationType)
        const presentationType = this.mapPresentationType(offer.presentationType)

        const key = `${pkg.packageId}-${monetizationType}`
        const existing = grouped.get(key)

        const currentRank = presentationRank[presentationType] || 0
        const existingRank = existing ? presentationRank[existing.presentationType] || 0 : -1

        if (!existing || currentRank > existingRank) {
          // Parse retailPrice - could be number, string, or null
          let retailPrice: number | undefined
          if (typeof offer.retailPrice === 'number') {
            retailPrice = offer.retailPrice
          } else if (typeof offer.retailPrice === 'string') {
            // Handle localized formats like "4,99" (comma decimal) or "4.99" (dot decimal)
            const normalized = offer.retailPrice.replace(',', '.').replace(/[^0-9.]/g, '')
            const parsed = Number.parseFloat(normalized)
            if (!Number.isNaN(parsed)) retailPrice = parsed
          }

          grouped.set(key, {
            monetizationType,
            providerId: pkg.packageId,
            providerName: pkg.clearName || `Provider ${pkg.packageId}`,
            providerIconUrl: this.buildIconUrl(pkg.icon),
            presentationType,
            url: offer.standardWebURL || '',
            retailPrice,
            currency: typeof offer.currency === 'string' ? offer.currency : undefined,
          })
        }
      } catch {
        // Skip malformed offer
      }
    }

    return Array.from(grouped.values())
  }

  private parseEdges(data: any): JustWatchResult[] {
    const edges = data?.popularTitles?.edges
    if (!Array.isArray(edges)) return []
    return edges.map((edge: any) => this.mapNode(edge?.node)).filter(Boolean) as JustWatchResult[]
  }

  // Search

  async search(
    query: string,
    contentType?: 'movie' | 'show',
    _year?: number
  ): Promise<JustWatchResult[]> {
    try {
      const filter: Record<string, any> = { searchQuery: query }

      if (contentType) {
        filter.objectTypes = [contentType === 'movie' ? 'MOVIE' : 'SHOW']
      }

      const data = await this.graphqlQuery(POPULAR_TITLES_QUERY, {
        country: this.country,
        language: this.language,
        first: 10,
        filter,
        sortBy: 'POPULAR',
      })

      return this.safeParseResponse(data, (d) => this.parseEdges(d), [])
    } catch (error) {
      console.warn('[JustWatch] Search failed:', error)
      return []
    }
  }

  // Streaming availability

  async getStreamingAvailability(
    title: string,
    year: number,
    contentType: 'movie' | 'show'
  ): Promise<JustWatchOffer[]> {
    try {
      const results = await this.search(title, contentType, year)

      if (results.length === 0) return []

      // Find best match: exact title match + year match
      const titleLower = title.toLowerCase()
      const bestMatch =
        results.find((r) => r.title.toLowerCase() === titleLower && r.year === year) ||
        results.find((r) => r.title.toLowerCase() === titleLower) ||
        results[0]

      return bestMatch.offers
    } catch (error) {
      console.warn('[JustWatch] getStreamingAvailability failed:', error)
      return []
    }
  }

  // Popular content

  async getPopularMovies(): Promise<JustWatchResult[]> {
    try {
      const data = await this.graphqlQuery(POPULAR_TITLES_QUERY, {
        country: this.country,
        language: this.language,
        first: 20,
        filter: {
          objectTypes: ['MOVIE'],
          monetizationTypes: ['FLATRATE'],
        },
        sortBy: 'POPULAR',
      })

      return this.safeParseResponse(data, (d) => this.parseEdges(d), [])
    } catch (error) {
      console.warn('[JustWatch] getPopularMovies failed:', error)
      return []
    }
  }

  async getPopularShows(): Promise<JustWatchResult[]> {
    try {
      const data = await this.graphqlQuery(POPULAR_TITLES_QUERY, {
        country: this.country,
        language: this.language,
        first: 20,
        filter: {
          objectTypes: ['SHOW'],
          monetizationTypes: ['FLATRATE'],
        },
        sortBy: 'POPULAR',
      })

      return this.safeParseResponse(data, (d) => this.parseEdges(d), [])
    } catch (error) {
      console.warn('[JustWatch] getPopularShows failed:', error)
      return []
    }
  }

  // Provider list (kept for interface compatibility, but providers now come embedded in offers)
  async getProviders(): Promise<JustWatchProvider[]> {
    return []
  }
}

export const justwatchService = new JustWatchService()
