import logger from '@adonisjs/core/services/logger'
import { webhookService } from '#services/webhooks/webhook_service'
import { notificationService } from '#services/notifications/notification_service'
import { mediaServerService } from '#services/media_servers/media_server_service'
import MediaServerConfig from '#models/media_server_config'
import type { WebhookEvent } from '#models/webhook'
import type { NotificationEvent } from '#models/notification_provider'
import type {
  WebhookPayload,
  GrabEventPayload,
  DownloadCompletedEventPayload,
  ImportCompletedEventPayload,
  ImportFailedEventPayload,
  HealthIssueEventPayload,
  HealthRestoredEventPayload,
  MediaInfo,
  ReleaseInfo,
  FileInfo,
} from '#services/webhooks/webhook_events'

type MediaType = 'music' | 'movies' | 'tv' | 'books'

interface EmitOptions {
  skipWebhooks?: boolean
  skipNotifications?: boolean
}

/**
 * Central event emitter for triggering webhooks and notifications
 */
export class EventEmitter {
  /**
   * Emit a grab event (release sent to download client)
   */
  async emitGrab(
    data: {
      media: MediaInfo
      release: ReleaseInfo
      downloadClient: string
      downloadId: string
    },
    options: EmitOptions = {}
  ): Promise<void> {
    const payload: GrabEventPayload = {
      eventType: 'grab',
      instanceName: process.env.INSTANCE_NAME || 'Hamster',
      applicationUrl: process.env.APP_URL,
      ...data,
    }

    await this.dispatch('grab', payload, this.mapMediaType(data.media.mediaType), options)
  }

  /**
   * Emit a download completed event
   */
  async emitDownloadCompleted(
    data: {
      media: MediaInfo
      release: ReleaseInfo
      downloadClient: string
      downloadId: string
      outputPath: string
    },
    options: EmitOptions = {}
  ): Promise<void> {
    const payload: DownloadCompletedEventPayload = {
      eventType: 'download.completed',
      instanceName: process.env.INSTANCE_NAME || 'Hamster',
      applicationUrl: process.env.APP_URL,
      ...data,
    }

    await this.dispatch(
      'download.completed',
      payload,
      this.mapMediaType(data.media.mediaType),
      options
    )
  }

  /**
   * Emit an import completed event
   */
  async emitImportCompleted(
    data: {
      media: MediaInfo
      files: FileInfo[]
      isUpgrade: boolean
      previousQuality?: string
    },
    options: EmitOptions = {}
  ): Promise<void> {
    const payload: ImportCompletedEventPayload = {
      eventType: 'import.completed',
      instanceName: process.env.INSTANCE_NAME || 'Hamster',
      applicationUrl: process.env.APP_URL,
      ...data,
    }

    await this.dispatch(
      'import.completed',
      payload,
      this.mapMediaType(data.media.mediaType),
      options
    )

    // Also emit upgrade event if this was an upgrade
    if (data.isUpgrade && data.previousQuality) {
      await this.emitUpgrade(
        {
          media: data.media,
          files: data.files,
          previousQuality: data.previousQuality,
          newQuality: data.files[0]?.quality || 'Unknown',
        },
        options
      )
    }
  }

  /**
   * Emit an import failed event
   */
  async emitImportFailed(
    data: {
      media: MediaInfo
      release?: ReleaseInfo
      errorMessage: string
      downloadId?: string
    },
    options: EmitOptions = {}
  ): Promise<void> {
    const payload: ImportFailedEventPayload = {
      eventType: 'import.failed',
      instanceName: process.env.INSTANCE_NAME || 'Hamster',
      applicationUrl: process.env.APP_URL,
      ...data,
    }

    await this.dispatch('import.failed', payload, this.mapMediaType(data.media.mediaType), options)
  }

  /**
   * Emit an upgrade event
   */
  async emitUpgrade(
    data: {
      media: MediaInfo
      files: FileInfo[]
      previousQuality: string
      newQuality: string
    },
    options: EmitOptions = {}
  ): Promise<void> {
    const payload = {
      eventType: 'upgrade' as const,
      instanceName: process.env.INSTANCE_NAME || 'Hamster',
      applicationUrl: process.env.APP_URL,
      ...data,
    }

    await this.dispatch('upgrade', payload, this.mapMediaType(data.media.mediaType), options)
  }

  /**
   * Emit a health issue event
   */
  async emitHealthIssue(
    data: {
      level: 'warning' | 'error'
      source: string
      message: string
      wikiUrl?: string
    },
    options: EmitOptions = {}
  ): Promise<void> {
    const payload: HealthIssueEventPayload = {
      eventType: 'health.issue',
      instanceName: process.env.INSTANCE_NAME || 'Hamster',
      applicationUrl: process.env.APP_URL,
      ...data,
    }

    await this.dispatch('health.issue', payload, undefined, options)
  }

  /**
   * Emit a health restored event
   */
  async emitHealthRestored(
    data: {
      source: string
      message: string
    },
    options: EmitOptions = {}
  ): Promise<void> {
    const payload: HealthRestoredEventPayload = {
      eventType: 'health.restored',
      instanceName: process.env.INSTANCE_NAME || 'Hamster',
      applicationUrl: process.env.APP_URL,
      ...data,
    }

    await this.dispatch('health.restored', payload, undefined, options)
  }

  /**
   * Dispatch event to webhooks and notifications
   */
  private async dispatch(
    event: WebhookEvent & NotificationEvent,
    payload: WebhookPayload,
    mediaType?: MediaType,
    options: EmitOptions = {}
  ): Promise<void> {
    const promises: Promise<unknown>[] = []

    // Send webhooks
    if (!options.skipWebhooks) {
      promises.push(
        webhookService.dispatch(event, payload).catch((error) => {
          logger.error({ event, err: error }, 'Webhook dispatch failed')
        })
      )
    }

    // Send notifications
    if (!options.skipNotifications) {
      const notificationPayload = this.createNotificationPayload(event, payload, mediaType)
      promises.push(
        notificationService.notify(event, notificationPayload).catch((error) => {
          logger.error({ event, err: error }, 'Notification dispatch failed')
        })
      )
    }

    // Trigger media server library refresh on import completed
    if (event === 'import.completed') {
      promises.push(
        this.refreshMediaServers().catch((error) => {
          logger.error({ err: error }, 'Media server refresh failed')
        })
      )
    }

    await Promise.allSettled(promises)
  }

  /**
   * Refresh all enabled media server libraries
   */
  private async refreshMediaServers(): Promise<void> {
    const servers = await MediaServerConfig.query().where('enabled', true)

    for (const server of servers) {
      try {
        await mediaServerService.triggerRefresh({
          type: server.type,
          host: server.host,
          port: server.port,
          apiKey: server.apiKey,
          useSsl: server.useSsl,
          librarySections: server.librarySections,
        })
      } catch (error) {
        logger.error({ server: server.name, err: error }, 'Failed to refresh media server')
      }
    }
  }

  /**
   * Create notification payload from webhook payload
   */
  private createNotificationPayload(
    event: string,
    payload: WebhookPayload,
    mediaType?: MediaType
  ): {
    title: string
    message: string
    mediaType?: MediaType
    imageUrl?: string
  } {
    let title: string
    let message: string
    let imageUrl: string | undefined

    switch (event) {
      case 'grab': {
        const p = payload as GrabEventPayload
        title = `Grabbed: ${p.media?.title || 'Unknown'}`
        message = `Sent to ${p.downloadClient}`
        imageUrl = p.media?.posterUrl
        break
      }
      case 'download.completed': {
        const p = payload as DownloadCompletedEventPayload
        title = `Download Complete: ${p.media?.title || 'Unknown'}`
        message = `Ready for import`
        imageUrl = p.media?.posterUrl
        break
      }
      case 'import.completed': {
        const p = payload as ImportCompletedEventPayload
        title = `Imported: ${p.media?.title || 'Unknown'}`
        message = p.isUpgrade ? `Upgraded from ${p.previousQuality}` : 'Successfully imported'
        imageUrl = p.media?.posterUrl
        break
      }
      case 'import.failed': {
        const p = payload as ImportFailedEventPayload
        title = `Import Failed: ${p.media?.title || 'Unknown'}`
        message = p.errorMessage
        imageUrl = p.media?.posterUrl
        break
      }
      case 'upgrade': {
        const p = payload as unknown as {
          media: MediaInfo
          previousQuality: string
          newQuality: string
        }
        title = `Upgraded: ${p.media?.title || 'Unknown'}`
        message = `${p.previousQuality} → ${p.newQuality}`
        imageUrl = p.media?.posterUrl
        break
      }
      case 'health.issue': {
        const p = payload as HealthIssueEventPayload
        title = `Health Issue: ${p.source}`
        message = p.message
        break
      }
      case 'health.restored': {
        const p = payload as HealthRestoredEventPayload
        title = `Health Restored: ${p.source}`
        message = p.message
        break
      }
      default:
        title = `Hamster: ${event}`
        message = 'Event occurred'
    }

    return {
      title,
      message,
      mediaType,
      imageUrl,
    }
  }

  /**
   * Map media type string to notification media type
   */
  private mapMediaType(type: string): MediaType | undefined {
    switch (type) {
      case 'music':
        return 'music'
      case 'movies':
        return 'movies'
      case 'tv':
        return 'tv'
      case 'books':
        return 'books'
      default:
        return undefined
    }
  }
}

export const eventEmitter = new EventEmitter()
