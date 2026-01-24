export interface QBittorrentConfig {
  host: string
  port: number
  username?: string
  password?: string
  useSsl?: boolean
  category?: string
}

export interface QBittorrentTorrent {
  hash: string
  name: string
  size: number
  progress: number
  dlspeed: number
  upspeed: number
  priority: number
  num_seeds: number
  num_leechs: number
  state: string
  eta: number
  category: string
  added_on: number
  completion_on: number
  save_path: string
  content_path: string
}

export interface QBittorrentMaindata {
  rid: number
  server_state: {
    dl_info_speed: number
    dl_info_data: number
    up_info_speed: number
    up_info_data: number
    dl_rate_limit: number
    up_rate_limit: number
    dht_nodes: number
    connection_status: string
    free_space_on_disk: number
  }
  torrents: Record<string, QBittorrentTorrent>
}

/**
 * qBittorrent Web API client
 */
export class QBittorrentService {
  private readonly DEFAULT_TIMEOUT = 10000
  private cookies: Map<string, string> = new Map()

  private buildUrl(config: QBittorrentConfig, path: string): string {
    const protocol = config.useSsl ? 'https' : 'http'
    return `${protocol}://${config.host}:${config.port}/api/v2${path}`
  }

  /**
   * Authenticate with qBittorrent and store session cookie
   */
  private async authenticate(config: QBittorrentConfig): Promise<void> {
    const configKey = `${config.host}:${config.port}`

    // Check if we already have a valid cookie
    if (this.cookies.has(configKey)) {
      return
    }

    const url = this.buildUrl(config, '/auth/login')
    const formData = new URLSearchParams()
    formData.append('username', config.username || 'admin')
    formData.append('password', config.password || '')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      throw new Error(`Authentication failed: HTTP ${response.status}`)
    }

    const text = await response.text()
    if (text !== 'Ok.') {
      throw new Error('Authentication failed: Invalid credentials')
    }

    // Extract and store the SID cookie
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      const sidMatch = setCookie.match(/SID=([^;]+)/)
      if (sidMatch) {
        this.cookies.set(configKey, sidMatch[1])
      }
    }
  }

  /**
   * Make an authenticated request to qBittorrent
   */
  private async request(
    config: QBittorrentConfig,
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    await this.authenticate(config)

    const configKey = `${config.host}:${config.port}`
    const cookie = this.cookies.get(configKey)

    const url = this.buildUrl(config, path)
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Cookie: cookie ? `SID=${cookie}` : '',
      },
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    // If unauthorized, clear cookie and retry once
    if (response.status === 403) {
      this.cookies.delete(configKey)
      await this.authenticate(config)
      const newCookie = this.cookies.get(configKey)

      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Cookie: newCookie ? `SID=${newCookie}` : '',
        },
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      })
    }

    return response
  }

  /**
   * Test connection to qBittorrent
   */
  async testConnection(
    config: QBittorrentConfig
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      await this.authenticate(config)

      const response = await this.request(config, '/app/version')
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const version = await response.text()
      return { success: true, version }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  /**
   * Get all torrents
   */
  async getTorrents(config: QBittorrentConfig, category?: string): Promise<QBittorrentTorrent[]> {
    const params = new URLSearchParams()
    if (category || config.category) {
      params.append('category', category || config.category || '')
    }

    const path = `/torrents/info${params.toString() ? '?' + params.toString() : ''}`
    const response = await this.request(config, path)

    if (!response.ok) {
      throw new Error(`Failed to get torrents: HTTP ${response.status}`)
    }

    return response.json() as Promise<QBittorrentTorrent[]>
  }

  /**
   * Get main data including all torrents and transfer info
   */
  async getMaindata(config: QBittorrentConfig, rid = 0): Promise<QBittorrentMaindata> {
    const response = await this.request(config, `/sync/maindata?rid=${rid}`)

    if (!response.ok) {
      throw new Error(`Failed to get maindata: HTTP ${response.status}`)
    }

    return response.json() as Promise<QBittorrentMaindata>
  }

  /**
   * Add torrent from URL (magnet or .torrent URL)
   */
  async addTorrent(
    config: QBittorrentConfig,
    url: string,
    options: {
      category?: string
      savePath?: string
      paused?: boolean
      rename?: string
    } = {}
  ): Promise<void> {
    const formData = new FormData()
    formData.append('urls', url)

    if (options.category || config.category) {
      formData.append('category', options.category || config.category || '')
    }
    if (options.savePath) {
      formData.append('savepath', options.savePath)
    }
    if (options.paused) {
      formData.append('paused', 'true')
    }
    if (options.rename) {
      formData.append('rename', options.rename)
    }

    const response = await this.request(config, '/torrents/add', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to add torrent: ${text || response.status}`)
    }
  }

  /**
   * Add torrent from file content
   */
  async addTorrentFile(
    config: QBittorrentConfig,
    fileContent: Buffer | ArrayBuffer,
    filename: string,
    options: {
      category?: string
      savePath?: string
      paused?: boolean
      rename?: string
    } = {}
  ): Promise<void> {
    const formData = new FormData()
    formData.append('torrents', new Blob([fileContent]), filename)

    if (options.category || config.category) {
      formData.append('category', options.category || config.category || '')
    }
    if (options.savePath) {
      formData.append('savepath', options.savePath)
    }
    if (options.paused) {
      formData.append('paused', 'true')
    }
    if (options.rename) {
      formData.append('rename', options.rename)
    }

    const response = await this.request(config, '/torrents/add', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to add torrent file: ${text || response.status}`)
    }
  }

  /**
   * Pause torrent(s)
   */
  async pause(config: QBittorrentConfig, hashes: string | string[]): Promise<void> {
    const hashStr = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashStr)

    const response = await this.request(config, '/torrents/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`Failed to pause torrent: HTTP ${response.status}`)
    }
  }

  /**
   * Resume torrent(s)
   */
  async resume(config: QBittorrentConfig, hashes: string | string[]): Promise<void> {
    const hashStr = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashStr)

    const response = await this.request(config, '/torrents/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`Failed to resume torrent: HTTP ${response.status}`)
    }
  }

  /**
   * Delete torrent(s)
   */
  async delete(
    config: QBittorrentConfig,
    hashes: string | string[],
    deleteFiles = false
  ): Promise<void> {
    const hashStr = Array.isArray(hashes) ? hashes.join('|') : hashes
    const formData = new URLSearchParams()
    formData.append('hashes', hashStr)
    formData.append('deleteFiles', deleteFiles ? 'true' : 'false')

    const response = await this.request(config, '/torrents/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`Failed to delete torrent: HTTP ${response.status}`)
    }
  }

  /**
   * Get torrent properties
   */
  async getTorrentProperties(
    config: QBittorrentConfig,
    hash: string
  ): Promise<Record<string, unknown>> {
    const response = await this.request(config, `/torrents/properties?hash=${hash}`)

    if (!response.ok) {
      throw new Error(`Failed to get torrent properties: HTTP ${response.status}`)
    }

    return response.json() as Promise<Record<string, unknown>>
  }

  /**
   * Get all categories
   */
  async getCategories(
    config: QBittorrentConfig
  ): Promise<Record<string, { name: string; savePath: string }>> {
    const response = await this.request(config, '/torrents/categories')

    if (!response.ok) {
      throw new Error(`Failed to get categories: HTTP ${response.status}`)
    }

    return response.json() as Promise<Record<string, { name: string; savePath: string }>>
  }

  /**
   * Create category
   */
  async createCategory(config: QBittorrentConfig, name: string, savePath?: string): Promise<void> {
    const formData = new URLSearchParams()
    formData.append('category', name)
    if (savePath) {
      formData.append('savePath', savePath)
    }

    const response = await this.request(config, '/torrents/createCategory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`Failed to create category: HTTP ${response.status}`)
    }
  }

  /**
   * Map qBittorrent state to download status
   */
  mapStateToStatus(state: string): 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' {
    switch (state) {
      case 'allocating':
      case 'metaDL':
      case 'queuedDL':
      case 'checkingDL':
        return 'queued'
      case 'downloading':
      case 'forcedDL':
      case 'stalledDL':
        return 'downloading'
      case 'pausedDL':
      case 'pausedUP':
        return 'paused'
      case 'uploading':
      case 'stalledUP':
      case 'forcedUP':
      case 'queuedUP':
      case 'checkingUP':
      case 'checkingResumeData':
        return 'completed'
      case 'error':
      case 'missingFiles':
        return 'failed'
      default:
        return 'queued'
    }
  }
}

export const qbittorrentService = new QBittorrentService()
