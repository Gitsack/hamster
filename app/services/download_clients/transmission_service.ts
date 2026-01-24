export interface TransmissionConfig {
  host: string
  port: number
  username?: string
  password?: string
  useSsl?: boolean
  urlBase?: string
}

export interface TransmissionTorrent {
  id: number
  hashString: string
  name: string
  status: number
  percentDone: number
  rateDownload: number
  rateUpload: number
  eta: number
  error: number
  errorString: string
  isFinished: boolean
  isStalled: boolean
  totalSize: number
  downloadedEver: number
  uploadedEver: number
  addedDate: number
  doneDate: number
  downloadDir: string
  files: {
    bytesCompleted: number
    length: number
    name: string
  }[]
}

export interface TransmissionSessionStats {
  activeTorrentCount: number
  downloadSpeed: number
  uploadSpeed: number
  pausedTorrentCount: number
  torrentCount: number
}

// Transmission RPC status codes
export const TransmissionStatus = {
  STOPPED: 0,
  CHECK_WAIT: 1,
  CHECK: 2,
  DOWNLOAD_WAIT: 3,
  DOWNLOAD: 4,
  SEED_WAIT: 5,
  SEED: 6,
} as const

/**
 * Transmission RPC client
 */
export class TransmissionService {
  private readonly DEFAULT_TIMEOUT = 10000
  private sessionIds: Map<string, string> = new Map()

  private buildUrl(config: TransmissionConfig): string {
    const protocol = config.useSsl ? 'https' : 'http'
    const urlBase = config.urlBase?.replace(/\/$/, '') || '/transmission'
    return `${protocol}://${config.host}:${config.port}${urlBase}/rpc`
  }

  /**
   * Make an RPC request to Transmission
   */
  private async request<T>(
    config: TransmissionConfig,
    method: string,
    args?: Record<string, unknown>
  ): Promise<T> {
    const configKey = `${config.host}:${config.port}`
    let sessionId = this.sessionIds.get(configKey) || ''

    const url = this.buildUrl(config)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Transmission-Session-Id': sessionId,
    }

    // Add basic auth if credentials provided
    if (config.username) {
      const auth = Buffer.from(`${config.username}:${config.password || ''}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }

    const body = JSON.stringify({
      method,
      arguments: args || {},
    })

    let response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    // Transmission returns 409 with session ID in header
    if (response.status === 409) {
      const newSessionId = response.headers.get('X-Transmission-Session-Id')
      if (newSessionId) {
        this.sessionIds.set(configKey, newSessionId)
        headers['X-Transmission-Session-Id'] = newSessionId

        response = await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
        })
      }
    }

    if (!response.ok) {
      throw new Error(`Transmission RPC failed: HTTP ${response.status}`)
    }

    const data = (await response.json()) as { result: string; arguments?: T }

    if (data.result !== 'success') {
      throw new Error(`Transmission RPC error: ${data.result}`)
    }

    return data.arguments as T
  }

  /**
   * Test connection to Transmission
   */
  async testConnection(
    config: TransmissionConfig
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const result = await this.request<{ 'version': string; 'rpc-version': number }>(
        config,
        'session-get',
        { fields: ['version', 'rpc-version'] }
      )

      return { success: true, version: result.version }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  /**
   * Get all torrents
   */
  async getTorrents(config: TransmissionConfig): Promise<TransmissionTorrent[]> {
    const result = await this.request<{ torrents: TransmissionTorrent[] }>(config, 'torrent-get', {
      fields: [
        'id',
        'hashString',
        'name',
        'status',
        'percentDone',
        'rateDownload',
        'rateUpload',
        'eta',
        'error',
        'errorString',
        'isFinished',
        'isStalled',
        'totalSize',
        'downloadedEver',
        'uploadedEver',
        'addedDate',
        'doneDate',
        'downloadDir',
        'files',
      ],
    })

    return result.torrents
  }

  /**
   * Get session stats
   */
  async getSessionStats(config: TransmissionConfig): Promise<TransmissionSessionStats> {
    return this.request<TransmissionSessionStats>(config, 'session-stats')
  }

  /**
   * Add torrent from URL (magnet or .torrent URL)
   */
  async addTorrent(
    config: TransmissionConfig,
    url: string,
    options: {
      downloadDir?: string
      paused?: boolean
    } = {}
  ): Promise<{ id: number; hashString: string; name: string }> {
    const args: Record<string, unknown> = {
      filename: url,
    }

    if (options.downloadDir) {
      args['download-dir'] = options.downloadDir
    }
    if (options.paused) {
      args.paused = true
    }

    const result = await this.request<{
      'torrent-added'?: { id: number; hashString: string; name: string }
      'torrent-duplicate'?: { id: number; hashString: string; name: string }
    }>(config, 'torrent-add', args)

    const torrent = result['torrent-added'] || result['torrent-duplicate']
    if (!torrent) {
      throw new Error('Failed to add torrent: no torrent in response')
    }

    return torrent
  }

  /**
   * Add torrent from file content (base64)
   */
  async addTorrentFile(
    config: TransmissionConfig,
    fileContent: Buffer | ArrayBuffer,
    options: {
      downloadDir?: string
      paused?: boolean
    } = {}
  ): Promise<{ id: number; hashString: string; name: string }> {
    // Handle both Buffer and ArrayBuffer
    const buffer =
      fileContent instanceof Buffer ? fileContent : Buffer.from(new Uint8Array(fileContent))
    const base64 = buffer.toString('base64')

    const args: Record<string, unknown> = {
      metainfo: base64,
    }

    if (options.downloadDir) {
      args['download-dir'] = options.downloadDir
    }
    if (options.paused) {
      args.paused = true
    }

    const result = await this.request<{
      'torrent-added'?: { id: number; hashString: string; name: string }
      'torrent-duplicate'?: { id: number; hashString: string; name: string }
    }>(config, 'torrent-add', args)

    const torrent = result['torrent-added'] || result['torrent-duplicate']
    if (!torrent) {
      throw new Error('Failed to add torrent: no torrent in response')
    }

    return torrent
  }

  /**
   * Start torrent(s)
   */
  async start(config: TransmissionConfig, ids: number | number[]): Promise<void> {
    await this.request(config, 'torrent-start', {
      ids: Array.isArray(ids) ? ids : [ids],
    })
  }

  /**
   * Stop torrent(s)
   */
  async stop(config: TransmissionConfig, ids: number | number[]): Promise<void> {
    await this.request(config, 'torrent-stop', {
      ids: Array.isArray(ids) ? ids : [ids],
    })
  }

  /**
   * Remove torrent(s)
   */
  async remove(
    config: TransmissionConfig,
    ids: number | number[],
    deleteLocalData = false
  ): Promise<void> {
    await this.request(config, 'torrent-remove', {
      'ids': Array.isArray(ids) ? ids : [ids],
      'delete-local-data': deleteLocalData,
    })
  }

  /**
   * Get free space in download directory
   */
  async getFreeSpace(config: TransmissionConfig, path?: string): Promise<number> {
    // Get default download dir if not specified
    let downloadDir = path
    if (!downloadDir) {
      const session = await this.request<{ 'download-dir': string }>(config, 'session-get', {
        fields: ['download-dir'],
      })
      downloadDir = session['download-dir']
    }

    const result = await this.request<{ 'size-bytes': number }>(config, 'free-space', {
      path: downloadDir,
    })

    return result['size-bytes']
  }

  /**
   * Map Transmission status to download status
   */
  mapStatusToDownloadStatus(
    status: number,
    isFinished: boolean
  ): 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' {
    if (isFinished) {
      return 'completed'
    }

    switch (status) {
      case TransmissionStatus.STOPPED:
        return 'paused'
      case TransmissionStatus.CHECK_WAIT:
      case TransmissionStatus.CHECK:
      case TransmissionStatus.DOWNLOAD_WAIT:
        return 'queued'
      case TransmissionStatus.DOWNLOAD:
        return 'downloading'
      case TransmissionStatus.SEED_WAIT:
      case TransmissionStatus.SEED:
        return 'completed'
      default:
        return 'queued'
    }
  }
}

export const transmissionService = new TransmissionService()
