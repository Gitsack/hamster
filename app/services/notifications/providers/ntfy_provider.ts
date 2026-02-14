import type { NtfySettings } from '#models/notification_provider'
import type { NotificationPayload } from '../notification_service.js'

/**
 * Ntfy notification provider
 * Sends notifications via the ntfy pub/sub REST API
 */
export class NtfyProvider {
  private readonly DEFAULT_SERVER = 'https://ntfy.sh'
  private readonly DEFAULT_TIMEOUT = 10000

  /**
   * Send notification via ntfy
   */
  async send(settings: NtfySettings, payload: NotificationPayload): Promise<void> {
    const { serverUrl, topic, username, password, priority = 3 } = settings

    if (!topic) {
      throw new Error('Ntfy topic is required')
    }

    const baseUrl = (serverUrl || this.DEFAULT_SERVER).replace(/\/+$/, '')
    const url = `${baseUrl}/${topic}`

    const headers: Record<string, string> = {
      Title: payload.title,
      Priority: String(priority),
      Tags: this.getTags(payload),
    }

    if (payload.url) {
      headers['Click'] = payload.url
    }

    if (payload.imageUrl) {
      headers['Attach'] = payload.imageUrl
    }

    if (username && password) {
      headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payload.message,
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Ntfy error: ${response.status} ${text}`)
    }
  }

  /**
   * Test ntfy connection by sending a test notification
   */
  async test(settings: NtfySettings): Promise<{ success: boolean; error?: string }> {
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
   * Get ntfy tags based on media type
   */
  private getTags(payload: NotificationPayload): string {
    switch (payload.mediaType) {
      case 'music':
        return 'musical_note'
      case 'movies':
        return 'movie_camera'
      case 'tv':
        return 'tv'
      case 'books':
        return 'books'
      default:
        return 'hamster'
    }
  }
}

export const ntfyProvider = new NtfyProvider()
