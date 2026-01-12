import type { PushoverSettings } from '#models/notification_provider'
import type { NotificationPayload } from '../notification_service.js'

/**
 * Pushover notification provider
 */
export class PushoverProvider {
  private readonly API_URL = 'https://api.pushover.net/1/messages.json'
  private readonly DEFAULT_TIMEOUT = 10000

  /**
   * Send notification via Pushover
   */
  async send(settings: PushoverSettings, payload: NotificationPayload): Promise<void> {
    const { apiToken, userKey, priority = 0, sound } = settings

    if (!apiToken || !userKey) {
      throw new Error('Pushover API token and user key are required')
    }

    const body: Record<string, string | number> = {
      token: apiToken,
      user: userKey,
      title: payload.title,
      message: payload.message,
      priority,
      html: 1,
    }

    if (sound) {
      body.sound = sound
    }

    if (payload.url) {
      body.url = payload.url
      body.url_title = 'View in Hamster'
    }

    // For high priority, emergency priority requires retry and expire
    if (priority === 2) {
      body.retry = 60 // Retry every 60 seconds
      body.expire = 3600 // Expire after 1 hour
    }

    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body as Record<string, string>).toString(),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { errors?: string[] }
      throw new Error(`Pushover error: ${data.errors?.join(', ') || response.status}`)
    }

    const result = await response.json() as { status: number; errors?: string[] }
    if (result.status !== 1) {
      throw new Error(`Pushover error: ${result.errors?.join(', ') || 'Unknown error'}`)
    }
  }

  /**
   * Test Pushover connection
   */
  async test(settings: PushoverSettings): Promise<{ success: boolean; error?: string }> {
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
   * Validate Pushover user/group key
   */
  async validateUser(settings: PushoverSettings): Promise<{ success: boolean; error?: string }> {
    const { apiToken, userKey } = settings

    const response = await fetch('https://api.pushover.net/1/users/validate.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: apiToken,
        user: userKey,
      }).toString(),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    })

    const result = await response.json() as { status: number; errors?: string[] }

    if (result.status === 1) {
      return { success: true }
    }

    return {
      success: false,
      error: result.errors?.join(', ') || 'Invalid user key',
    }
  }
}

export const pushoverProvider = new PushoverProvider()
