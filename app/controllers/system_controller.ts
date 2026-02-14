import os from 'node:os'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import RootFolder from '#models/root_folder'
import Indexer from '#models/indexer'
import DownloadClient from '#models/download_client'
import { sabnzbdService } from '#services/download_clients/sabnzbd_service'
import { nzbgetService } from '#services/download_clients/nzbget_service'
import { qbittorrentService } from '#services/download_clients/qbittorrent_service'
import { transmissionService } from '#services/download_clients/transmission_service'
import { delugeService } from '#services/download_clients/deluge_service'
import { eventEmitter } from '#services/events/event_emitter'
import fs from 'node:fs/promises'

interface HealthCheck {
  name: string
  status: 'ok' | 'warning' | 'error'
  message?: string
}

interface HealthResponse {
  status: 'ok' | 'warning' | 'error'
  version: string
  uptime: number
  checks: HealthCheck[]
  timestamp: string
}

export default class SystemController {

  private previousHealthStatus: Map<string, 'ok' | 'warning' | 'error'> = new Map()

  /**
   * Enhanced health check endpoint
   */
  async health({ response }: HttpContext) {
    const checks: HealthCheck[] = []
    let overallStatus: 'ok' | 'warning' | 'error' = 'ok'

    // Check database connectivity
    try {
      const start = Date.now()
      await db.rawQuery('SELECT 1')
      const latency = Date.now() - start
      checks.push({
        name: 'database',
        status: latency > 1000 ? 'warning' : 'ok',
        message: `Connected (${latency}ms)`,
      })
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection failed',
      })
      overallStatus = 'error'
    }

    // Check root folders
    const rootFolderCheck = await this.checkRootFolders()
    checks.push(rootFolderCheck)
    if (rootFolderCheck.status === 'error') overallStatus = 'error'
    else if (rootFolderCheck.status === 'warning' && overallStatus !== 'error')
      overallStatus = 'warning'

    // Check indexers
    const indexerCheck = await this.checkIndexers()
    checks.push(indexerCheck)
    if (indexerCheck.status === 'warning' && overallStatus !== 'error') overallStatus = 'warning'

    // Check download clients
    const downloadClientCheck = await this.checkDownloadClients()
    checks.push(downloadClientCheck)
    if (downloadClientCheck.status === 'error') overallStatus = 'error'
    else if (downloadClientCheck.status === 'warning' && overallStatus !== 'error')
      overallStatus = 'warning'

    // Emit health events based on status changes
    for (const check of checks) {
      const previousStatus = this.previousHealthStatus.get(check.name)

      if (
        (check.status === 'error' || check.status === 'warning') &&
        previousStatus !== check.status
      ) {
        eventEmitter
          .emitHealthIssue({
            level: check.status === 'error' ? 'error' : 'warning',
            source: check.name,
            message: check.message || `${check.name} check failed`,
          })
          .catch((err) =>
            console.error('[SystemController] Failed to emit health issue event:', err)
          )
      } else if (check.status === 'ok' && previousStatus && previousStatus !== 'ok') {
        eventEmitter
          .emitHealthRestored({
            source: check.name,
            message: check.message || `${check.name} check restored`,
          })
          .catch((err) =>
            console.error('[SystemController] Failed to emit health restored event:', err)
          )
      }

      this.previousHealthStatus.set(check.name, check.status)
    }

    const healthResponse: HealthResponse = {
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
      checks,
      timestamp: new Date().toISOString(),
    }

    const statusCode = overallStatus === 'error' ? 503 : 200
    return response.status(statusCode).json(healthResponse)
  }

  /**
   * Check root folders accessibility and disk space
   */
  private async checkRootFolders(): Promise<HealthCheck> {
    try {
      const rootFolders = await RootFolder.all()

      if (rootFolders.length === 0) {
        return {
          name: 'rootFolders',
          status: 'warning',
          message: 'No root folders configured',
        }
      }

      const issues: string[] = []
      const lowSpaceWarningBytes = 10 * 1024 * 1024 * 1024 // 10 GB

      for (const folder of rootFolders) {
        try {
          await fs.access(folder.path)

          // Check if we can get space info
          if (folder.freeSpaceBytes !== null && folder.freeSpaceBytes < lowSpaceWarningBytes) {
            const freeGb = Math.round(folder.freeSpaceBytes / (1024 * 1024 * 1024))
            issues.push(`${folder.path}: Low disk space (${freeGb} GB free)`)
          }
        } catch {
          issues.push(`${folder.path}: Not accessible`)
        }
      }

      if (issues.length > 0) {
        return {
          name: 'rootFolders',
          status: issues.some((i) => i.includes('Not accessible')) ? 'error' : 'warning',
          message: issues.join('; '),
        }
      }

      return {
        name: 'rootFolders',
        status: 'ok',
        message: `${rootFolders.length} folder(s) accessible`,
      }
    } catch (error) {
      return {
        name: 'rootFolders',
        status: 'error',
        message: error instanceof Error ? error.message : 'Check failed',
      }
    }
  }

  /**
   * Check indexer configuration
   */
  private async checkIndexers(): Promise<HealthCheck> {
    try {
      const indexers = await Indexer.query().where('enabled', true)

      if (indexers.length === 0) {
        return {
          name: 'indexers',
          status: 'warning',
          message: 'No indexers configured',
        }
      }

      return {
        name: 'indexers',
        status: 'ok',
        message: `${indexers.length} indexer(s) enabled`,
      }
    } catch (error) {
      return {
        name: 'indexers',
        status: 'error',
        message: error instanceof Error ? error.message : 'Check failed',
      }
    }
  }

  /**
   * Check download client connectivity
   */
  private async checkDownloadClients(): Promise<HealthCheck> {
    try {
      const clients = await DownloadClient.query().where('enabled', true)

      if (clients.length === 0) {
        return {
          name: 'downloadClients',
          status: 'warning',
          message: 'No download clients configured',
        }
      }

      const results = await Promise.allSettled(
        clients.map(async (client) => {
          const settings = client.settings
          const config = {
            host: settings.host || 'localhost',
            port: settings.port || 8080,
            useSsl: settings.useSsl,
            apiKey: settings.apiKey || '',
            username: settings.username,
            password: settings.password,
            category: settings.category,
            urlBase: settings.urlBase,
          }

          switch (client.type) {
            case 'sabnzbd':
              return sabnzbdService.testConnection(config)
            case 'nzbget':
              return nzbgetService.testConnection(config)
            case 'qbittorrent':
              return qbittorrentService.testConnection(config)
            case 'transmission':
              return transmissionService.testConnection(config)
            case 'deluge':
              return delugeService.testConnection({
                host: config.host,
                port: config.port || 8112,
                password: config.password || '',
                useSsl: config.useSsl,
              })
            default:
              return { success: false, error: 'Unknown client type' }
          }
        })
      )

      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      )

      if (failed.length === clients.length) {
        return {
          name: 'downloadClients',
          status: 'error',
          message: 'All download clients unreachable',
        }
      }

      if (failed.length > 0) {
        return {
          name: 'downloadClients',
          status: 'warning',
          message: `${failed.length}/${clients.length} client(s) unreachable`,
        }
      }

      return {
        name: 'downloadClients',
        status: 'ok',
        message: `${clients.length} client(s) connected`,
      }
    } catch (error) {
      return {
        name: 'downloadClients',
        status: 'error',
        message: error instanceof Error ? error.message : 'Check failed',
      }
    }
  }

  /**
   * Get system info
   */
  async info({ response }: HttpContext) {
    const uptime = Math.floor(process.uptime())

    return response.json({
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime,
      memory: {
        used: Math.round(process.memoryUsage().rss / 1024 / 1024),
        total: Math.round(os.totalmem() / 1024 / 1024),
      },
    })
  }
}
