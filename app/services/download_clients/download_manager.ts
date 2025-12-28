import DownloadClient from '#models/download_client'
import Download from '#models/download'
import { sabnzbdService, type SabnzbdConfig } from './sabnzbd_service.js'
import { downloadImportService } from '#services/media/download_import_service'
import { DateTime } from 'luxon'

export interface DownloadRequest {
  title: string
  downloadUrl: string
  size?: number
  albumId?: number
  releaseId?: number
  indexerId?: number
  indexerName?: string
  guid?: string
}

export interface QueueItem {
  id: number
  externalId: string | null
  title: string
  status: string
  progress: number
  size: number | null
  remaining: number | null
  eta: number | null
  albumId: number | null
  downloadClient: string
  startedAt: string | null
}

export class DownloadManager {
  /**
   * Send a release to the download client
   */
  async grab(request: DownloadRequest): Promise<Download> {
    // Get enabled download client
    const client = await DownloadClient.query().where('enabled', true).orderBy('priority', 'asc').first()

    if (!client) {
      throw new Error('No enabled download client configured')
    }

    // Create download record
    const download = await Download.create({
      downloadClientId: client.id,
      title: request.title,
      status: 'queued',
      progress: 0,
      sizeBytes: request.size || null,
      albumId: request.albumId || null,
      releaseId: request.releaseId || null,
      indexerId: request.indexerId || null,
      nzbInfo: {
        guid: request.guid,
        title: request.title,
        downloadUrl: request.downloadUrl,
        size: request.size,
        indexer: request.indexerName,
      },
      startedAt: DateTime.now(),
    })

    try {
      // Send to download client
      const externalId = await this.sendToClient(client, request)
      download.externalId = externalId
      download.status = 'downloading'
      await download.save()

      return download
    } catch (error) {
      download.status = 'failed'
      download.errorMessage = error instanceof Error ? error.message : 'Failed to send to download client'
      await download.save()
      throw error
    }
  }

  /**
   * Send NZB to download client
   */
  private async sendToClient(client: DownloadClient, request: DownloadRequest): Promise<string> {
    switch (client.type) {
      case 'sabnzbd': {
        const config: SabnzbdConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8080,
          apiKey: client.settings.apiKey || '',
          useSsl: client.settings.useSsl || false,
          category: client.settings.category,
        }

        const result = await sabnzbdService.addFromUrl(config, request.downloadUrl, {
          name: request.title,
          category: client.settings.category,
        })

        return result.nzo_ids[0]
      }

      default:
        throw new Error(`Unsupported download client type: ${client.type}`)
    }
  }

  /**
   * Get active queue
   */
  async getQueue(): Promise<QueueItem[]> {
    const downloads = await Download.query()
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
      .preload('downloadClient')
      .orderBy('createdAt', 'asc')

    return downloads.map((d) => ({
      id: d.id,
      externalId: d.externalId,
      title: d.title,
      status: d.status,
      progress: d.progress,
      size: d.sizeBytes,
      remaining: d.remainingBytes,
      eta: d.etaSeconds,
      albumId: d.albumId,
      downloadClient: d.downloadClient?.name || 'Unknown',
      startedAt: d.startedAt?.toISO() || null,
    }))
  }

  /**
   * Refresh queue status from download clients
   */
  async refreshQueue(): Promise<void> {
    const clients = await DownloadClient.query().where('enabled', true)

    for (const client of clients) {
      try {
        await this.refreshClientQueue(client)
      } catch (error) {
        console.error(`Failed to refresh queue for ${client.name}:`, error)
      }
    }
  }

  /**
   * Refresh queue from a specific client
   */
  private async refreshClientQueue(client: DownloadClient): Promise<void> {
    switch (client.type) {
      case 'sabnzbd': {
        const config: SabnzbdConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8080,
          apiKey: client.settings.apiKey || '',
          useSsl: client.settings.useSsl || false,
        }

        const queue = await sabnzbdService.getQueue(config)

        // Update local downloads
        for (const slot of queue.slots) {
          const download = await Download.query()
            .where('downloadClientId', client.id)
            .where('externalId', slot.nzo_id)
            .first()

          if (download) {
            download.progress = parseFloat(slot.percentage)
            download.status = this.mapSabnzbdStatus(slot.status)
            download.remainingBytes = parseFloat(slot.mbleft) * 1024 * 1024
            download.etaSeconds = this.parseTimeLeft(slot.timeleft)
            await download.save()
          }
        }

        // Check history for completed downloads
        const history = await sabnzbdService.getHistory(config, 20)

        for (const slot of history.slots) {
          const download = await Download.query()
            .where('downloadClientId', client.id)
            .where('externalId', slot.nzo_id)
            .first()

          if (download && download.status !== 'completed' && download.status !== 'failed' && download.status !== 'importing') {
            if (slot.status === 'Completed') {
              // Mark as importing and save the output path
              download.status = 'importing'
              download.progress = 100
              download.completedAt = DateTime.now()
              download.outputPath = slot.storage
              await download.save()

              // Trigger import in background
              this.triggerImport(download).catch((error) => {
                console.error(`Failed to import download ${download.id}:`, error)
              })
            } else if (slot.status === 'Failed') {
              download.status = 'failed'
              download.errorMessage = slot.fail_message || 'Download failed'
              await download.save()
            }
          }
        }

        break
      }
    }
  }

  /**
   * Trigger import for a completed download
   */
  private async triggerImport(download: Download): Promise<void> {
    console.log(`Starting import for download: ${download.title}`)

    try {
      const result = await downloadImportService.importDownload(download, (progress) => {
        console.log(`Import progress: ${progress.phase} - ${progress.current}/${progress.total}`)
      })

      if (result.success) {
        console.log(`Import completed: ${result.filesImported} files imported for ${download.title}`)
        download.status = 'completed'
      } else {
        console.error(`Import failed for ${download.title}:`, result.errors)
        download.status = 'failed'
        download.errorMessage = result.errors.join('; ') || 'Import failed'
      }

      await download.save()
    } catch (error) {
      console.error(`Import error for ${download.title}:`, error)
      download.status = 'failed'
      download.errorMessage = error instanceof Error ? error.message : 'Import failed'
      await download.save()
    }
  }

  /**
   * Map SABnzbd status to our status
   */
  private mapSabnzbdStatus(
    status: string
  ): 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'importing' {
    switch (status) {
      case 'Downloading':
      case 'Grabbing':
      case 'Fetching':
        return 'downloading'
      case 'Paused':
        return 'paused'
      case 'Queued':
        return 'queued'
      default:
        return 'queued'
    }
  }

  /**
   * Parse SABnzbd time left string to seconds
   */
  private parseTimeLeft(timeleft: string): number {
    if (!timeleft || timeleft === 'Unknown') return 0

    const parts = timeleft.split(':')
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
    }
    return 0
  }

  /**
   * Cancel a download
   */
  async cancel(downloadId: number, deleteFiles = false): Promise<void> {
    const download = await Download.query().where('id', downloadId).preload('downloadClient').first()

    if (!download) {
      throw new Error('Download not found')
    }

    if (download.externalId && download.downloadClient) {
      const client = download.downloadClient

      switch (client.type) {
        case 'sabnzbd': {
          const config: SabnzbdConfig = {
            host: client.settings.host || 'localhost',
            port: client.settings.port || 8080,
            apiKey: client.settings.apiKey || '',
            useSsl: client.settings.useSsl || false,
          }

          await sabnzbdService.delete(config, download.externalId, deleteFiles)
          break
        }
      }
    }

    await download.delete()
  }

  /**
   * Test a download client connection
   */
  async testClient(
    type: string,
    settings: { host?: string; port?: number; apiKey?: string; useSsl?: boolean }
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    switch (type) {
      case 'sabnzbd': {
        const config: SabnzbdConfig = {
          host: settings.host || 'localhost',
          port: settings.port || 8080,
          apiKey: settings.apiKey || '',
          useSsl: settings.useSsl || false,
        }

        return sabnzbdService.testConnection(config)
      }

      default:
        return { success: false, error: `Unsupported client type: ${type}` }
    }
  }
}

export const downloadManager = new DownloadManager()
