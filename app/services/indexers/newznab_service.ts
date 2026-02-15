import { XMLParser } from 'fast-xml-parser'

export interface NewznabCapabilities {
  searching: {
    search: boolean
    tvSearch: boolean
    movieSearch: boolean
    musicSearch: boolean
    audioSearch: boolean
    bookSearch: boolean
  }
  categories: NewznabCategory[]
  limits: {
    max: number
    default: number
  }
}

export interface NewznabCategory {
  id: number
  name: string
  subCategories?: NewznabCategory[]
}

export interface NewznabSearchResult {
  guid: string
  title: string
  link: string
  size: number
  pubDate: string
  category: string
  categoryId: number
  indexer: string
  indexerId: string
  downloadUrl: string
  infoUrl?: string
  grabs?: number
  seeders?: number
  peers?: number
  // Music-specific attributes
  artist?: string
  album?: string
  label?: string
  year?: number
}

export interface NewznabIndexerConfig {
  id: string
  name: string
  url: string
  apiKey: string
  categories: number[]
  enabled: boolean
}

// Music categories in Newznab
const MUSIC_CATEGORIES = [
  3000, // Audio
  3010, // MP3
  3020, // Video (Music Videos)
  3030, // Audiobook
  3040, // FLAC
  3050, // Other
  3060, // Foreign
]

export class NewznabService {
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  })

  // Default timeout for fetch requests (5 seconds)
  private fetchTimeout = 5000

  /**
   * Fetch with timeout to prevent slow indexers from blocking
   */
  private async fetchWithTimeout(url: string, timeoutMs?: number): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs || this.fetchTimeout)

    try {
      const response = await fetch(url, { signal: controller.signal })
      return response
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Test connection and get indexer capabilities
   */
  async getCapabilities(url: string, apiKey: string): Promise<NewznabCapabilities> {
    const capsUrl = `${this.normalizeUrl(url)}/api?t=caps&apikey=${apiKey}`

    const response = await this.fetchWithTimeout(capsUrl, 10000) // 10s for caps check
    if (!response.ok) {
      throw new Error(`Failed to get capabilities: ${response.status}`)
    }

    const xml = await response.text()
    const data = this.parser.parse(xml)

    const caps = data.caps
    if (!caps) {
      throw new Error('Invalid capabilities response')
    }

    const searching = caps.searching || {}
    const categories: NewznabCategory[] = []

    // Parse categories
    const catList = caps.categories?.category || []
    const categoryArray = Array.isArray(catList) ? catList : [catList]

    for (const cat of categoryArray) {
      if (!cat) continue

      const category: NewznabCategory = {
        id: Number.parseInt(cat['@_id'], 10),
        name: cat['@_name'],
        subCategories: [],
      }

      const subCats = cat.subcat || []
      const subCatArray = Array.isArray(subCats) ? subCats : [subCats]

      for (const subCat of subCatArray) {
        if (!subCat) continue
        category.subCategories?.push({
          id: Number.parseInt(subCat['@_id'], 10),
          name: subCat['@_name'],
        })
      }

      categories.push(category)
    }

    return {
      searching: {
        search: searching.search?.['@_available'] === 'yes',
        tvSearch: searching['tv-search']?.['@_available'] === 'yes',
        movieSearch: searching['movie-search']?.['@_available'] === 'yes',
        musicSearch: searching['music-search']?.['@_available'] === 'yes',
        audioSearch: searching['audio-search']?.['@_available'] === 'yes',
        bookSearch: searching['book-search']?.['@_available'] === 'yes',
      },
      categories,
      limits: {
        max: Number.parseInt(caps.limits?.['@_max'] || '100', 10),
        default: Number.parseInt(caps.limits?.['@_default'] || '100', 10),
      },
    }
  }

  /**
   * Search for music releases
   */
  async searchMusic(
    config: NewznabIndexerConfig,
    options: {
      query?: string
      artist?: string
      album?: string
      label?: string
      year?: number
      categories?: number[]
      limit?: number
      offset?: number
    } = {}
  ): Promise<NewznabSearchResult[]> {
    const params = new URLSearchParams({
      t: 'music',
      apikey: config.apiKey,
      limit: String(options.limit || 100),
      offset: String(options.offset || 0),
      extended: '1', // Request extended attributes (grabs, etc.)
    })

    if (options.query) params.set('q', options.query)
    if (options.artist) params.set('artist', options.artist)
    if (options.album) params.set('album', options.album)
    if (options.label) params.set('label', options.label)
    if (options.year) params.set('year', String(options.year))

    const categories = options.categories || config.categories || MUSIC_CATEGORIES
    if (categories.length > 0) {
      params.set('cat', categories.join(','))
    }

    const searchUrl = `${this.normalizeUrl(config.url)}/api?${params.toString()}`

    const response = await this.fetchWithTimeout(searchUrl)
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    const xml = await response.text()
    return this.parseSearchResults(xml, config)
  }

  /**
   * General search (fallback if music search not supported)
   */
  async search(
    config: NewznabIndexerConfig,
    query: string,
    options: {
      categories?: number[]
      limit?: number
      offset?: number
    } = {}
  ): Promise<NewznabSearchResult[]> {
    const params = new URLSearchParams({
      t: 'search',
      apikey: config.apiKey,
      q: query,
      limit: String(options.limit || 100),
      offset: String(options.offset || 0),
      extended: '1', // Request extended attributes (grabs, etc.)
    })

    const categories = options.categories || config.categories || MUSIC_CATEGORIES
    if (categories.length > 0) {
      params.set('cat', categories.join(','))
    }

    const searchUrl = `${this.normalizeUrl(config.url)}/api?${params.toString()}`

    const response = await this.fetchWithTimeout(searchUrl)
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    const xml = await response.text()
    return this.parseSearchResults(xml, config)
  }

  /**
   * Search for TV shows using Newznab tvsearch
   */
  async searchTvShows(
    config: NewznabIndexerConfig,
    options: {
      query?: string
      tvdbId?: string
      imdbId?: string
      season?: number
      episode?: number
      airDate?: string
      categories?: number[]
      limit?: number
      offset?: number
    } = {}
  ): Promise<NewznabSearchResult[]> {
    const tvCategories = [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5060, 5070, 5080]

    const params = new URLSearchParams({
      t: 'tvsearch',
      apikey: config.apiKey,
      limit: String(options.limit || 100),
      offset: String(options.offset || 0),
      extended: '1',
    })

    if (options.query) params.set('q', options.query)
    if (options.tvdbId) params.set('tvdbid', options.tvdbId)
    if (options.imdbId) params.set('imdbid', options.imdbId)

    // For daily shows, use date-based season/ep: season=YYYY, ep=MM/DD
    if (options.airDate) {
      const [year, month, day] = options.airDate.split('-')
      params.set('season', year)
      params.set('ep', `${month}/${day}`)
    } else {
      if (options.season !== undefined) params.set('season', String(options.season))
      if (options.episode !== undefined) params.set('ep', String(options.episode))
    }

    const categories = options.categories || config.categories || tvCategories
    if (categories.length > 0) {
      params.set('cat', categories.join(','))
    }

    const searchUrl = `${this.normalizeUrl(config.url)}/api?${params.toString()}`

    const response = await this.fetchWithTimeout(searchUrl)
    if (!response.ok) {
      throw new Error(`TV search failed: ${response.status}`)
    }

    const xml = await response.text()
    return this.parseSearchResults(xml, config)
  }

  /**
   * Get NZB download URL
   */
  getNzbUrl(config: NewznabIndexerConfig, guid: string): string {
    return `${this.normalizeUrl(config.url)}/api?t=get&apikey=${config.apiKey}&id=${guid}`
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/+$/, '')
  }

  private parseSearchResults(xml: string, config: NewznabIndexerConfig): NewznabSearchResult[] {
    const data = this.parser.parse(xml)
    const channel = data.rss?.channel

    if (!channel) {
      // Check for error response
      const error = data.error
      if (error) {
        throw new Error(`Indexer error: ${error['@_description'] || 'Unknown error'}`)
      }
      return []
    }

    const items = channel.item || []
    const itemArray = Array.isArray(items) ? items : [items]

    return itemArray
      .filter((item: any) => item && item.title)
      .map((item: any) => {
        const attrs = this.parseNewznabAttributes(item['newznab:attr'] || item.attr || [])

        return {
          guid: item.guid?.['#text'] || item.guid || '',
          title: item.title,
          link: item.link,
          size: Number.parseInt(attrs.size || '0', 10),
          pubDate: item.pubDate,
          category: attrs.category || '',
          categoryId: Number.parseInt(attrs.categoryId || '0', 10),
          indexer: config.name,
          indexerId: config.id,
          downloadUrl: item.link,
          infoUrl: item.comments,
          grabs: attrs.grabs ? Number.parseInt(attrs.grabs, 10) : undefined,
          seeders: attrs.seeders ? Number.parseInt(attrs.seeders, 10) : undefined,
          peers: attrs.peers ? Number.parseInt(attrs.peers, 10) : undefined,
          artist: attrs.artist,
          album: attrs.album,
          label: attrs.label,
          year: attrs.year ? Number.parseInt(attrs.year, 10) : undefined,
        }
      })
  }

  private parseNewznabAttributes(attrs: any): Record<string, string> {
    const result: Record<string, string> = {}
    const attrArray = Array.isArray(attrs) ? attrs : [attrs]

    for (const attr of attrArray) {
      if (attr && attr['@_name'] && attr['@_value']) {
        result[attr['@_name']] = attr['@_value']
      }
    }

    return result
  }
}

export const newznabService = new NewznabService()
