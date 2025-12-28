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
  async testConnection(config: ProwlarrConfig): Promise<{ success: boolean; version?: string; error?: string }> {
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
   * Get download URL (Prowlarr proxies the download)
   */
  getDownloadUrl(config: ProwlarrConfig, guid: string, indexerId: number): string {
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
