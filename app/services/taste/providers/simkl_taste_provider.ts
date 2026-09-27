import { simklAccount } from '#services/simkl/simkl_account'
import { simklLibrary } from '#services/simkl/simkl_library'
import type { TasteProvider, TasteSnapshot } from '#services/taste/types'

/**
 * The connected Simkl account: ratings seed the deck, the plan-to-watch list
 * is suggested directly, and anything watched or dropped is never suggested.
 */
export const simklTasteProvider: TasteProvider = {
  id: 'simkl',
  label: 'Simkl',

  async collect(): Promise<TasteSnapshot | null> {
    const { account } = await simklAccount.status()
    if (!account) return null
    const items = await simklLibrary.items()

    const snapshot: TasteSnapshot = { seeds: [], seen: [], picks: [] }
    for (const item of items) {
      if (!item.tmdbId) continue
      const ref = { kind: item.kind, tmdbId: item.tmdbId }

      if (item.status === 'plantowatch') {
        snapshot.picks.push({ ...ref, weight: 0.9, reason: 'On your Simkl watchlist' })
        continue
      }
      snapshot.seen.push(ref)
      if (item.status === 'dropped') continue

      // 10 → 1, 8 → 0.56, 7 → 0.33; unrated but watched counts a little.
      if (item.rating !== null) {
        const weight = (item.rating - 5.5) / 4.5
        if (weight >= 0.3) {
          snapshot.seeds.push({
            ...ref,
            title: item.title,
            weight,
            reason: `Because you rated ${item.title} ${item.rating}/10 on Simkl`,
          })
        }
      } else if (item.status === 'completed' || item.status === 'watching') {
        snapshot.seeds.push({
          ...ref,
          title: item.title,
          weight: 0.3,
          reason: `Because you watched ${item.title}`,
        })
      }
    }
    return snapshot
  },

  describe(snapshot, error) {
    if (error) return 'Simkl did not answer; it is skipped this time.'
    if (!snapshot) return null
    const rated = snapshot.seeds.filter((s) => s.reason.includes('/10')).length
    const parts = [`${rated} Simkl ratings`]
    if (snapshot.picks.length) parts.push(`${snapshot.picks.length} on your watchlist`)
    return parts.join(', ')
  },
}
