import MediaServerConfig from '#models/media_server_config'
import { mapHost } from '#utils/host_mapping'
import type { TasteProvider, TasteSnapshot } from '#services/taste/types'

interface JellyfinUser {
  Id: string
  Name: string
  Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean }
}

interface JellyfinItem {
  Name: string
  Type: 'Movie' | 'Series'
  ProviderIds?: Record<string, string>
  UserData?: {
    Played?: boolean
    PlayCount?: number
    IsFavorite?: boolean
    PlayedPercentage?: number
  }
}

/**
 * What the household actually watches on Jellyfin or Emby — both speak the
 * same API. Favourites and rewatches weigh most; titles only started weigh
 * least. Only administrator accounts are read, so a guest profile does not
 * steer the operator's deck.
 */
export const mediaServerTasteProvider: TasteProvider = {
  id: 'media-server',
  label: 'Jellyfin / Emby',

  async collect(): Promise<TasteSnapshot | null> {
    const servers = await MediaServerConfig.query()
      .where('enabled', true)
      .whereIn('type', ['jellyfin', 'emby'])
    if (servers.length === 0) return null

    const snapshot: TasteSnapshot = { seeds: [], seen: [], picks: [] }
    const best = new Map<string, { weight: number; reason: string; title: string }>()

    for (const server of servers) {
      const base = `${server.useSsl ? 'https' : 'http'}://${mapHost(server.host)}:${server.port}`
      const get = async <T>(path: string): Promise<T> => {
        const res = await fetch(
          `${base}${path}${path.includes('?') ? '&' : '?'}api_key=${server.apiKey}`,
          {
            signal: AbortSignal.timeout(15_000),
          }
        )
        if (!res.ok) throw new Error(`${server.name}: HTTP ${res.status}`)
        return (await res.json()) as T
      }

      const allUsers = await get<JellyfinUser[]>('/Users')
      const users = allUsers.filter((u) => u.Policy?.IsAdministrator && !u.Policy?.IsDisabled)
      const serverName = server.type === 'emby' ? 'Emby' : 'Jellyfin'

      for (const user of users) {
        const { Items: items = [] } = await get<{ Items?: JellyfinItem[] }>(
          `/Users/${user.Id}/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds&EnableUserData=true`
        )
        for (const item of items) {
          const tmdbId = Number(item.ProviderIds?.Tmdb ?? item.ProviderIds?.tmdb)
          if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue
          const kind = item.Type === 'Movie' ? 'movie' : 'tv'
          const data = item.UserData ?? {}
          const watched = data.Played || (data.PlayedPercentage ?? 0) > 0

          let weight = 0
          let reason = ''
          if (data.IsFavorite) {
            weight = 1
            reason = `Because ${item.Name} is a favourite on ${serverName}`
          } else if ((data.PlayCount ?? 0) >= 2) {
            weight = 0.8
            reason = `Because you rewatched ${item.Name}`
          } else if (data.Played) {
            weight = 0.5
            reason = `Because you watched ${item.Name}`
          } else if (watched) {
            weight = 0.35
            reason = `Because you started ${item.Name}`
          }
          if (weight === 0) continue

          const key = `${kind}:${tmdbId}`
          const prev = best.get(key)
          if (!prev || prev.weight < weight) best.set(key, { weight, reason, title: item.Name })
        }
      }
    }

    for (const [key, { weight, reason, title }] of best) {
      const [kind, id] = key.split(':') as ['movie' | 'tv', string]
      const tmdbId = Number(id)
      snapshot.seen.push({ kind, tmdbId })
      snapshot.seeds.push({ kind, tmdbId, title, weight, reason })
    }
    return snapshot
  },

  describe(snapshot, error) {
    if (error)
      return `The media server did not answer (${String((error as Error).message ?? error)}).`
    if (!snapshot) return null
    return `${snapshot.seeds.length} watched on your media server`
  },
}
