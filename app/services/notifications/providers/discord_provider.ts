import type { DiscordSettings } from '#models/notification_provider'
import type { NotificationPayload } from '../notification_service.js'

/**
 * Discord webhook notification provider
 */
export class DiscordProvider {
  private readonly DEFAULT_TIMEOUT = 10000

  /**
   * Send notification to Discord webhook
   */
  async send(settings: DiscordSettings, payload: NotificationPayload): Promise<void> {
    const { webhookUrl, username, avatarUrl } = settings

    if (!webhookUrl) {
      throw new Error('Discord webhook URL is required')
    }

    // Build Discord embed
    const embed: Record<string, unknown> = {
      title: payload.title,
      description: payload.message,
      color: this.getColor(payload),
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Hamster',
      },
    }

    if (payload.imageUrl) {
      embed.thumbnail = { url: payload.imageUrl }
    }

    if (payload.url) {
      embed.url = payload.url
    }

    const body: Record<string, unknown> = {
      embeds: [embed],
    }

    if (username) {
      body.username = username
    }

    if (avatarUrl) {
      body.avatar_url = avatarUrl
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Discord webhook failed: ${response.status} ${text}`)
    }
  }

  /**
   * Test Discord webhook connection
   */
  async test(settings: DiscordSettings): Promise<{ success: boolean; error?: string }> {
    try {
      await this.send(settings, {
        title: 'Test Notification',
        message: 'This is a test notification from Hamster.',
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get embed color based on media type
   */
  private getColor(payload: NotificationPayload): number {
    switch (payload.mediaType) {
      case 'music':
        return 0x1db954 // Spotify green
      case 'movies':
        return 0xe50914 // Netflix red
      case 'tv':
        return 0x0077ff // Blue
      case 'books':
        return 0x8b4513 // Brown
      default:
        return 0x5865f2 // Discord blurple
    }
  }
}

export const discordProvider = new DiscordProvider()
