export interface DelugeConfig {
  host: string
  port: number
  password: string
  useSsl?: boolean
}

export interface DelugeTorrent {
  hash: string
  name: string
  state: string
  progress: number
  totalSize: number
  totalDone: number
  downloadPayloadRate: number
  uploadPayloadRate: number
  eta: number
  numSeeds: number
  numPeers: number
  savePath: string
  timeAdded: number
  isFinished: boolean
  moveCompletedPath: string
}

/**
 * Deluge JSON-RPC v2 client
 */
export class DelugeService {
  private readonly DEFAULT_TIMEOUT = 10000
  private cookies: Map<string, string> = new Map()
  private requestId = 0

  private buildUrl(config: DelugeConfig): string {
    const protocol = config.useSsl ? 'https' : 'http'
    return `${protocol}://${config.host}:${config.port}/json`
  }

  /**
   * Make a JSON-RPC request to Deluge
   */
  private async rpc<T>(config: DelugeConfig, method: string, params: unknown[] = []): Promise<T> {
    const url = this.buildUrl(config)
    const configKey = `${config.host}:${config.port}`
    const cookie = this.cookies.get(configKey)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (cookie) {
      headers['Cookie'] = cookie
    }

    const body = JSON.stringify({
      id: ++this.requestId,
      method,
      params,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    // Store session cookie
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      this.cookies.set(configKey, setCookie.split(';')[0])
    }

    if (!response.ok) {
      throw new Error(`Deluge RPC failed: HTTP ${response.status}`)
    }

    const data = (await response.json()) as {
      result: T
      error: { message: string; code: number } | null
    }

    if (data.error) {
      throw new Error(`Deluge RPC error: ${data.error.message}`)
    }

    return data.result
  }

  /**
   * Authenticate with Deluge daemon
   */
  private async authenticate(config: DelugeConfig): Promise<void> {
    const result = await this.rpc<boolean>(config, 'auth.login', [config.password])
    if (!result) {
      throw new Error('Authentication failed: Invalid password')
    }
  }

  /**
   * Make an authenticated RPC request (login first if needed)
   */
  private async request<T>(
    config: DelugeConfig,
    method: string,
    params: unknown[] = []
  ): Promise<T> {
    try {
      return await this.rpc<T>(config, method, params)
    } catch (error) {
      // If unauthenticated, login and retry
      if (
        error instanceof Error &&
        (error.message.includes('Not authenticated') || error.message.includes('403'))
      ) {
        await this.authenticate(config)
        return this.rpc<T>(config, method, params)
      }
      // Try authenticating anyway on first call
      const configKey = `${config.host}:${config.port}`
      if (!this.cookies.has(configKey)) {
        await this.authenticate(config)
        return this.rpc<T>(config, method, params)
      }
      throw error
    }
  }

  /**
   * Test connection to Deluge
   */
  async testConnection(
    config: DelugeConfig
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      await this.authenticate(config)
      const version = await this.rpc<string>(config, 'daemon.info', [])
      return { success: true, version }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  /**
   * Get all torrents with status fields
   */
  async getTorrents(config: DelugeConfig): Promise<DelugeTorrent[]> {
    const fields = [
      'name',
      'state',
      'progress',
      'total_size',
      'total_done',
      'download_payload_rate',
      'upload_payload_rate',
      'eta',
      'num_seeds',
      'num_peers',
      'save_path',
      'time_added',
      'is_finished',
      'move_completed_path',
    ]

    const result = await this.request<Record<string, Record<string, unknown>>>(
      config,
      'core.get_torrents_status',
      [{}, fields]
    )

    return Object.entries(result).map(([hash, data]) => ({
      hash,
      name: data.name as string,
      state: data.state as string,
      progress: (data.progress as number) || 0,
      totalSize: (data.total_size as number) || 0,
      totalDone: (data.total_done as number) || 0,
      downloadPayloadRate: (data.download_payload_rate as number) || 0,
      uploadPayloadRate: (data.upload_payload_rate as number) || 0,
      eta: (data.eta as number) || 0,
      numSeeds: (data.num_seeds as number) || 0,
      numPeers: (data.num_peers as number) || 0,
      savePath: (data.save_path as string) || '',
      timeAdded: (data.time_added as number) || 0,
      isFinished: (data.is_finished as boolean) || false,
      moveCompletedPath: (data.move_completed_path as string) || '',
    }))
  }

  /**
   * Add torrent from magnet URI or URL
   */
  async addTorrent(
    config: DelugeConfig,
    url: string,
    options: { downloadPath?: string; addPaused?: boolean } = {}
  ): Promise<string> {
    const opts: Record<string, unknown> = {}
    if (options.downloadPath) {
      opts.download_location = options.downloadPath
    }
    if (options.addPaused) {
      opts.add_paused = true
    }

    if (url.startsWith('magnet:')) {
      const hash = await this.request<string>(config, 'core.add_torrent_magnet', [url, opts])
      if (!hash) {
        throw new Error('Failed to add magnet: no hash returned')
      }
      return hash
    }

    const hash = await this.request<string>(config, 'core.add_torrent_url', [url, opts])
    if (!hash) {
      throw new Error('Failed to add torrent URL: no hash returned')
    }
    return hash
  }

  /**
   * Add torrent from file content (base64)
   */
  async addTorrentFile(
    config: DelugeConfig,
    fileContent: Buffer | ArrayBuffer,
    filename: string,
    options: { downloadPath?: string; addPaused?: boolean } = {}
  ): Promise<string> {
    const buffer =
      fileContent instanceof Buffer ? fileContent : Buffer.from(new Uint8Array(fileContent))
    const base64 = buffer.toString('base64')

    const opts: Record<string, unknown> = {}
    if (options.downloadPath) {
      opts.download_location = options.downloadPath
    }
    if (options.addPaused) {
      opts.add_paused = true
    }

    const hash = await this.request<string>(config, 'core.add_torrent_file', [
      filename,
      base64,
      opts,
    ])
    if (!hash) {
      throw new Error('Failed to add torrent file: no hash returned')
    }
    return hash
  }

  /**
   * Pause torrent(s)
   */
  async pause(config: DelugeConfig, ids: string | string[]): Promise<void> {
    const hashes = Array.isArray(ids) ? ids : [ids]
    await this.request(config, 'core.pause_torrent', [hashes])
  }

  /**
   * Resume torrent(s)
   */
  async resume(config: DelugeConfig, ids: string | string[]): Promise<void> {
    const hashes = Array.isArray(ids) ? ids : [ids]
    await this.request(config, 'core.resume_torrent', [hashes])
  }

  /**
   * Remove torrent(s)
   */
  async remove(config: DelugeConfig, id: string, deleteFiles = false): Promise<void> {
    await this.request(config, 'core.remove_torrent', [id, deleteFiles])
  }

  /**
   * Map Deluge state to download status
   */
  mapStateToStatus(
    state: string,
    isFinished: boolean
  ): 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' {
    if (isFinished) {
      return 'completed'
    }

    switch (state) {
      case 'Downloading':
        return 'downloading'
      case 'Seeding':
        return 'completed'
      case 'Paused':
        return 'paused'
      case 'Checking':
      case 'Queued':
      case 'Allocating':
      case 'Moving':
        return 'queued'
      case 'Error':
        return 'failed'
      default:
        return 'queued'
    }
  }
}

export const delugeService = new DelugeService()
