import type { HttpContext } from '@adonisjs/core/http'
import Webhook from '#models/webhook'
import vine from '@vinejs/vine'
import { webhookService } from '#services/webhooks/webhook_service'

const webhookValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    url: vine.string().url(),
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

export default class WebhooksController {
  /**
   * List all webhooks
   */
  async index({ response }: HttpContext) {
    const webhooks = await Webhook.query().orderBy('name', 'asc')
    return response.json(webhooks)
  }

  /**
   * Create a new webhook
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(webhookValidator)

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

    return response.created(webhook)
  }

  /**
   * Get a single webhook
   */
  async show({ params, response }: HttpContext) {
    const webhook = await Webhook.find(params.id)
    if (!webhook) {
      return response.notFound({ error: 'Webhook not found' })
    }
    return response.json(webhook)
  }

  /**
   * Update a webhook
   */
  async update({ params, request, response }: HttpContext) {
    const webhook = await Webhook.find(params.id)
    if (!webhook) {
      return response.notFound({ error: 'Webhook not found' })
    }

    const data = await request.validateUsing(webhookValidator)

    webhook.merge({
      name: data.name,
      url: data.url,
      enabled: data.enabled ?? webhook.enabled,
      method: data.method ?? webhook.method,
      headers: data.headers ?? webhook.headers,
      payloadTemplate: data.payloadTemplate ?? webhook.payloadTemplate,
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

    return response.json(webhook)
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
