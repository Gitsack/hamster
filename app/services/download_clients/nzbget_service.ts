export interface NzbgetConfig {
  host: string
  port: number
  username?: string
  password?: string
  useSsl?: boolean
  category?: string
}

export interface NzbgetQueueItem {
  NZBID: number
  NZBName: string
  NZBNicename: string
  Kind: 'NZB' | 'URL'
  URL: string
  NZBFilename: string
  DestDir: string
  FinalDir: string
  Category: string
  FileSizeLo: number
  FileSizeHi: number
  FileSizeMB: number
  FileCount: number
  RemainingFileSizeLo: number
  RemainingFileSizeHi: number
  RemainingFileSizeMB: number
  RemainingFileCount: number
  Priority: number
  ActiveDownloads: number
  Status: string
  TotalArticles: number
  SuccessArticles: number
  FailedArticles: number
  Health: number
  DownloadedSizeLo: number
  DownloadedSizeHi: number
  DownloadedSizeMB: number
  DownloadTimeSec: number
  PostTotalTimeSec: number
  ParTimeSec: number
  RepairTimeSec: number
  UnpackTimeSec: number
  DeleteStatus: string
  MarkStatus: string
  ExParStatus: string
  UnpackStatus: string
  UrlStatus: string
  ScriptStatus: string
  ScriptStatuses: { Name: string; Status: string }[]
}

export interface NzbgetHistoryItem {
  NZBID: number
  Name: string
  NZBNicename: string
  Kind: 'NZB' | 'URL' | 'DUP'
  URL: string
  NZBFilename: string
  DestDir: string
  FinalDir: string
  Category: string
  ParStatus: string
  UnpackStatus: string
  MoveStatus: string
  ScriptStatus: string
  DeleteStatus: string
  MarkStatus: string
  UrlStatus: string
  FileSizeLo: number
  FileSizeHi: number
  FileSizeMB: number
  FileCount: number
  MinPostTime: number
  MaxPostTime: number
  TotalArticles: number
  SuccessArticles: number
  FailedArticles: number
  Health: number
  CriticalHealth: number
  DupeKey: string
  DupeScore: number
  DupeMode: string
  DownloadedSizeLo: number
  DownloadedSizeHi: number
  DownloadedSizeMB: number
  DownloadTimeSec: number
  PostTotalTimeSec: number
  ParTimeSec: number
  RepairTimeSec: number
  UnpackTimeSec: number
  HistoryTime: number
  Status: string
}

export interface NzbgetStatus {
  RemainingSizeLo: number
  RemainingSizeHi: number
  RemainingSizeMB: number
  ForcedSizeLo: number
  ForcedSizeHi: number
  ForcedSizeMB: number
  DownloadedSizeLo: number
  DownloadedSizeHi: number
  DownloadedSizeMB: number
  ArticleCacheLo: number
  ArticleCacheHi: number
  ArticleCacheMB: number
  DownloadRate: number
  AverageDownloadRate: number
  DownloadLimit: number
  ThreadCount: number
  ParJobCount: number
  PostJobCount: number
  UrlCount: number
  UpTimeSec: number
  DownloadTimeSec: number
  ServerPaused: boolean
  DownloadPaused: boolean
  Download2Paused: boolean
  ServerStandBy: boolean
  PostPaused: boolean
  ScanPaused: boolean
  QuotaReached: boolean
  FreeDiskSpaceLo: number
  FreeDiskSpaceHi: number
  FreeDiskSpaceMB: number
  ServerTime: number
  ResumeTime: number
  FeedActive: boolean
  QueueScriptCount: number
  NewsServers: {
    ID: number
    Active: boolean
  }[]
}

/**
 * NZBGet JSON-RPC client
 */
export class NzbgetService {
  private readonly DEFAULT_TIMEOUT = 10000

  private buildUrl(config: NzbgetConfig): string {
    const protocol = config.useSsl ? 'https' : 'http'
    const auth = config.username ? `${config.username}:${config.password || ''}@` : ''
    return `${protocol}://${auth}${config.host}:${config.port}/jsonrpc`
  }

  /**
   * Make an RPC request to NZBGet
   */
  private async request<T>(
    config: NzbgetConfig,
    method: string,
    params: unknown[] = []
  ): Promise<T> {
    const url = this.buildUrl(config)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method,
        params,
      }),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      throw new Error(`NZBGet RPC failed: HTTP ${response.status}`)
    }

    const data = await response.json() as { result?: T; error?: { message: string } }

    if (data.error) {
      throw new Error(`NZBGet RPC error: ${data.error.message}`)
    }

    return data.result as T
  }

  /**
   * Test connection to NZBGet
   */
  async testConnection(config: NzbgetConfig): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const version = await this.request<string>(config, 'version')
      return { success: true, version }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  /**
   * Get server status
   */
  async getStatus(config: NzbgetConfig): Promise<NzbgetStatus> {
    return this.request<NzbgetStatus>(config, 'status')
  }

  /**
   * Get download queue
   */
  async getQueue(config: NzbgetConfig): Promise<NzbgetQueueItem[]> {
    return this.request<NzbgetQueueItem[]>(config, 'listgroups')
  }

  /**
   * Get download history
   */
  async getHistory(config: NzbgetConfig, hidden = false): Promise<NzbgetHistoryItem[]> {
    return this.request<NzbgetHistoryItem[]>(config, 'history', [hidden])
  }

  /**
   * Add NZB from URL
   */
  async addFromUrl(
    config: NzbgetConfig,
    nzbUrl: string,
    options: {
      category?: string
      priority?: number
      nzbName?: string
      addPaused?: boolean
    } = {}
  ): Promise<number> {
    const category = options.category || config.category || ''
    const priority = options.priority ?? 0
    const addToTop = false
    const addPaused = options.addPaused ?? false
    const dupeKey = ''
    const dupeScore = 0
    const dupeMode = 'SCORE'
    const params: unknown[] = []

    // append method: NZBFilename, NZBContent (empty for URL), Category, Priority, AddToTop, AddPaused, DupeKey, DupeScore, DupeMode, PPParameters
    // For URL-based adds, use appendurl
    const result = await this.request<number>(config, 'appendurl', [
      options.nzbName || '',
      category,
      priority,
      addToTop,
      addPaused,
      nzbUrl,
      dupeKey,
      dupeScore,
      dupeMode,
      params,
    ])

    return result
  }

  /**
   * Add NZB from file content
   */
  async addFromFile(
    config: NzbgetConfig,
    nzbContent: Buffer | string,
    filename: string,
    options: {
      category?: string
      priority?: number
      addPaused?: boolean
    } = {}
  ): Promise<number> {
    const base64Content = Buffer.isBuffer(nzbContent)
      ? nzbContent.toString('base64')
      : Buffer.from(nzbContent).toString('base64')

    const category = options.category || config.category || ''
    const priority = options.priority ?? 0
    const addToTop = false
    const addPaused = options.addPaused ?? false
    const dupeKey = ''
    const dupeScore = 0
    const dupeMode = 'SCORE'
    const params: unknown[] = []

    const result = await this.request<number>(config, 'append', [
      filename,
      base64Content,
      category,
      priority,
      addToTop,
      addPaused,
      dupeKey,
      dupeScore,
      dupeMode,
      params,
    ])

    return result
  }

  /**
   * Pause download queue
   */
  async pauseDownload(config: NzbgetConfig): Promise<boolean> {
    return this.request<boolean>(config, 'pausedownload')
  }

  /**
   * Resume download queue
   */
  async resumeDownload(config: NzbgetConfig): Promise<boolean> {
    return this.request<boolean>(config, 'resumedownload')
  }

  /**
   * Pause a specific group
   */
  async pauseGroup(config: NzbgetConfig, nzbId: number): Promise<boolean> {
    return this.request<boolean>(config, 'editqueue', ['GroupPause', '', [nzbId]])
  }

  /**
   * Resume a specific group
   */
  async resumeGroup(config: NzbgetConfig, nzbId: number): Promise<boolean> {
    return this.request<boolean>(config, 'editqueue', ['GroupResume', '', [nzbId]])
  }

  /**
   * Delete from queue
   */
  async deleteFromQueue(config: NzbgetConfig, nzbId: number): Promise<boolean> {
    return this.request<boolean>(config, 'editqueue', ['GroupDelete', '', [nzbId]])
  }

  /**
   * Delete from history
   */
  async deleteFromHistory(config: NzbgetConfig, nzbId: number, deleteFiles = false): Promise<boolean> {
    const command = deleteFiles ? 'HistoryDelete' : 'HistoryFinalDelete'
    return this.request<boolean>(config, 'editqueue', [command, '', [nzbId]])
  }

  /**
   * Get config values
   */
  async getConfig(config: NzbgetConfig): Promise<{ Name: string; Value: string }[]> {
    return this.request<{ Name: string; Value: string }[]>(config, 'config')
  }

  /**
   * Get specific config value
   */
  async getConfigValue(config: NzbgetConfig, name: string): Promise<string | undefined> {
    const configItems = await this.getConfig(config)
    const item = configItems.find((c) => c.Name === name)
    return item?.Value
  }

  /**
   * Get categories
   */
  async getCategories(config: NzbgetConfig): Promise<string[]> {
    const configItems = await this.getConfig(config)
    const categories: string[] = []

    // NZBGet categories are defined as Category1.Name, Category2.Name, etc.
    for (const item of configItems) {
      if (item.Name.match(/^Category\d+\.Name$/)) {
        categories.push(item.Value)
      }
    }

    return categories
  }

  /**
   * Map NZBGet status to download status
   */
  mapStatusToDownloadStatus(status: string): 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' {
    // Queue statuses
    if (status === 'QUEUED' || status === 'FETCHING') {
      return 'queued'
    }
    if (status === 'DOWNLOADING') {
      return 'downloading'
    }
    if (status === 'PAUSED') {
      return 'paused'
    }

    // Post-processing statuses
    if (['PP_QUEUED', 'LOADING_PARS', 'VERIFYING_SOURCES', 'REPAIRING', 'VERIFYING_REPAIRED', 'RENAMING', 'UNPACKING', 'MOVING', 'EXECUTING_SCRIPT'].includes(status)) {
      return 'downloading' // Still processing
    }

    // History statuses
    if (status === 'SUCCESS') {
      return 'completed'
    }
    if (['FAILURE', 'BAD', 'DELETED', 'DUPE', 'COPY', 'FETCH_FAILURE', 'PAR_FAILURE', 'UNPACK_FAILURE', 'MOVE_FAILURE', 'SCRIPT_FAILURE', 'DISK_FAILURE', 'HEALTH_FAILURE', 'DELETED_FAILURE'].includes(status)) {
      return 'failed'
    }

    return 'queued'
  }
}

export const nzbgetService = new NzbgetService()
