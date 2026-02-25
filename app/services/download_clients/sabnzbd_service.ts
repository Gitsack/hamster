export interface SabnzbdConfig {
  host: string
  port: number
  apiKey: string
  useSsl?: boolean
  category?: string
}

export interface SabnzbdQueueItem {
  nzo_id: string
  filename: string
  status:
    | 'Queued'
    | 'Downloading'
    | 'Paused'
    | 'Grabbing'
    | 'Fetching'
    | 'Verifying'
    | 'Repairing'
    | 'Extracting'
    | 'Moving'
    | 'Running'
  percentage: string
  mb: string
  mbleft: string
  timeleft: string
  eta: string
  avg_age: string
  category: string
  priority: string
  script: string
  size: string
}

export interface SabnzbdHistoryItem {
  nzo_id: string
  name: string
  status: 'Completed' | 'Failed' | 'Extracting' | 'Verifying' | 'Repairing' | 'Running' | 'Moving'
  category: string
  bytes: number
  download_time: number
  completed: number
  storage: string
  fail_message?: string
}

export interface SabnzbdQueue {
  paused: boolean
  diskspace1: string
  diskspace2: string
  speed: string
  kbpersec: string
  mbleft: string
  mb: string
  noofslots: number
  slots: SabnzbdQueueItem[]
}

export interface SabnzbdHistory {
  noofslots: number
  slots: SabnzbdHistoryItem[]
}

export class SabnzbdService {
  // Default timeout for API calls (10 seconds)
  private readonly DEFAULT_TIMEOUT = 10000

  private buildUrl(config: SabnzbdConfig, params: Record<string, string>): string {
    const protocol = config.useSsl ? 'https' : 'http'
    const baseUrl = `${protocol}://${config.host}:${config.port}/api`
    const queryParams = new URLSearchParams({
      ...params,
      apikey: config.apiKey,
      output: 'json',
    })
    return `${baseUrl}?${queryParams.toString()}`
  }

  /**
   * Test connection to SABnzbd
   */
  async testConnection(
    config: SabnzbdConfig
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const url = this.buildUrl(config, { mode: 'version' })
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = (await response.json()) as { version?: string; error?: string }

      if (data.error) {
        return { success: false, error: data.error }
      }

      return { success: true, version: data.version }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  /**
   * Get queue status
   */
  async getQueue(config: SabnzbdConfig, limit = 100): Promise<SabnzbdQueue> {
    const url = this.buildUrl(config, { mode: 'queue', limit: String(limit) })
    const startTime = Date.now()

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT) })
      const elapsed = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`Failed to get queue: HTTP ${response.status} (${elapsed}ms)`)
      }

      const data = (await response.json()) as { queue: SabnzbdQueue }
      return data.queue
    } catch (error) {
      const elapsed = Date.now() - startTime
      const host = `${config.useSsl ? 'https' : 'http'}://${config.host}:${config.port}`
      console.error(
        `[SABnzbd] getQueue failed after ${elapsed}ms to ${host}:`,
        error instanceof Error ? error.message : error
      )
      throw error
    }
  }

  /**
   * Get history
   */
  async getHistory(config: SabnzbdConfig, limit = 50): Promise<SabnzbdHistory> {
    const url = this.buildUrl(config, { mode: 'history', limit: String(limit) })
    const startTime = Date.now()

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT) })
      const elapsed = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`Failed to get history: HTTP ${response.status} (${elapsed}ms)`)
      }

      const data = (await response.json()) as { history: SabnzbdHistory }
      return data.history
    } catch (error) {
      const elapsed = Date.now() - startTime
      const host = `${config.useSsl ? 'https' : 'http'}://${config.host}:${config.port}`
      console.error(
        `[SABnzbd] getHistory failed after ${elapsed}ms to ${host}:`,
        error instanceof Error ? error.message : error
      )
      throw error
    }
  }

  /**
   * Add NZB from URL
   */
  async addFromUrl(
    config: SabnzbdConfig,
    nzbUrl: string,
    options: {
      category?: string
      priority?: number
      name?: string
    } = {}
  ): Promise<{ nzo_ids: string[] }> {
    const params: Record<string, string> = {
      mode: 'addurl',
      name: nzbUrl,
    }

    if (options.category || config.category) {
      params.cat = options.category || config.category || ''
    }
    if (options.priority !== undefined) {
      params.priority = String(options.priority)
    }
    if (options.name) {
      params.nzbname = options.name
    }

    const url = this.buildUrl(config, params)
    const response = await fetch(url, { signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT) })

    if (!response.ok) {
      throw new Error(`Failed to add NZB: ${response.status}`)
    }

    const data = (await response.json()) as { status: boolean; nzo_ids?: string[]; error?: string }

    if (!data.status || !data.nzo_ids) {
      throw new Error(data.error || 'Failed to add NZB to SABnzbd')
    }

    return { nzo_ids: data.nzo_ids }
  }

  /**
   * Add NZB from file content
   */
  async addFromFile(
    config: SabnzbdConfig,
    nzbContent: Buffer | string,
    filename: string,
    options: {
      category?: string
      priority?: number
    } = {}
  ): Promise<{ nzo_ids: string[] }> {
    const protocol = config.useSsl ? 'https' : 'http'
    const baseUrl = `${protocol}://${config.host}:${config.port}/api`

    const formData = new FormData()
    formData.append('apikey', config.apiKey)
    formData.append('output', 'json')
    formData.append('mode', 'addfile')
    formData.append('nzbfile', new Blob([nzbContent]), filename)

    if (options.category || config.category) {
      formData.append('cat', options.category || config.category || '')
    }
    if (options.priority !== undefined) {
      formData.append('priority', String(options.priority))
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      throw new Error(`Failed to add NZB file: ${response.status}`)
    }

    const data = (await response.json()) as { status: boolean; nzo_ids?: string[]; error?: string }

    if (!data.status || !data.nzo_ids) {
      throw new Error(data.error || 'Failed to add NZB file to SABnzbd')
    }

    return { nzo_ids: data.nzo_ids }
  }

  /**
   * Pause the queue
   */
  async pause(config: SabnzbdConfig): Promise<void> {
    const url = this.buildUrl(config, { mode: 'pause' })
    const response = await fetch(url, { signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT) })

    if (!response.ok) {
      throw new Error(`Failed to pause queue: ${response.status}`)
    }
  }

  /**
   * Resume the queue
   */
  async resume(config: SabnzbdConfig): Promise<void> {
    const url = this.buildUrl(config, { mode: 'resume' })
    const response = await fetch(url, { signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT) })

    if (!response.ok) {
      throw new Error(`Failed to resume queue: ${response.status}`)
    }
  }

  /**
   * Delete an item from queue or history
   */
  async delete(config: SabnzbdConfig, nzoId: string, deleteFiles = false): Promise<void> {
    const url = this.buildUrl(config, {
      mode: 'queue',
      name: 'delete',
      value: nzoId,
      del_files: deleteFiles ? '1' : '0',
    })
    const response = await fetch(url, { signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT) })

    if (!response.ok) {
      throw new Error(`Failed to delete item: ${response.status}`)
    }
  }

  /**
   * Delete an item from history
   */
  async deleteHistory(config: SabnzbdConfig, nzoId: string, deleteFiles = false): Promise<void> {
    const url = this.buildUrl(config, {
      mode: 'history',
      name: 'delete',
      value: nzoId,
      del_files: deleteFiles ? '1' : '0',
    })
    const response = await fetch(url, { signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT) })

    if (!response.ok) {
      throw new Error(`Failed to delete history item: ${response.status}`)
    }
  }

  /**
   * Get categories
   */
  async getCategories(config: SabnzbdConfig): Promise<string[]> {
    const url = this.buildUrl(config, { mode: 'get_cats' })
    const response = await fetch(url, { signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT) })

    if (!response.ok) {
      throw new Error(`Failed to get categories: ${response.status}`)
    }

    const data = (await response.json()) as { categories: string[] }
    return data.categories || []
  }

  /**
   * Get SABnzbd configuration (including folder paths)
   */
  async getConfig(
    config: SabnzbdConfig
  ): Promise<{ completeDir?: string; incompleteDir?: string }> {
    const url = this.buildUrl(config, { mode: 'get_config' })
    const response = await fetch(url, { signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT) })

    if (!response.ok) {
      throw new Error(`Failed to get config: ${response.status}`)
    }

    const data = (await response.json()) as {
      config?: {
        misc?: {
          complete_dir?: string
          download_dir?: string
        }
      }
    }

    return {
      completeDir: data.config?.misc?.complete_dir,
      incompleteDir: data.config?.misc?.download_dir,
    }
  }
}

export const sabnzbdService = new SabnzbdService()
