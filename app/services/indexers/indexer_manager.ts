import Indexer from '#models/indexer'
import ProwlarrConfig from '#models/prowlarr_config'
import {
  newznabService,
  type NewznabSearchResult,
  type NewznabIndexerConfig,
} from './newznab_service.js'
import { prowlarrService, type ProwlarrSearchResult } from './prowlarr_service.js'

export interface UnifiedSearchResult {
  id: string
  title: string
  indexer: string
  indexerId: string
  size: number
  publishDate: string
  downloadUrl: string
  infoUrl?: string
  grabs?: number
  seeders?: number
  peers?: number
  protocol: 'usenet' | 'torrent'
  source: 'direct' | 'prowlarr'
  // Music-specific
  artist?: string
  album?: string
  year?: number
  quality?: string
}

export interface SearchOptions {
  query?: string
  artist?: string
  album?: string
  track?: string
  year?: number
  indexerIds?: string[]
  useProwlarr?: boolean
  limit?: number
  // If true, use general search without music-specific filters
  generalSearch?: boolean
  // If true, skip deduplication
  skipDedup?: boolean
}

export interface MovieSearchOptions {
  title: string
  year?: number
  imdbId?: string
  tmdbId?: string
  indexerIds?: string[]
  limit?: number
}

export interface TvSearchOptions {
  title: string
  season?: number
  episode?: number
  tvdbId?: string
  imdbId?: string
  indexerIds?: string[]
  limit?: number
}

export interface BookSearchOptions {
  title: string
  author?: string
  indexerIds?: string[]
  limit?: number
}

export class IndexerManager {
  /**
   * Search across all configured indexers
   */
  async search(options: SearchOptions): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = []

    // Get Prowlarr config if enabled
    const prowlarrConfig = await ProwlarrConfig.query().where('syncEnabled', true).first()

    // Get direct indexers
    const directIndexers = await Indexer.query()
      .where('enabled', true)
      .if(options.indexerIds?.length, (query) => {
        query.whereIn('id', options.indexerIds!)
      })

    // Search via Prowlarr if configured and not filtered to specific indexers
    if (prowlarrConfig && options.useProwlarr !== false) {
      try {
        const prowlarrResults = await prowlarrService.searchMusic(
          {
            url: prowlarrConfig.baseUrl,
            apiKey: prowlarrConfig.apiKey,
          },
          {
            query: options.query,
            artist: options.artist,
            album: options.album,
            limit: options.limit,
          }
        )

        results.push(...this.mapProwlarrResults(prowlarrResults))
      } catch (error) {
        console.error('Prowlarr search failed:', error)
      }
    }

    // Search direct indexers in parallel
    const directSearches = directIndexers.map(async (indexer) => {
      try {
        const config: NewznabIndexerConfig = {
          id: indexer.id,
          name: indexer.name,
          url: indexer.settings.baseUrl || '',
          apiKey: indexer.settings.apiKey || '',
          categories: indexer.settings.categories || [],
          enabled: indexer.enabled,
        }

        let searchResults: NewznabSearchResult[]
        const query = [options.artist, options.album, options.track, options.query]
          .filter(Boolean)
          .join(' ')

        if (options.generalSearch) {
          // General search without music-specific filters (like Prowlarr)
          searchResults = await newznabService.search(config, query, {
            limit: options.limit,
            categories: [], // No category filter
          })
        } else if (options.track) {
          // Track-specific search - use general search with track title
          // This might find singles, EPs, or compilations containing the track
          searchResults = await newznabService.search(config, query, {
            limit: options.limit,
          })
        } else {
          // Try music search first, fallback to general search
          try {
            searchResults = await newznabService.searchMusic(config, {
              query: options.query,
              artist: options.artist,
              album: options.album,
              year: options.year,
              limit: options.limit,
            })
          } catch {
            // Fallback to general search if music search fails
            searchResults = await newznabService.search(config, query, {
              limit: options.limit,
            })
          }
        }

        return this.mapNewznabResults(searchResults)
      } catch (error) {
        console.error(`Search failed for indexer ${indexer.name}:`, error)
        return []
      }
    })

    const directResults = await Promise.all(directSearches)
    results.push(...directResults.flat())

    // Sort by publish date (newest first)
    results.sort((a, b) => {
      const dateA = new Date(a.publishDate).getTime()
      const dateB = new Date(b.publishDate).getTime()
      return dateB - dateA
    })

    // Deduplicate by title (prefer larger files) - skip if requested
    if (options.skipDedup) {
      return results
    }

    const seen = new Map<string, UnifiedSearchResult>()
    for (const result of results) {
      const key = result.title.toLowerCase()
      const existing = seen.get(key)
      if (!existing || result.size > existing.size) {
        seen.set(key, result)
      }
    }

    return Array.from(seen.values())
  }

  /**
   * Get download URL for a search result
   */
  async getDownloadUrl(result: UnifiedSearchResult): Promise<string> {
    if (result.source === 'prowlarr') {
      const prowlarrConfig = await ProwlarrConfig.query().where('syncEnabled', true).first()
      if (!prowlarrConfig) {
        throw new Error('Prowlarr is not configured')
      }

      return prowlarrService.getDownloadUrl(
        { url: prowlarrConfig.baseUrl, apiKey: prowlarrConfig.apiKey },
        result.id,
        result.indexerId
      )
    }

    // For direct indexers, the downloadUrl is already set
    return result.downloadUrl
  }

  /**
   * Test an indexer connection
   */
  async testIndexer(
    url: string,
    apiKey: string
  ): Promise<{ success: boolean; error?: string; categories?: number[] }> {
    try {
      const capabilities = await newznabService.getCapabilities(url, apiKey)

      // Get music category IDs
      const musicCategories = capabilities.categories
        .filter((cat) => cat.id >= 3000 && cat.id < 4000)
        .flatMap((cat) => [cat.id, ...(cat.subCategories?.map((sub) => sub.id) || [])])

      // Also verify search works (caps endpoint often works without proper auth)
      try {
        await newznabService.search(
          {
            id: 'test',
            name: 'Test',
            url,
            apiKey,
            categories: [],
            enabled: true,
          },
          'test',
          { limit: 1 }
        )
      } catch (searchError) {
        // If search fails with auth error, report it
        const message = searchError instanceof Error ? searchError.message : 'Search failed'
        if (
          message.toLowerCase().includes('credentials') ||
          message.toLowerCase().includes('auth')
        ) {
          return {
            success: false,
            error: `Capabilities OK but search failed: ${message}`,
          }
        }
        // Other search errors (no results, etc.) are OK for test
      }

      return {
        success: true,
        categories: musicCategories,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  private mapNewznabResults(results: NewznabSearchResult[]): UnifiedSearchResult[] {
    return results.map((result) => ({
      id: result.guid,
      title: result.title,
      indexer: result.indexer,
      indexerId: result.indexerId,
      size: result.size,
      publishDate: result.pubDate,
      downloadUrl: result.downloadUrl,
      infoUrl: result.infoUrl,
      grabs: result.grabs,
      seeders: result.seeders,
      peers: result.peers,
      protocol: 'usenet' as const,
      source: 'direct' as const,
      artist: result.artist,
      album: result.album,
      year: result.year,
      quality: this.detectQuality(result.title),
    }))
  }

  private mapProwlarrResults(results: ProwlarrSearchResult[]): UnifiedSearchResult[] {
    return results.map((result) => ({
      id: result.guid,
      title: result.title,
      indexer: result.indexer,
      indexerId: String(result.indexerId),
      size: result.size,
      publishDate: result.publishDate,
      downloadUrl: result.downloadUrl,
      infoUrl: result.infoUrl,
      grabs: result.grabs,
      seeders: result.seeders,
      peers: result.leechers,
      protocol: result.protocol,
      source: 'prowlarr' as const,
      artist: result.artist,
      album: result.album,
      year: result.year,
      quality: this.detectQuality(result.title),
    }))
  }

  private detectQuality(title: string): string | undefined {
    const lowerTitle = title.toLowerCase()

    if (lowerTitle.includes('flac') || lowerTitle.includes('lossless')) {
      if (
        lowerTitle.includes('24bit') ||
        lowerTitle.includes('24-bit') ||
        lowerTitle.includes('hi-res')
      ) {
        return 'FLAC 24bit'
      }
      return 'FLAC'
    }

    if (lowerTitle.includes('alac')) return 'ALAC'
    if (lowerTitle.includes('wav')) return 'WAV'
    if (lowerTitle.includes('320')) return 'MP3 320'
    if (lowerTitle.includes('v0')) return 'MP3 V0'
    if (lowerTitle.includes('256')) return 'MP3 256'
    if (lowerTitle.includes('192')) return 'MP3 192'
    if (lowerTitle.includes('aac')) return 'AAC'
    if (lowerTitle.includes('ogg')) return 'OGG Vorbis'
    if (lowerTitle.includes('mp3')) return 'MP3'

    return undefined
  }

  private detectVideoQuality(title: string): string | undefined {
    const lowerTitle = title.toLowerCase()

    if (lowerTitle.includes('2160p') || lowerTitle.includes('4k') || lowerTitle.includes('uhd'))
      return '2160p'
    if (lowerTitle.includes('1080p')) return '1080p'
    if (lowerTitle.includes('720p')) return '720p'
    if (lowerTitle.includes('480p') || lowerTitle.includes('sd')) return '480p'
    if (lowerTitle.includes('bluray') || lowerTitle.includes('blu-ray')) return 'BluRay'
    if (lowerTitle.includes('remux')) return 'Remux'
    if (lowerTitle.includes('web-dl') || lowerTitle.includes('webdl')) return 'WEB-DL'
    if (lowerTitle.includes('webrip')) return 'WEBRip'
    if (lowerTitle.includes('hdtv')) return 'HDTV'

    return undefined
  }

  /**
   * Search for movies across Prowlarr and direct indexers
   */
  async searchMovies(options: MovieSearchOptions): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = []

    // Movie categories: 2000 (Movies), 2010 (Foreign), 2020 (Other), 2030 (SD), 2040 (HD), 2045 (UHD), 2050 (BluRay), 2060 (3D)
    const movieCategories = [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060]

    // Try Prowlarr first if configured
    const prowlarrConfig = await ProwlarrConfig.query().where('syncEnabled', true).first()

    if (prowlarrConfig) {
      try {
        const prowlarrResults = await prowlarrService.searchMovies(
          {
            url: prowlarrConfig.baseUrl,
            apiKey: prowlarrConfig.apiKey,
          },
          {
            title: options.title,
            year: options.year,
            imdbId: options.imdbId,
            tmdbId: options.tmdbId,
            // Don't pass indexerIds to Prowlarr - our UUIDs don't match Prowlarr's numeric IDs
            limit: options.limit || 50,
          }
        )

        results.push(
          ...prowlarrResults.map((result) => ({
            id: result.guid,
            title: result.title,
            indexer: result.indexer,
            indexerId: String(result.indexerId),
            size: result.size,
            publishDate: result.publishDate,
            downloadUrl: result.downloadUrl,
            infoUrl: result.infoUrl,
            grabs: result.grabs,
            seeders: result.seeders,
            peers: result.leechers,
            protocol: result.protocol,
            source: 'prowlarr' as const,
            quality: this.detectVideoQuality(result.title),
          }))
        )
      } catch (error) {
        console.error('Prowlarr movie search failed:', error)
      }
    }

    // Also search direct indexers
    const directIndexers = await Indexer.query().where('enabled', true)

    const directSearches = directIndexers.map(async (indexer) => {
      try {
        const config: NewznabIndexerConfig = {
          id: indexer.id,
          name: indexer.name,
          url: indexer.settings.baseUrl || '',
          apiKey: indexer.settings.apiKey || '',
          categories: movieCategories,
          enabled: indexer.enabled,
        }

        // Build search query
        let query = options.title
        if (options.year) {
          query = `${query} ${options.year}`
        }

        const searchResults = await newznabService.search(config, query, {
          categories: movieCategories,
          limit: options.limit || 50,
        })

        return searchResults.map((result) => ({
          id: result.guid,
          title: result.title,
          indexer: result.indexer,
          indexerId: result.indexerId,
          size: result.size,
          publishDate: result.pubDate,
          downloadUrl: result.downloadUrl,
          infoUrl: result.infoUrl,
          grabs: result.grabs,
          seeders: result.seeders,
          peers: result.peers,
          protocol: 'usenet' as const,
          source: 'direct' as const,
          quality: this.detectVideoQuality(result.title),
        }))
      } catch (error) {
        console.error(`Movie search failed for indexer ${indexer.name}:`, error)
        return []
      }
    })

    const directResults = await Promise.all(directSearches)
    results.push(...directResults.flat())

    if (results.length === 0 && !prowlarrConfig && directIndexers.length === 0) {
      throw new Error(
        'No indexers configured. Please configure Prowlarr or add indexers in settings.'
      )
    }

    // Sort by size (larger = better quality usually)
    return results.sort((a, b) => b.size - a.size)
  }

  /**
   * Search for TV shows/episodes across Prowlarr and direct indexers
   */
  async searchTvShows(options: TvSearchOptions): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = []

    // TV categories: 5000 (TV), 5010 (WEB-DL), 5020 (Foreign), 5030 (SD), 5040 (HD), 5045 (UHD), 5050 (Other), 5060 (Sports), 5070 (Anime), 5080 (Documentary)
    const tvCategories = [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5060, 5070, 5080]

    // Try Prowlarr first if configured
    const prowlarrConfig = await ProwlarrConfig.query().where('syncEnabled', true).first()

    if (prowlarrConfig) {
      try {
        const prowlarrResults = await prowlarrService.searchTvShows(
          {
            url: prowlarrConfig.baseUrl,
            apiKey: prowlarrConfig.apiKey,
          },
          {
            title: options.title,
            season: options.season,
            episode: options.episode,
            tvdbId: options.tvdbId,
            imdbId: options.imdbId,
            // Don't pass indexerIds to Prowlarr - our UUIDs don't match Prowlarr's numeric IDs
            limit: options.limit || 50,
          }
        )

        results.push(
          ...prowlarrResults.map((result) => ({
            id: result.guid,
            title: result.title,
            indexer: result.indexer,
            indexerId: String(result.indexerId),
            size: result.size,
            publishDate: result.publishDate,
            downloadUrl: result.downloadUrl,
            infoUrl: result.infoUrl,
            grabs: result.grabs,
            seeders: result.seeders,
            peers: result.leechers,
            protocol: result.protocol,
            source: 'prowlarr' as const,
            quality: this.detectVideoQuality(result.title),
          }))
        )
      } catch (error) {
        console.error('Prowlarr TV search failed:', error)
      }
    }

    // Also search direct indexers
    const directIndexers = await Indexer.query().where('enabled', true)

    const directSearches = directIndexers.map(async (indexer) => {
      try {
        const config: NewznabIndexerConfig = {
          id: indexer.id,
          name: indexer.name,
          url: indexer.settings.baseUrl || '',
          apiKey: indexer.settings.apiKey || '',
          categories: tvCategories,
          enabled: indexer.enabled,
        }

        // Build search query
        let query = options.title
        if (options.season !== undefined) {
          query = `${query} S${String(options.season).padStart(2, '0')}`
          if (options.episode !== undefined) {
            query = `${query}E${String(options.episode).padStart(2, '0')}`
          }
        }

        const searchResults = await newznabService.search(config, query, {
          categories: tvCategories,
          limit: options.limit || 50,
        })

        return searchResults.map((result) => ({
          id: result.guid,
          title: result.title,
          indexer: result.indexer,
          indexerId: result.indexerId,
          size: result.size,
          publishDate: result.pubDate,
          downloadUrl: result.downloadUrl,
          infoUrl: result.infoUrl,
          grabs: result.grabs,
          seeders: result.seeders,
          peers: result.peers,
          protocol: 'usenet' as const,
          source: 'direct' as const,
          quality: this.detectVideoQuality(result.title),
        }))
      } catch (error) {
        console.error(`TV search failed for indexer ${indexer.name}:`, error)
        return []
      }
    })

    const directResults = await Promise.all(directSearches)
    results.push(...directResults.flat())

    if (results.length === 0 && !prowlarrConfig && directIndexers.length === 0) {
      throw new Error(
        'No indexers configured. Please configure Prowlarr or add indexers in settings.'
      )
    }

    // Sort by size (larger = better quality usually)
    return results.sort((a, b) => b.size - a.size)
  }

  /**
   * Search for books across Prowlarr and direct indexers
   */
  async searchBooks(options: BookSearchOptions): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = []

    // Book/Ebook categories: 7000 (Books), 7010 (Mags), 7020 (EBook), 7030 (Comics), 7040 (Technical), 7050 (Other), 8010 (Audiobook)
    const bookCategories = [7000, 7010, 7020, 7030, 7040, 7050, 8010]

    // Try Prowlarr first if configured
    const prowlarrConfig = await ProwlarrConfig.query().where('syncEnabled', true).first()

    if (prowlarrConfig) {
      try {
        const prowlarrResults = await prowlarrService.searchBooks(
          {
            url: prowlarrConfig.baseUrl,
            apiKey: prowlarrConfig.apiKey,
          },
          {
            title: options.title,
            author: options.author,
            // Don't pass indexerIds to Prowlarr - our UUIDs don't match Prowlarr's numeric IDs
            limit: options.limit || 50,
          }
        )

        results.push(
          ...prowlarrResults.map((result) => ({
            id: result.guid,
            title: result.title,
            indexer: result.indexer,
            indexerId: String(result.indexerId),
            size: result.size,
            publishDate: result.publishDate,
            downloadUrl: result.downloadUrl,
            infoUrl: result.infoUrl,
            grabs: result.grabs,
            seeders: result.seeders,
            peers: result.leechers,
            protocol: result.protocol,
            source: 'prowlarr' as const,
          }))
        )
      } catch (error) {
        console.error('Prowlarr book search failed:', error)
      }
    }

    // Also search direct indexers
    const directIndexers = await Indexer.query().where('enabled', true)

    const directSearches = directIndexers.map(async (indexer) => {
      try {
        const config: NewznabIndexerConfig = {
          id: indexer.id,
          name: indexer.name,
          url: indexer.settings.baseUrl || '',
          apiKey: indexer.settings.apiKey || '',
          categories: bookCategories,
          enabled: indexer.enabled,
        }

        // Build search query
        let query = options.title
        if (options.author) {
          query = `${options.author} ${query}`
        }

        const searchResults = await newznabService.search(config, query, {
          categories: bookCategories,
          limit: options.limit || 50,
        })

        return searchResults.map((result) => ({
          id: result.guid,
          title: result.title,
          indexer: result.indexer,
          indexerId: result.indexerId,
          size: result.size,
          publishDate: result.pubDate,
          downloadUrl: result.downloadUrl,
          infoUrl: result.infoUrl,
          grabs: result.grabs,
          seeders: result.seeders,
          peers: result.peers,
          protocol: 'usenet' as const,
          source: 'direct' as const,
        }))
      } catch (error) {
        console.error(`Book search failed for indexer ${indexer.name}:`, error)
        return []
      }
    })

    const directResults = await Promise.all(directSearches)
    results.push(...directResults.flat())

    if (results.length === 0 && !prowlarrConfig && directIndexers.length === 0) {
      throw new Error(
        'No indexers configured. Please configure Prowlarr or add indexers in settings.'
      )
    }

    // Sort by size (larger files first)
    return results.sort((a, b) => b.size - a.size)
  }
}

export const indexerManager = new IndexerManager()
