import { simklAccount } from '#services/simkl/simkl_account'
import { simklLibrary } from '#services/simkl/simkl_library'
import type { ImportListItem } from './types.js'

/**
 * The connected Simkl account's plan-to-watch list. Read from the same local
 * snapshot the For you deck uses, so a sync costs Simkl at most one activity
 * check.
 */
export class SimklWatchlistProvider {
  async fetchWatchlist(mediaType: 'movies' | 'tv'): Promise<ImportListItem[]> {
    const { account } = await simklAccount.status()
    if (!account) {
      throw new Error('Connect a Simkl account in Settings → Media Management first.')
    }
    const kind = mediaType === 'movies' ? 'movie' : 'tv'
    const items = await simklLibrary.items()
    return items
      .filter((i) => i.kind === kind && i.status === 'plantowatch')
      .map((i) => ({
        title: i.title,
        year: i.year,
        imdbId: null,
        tmdbId: i.tmdbId,
        mediaType: kind === 'movie' ? 'movie' : 'show',
      }))
  }
}

export const simklWatchlistProvider = new SimklWatchlistProvider()
