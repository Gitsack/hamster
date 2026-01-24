import NotificationProvider, { type NotificationEvent } from '#models/notification_provider'
import NotificationHistory from '#models/notification_history'
import { discordProvider } from './providers/discord_provider.js'
import { telegramProvider } from './providers/telegram_provider.js'
import { pushoverProvider } from './providers/pushover_provider.js'
import { slackProvider } from './providers/slack_provider.js'
import { gotifyProvider } from './providers/gotify_provider.js'
import { emailProvider } from './providers/email_provider.js'

export interface NotificationPayload {
  title: string
  message: string
  mediaType?: 'music' | 'movies' | 'tv' | 'books'
  imageUrl?: string
  url?: string
}

export interface NotificationResult {
  providerId: string
  success: boolean
  error?: string
}

/**
 * Service for sending notifications through various providers
 */
export class NotificationService {
  /**
   * Send notification for an event to all matching providers
   */
  async notify(
    event: NotificationEvent,
    payload: NotificationPayload
  ): Promise<NotificationResult[]> {
    const providers = await NotificationProvider.query().where('enabled', true)
    const results: NotificationResult[] = []

    for (const provider of providers) {
      if (provider.shouldNotify(event, payload.mediaType)) {
        const result = await this.sendToProvider(provider, event, payload)
        results.push(result)
      }
    }

    return results
  }

  /**
   * Send notification to a specific provider
   */
  async sendToProvider(
    provider: NotificationProvider,
    event: NotificationEvent,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    const result: NotificationResult = {
      providerId: provider.id,
      success: false,
    }

    try {
      // Cast settings through unknown first for type safety
      const settings = provider.settings as unknown

      switch (provider.type) {
        case 'discord':
          await discordProvider.send(
            settings as Parameters<typeof discordProvider.send>[0],
            payload
          )
          break
        case 'telegram':
          await telegramProvider.send(
            settings as Parameters<typeof telegramProvider.send>[0],
            payload
          )
          break
        case 'pushover':
          await pushoverProvider.send(
            settings as Parameters<typeof pushoverProvider.send>[0],
            payload
          )
          break
        case 'slack':
          await slackProvider.send(settings as Parameters<typeof slackProvider.send>[0], payload)
          break
        case 'gotify':
          await gotifyProvider.send(settings as Parameters<typeof gotifyProvider.send>[0], payload)
          break
        case 'email':
          await emailProvider.send(settings as Parameters<typeof emailProvider.send>[0], payload)
          break
        default:
          throw new Error(`Unknown provider type: ${provider.type}`)
      }

      result.success = true

      // Log success
      await NotificationHistory.create({
        providerId: provider.id,
        eventType: event,
        title: payload.title,
        message: payload.message,
        success: true,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.error = errorMessage

      // Log failure
      await NotificationHistory.create({
        providerId: provider.id,
        eventType: event,
        title: payload.title,
        message: payload.message,
        success: false,
        errorMessage,
      })
    }

    return result
  }

  /**
   * Test a notification provider
   */
  async testProvider(provider: NotificationProvider): Promise<NotificationResult> {
    const testPayload: NotificationPayload = {
      title: 'Test Notification',
      message:
        'This is a test notification from Hamster. If you can see this, notifications are working!',
    }

    return this.sendToProvider(provider, 'health.restored', testPayload)
  }

  /**
   * Get notification history
   */
  async getHistory(options: {
    providerId?: string
    limit?: number
    offset?: number
  }): Promise<NotificationHistory[]> {
    const query = NotificationHistory.query().orderBy('createdAt', 'desc')

    if (options.providerId) {
      query.where('providerId', options.providerId)
    }

    if (options.limit) {
      query.limit(options.limit)
    }

    if (options.offset) {
      query.offset(options.offset)
    }

    return query
  }

  /**
   * Clean up old notification history
   */
  async cleanupHistory(olderThanDays = 30): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)

    const result = await NotificationHistory.query()
      .where('createdAt', '<', cutoff.toISOString())
      .delete()

    return Array.isArray(result) ? result.length : (result as number)
  }

  /**
   * Create notification payload from event data
   */
  createPayload(
    event: NotificationEvent,
    data: {
      mediaTitle?: string
      mediaType?: 'music' | 'movies' | 'tv' | 'books'
      quality?: string
      releaseTitle?: string
      indexer?: string
      errorMessage?: string
      imageUrl?: string
    }
  ): NotificationPayload {
    let title: string
    let message: string

    switch (event) {
      case 'grab':
        title = `Grabbed: ${data.mediaTitle}`
        message = `${data.releaseTitle || 'Unknown release'} from ${data.indexer || 'Unknown indexer'}`
        break
      case 'download.completed':
        title = `Download Complete: ${data.mediaTitle}`
        message = `${data.releaseTitle || 'Unknown release'} has finished downloading`
        break
      case 'import.completed':
        title = `Imported: ${data.mediaTitle}`
        message = `Successfully imported ${data.quality || 'unknown quality'}`
        break
      case 'import.failed':
        title = `Import Failed: ${data.mediaTitle}`
        message = data.errorMessage || 'Unknown error occurred during import'
        break
      case 'upgrade':
        title = `Upgraded: ${data.mediaTitle}`
        message = `Upgraded to ${data.quality || 'higher quality'}`
        break
      case 'health.issue':
        title = 'Health Issue Detected'
        message = data.errorMessage || 'A health issue was detected'
        break
      case 'health.restored':
        title = 'Health Restored'
        message = data.errorMessage || 'Previous health issue has been resolved'
        break
      default:
        title = `Hamster: ${event}`
        message = data.mediaTitle || 'Event occurred'
    }

    return {
      title,
      message,
      mediaType: data.mediaType,
      imageUrl: data.imageUrl,
    }
  }
}

export const notificationService = new NotificationService()
