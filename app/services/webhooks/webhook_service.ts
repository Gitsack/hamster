import Webhook, { type WebhookEvent } from '#models/webhook'
import WebhookHistory from '#models/webhook_history'
import type { WebhookPayload } from './webhook_events.js'

export interface WebhookDeliveryResult {
  webhookId: string
  success: boolean
  statusCode?: number
  error?: string
}

/**
 * Service for managing and dispatching webhooks
 */
export class WebhookService {
  private readonly DEFAULT_TIMEOUT = 30000 // 30 seconds

  /**
   * Dispatch an event to all matching webhooks
   */
  async dispatch(event: WebhookEvent, payload: WebhookPayload): Promise<WebhookDeliveryResult[]> {
    const webhooks = await Webhook.query().where('enabled', true)
    const results: WebhookDeliveryResult[] = []

    for (const webhook of webhooks) {
      if (webhook.shouldTrigger(event)) {
        const result = await this.deliverWebhook(webhook, event, payload)
        results.push(result)
      }
    }

    return results
  }

  /**
   * Deliver payload to a single webhook
   */
  async deliverWebhook(
    webhook: Webhook,
    event: WebhookEvent,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const result: WebhookDeliveryResult = {
      webhookId: webhook.id,
      success: false,
    }

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'User-Agent': 'Hamster/1.0',
        'X-Hamster-Event': event,
        ...webhook.headers,
      }

      // Prepare body (only for non-GET requests)
      let body: string | undefined
      if (webhook.method !== 'GET') {
        headers['Content-Type'] = 'application/json'
        if (webhook.payloadTemplate) {
          body = this.renderTemplate(webhook.payloadTemplate, payload)
        } else {
          body = JSON.stringify(payload)
        }
      }

      // Send request
      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
        body,
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      })

      result.statusCode = response.status
      result.success = response.ok

      // Get response body for logging
      let responseBody: string | null = null
      try {
        responseBody = await response.text()
      } catch {
        // Ignore response body read errors
      }

      // Log to history
      await WebhookHistory.create({
        webhookId: webhook.id,
        eventType: event,
        payload: payload as unknown as Record<string, unknown>,
        responseStatus: response.status,
        responseBody: responseBody?.substring(0, 10000) || null,
        success: response.ok,
        errorMessage: response.ok ? null : `HTTP ${response.status}`,
      })

      if (!response.ok) {
        result.error = `HTTP ${response.status}`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.error = errorMessage

      // Log failure to history
      await WebhookHistory.create({
        webhookId: webhook.id,
        eventType: event,
        payload: payload as unknown as Record<string, unknown>,
        responseStatus: null,
        responseBody: null,
        success: false,
        errorMessage,
      })
    }

    return result
  }

  /**
   * Test a webhook by sending a test payload
   */
  async testWebhook(webhook: Webhook): Promise<WebhookDeliveryResult> {
    const testPayload: WebhookPayload = {
      eventType: 'health.restored',
      instanceName: process.env.INSTANCE_NAME || 'Hamster',
      applicationUrl: process.env.APP_URL,
      source: 'WebhookTest',
      message: 'This is a test notification from Hamster',
    }

    return this.deliverWebhook(webhook, 'health.restored', testPayload)
  }

  /**
   * Render a custom payload template with variables
   */
  private renderTemplate(template: string, payload: WebhookPayload): string {
    let result = template

    // Replace template variables like {{eventType}}, {{media.title}}, etc.
    const replaceValue = (obj: Record<string, unknown>, prefix = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          replaceValue(value as Record<string, unknown>, fullKey)
        } else {
          const placeholder = `{{${fullKey}}}`
          const stringValue = value === null || value === undefined ? '' : String(value)
          result = result.replaceAll(placeholder, stringValue)
        }
      }
    }

    replaceValue(payload as unknown as Record<string, unknown>)
    return result
  }

  /**
   * Get webhook history with optional filters
   */
  async getHistory(options: {
    webhookId?: string
    limit?: number
    offset?: number
  }): Promise<WebhookHistory[]> {
    const query = WebhookHistory.query().orderBy('createdAt', 'desc')

    if (options.webhookId) {
      query.where('webhookId', options.webhookId)
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
   * Clean up old webhook history entries
   */
  async cleanupHistory(olderThanDays = 30): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)

    const result = await WebhookHistory.query()
      .where('createdAt', '<', cutoff.toISOString())
      .delete()

    return Array.isArray(result) ? result.length : (result as number)
  }
}

export const webhookService = new WebhookService()
