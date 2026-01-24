import type { SlackSettings } from '#models/notification_provider'
import type { NotificationPayload } from '../notification_service.js'

/**
 * Slack webhook notification provider
 */
export class SlackProvider {
  private readonly DEFAULT_TIMEOUT = 10000

  /**
   * Send notification to Slack webhook
   */
  async send(settings: SlackSettings, payload: NotificationPayload): Promise<void> {
    const { webhookUrl, channel, username, iconUrl } = settings

    if (!webhookUrl) {
      throw new Error('Slack webhook URL is required')
    }

    // Build Slack message with blocks for rich formatting
    const body: Record<string, unknown> = {
      text: payload.title, // Fallback for notifications
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: payload.title,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: payload.message,
          },
        },
      ],
    }

    // Add image if provided
    if (payload.imageUrl) {
      ;(body.blocks as unknown[]).push({
        type: 'image',
        image_url: payload.imageUrl,
        alt_text: payload.title,
      })
    }

    // Add link button if URL provided
    if (payload.url) {
      ;(body.blocks as unknown[]).push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View in Hamster',
              emoji: true,
            },
            url: payload.url,
          },
        ],
      })
    }

    // Add context footer
    ;(body.blocks as unknown[]).push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent by *Hamster* at ${new Date().toLocaleString()}`,
        },
      ],
    })

    if (channel) {
      body.channel = channel
    }

    if (username) {
      body.username = username
    }

    if (iconUrl) {
      body.icon_url = iconUrl
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
      throw new Error(`Slack webhook failed: ${response.status} ${text}`)
    }
  }

  /**
   * Test Slack webhook connection
   */
  async test(settings: SlackSettings): Promise<{ success: boolean; error?: string }> {
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
}

export const slackProvider = new SlackProvider()
