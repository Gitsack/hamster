export interface MediaServerConfig {
  type: 'plex' | 'emby' | 'jellyfin'
  host: string
  port: number
  apiKey: string
  useSsl?: boolean
  librarySections?: string[]
}

/**
 * Media server library refresh service.
 * Supports Plex, Emby, and Jellyfin.
 */
export class MediaServerService {
  private readonly DEFAULT_TIMEOUT = 10000

  private buildBaseUrl(config: MediaServerConfig): string {
    const protocol = config.useSsl ? 'https' : 'http'
    return `${protocol}://${config.host}:${config.port}`
  }

  /**
   * Trigger a library refresh on the configured media server
   */
  async triggerRefresh(config: MediaServerConfig): Promise<void> {
    switch (config.type) {
      case 'plex':
        return this.refreshPlex(config)
      case 'emby':
        return this.refreshEmby(config)
      case 'jellyfin':
        return this.refreshJellyfin(config)
      default:
        throw new Error(`Unsupported media server type: ${config.type}`)
    }
  }

  /**
   * Test connection to a media server
   */
  async testConnection(
    config: MediaServerConfig
  ): Promise<{ success: boolean; name?: string; error?: string }> {
    try {
      switch (config.type) {
        case 'plex':
          return await this.testPlex(config)
        case 'emby':
          return await this.testEmby(config)
        case 'jellyfin':
          return await this.testJellyfin(config)
        default:
          return { success: false, error: `Unsupported type: ${config.type}` }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  // ── Plex ──

  private async refreshPlex(config: MediaServerConfig): Promise<void> {
    const baseUrl = this.buildBaseUrl(config)

    if (config.librarySections && config.librarySections.length > 0) {
      // Refresh specific sections
      for (const sectionId of config.librarySections) {
        const url = `${baseUrl}/library/sections/${sectionId}/refresh?X-Plex-Token=${config.apiKey}`
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
        })
        if (!response.ok) {
          throw new Error(`Plex refresh failed for section ${sectionId}: HTTP ${response.status}`)
        }
      }
    } else {
      // Refresh all sections
      const url = `${baseUrl}/library/sections?X-Plex-Token=${config.apiKey}`
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      })
      if (!response.ok) {
        throw new Error(`Plex sections request failed: HTTP ${response.status}`)
      }

      // Plex returns XML by default, ask for JSON
      const sectionsUrl = `${baseUrl}/library/sections?X-Plex-Token=${config.apiKey}`
      const sectionsResponse = await fetch(sectionsUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      })

      if (sectionsResponse.ok) {
        const data = (await sectionsResponse.json()) as {
          MediaContainer?: { Directory?: Array<{ key: string }> }
        }
        const sections = data?.MediaContainer?.Directory || []
        for (const section of sections) {
          const refreshUrl = `${baseUrl}/library/sections/${section.key}/refresh?X-Plex-Token=${config.apiKey}`
          await fetch(refreshUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
          }).catch(() => {})
        }
      }
    }
  }

  private async testPlex(
    config: MediaServerConfig
  ): Promise<{ success: boolean; name?: string; error?: string }> {
    const baseUrl = this.buildBaseUrl(config)
    const url = `${baseUrl}/identity?X-Plex-Token=${config.apiKey}`

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = (await response.json()) as {
      MediaContainer?: { friendlyName?: string }
    }

    return {
      success: true,
      name: data?.MediaContainer?.friendlyName || 'Plex',
    }
  }

  // ── Emby ──

  private async refreshEmby(config: MediaServerConfig): Promise<void> {
    const baseUrl = this.buildBaseUrl(config)
    const url = `${baseUrl}/Library/Refresh?api_key=${config.apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      throw new Error(`Emby library refresh failed: HTTP ${response.status}`)
    }
  }

  private async testEmby(
    config: MediaServerConfig
  ): Promise<{ success: boolean; name?: string; error?: string }> {
    const baseUrl = this.buildBaseUrl(config)
    const url = `${baseUrl}/System/Info?api_key=${config.apiKey}`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = (await response.json()) as { ServerName?: string }

    return {
      success: true,
      name: data?.ServerName || 'Emby',
    }
  }

  // ── Jellyfin ──

  private async refreshJellyfin(config: MediaServerConfig): Promise<void> {
    const baseUrl = this.buildBaseUrl(config)
    const url = `${baseUrl}/Library/Refresh?api_key=${config.apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      throw new Error(`Jellyfin library refresh failed: HTTP ${response.status}`)
    }
  }

  private async testJellyfin(
    config: MediaServerConfig
  ): Promise<{ success: boolean; name?: string; error?: string }> {
    const baseUrl = this.buildBaseUrl(config)
    const url = `${baseUrl}/System/Info?api_key=${config.apiKey}`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = (await response.json()) as { ServerName?: string }

    return {
      success: true,
      name: data?.ServerName || 'Jellyfin',
    }
  }
}

export const mediaServerService = new MediaServerService()
