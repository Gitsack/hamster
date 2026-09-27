import AppSetting from '#models/app_setting'
import { simklGet } from '#services/simkl/simkl_client'
import { simklAccount } from '#services/simkl/simkl_account'

const LIBRARY_KEY = 'simklLibrary'
/** Never check Simkl more often than this, however often the deck rebuilds. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000

export type SimklStatus = 'watching' | 'plantowatch' | 'hold' | 'dropped' | 'completed'

export interface SimklItem {
  kind: 'movie' | 'tv'
  simklId: number
  tmdbId: number | null
  title: string
  year: number | null
  status: SimklStatus
  /** The user's own 1–10 score. */
  rating: number | null
}

interface Snapshot {
  checkedAt: number
  activities: Activities | null
  items: Record<string, SimklItem>
}

interface Activities {
  all?: string
  movies?: Record<string, string>
  tv_shows?: Record<string, string>
}

interface AllItemsEntry {
  status: SimklStatus
  user_rating: number | null
  movie?: { title: string; year?: number; ids: { simkl?: number; tmdb?: string } }
  show?: { title: string; year?: number; ids: { simkl?: number; tmdb?: string } }
}

interface AllItemsResponse {
  movies?: AllItemsEntry[]
  shows?: AllItemsEntry[]
}

function toItem(kind: 'movie' | 'tv', entry: AllItemsEntry): SimklItem | null {
  const media = kind === 'movie' ? entry.movie : entry.show
  if (!media?.ids.simkl) return null
  const tmdb = Number(media.ids.tmdb)
  return {
    kind,
    simklId: media.ids.simkl,
    tmdbId: Number.isFinite(tmdb) && tmdb > 0 ? tmdb : null,
    title: media.title,
    year: media.year ?? null,
    status: entry.status,
    rating: entry.user_rating ?? null,
  }
}

/**
 * A local copy of the connected user's Simkl movies and shows, kept in step
 * the way Simkl asks integrations to: check the tiny /sync/activities first
 * and only fetch when something moved — a delta when items were added or
 * changed status, the whole list when something was removed or re-rated
 * (a date_from delta cannot express either).
 */
class SimklLibrary {
  private syncing: Promise<SimklItem[]> | null = null

  async items(): Promise<SimklItem[]> {
    this.syncing ??= this.sync().finally(() => {
      this.syncing = null
    })
    return this.syncing
  }

  private async sync(): Promise<SimklItem[]> {
    const token = await simklAccount.getAccessToken()
    if (!token) return []

    const snapshot = await AppSetting.get<Snapshot | null>(LIBRARY_KEY, null)
    if (snapshot && Date.now() - snapshot.checkedAt < CHECK_INTERVAL_MS) {
      return Object.values(snapshot.items)
    }

    const activities = await simklGet<Activities>('/sync/activities', {}, token)
    const previous = snapshot?.activities

    let items: Record<string, SimklItem>
    if (snapshot && previous?.all && previous.all === activities.all) {
      items = snapshot.items
    } else if (snapshot && previous?.all && !this.needsFullPull(previous, activities)) {
      const delta = await simklGet<AllItemsResponse>(
        '/sync/all-items',
        { date_from: previous.all },
        token
      )
      items = { ...snapshot.items, ...this.index(delta) }
    } else {
      items = this.index(await simklGet<AllItemsResponse>('/sync/all-items', {}, token))
    }

    await AppSetting.set(LIBRARY_KEY, { checkedAt: Date.now(), activities, items })
    return Object.values(items)
  }

  private needsFullPull(before: Activities, now: Activities): boolean {
    for (const group of ['movies', 'tv_shows'] as const) {
      for (const field of ['removed_from_list', 'rated_at']) {
        if (before[group]?.[field] !== now[group]?.[field]) return true
      }
    }
    return false
  }

  private index(response: AllItemsResponse): Record<string, SimklItem> {
    const out: Record<string, SimklItem> = {}
    for (const entry of response.movies ?? []) {
      const item = toItem('movie', entry)
      if (item) out[`movie:${item.simklId}`] = item
    }
    for (const entry of response.shows ?? []) {
      const item = toItem('tv', entry)
      if (item) out[`tv:${item.simklId}`] = item
    }
    return out
  }
}

export const simklLibrary = new SimklLibrary()
