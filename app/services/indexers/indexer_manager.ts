import Indexer from '#models/indexer'
import ProwlarrConfig from '#models/prowlarr_config'
import { newznabService, type NewznabSearchResult, type NewznabIndexerConfig } from './newznab_service.js'
import { prowlarrService, type ProwlarrSearchResult } from './prowlarr_service.js'

export interface UnifiedSearchResult {
  id: string
  title: string
  indexer: string
  indexerId: number
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
  year?: number
  indexerIds?: number[]
  useProwlarr?: boolean
  limit?: number
  // If true, use general search without music-specific filters
  generalSearch?: boolean
  // If true, skip deduplication
  skipDedup?: boolean
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
        const query = [options.artist, options.album, options.query]
          .filter(Boolean)
          .join(' ')

        if (options.generalSearch) {
          // General search without music-specific filters (like Prowlarr)
          searchResults = await newznabService.search(config, query, {
            limit: options.limit,
            categories: [], // No category filter
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
  async testIndexer(url: string, apiKey: string): Promise<{ success: boolean; error?: string; categories?: number[] }> {
    try {
      const capabilities = await newznabService.getCapabilities(url, apiKey)

      // Get music category IDs
      const musicCategories = capabilities.categories
        .filter((cat) => cat.id >= 3000 && cat.id < 4000)
        .flatMap((cat) => [cat.id, ...(cat.subCategories?.map((sub) => sub.id) || [])])

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
      indexerId: result.indexerId,
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
      if (lowerTitle.includes('24bit') || lowerTitle.includes('24-bit') || lowerTitle.includes('hi-res')) {
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
}

export const indexerManager = new IndexerManager()
