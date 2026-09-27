import PQueue from 'p-queue'
import app from '@adonisjs/core/services/app'
import { cache } from '#services/cache/cache_service'

/**
 * ListenBrainz — MetaBrainz's open listening data, no account or key needed.
 * Used for "listeners of this artist also play…" similarity, an artist's most
 * played albums, and artist genres. Everything is cached for a day: the data
 * moves slowly and the deck is rebuilt often.
 */

const LABS = 'https://labs.api.listenbrainz.org'
const API = 'https://api.listenbrainz.org/1'
/** Long listening history: established similarity, not this week's trend. */
const SIMILARITY_ALGORITHM =
  'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30'
const DAY = 24 * 60 * 60 * 1000

const queue = new PQueue({ concurrency: 2, interval: 250, intervalCap: 2 })

async function get<T>(url: string, retried = false): Promise<T> {
  const res = await queue.add(() =>
    fetch(url, {
      headers: { 'User-Agent': `hamster/${app.version?.toString() ?? '0.0.0'}` },
      signal: AbortSignal.timeout(20_000),
    })
  )
  // Rate limited: wait as long as ListenBrainz asks (within reason), once.
  if (res.status === 429 && !retried) {
    const wait = Number(res.headers.get('X-RateLimit-Reset-In') ?? res.headers.get('Retry-After'))
    await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(wait) ? wait : 2, 10) * 1000))
    return get<T>(url, true)
  }
  if (!res.ok) throw new Error(`ListenBrainz ${res.status}: ${url}`)
  return (await res.json()) as T
}

export interface SimilarArtist {
  mbid: string
  name: string
  score: number
}

export interface TopAlbum {
  releaseGroupMbid: string
  name: string
  date: string | null
  type: string | null
  listens: number
  coverReleaseMbid: string | null
}

export interface ArtistGenre {
  genre: string
  count: number
}

export const listenBrainz = {
  similarArtists(artistMbid: string): Promise<SimilarArtist[]> {
    return cache.getOrSet(`lb:similar:${artistMbid}`, DAY, async () => {
      const rows = await get<{ artist_mbid: string; name: string; score: number }[]>(
        `${LABS}/similar-artists/json?artist_mbids=${artistMbid}&algorithm=${SIMILARITY_ALGORITHM}`
      )
      return rows.map((r) => ({ mbid: r.artist_mbid, name: r.name, score: r.score }))
    })
  },

  topAlbums(artistMbid: string): Promise<TopAlbum[]> {
    return cache.getOrSet(`lb:top-rg:${artistMbid}`, DAY, async () => {
      const rows = await get<
        {
          release_group_mbid: string
          release_group?: { name?: string; date?: string; type?: string }
          release?: { caa_release_mbid?: string }
          total_listen_count?: number
        }[]
      >(`${API}/popularity/top-release-groups-for-artist/${artistMbid}`)
      return rows.map((r) => ({
        releaseGroupMbid: r.release_group_mbid,
        name: r.release_group?.name ?? '',
        date: r.release_group?.date || null,
        type: r.release_group?.type ?? null,
        listens: r.total_listen_count ?? 0,
        coverReleaseMbid: r.release?.caa_release_mbid ?? null,
      }))
    })
  },

  /**
   * Genres of many artists, in chunks of 25 per request. Only real genres
   * (tags MusicBrainz maps to a genre) count, not free-form tags.
   */
  async artistGenres(artistMbids: string[]): Promise<Map<string, ArtistGenre[]>> {
    const out = new Map<string, ArtistGenre[]>()
    const unique = [...new Set(artistMbids)]
    for (let i = 0; i < unique.length; i += 25) {
      const chunk = unique.slice(i, i + 25)
      // One failed chunk costs only its own artists' genres.
      const rows = await cache
        .getOrSet(`lb:genres:${chunk.join(',')}`, DAY, () =>
          get<
            {
              artist_mbid: string
              tag?: { artist?: { tag: string; count: number; genre_mbid?: string }[] }
            }[]
          >(`${API}/metadata/artist/?artist_mbids=${chunk.join(',')}&inc=tag`)
        )
        .catch(() => [])
      for (const row of rows) {
        const genres = (row.tag?.artist ?? [])
          .filter((t) => t.genre_mbid)
          .map((t) => ({ genre: t.tag, count: t.count }))
          .sort((a, b) => b.count - a.count)
        out.set(row.artist_mbid, genres)
      }
    }
    return out
  },
}

export function coverUrl(releaseMbid: string | null): string | null {
  return releaseMbid ? `https://coverartarchive.org/release/${releaseMbid}/front-500` : null
}
