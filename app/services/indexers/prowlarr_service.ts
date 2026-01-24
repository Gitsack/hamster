export interface ProwlarrIndexer {
  id: number
  name: string
  protocol: 'usenet' | 'torrent'
  privacy: 'public' | 'private' | 'semiPrivate'
  supportsRss: boolean
  supportsSearch: boolean
  capabilities: {
    supportsRawSearch: boolean
    searchParams: string[]
    tvSearchParams: string[]
    movieSearchParams: string[]
    musicSearchParams: string[]
    bookSearchParams: string[]
    categories: Array<{
      id: number
      name: string
      subCategories?: Array<{ id: number; name: string }>
    }>
  }
  priority: number
  added: string
  enable: boolean
  appProfileId: number
}

export interface ProwlarrSearchResult {
  guid: string
  indexerId: number
  indexer: string
  title: string
  sortTitle: string
  size: number
  downloadUrl: string
  infoUrl?: string
  publishDate: string
  categories: Array<{ id: number; name: string }>
  protocol: 'usenet' | 'torrent'
  seeders?: number
  leechers?: number
  grabs?: number
  // Music-specific
  artist?: string
  album?: string
  year?: number
}

export interface ProwlarrConfig {
  url: string
  apiKey: string
}

export class ProwlarrService {
  /**
   * Test Prowlarr connection
   */
  async testConnection(
    config: ProwlarrConfig
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const response = await fetch(`${this.normalizeUrl(config.url)}/api/v1/system/status`, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid API key' }
        }
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = (await response.json()) as { version: string }
      return { success: true, version: data.version }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  /**
   * Get all indexers from Prowlarr
   */
  async getIndexers(config: ProwlarrConfig): Promise<ProwlarrIndexer[]> {
    const response = await fetch(`${this.normalizeUrl(config.url)}/api/v1/indexer`, {
      headers: {
        'X-Api-Key': config.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get indexers: ${response.status}`)
    }

    return (await response.json()) as ProwlarrIndexer[]
  }

  /**
   * Search across all Prowlarr indexers
   */
  async search(
    config: ProwlarrConfig,
    options: {
      query?: string
      categories?: number[]
      type?: 'search' | 'tvsearch' | 'movie' | 'music' | 'book'
      indexerIds?: number[]
      limit?: number
      offset?: number
    } = {}
  ): Promise<ProwlarrSearchResult[]> {
    const params = new URLSearchParams()

    if (options.query) params.set('query', options.query)
    if (options.type) params.set('type', options.type)
    if (options.categories?.length) params.set('categories', options.categories.join(','))
    if (options.indexerIds?.length) params.set('indexerIds', options.indexerIds.join(','))
    if (options.limit) params.set('limit', String(options.limit))
    if (options.offset) params.set('offset', String(options.offset))

    const response = await fetch(
      `${this.normalizeUrl(config.url)}/api/v1/search?${params.toString()}`,
      {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    return (await response.json()) as ProwlarrSearchResult[]
  }

  /**
   * Search for music specifically
   */
  async searchMusic(
    config: ProwlarrConfig,
    options: {
      query?: string
      artist?: string
      album?: string
      indexerIds?: number[]
      limit?: number
    } = {}
  ): Promise<ProwlarrSearchResult[]> {
    // Build search query
    let query = options.query || ''
    if (options.artist && options.album) {
      query = `${options.artist} ${options.album}`
    } else if (options.artist) {
      query = options.artist
    } else if (options.album) {
      query = options.album
    }

    // Music categories: 3000 (Audio), 3010 (MP3), 3040 (FLAC), etc.
    const musicCategories = [3000, 3010, 3020, 3030, 3040, 3050, 3060]

    return this.search(config, {
      query,
      type: 'music',
      categories: musicCategories,
      indexerIds: options.indexerIds,
      limit: options.limit || 100,
    })
  }

  /**
   * Search for movies specifically
   */
  async searchMovies(
    config: ProwlarrConfig,
    options: {
      query?: string
      title?: string
      year?: number
      imdbId?: string
      tmdbId?: string
      indexerIds?: number[]
      limit?: number
    } = {}
  ): Promise<ProwlarrSearchResult[]> {
    // Build search query
    let query = options.query || options.title || ''
    if (options.year && !options.query) {
      query = `${query} ${options.year}`.trim()
    }

    // Movie categories: 2000 (Movies), 2010 (Foreign), 2020 (Other), 2030 (SD), 2040 (HD), 2045 (UHD), 2050 (BluRay), 2060 (3D)
    const movieCategories = [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060]

    return this.search(config, {
      query,
      type: 'movie',
      categories: movieCategories,
      indexerIds: options.indexerIds,
      limit: options.limit || 100,
    })
  }

  /**
   * Search for TV shows specifically
   */
  async searchTvShows(
    config: ProwlarrConfig,
    options: {
      query?: string
      title?: string
      season?: number
      episode?: number
      tvdbId?: string
      imdbId?: string
      indexerIds?: number[]
      limit?: number
    } = {}
  ): Promise<ProwlarrSearchResult[]> {
    // Build search query
    let query = options.query || options.title || ''
    if (options.season !== undefined && !options.query) {
      query = `${query} S${String(options.season).padStart(2, '0')}`.trim()
      if (options.episode !== undefined) {
        query = `${query}E${String(options.episode).padStart(2, '0')}`
      }
    }

    // TV categories: 5000 (TV), 5010 (WEB-DL), 5020 (Foreign), 5030 (SD), 5040 (HD), 5045 (UHD), 5050 (Other), 5060 (Sports), 5070 (Anime), 5080 (Documentary)
    const tvCategories = [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5060, 5070, 5080]

    return this.search(config, {
      query,
      type: 'tvsearch',
      categories: tvCategories,
      indexerIds: options.indexerIds,
      limit: options.limit || 100,
    })
  }

  /**
   * Search for books/ebooks specifically
   */
  async searchBooks(
    config: ProwlarrConfig,
    options: {
      query?: string
      title?: string
      author?: string
      indexerIds?: number[]
      limit?: number
    } = {}
  ): Promise<ProwlarrSearchResult[]> {
    // Build search query
    let query = options.query || ''
    if (!options.query) {
      if (options.author && options.title) {
        query = `${options.author} ${options.title}`
      } else if (options.title) {
        query = options.title
      } else if (options.author) {
        query = options.author
      }
    }

    // Book/Ebook categories: 7000 (Books), 7010 (Mags), 7020 (EBook), 7030 (Comics), 7040 (Technical), 7050 (Other), 8010 (Audiobook)
    const bookCategories = [7000, 7010, 7020, 7030, 7040, 7050, 8010]

    return this.search(config, {
      query,
      type: 'book',
      categories: bookCategories,
      indexerIds: options.indexerIds,
      limit: options.limit || 100,
    })
  }

  /**
   * Get download URL (Prowlarr proxies the download)
   */
  getDownloadUrl(config: ProwlarrConfig, guid: string, indexerId: string | number): string {
    return `${this.normalizeUrl(config.url)}/api/v1/search/download?guid=${encodeURIComponent(guid)}&indexerId=${indexerId}`
  }

  /**
   * Sync indexers from Prowlarr to local database
   */
  async syncIndexers(config: ProwlarrConfig): Promise<{
    added: number
    updated: number
    removed: number
    indexers: ProwlarrIndexer[]
  }> {
    const indexers = await this.getIndexers(config)

    // Filter to only usenet indexers that support music search
    const musicIndexers = indexers.filter((indexer) => {
      if (!indexer.enable) return false
      if (indexer.protocol !== 'usenet') return false

      // Check if indexer has music categories
      const hasMusic = indexer.capabilities.categories.some(
        (cat) => cat.id >= 3000 && cat.id < 4000
      )
      return hasMusic
    })

    return {
      added: 0,
      updated: 0,
      removed: 0,
      indexers: musicIndexers,
    }
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/+$/, '')
  }
}

export const prowlarrService = new ProwlarrService()
