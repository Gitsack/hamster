const COVER_ART_ARCHIVE_API = 'https://coverartarchive.org'

export interface CoverArt {
  id: string
  types: string[]
  front: boolean
  back: boolean
  image: string
  thumbnails: {
    'small'?: string
    'large'?: string
    '250'?: string
    '500'?: string
    '1200'?: string
  }
}

export class CoverArtService {
  /**
   * Get cover art for a release group (album)
   */
  async getReleaseGroupCoverArt(releaseGroupMbid: string): Promise<CoverArt | null> {
    try {
      const response = await fetch(`${COVER_ART_ARCHIVE_API}/release-group/${releaseGroupMbid}`, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Cover Art Archive error: ${response.status}`)
      }

      const data = (await response.json()) as { images?: any[] }
      const frontImage = data.images?.find((img: any) => img.front === true)

      if (!frontImage) {
        return data.images?.[0] || null
      }

      return {
        id: frontImage.id,
        types: frontImage.types || [],
        front: frontImage.front,
        back: frontImage.back,
        image: frontImage.image,
        thumbnails: frontImage.thumbnails || {},
      }
    } catch (error) {
      console.error(`Failed to get cover art for release group ${releaseGroupMbid}:`, error)
      return null
    }
  }

  /**
   * Get cover art for a specific release
   */
  async getReleaseCoverArt(releaseMbid: string): Promise<CoverArt | null> {
    try {
      const response = await fetch(`${COVER_ART_ARCHIVE_API}/release/${releaseMbid}`, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Cover Art Archive error: ${response.status}`)
      }

      const data = (await response.json()) as { images?: any[] }
      const frontImage = data.images?.find((img: any) => img.front === true)

      if (!frontImage) {
        return data.images?.[0] || null
      }

      return {
        id: frontImage.id,
        types: frontImage.types || [],
        front: frontImage.front,
        back: frontImage.back,
        image: frontImage.image,
        thumbnails: frontImage.thumbnails || {},
      }
    } catch (error) {
      console.error(`Failed to get cover art for release ${releaseMbid}:`, error)
      return null
    }
  }

  /**
   * Get the front cover URL for a release group
   */
  getFrontCoverUrl(releaseGroupMbid: string, size: '250' | '500' | '1200' = '500'): string {
    return `${COVER_ART_ARCHIVE_API}/release-group/${releaseGroupMbid}/front-${size}`
  }

  /**
   * Check if cover art exists for a release group and return URL if it does
   */
  async getVerifiedCoverUrl(
    releaseGroupMbid: string,
    size: '250' | '500' | '1200' = '500'
  ): Promise<string | null> {
    try {
      const url = this.getFrontCoverUrl(releaseGroupMbid, size)
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok || response.status === 307) {
        // 307 is a redirect to the actual image, which means it exists
        return url
      }
      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Get the front cover URL for a release
   */
  getReleaseFrontCoverUrl(releaseMbid: string, size: '250' | '500' | '1200' = '500'): string {
    return `${COVER_ART_ARCHIVE_API}/release/${releaseMbid}/front-${size}`
  }
}

export const coverArtService = new CoverArtService()
