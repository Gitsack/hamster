import type { HttpContext } from '@adonisjs/core/http'
import Webhook from '#models/webhook'
import WebhookHistory from '#models/webhook_history'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { webhookService } from '#services/webhooks/webhook_service'
import {
  maskWebhookHeaders,
  maskWebhookUrl,
  restoreWebhookHeaders,
  restoreWebhookUrl,
} from '#services/webhooks/webhook_secrets'

// Self-hosted services live at LAN or Docker hostnames (http://jellyfin:8096),
// which have no TLD.
const LAN_URL = { require_tld: false, allow_underscores: true }

const webhookValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    url: vine.string().url(LAN_URL),
    enabled: vine.boolean().optional(),
    method: vine.enum(['GET', 'POST', 'PUT', 'PATCH'] as const).optional(),
    headers: vine.record(vine.string()).optional(),
    payloadTemplate: vine.string().nullable().optional(),
    onGrab: vine.boolean().optional(),
    onDownloadComplete: vine.boolean().optional(),
    onImportComplete: vine.boolean().optional(),
    onImportFailed: vine.boolean().optional(),
    onUpgrade: vine.boolean().optional(),
    onRename: vine.boolean().optional(),
    onDelete: vine.boolean().optional(),
    onHealthIssue: vine.boolean().optional(),
    onHealthRestored: vine.boolean().optional(),
  })
)

/**
 * Validate the body only. request.validateUsing() also mixes the request's own
 * `headers`, `params` and `cookies` into the data, and the request headers
 * would win over the webhook's `headers` field: the browser's Host, Cookie and
 * session would be stored and sent with every delivery.
 */
const validateBody = (request: HttpContext['request']) =>
  request.validateUsing(webhookValidator, { data: request.all() })

/** The most recent delivery attempt, shown on the target row. */
export interface LastDelivery {
  success: boolean
  status: number | null
  error: string | null
  createdAt: string
}

/**
 * A webhook as the API shows it: credentials in the URL and headers masked.
 * They are restored from the stored row on update, so the masked form is safe
 * to send straight back.
 */
function present(webhook: Webhook, lastDelivery?: LastDelivery | null) {
  return {
    ...webhook.toJSON(),
    url: maskWebhookUrl(webhook.url),
    headers: maskWebhookHeaders(webhook.headers),
    ...(lastDelivery !== undefined ? { lastDelivery } : {}),
  }
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return new Date(String(value)).toISOString()
}

export default class WebhooksController {
  /**
   * List all webhooks, each with its last delivery attempt
   */
  async index({ response }: HttpContext) {
    const webhooks = await Webhook.query().orderBy('name', 'asc')

    // One row per webhook: its newest history entry.
    const rows: {
      webhook_id: string
      success: boolean
      response_status: number | null
      error_message: string | null
      created_at: Date | string
    }[] = await db
      .from('webhook_history')
      .distinctOn('webhook_id')
      .select('webhook_id', 'success', 'response_status', 'error_message', 'created_at')
      .orderBy('webhook_id', 'asc')
      .orderBy('created_at', 'desc')
    const last = new Map<string, LastDelivery>(
      rows.map((row) => [
        row.webhook_id,
        {
          success: row.success,
          status: row.response_status,
          error: row.error_message,
          createdAt: toIso(row.created_at),
        },
      ])
    )

    return response.json(webhooks.map((webhook) => present(webhook, last.get(webhook.id) ?? null)))
  }

  /**
   * Create a new webhook
   */
  async store({ request, response }: HttpContext) {
    const data = await validateBody(request)

    const webhook = await Webhook.create({
      name: data.name,
      url: data.url,
      enabled: data.enabled ?? true,
      method: data.method ?? 'POST',
      events: [],
      headers: data.headers ?? null,
      payloadTemplate: data.payloadTemplate ?? null,
      onGrab: data.onGrab ?? true,
      onDownloadComplete: data.onDownloadComplete ?? true,
      onImportComplete: data.onImportComplete ?? true,
      onImportFailed: data.onImportFailed ?? true,
      onUpgrade: data.onUpgrade ?? true,
      onRename: data.onRename ?? false,
      onDelete: data.onDelete ?? false,
      onHealthIssue: data.onHealthIssue ?? true,
      onHealthRestored: data.onHealthRestored ?? false,
    })

    return response.created(present(webhook))
  }

  /**
   * Get a single webhook
   */
  async show({ params, response }: HttpContext) {
    const webhook = await Webhook.find(params.id)
    if (!webhook) {
      return response.notFound({ error: 'Webhook not found' })
    }
    return response.json(present(webhook))
  }

  /**
   * Update a webhook
   */
  async update({ params, request, response }: HttpContext) {
    const webhook = await Webhook.find(params.id)
    if (!webhook) {
      return response.notFound({ error: 'Webhook not found' })
    }

    const data = await validateBody(request)

    // The editor was given masked values; whatever still reads "****" keeps what is stored.
    const url = restoreWebhookUrl(data.url, webhook.url)
    if (url === null) {
      return response.unprocessableEntity({
        error:
          'The URL still contains a masked value (****) that does not match the stored one. Type the full URL again.',
      })
    }
    let headers = webhook.headers
    if (data.headers !== undefined) {
      headers = restoreWebhookHeaders(data.headers, webhook.headers)
      if (headers === null) {
        return response.unprocessableEntity({
          error: 'A header still reads **** but has no stored value. Type the header value again.',
        })
      }
    }

    webhook.merge({
      name: data.name,
      url,
      enabled: data.enabled ?? webhook.enabled,
      method: data.method ?? webhook.method,
      headers,
      // null clears the template; leaving it out keeps it.
      payloadTemplate:
        data.payloadTemplate !== undefined ? data.payloadTemplate : webhook.payloadTemplate,
      onGrab: data.onGrab ?? webhook.onGrab,
      onDownloadComplete: data.onDownloadComplete ?? webhook.onDownloadComplete,
      onImportComplete: data.onImportComplete ?? webhook.onImportComplete,
      onImportFailed: data.onImportFailed ?? webhook.onImportFailed,
      onUpgrade: data.onUpgrade ?? webhook.onUpgrade,
      onRename: data.onRename ?? webhook.onRename,
      onDelete: data.onDelete ?? webhook.onDelete,
      onHealthIssue: data.onHealthIssue ?? webhook.onHealthIssue,
      onHealthRestored: data.onHealthRestored ?? webhook.onHealthRestored,
    })
    await webhook.save()

    return response.json(present(webhook))
  }

  /**
   * Delete a webhook
   */
  async destroy({ params, response }: HttpContext) {
    const webhook = await Webhook.find(params.id)
    if (!webhook) {
      return response.notFound({ error: 'Webhook not found' })
    }

    await webhook.delete()
    return response.noContent()
  }

  /**
   * Test a webhook
   */
  async test({ params, response }: HttpContext) {
    const webhook = await Webhook.find(params.id)
    if (!webhook) {
      return response.notFound({ error: 'Webhook not found' })
    }

    const result = await webhookService.testWebhook(webhook)

    return response.json({
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
    })
  }

  /**
   * Delivery attempts across every webhook, newest first
   */
  async allHistory({ request, response }: HttpContext) {
    const { limit = 50, offset = 0 } = request.qs()

    const history = await webhookService.getHistory({
      limit: Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 200),
      offset: Math.max(Number.parseInt(offset, 10) || 0, 0),
    })

    return response.json(history)
  }

  /**
   * Clear the delivery log of every webhook
   */
  async clearAllHistory({ response }: HttpContext) {
    await WebhookHistory.query().delete()
    return response.noContent()
  }

  /**
   * Get webhook history
   */
  async history({ params, request, response }: HttpContext) {
    const { limit = 50, offset = 0 } = request.qs()

    const history = await webhookService.getHistory({
      webhookId: params.id,
      limit: Number.parseInt(limit, 10),
      offset: Number.parseInt(offset, 10),
    })

    return response.json(history)
  }

  /**
   * Clear webhook history
   */
  async clearHistory({ params, response }: HttpContext) {
    const webhook = await Webhook.find(params.id)
    if (!webhook) {
      return response.notFound({ error: 'Webhook not found' })
    }

    await webhook.related('history').query().delete()
    return response.noContent()
  }
}
