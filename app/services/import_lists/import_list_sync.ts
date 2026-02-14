import ImportList from '#models/import_list'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import AppSetting from '#models/app_setting'
import { DateTime } from 'luxon'
import { traktListProvider, type ImportListItem } from './trakt_list_provider.js'
import { imdbListProvider } from './imdb_list_provider.js'

interface SyncResult {
  listId: string
  listName: string
  itemsFound: number
  itemsAdded: number
  itemsExisting: number
  errors: string[]
}

export class ImportListSyncService {
  /**
   * Sync a single import list
   */
  async syncList(list: ImportList): Promise<SyncResult> {
    const result: SyncResult = {
      listId: list.id,
      listName: list.name,
      itemsFound: 0,
      itemsAdded: 0,
      itemsExisting: 0,
      errors: [],
    }

    try {
      // Initialize Trakt client ID if needed
      if (list.type === 'trakt_watchlist' || list.type === 'trakt_list') {
        const traktClientId = await AppSetting.get<string>('traktClientId', '')
        if (!traktClientId) {
          result.errors.push('Trakt client ID not configured')
          return result
        }
        traktListProvider.setClientId(traktClientId)
      }

      // Fetch items from the list provider
      const items = await this.fetchItems(list)
      result.itemsFound = items.length

      if (!list.autoAdd) {
        // Just report what was found, don't add anything
        return result
      }

      // Process each item
      for (const item of items) {
        try {
          const added = await this.processItem(item, list)
          if (added) {
            result.itemsAdded++
          } else {
            result.itemsExisting++
          }
        } catch (error) {
          result.errors.push(
            `Failed to process "${item.title}": ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      // Update last synced timestamp
      list.lastSyncedAt = DateTime.now()
      await list.save()
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error during sync')
    }

    return result
  }

  /**
   * Sync all enabled import lists
   */
  async syncAll(): Promise<SyncResult[]> {
    const lists = await ImportList.query().where('enabled', true)
    const results: SyncResult[] = []

    for (const list of lists) {
      const result = await this.syncList(list)
      results.push(result)
    }

    return results
  }

  /**
   * Fetch items from the configured list provider
   */
  private async fetchItems(list: ImportList): Promise<ImportListItem[]> {
    const mediaType = list.mediaType === 'movies' ? 'movies' : 'tv'

    switch (list.type) {
      case 'trakt_watchlist':
        return traktListProvider.fetchWatchlist(list.settings, mediaType)

      case 'trakt_list':
        return traktListProvider.fetchList(list.settings, mediaType)

      case 'imdb_list':
        return imdbListProvider.fetchList(list.settings)

      default:
        throw new Error(`Unknown list type: ${list.type}`)
    }
  }

  /**
   * Process a single import list item - check if it exists and add if not
   * Returns true if the item was added, false if it already existed
   */
  private async processItem(item: ImportListItem, list: ImportList): Promise<boolean> {
    if (item.mediaType === 'movie' && list.mediaType === 'movies') {
      return this.processMovie(item, list)
    } else if (item.mediaType === 'show' && list.mediaType === 'tv') {
      return this.processTvShow(item, list)
    }

    return false
  }

  private async processMovie(item: ImportListItem, list: ImportList): Promise<boolean> {
    // Check if movie already exists by TMDB ID or IMDb ID
    if (item.tmdbId) {
      const existing = await Movie.query().where('tmdbId', String(item.tmdbId)).first()
      if (existing) return false
    }

    if (item.imdbId) {
      const existing = await Movie.query().where('imdbId', item.imdbId).first()
      if (existing) return false
    }

    // Check by title + year as fallback
    const titleQuery = Movie.query().whereILike('title', item.title)
    if (item.year) {
      titleQuery.where('year', item.year)
    }
    const existingByTitle = await titleQuery.first()
    if (existingByTitle) return false

    // Create the movie
    await Movie.create({
      tmdbId: item.tmdbId ? String(item.tmdbId) : null,
      imdbId: item.imdbId,
      title: item.title,
      sortTitle: item.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
      year: item.year,
      requested: true,
      hasFile: false,
      needsReview: false,
      genres: [],
      qualityProfileId: list.qualityProfileId,
      rootFolderId: list.rootFolderId,
      addedAt: DateTime.now(),
    })

    return true
  }

  private async processTvShow(item: ImportListItem, list: ImportList): Promise<boolean> {
    // Check if show already exists by TMDB ID or IMDb ID
    if (item.tmdbId) {
      const existing = await TvShow.query().where('tmdbId', String(item.tmdbId)).first()
      if (existing) return false
    }

    if (item.imdbId) {
      const existing = await TvShow.query().where('imdbId', item.imdbId).first()
      if (existing) return false
    }

    // Check by title + year as fallback
    const titleQuery = TvShow.query().whereILike('title', item.title)
    if (item.year) {
      titleQuery.where('year', item.year)
    }
    const existingByTitle = await titleQuery.first()
    if (existingByTitle) return false

    // Create the TV show
    await TvShow.create({
      tmdbId: item.tmdbId ? String(item.tmdbId) : null,
      imdbId: item.imdbId,
      title: item.title,
      sortTitle: item.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
      year: item.year,
      requested: true,
      needsReview: false,
      genres: [],
      seasonCount: 0,
      episodeCount: 0,
      qualityProfileId: list.qualityProfileId,
      rootFolderId: list.rootFolderId,
      addedAt: DateTime.now(),
    })

    return true
  }
}

export const importListSyncService = new ImportListSyncService()
