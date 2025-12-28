import PQueue from 'p-queue'

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'MediaBox/1.0.0 (https://github.com/mediabox)'

// MusicBrainz rate limit: 1 request per second for unauthenticated users
const queue = new PQueue({ interval: 1100, intervalCap: 1 })

export interface MusicBrainzArtist {
  id: string
  name: string
  sortName: string
  disambiguation?: string
  type?: string
  country?: string
  beginDate?: string
  endDate?: string
  tags?: string[]
}

export interface MusicBrainzAlbum {
  id: string
  title: string
  artistId: string
  artistName: string
  releaseDate?: string
  primaryType?: string
  secondaryTypes?: string[]
  status?: string
  country?: string
  trackCount?: number
}

export interface MusicBrainzTrack {
  id: string
  title: string
  position: number
  length?: number
  artistId?: string
  artistName?: string
}

export interface MusicBrainzRelease {
  id: string
  title: string
  status?: string
  country?: string
  date?: string
  format?: string
  trackCount: number
  media: Array<{
    format?: string
    trackCount: number
    tracks: MusicBrainzTrack[]
  }>
}

async function fetchWithRateLimit(url: string): Promise<Response> {
  return queue.add(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`)
    }

    return response
  }) as Promise<Response>
}

export class MusicBrainzService {
  /**
   * Search for artists by name
   */
  async searchArtists(query: string, limit = 25): Promise<MusicBrainzArtist[]> {
    const url = `${MUSICBRAINZ_API}/artist/?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`
    const response = await fetchWithRateLimit(url)
    const data = (await response.json()) as { artists?: any[] }

    return (data.artists || []).map((artist: any) => ({
      id: artist.id,
      name: artist.name,
      sortName: artist['sort-name'],
      disambiguation: artist.disambiguation,
      type: artist.type,
      country: artist.country,
      beginDate: artist['life-span']?.begin,
      endDate: artist['life-span']?.end,
      tags: artist.tags?.map((t: any) => t.name) || [],
    }))
  }

  /**
   * Get artist details by MusicBrainz ID
   */
  async getArtist(mbid: string): Promise<MusicBrainzArtist | null> {
    const url = `${MUSICBRAINZ_API}/artist/${mbid}?inc=tags&fmt=json`

    try {
      const response = await fetchWithRateLimit(url)
      const artist = (await response.json()) as any

      return {
        id: artist.id,
        name: artist.name,
        sortName: artist['sort-name'],
        disambiguation: artist.disambiguation,
        type: artist.type,
        country: artist.country,
        beginDate: artist['life-span']?.begin,
        endDate: artist['life-span']?.end,
        tags: artist.tags?.map((t: any) => t.name) || [],
      }
    } catch (error) {
      console.error(`Failed to get artist ${mbid}:`, error)
      return null
    }
  }

  /**
   * Get all release groups (albums) for an artist
   */
  async getArtistAlbums(artistMbid: string): Promise<MusicBrainzAlbum[]> {
    const albums: MusicBrainzAlbum[] = []
    let offset = 0
    const limit = 100

    while (true) {
      const url = `${MUSICBRAINZ_API}/release-group?artist=${artistMbid}&limit=${limit}&offset=${offset}&fmt=json`
      const response = await fetchWithRateLimit(url)
      const data = (await response.json()) as { 'release-groups'?: any[] }

      const releaseGroups = data['release-groups'] || []
      if (releaseGroups.length === 0) break

      for (const rg of releaseGroups) {
        albums.push({
          id: rg.id,
          title: rg.title,
          artistId: artistMbid,
          artistName: rg['artist-credit']?.[0]?.name || '',
          releaseDate: rg['first-release-date'],
          primaryType: rg['primary-type'],
          secondaryTypes: rg['secondary-types'] || [],
          status: undefined,
          country: undefined,
        })
      }

      if (releaseGroups.length < limit) break
      offset += limit
    }

    return albums
  }

  /**
   * Get releases for a release group (album)
   */
  async getAlbumReleases(releaseGroupMbid: string): Promise<MusicBrainzRelease[]> {
    const url = `${MUSICBRAINZ_API}/release?release-group=${releaseGroupMbid}&inc=recordings+media&fmt=json`
    const response = await fetchWithRateLimit(url)
    const data = (await response.json()) as { releases?: any[] }

    return (data.releases || []).map((release: any) => ({
      id: release.id,
      title: release.title,
      status: release.status,
      country: release.country,
      date: release.date,
      format: release.media?.[0]?.format,
      trackCount: release.media?.reduce((sum: number, m: any) => sum + (m['track-count'] || 0), 0) || 0,
      media: (release.media || []).map((medium: any) => ({
        format: medium.format,
        trackCount: medium['track-count'] || 0,
        tracks: (medium.tracks || []).map((track: any) => ({
          id: track.id,
          title: track.title,
          position: track.position,
          length: track.length,
          artistId: track['artist-credit']?.[0]?.artist?.id,
          artistName: track['artist-credit']?.[0]?.name,
        })),
      })),
    }))
  }

  /**
   * Search for albums by name
   */
  async searchAlbums(query: string, artistName?: string, limit = 25): Promise<MusicBrainzAlbum[]> {
    let searchQuery = query
    if (artistName) {
      searchQuery = `${query} AND artist:${artistName}`
    }

    const url = `${MUSICBRAINZ_API}/release-group/?query=${encodeURIComponent(searchQuery)}&limit=${limit}&fmt=json`
    const response = await fetchWithRateLimit(url)
    const data = (await response.json()) as { 'release-groups'?: any[] }

    return (data['release-groups'] || []).map((rg: any) => ({
      id: rg.id,
      title: rg.title,
      artistId: rg['artist-credit']?.[0]?.artist?.id || '',
      artistName: rg['artist-credit']?.[0]?.name || '',
      releaseDate: rg['first-release-date'],
      primaryType: rg['primary-type'],
      secondaryTypes: rg['secondary-types'] || [],
    }))
  }

  /**
   * Search for tracks (recordings) by name
   */
  async searchTracks(
    query: string,
    artistName?: string,
    limit = 25
  ): Promise<
    Array<{
      id: string
      title: string
      artistId: string
      artistName: string
      albumTitle?: string
      albumId?: string
      duration?: number
    }>
  > {
    let searchQuery = query
    if (artistName) {
      searchQuery = `${query} AND artist:${artistName}`
    }

    const url = `${MUSICBRAINZ_API}/recording/?query=${encodeURIComponent(searchQuery)}&limit=${limit}&fmt=json`
    const response = await fetchWithRateLimit(url)
    const data = (await response.json()) as { recordings?: any[] }

    return (data.recordings || []).map((recording: any) => ({
      id: recording.id,
      title: recording.title,
      artistId: recording['artist-credit']?.[0]?.artist?.id || '',
      artistName: recording['artist-credit']?.[0]?.name || '',
      albumTitle: recording.releases?.[0]?.title,
      albumId: recording.releases?.[0]?.['release-group']?.id,
      duration: recording.length,
    }))
  }
}

export const musicBrainzService = new MusicBrainzService()
