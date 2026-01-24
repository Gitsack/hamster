import type { GotifySettings } from '#models/notification_provider'
import type { NotificationPayload } from '../notification_service.js'

/**
 * Gotify notification provider
 */
export class GotifyProvider {
  private readonly DEFAULT_TIMEOUT = 10000

  /**
   * Send notification to Gotify server
   */
  async send(settings: GotifySettings, payload: NotificationPayload): Promise<void> {
    const { serverUrl, appToken, priority = 5 } = settings

    if (!serverUrl || !appToken) {
      throw new Error('Gotify server URL and app token are required')
    }

    // Ensure URL doesn't end with /
    const baseUrl = serverUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/message`

    // Build message with markdown for extras
    const body: Record<string, unknown> = {
      title: payload.title,
      message: payload.message,
      priority,
    }

    // Add extras for rich content
    const extras: Record<string, unknown> = {
      'client::display': {
        contentType: 'text/markdown',
      },
    }

    if (payload.url) {
      extras['client::notification'] = {
        click: {
          url: payload.url,
        },
      }
    }

    body.extras = extras

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gotify-Key': appToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        errorDescription?: string
      }
      throw new Error(`Gotify error: ${data.errorDescription || data.error || response.status}`)
    }
  }

  /**
   * Test Gotify connection
   */
  async test(settings: GotifySettings): Promise<{ success: boolean; error?: string }> {
    try {
      // First verify server is reachable
      const baseUrl = settings.serverUrl.replace(/\/+$/, '')
      const healthUrl = `${baseUrl}/health`

      const healthResponse = await fetch(healthUrl, {
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      })

      if (!healthResponse.ok) {
        throw new Error('Gotify server not reachable')
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
}

export const gotifyProvider = new GotifyProvider()
