import type { TelegramSettings } from '#models/notification_provider'
import type { NotificationPayload } from '../notification_service.js'

/**
 * Telegram bot notification provider
 */
export class TelegramProvider {
  private readonly API_BASE = 'https://api.telegram.org/bot'
  private readonly DEFAULT_TIMEOUT = 10000

  /**
   * Send notification via Telegram bot
   */
  async send(settings: TelegramSettings, payload: NotificationPayload): Promise<void> {
    const { botToken, chatId } = settings

    if (!botToken || !chatId) {
      throw new Error('Telegram bot token and chat ID are required')
    }

    // Format message with HTML
    const text = this.formatMessage(payload)

    const url = `${this.API_BASE}${botToken}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: !payload.imageUrl,
      }),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { description?: string }
      throw new Error(`Telegram API error: ${data.description || response.status}`)
    }

    const result = (await response.json()) as { ok: boolean; description?: string }
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description || 'Unknown error'}`)
    }
  }

  /**
   * Test Telegram bot connection
   */
  async test(settings: TelegramSettings): Promise<{ success: boolean; error?: string }> {
    try {
      // First verify the bot token is valid
      const { botToken } = settings
      const meUrl = `${this.API_BASE}${botToken}/getMe`
      const meResponse = await fetch(meUrl, {
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      })

      if (!meResponse.ok) {
        throw new Error('Invalid bot token')
      }

      // Then send a test message
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
   * Format message with HTML tags
   */
  private formatMessage(payload: NotificationPayload): string {
    let message = `<b>${this.escapeHtml(payload.title)}</b>\n\n`
    message += this.escapeHtml(payload.message)

    if (payload.url) {
      message += `\n\n<a href="${payload.url}">View in Hamster</a>`
    }

    return message
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

export const telegramProvider = new TelegramProvider()
