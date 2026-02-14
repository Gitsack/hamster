import type { HttpContext } from '@adonisjs/core/http'
import NotificationProvider from '#models/notification_provider'
import vine from '@vinejs/vine'
import { notificationService } from '#services/notifications/notification_service'

const notificationProviderValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    type: vine.enum([
      'email',
      'discord',
      'telegram',
      'pushover',
      'slack',
      'gotify',
      'ntfy',
    ] as const),
    enabled: vine.boolean().optional(),
    settings: vine.record(vine.any()),
    onGrab: vine.boolean().optional(),
    onDownloadComplete: vine.boolean().optional(),
    onImportComplete: vine.boolean().optional(),
    onImportFailed: vine.boolean().optional(),
    onUpgrade: vine.boolean().optional(),
    onRename: vine.boolean().optional(),
    onDelete: vine.boolean().optional(),
    onHealthIssue: vine.boolean().optional(),
    onHealthRestored: vine.boolean().optional(),
    includeMusic: vine.boolean().optional(),
    includeMovies: vine.boolean().optional(),
    includeTv: vine.boolean().optional(),
    includeBooks: vine.boolean().optional(),
  })
)

export default class NotificationsController {
  /**
   * List all notification providers
   */
  async index({ response }: HttpContext) {
    const providers = await NotificationProvider.query().orderBy('name', 'asc')

    // Hide sensitive settings in response
    const safeProviders = providers.map((p) => ({
      ...p.toJSON(),
      settings: this.maskSensitiveSettings(p.type, p.settings),
    }))

    return response.json(safeProviders)
  }

  /**
   * Create a new notification provider
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(notificationProviderValidator)

    const provider = await NotificationProvider.create({
      name: data.name,
      type: data.type,
      enabled: data.enabled ?? true,
      settings: data.settings as unknown as NotificationProvider['settings'],
      onGrab: data.onGrab ?? false,
      onDownloadComplete: data.onDownloadComplete ?? true,
      onImportComplete: data.onImportComplete ?? true,
      onImportFailed: data.onImportFailed ?? true,
      onUpgrade: data.onUpgrade ?? true,
      onRename: data.onRename ?? false,
      onDelete: data.onDelete ?? false,
      onHealthIssue: data.onHealthIssue ?? true,
      onHealthRestored: data.onHealthRestored ?? false,
      includeMusic: data.includeMusic ?? true,
      includeMovies: data.includeMovies ?? true,
      includeTv: data.includeTv ?? true,
      includeBooks: data.includeBooks ?? true,
    })

    return response.created({
      ...provider.toJSON(),
      settings: this.maskSensitiveSettings(provider.type, provider.settings),
    })
  }

  /**
   * Get a single notification provider
   */
  async show({ params, response }: HttpContext) {
    const provider = await NotificationProvider.find(params.id)
    if (!provider) {
      return response.notFound({ error: 'Notification provider not found' })
    }

    return response.json({
      ...provider.toJSON(),
      settings: this.maskSensitiveSettings(provider.type, provider.settings),
    })
  }

  /**
   * Update a notification provider
   */
  async update({ params, request, response }: HttpContext) {
    const provider = await NotificationProvider.find(params.id)
    if (!provider) {
      return response.notFound({ error: 'Notification provider not found' })
    }

    const data = await request.validateUsing(notificationProviderValidator)

    // Merge settings, preserving existing values for masked fields
    const updatedSettings = this.mergeSettings(provider.settings, data.settings)

    provider.merge({
      name: data.name,
      type: data.type,
      enabled: data.enabled ?? provider.enabled,
      settings: updatedSettings as unknown as NotificationProvider['settings'],
      onGrab: data.onGrab ?? provider.onGrab,
      onDownloadComplete: data.onDownloadComplete ?? provider.onDownloadComplete,
      onImportComplete: data.onImportComplete ?? provider.onImportComplete,
      onImportFailed: data.onImportFailed ?? provider.onImportFailed,
      onUpgrade: data.onUpgrade ?? provider.onUpgrade,
      onRename: data.onRename ?? provider.onRename,
      onDelete: data.onDelete ?? provider.onDelete,
      onHealthIssue: data.onHealthIssue ?? provider.onHealthIssue,
      onHealthRestored: data.onHealthRestored ?? provider.onHealthRestored,
      includeMusic: data.includeMusic ?? provider.includeMusic,
      includeMovies: data.includeMovies ?? provider.includeMovies,
      includeTv: data.includeTv ?? provider.includeTv,
      includeBooks: data.includeBooks ?? provider.includeBooks,
    })
    await provider.save()

    return response.json({
      ...provider.toJSON(),
      settings: this.maskSensitiveSettings(provider.type, provider.settings),
    })
  }

  /**
   * Delete a notification provider
   */
  async destroy({ params, response }: HttpContext) {
    const provider = await NotificationProvider.find(params.id)
    if (!provider) {
      return response.notFound({ error: 'Notification provider not found' })
    }

    await provider.delete()
    return response.noContent()
  }

  /**
   * Test a notification provider
   */
  async test({ params, response }: HttpContext) {
    const provider = await NotificationProvider.find(params.id)
    if (!provider) {
      return response.notFound({ error: 'Notification provider not found' })
    }

    const result = await notificationService.testProvider(provider)

    return response.json({
      success: result.success,
      error: result.error,
    })
  }

  /**
   * Get notification history
   */
  async history({ request, response }: HttpContext) {
    const { providerId, limit = 50, offset = 0 } = request.qs()

    const history = await notificationService.getHistory({
      providerId,
      limit: Number.parseInt(limit, 10),
      offset: Number.parseInt(offset, 10),
    })

    return response.json(history)
  }

  /**
   * Get available notification provider types
   */
  async types({ response }: HttpContext) {
    return response.json([
      {
        type: 'discord',
        name: 'Discord',
        fields: [
          { name: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true },
          { name: 'username', label: 'Username', type: 'text', required: false },
          { name: 'avatarUrl', label: 'Avatar URL', type: 'url', required: false },
        ],
      },
      {
        type: 'telegram',
        name: 'Telegram',
        fields: [
          { name: 'botToken', label: 'Bot Token', type: 'password', required: true },
          { name: 'chatId', label: 'Chat ID', type: 'text', required: true },
        ],
      },
      {
        type: 'pushover',
        name: 'Pushover',
        fields: [
          { name: 'apiToken', label: 'API Token', type: 'password', required: true },
          { name: 'userKey', label: 'User Key', type: 'password', required: true },
          { name: 'priority', label: 'Priority', type: 'number', required: false },
          { name: 'sound', label: 'Sound', type: 'text', required: false },
        ],
      },
      {
        type: 'slack',
        name: 'Slack',
        fields: [
          { name: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true },
          { name: 'channel', label: 'Channel', type: 'text', required: false },
          { name: 'username', label: 'Username', type: 'text', required: false },
        ],
      },
      {
        type: 'gotify',
        name: 'Gotify',
        fields: [
          { name: 'serverUrl', label: 'Server URL', type: 'url', required: true },
          { name: 'appToken', label: 'App Token', type: 'password', required: true },
          { name: 'priority', label: 'Priority', type: 'number', required: false },
        ],
      },
      {
        type: 'email',
        name: 'Email',
        fields: [
          { name: 'host', label: 'SMTP Host', type: 'text', required: true },
          { name: 'port', label: 'SMTP Port', type: 'number', required: true },
          { name: 'secure', label: 'Use SSL/TLS', type: 'boolean', required: false },
          { name: 'username', label: 'Username', type: 'text', required: false },
          { name: 'password', label: 'Password', type: 'password', required: false },
          { name: 'from', label: 'From Address', type: 'email', required: true },
          { name: 'to', label: 'To Address', type: 'email', required: true },
        ],
      },
      {
        type: 'ntfy',
        name: 'Ntfy',
        fields: [
          {
            name: 'serverUrl',
            label: 'Server URL',
            type: 'url',
            required: false,
            placeholder: 'https://ntfy.sh',
          },
          { name: 'topic', label: 'Topic', type: 'text', required: true },
          { name: 'username', label: 'Username', type: 'text', required: false },
          { name: 'password', label: 'Password', type: 'password', required: false },
          { name: 'priority', label: 'Priority (1-5)', type: 'number', required: false },
        ],
      },
    ])
  }

  /**
   * Mask sensitive settings for API responses
   */
  private maskSensitiveSettings(type: string, settings: unknown): Record<string, unknown> {
    const settingsObj = settings as Record<string, unknown>
    const sensitiveFields: Record<string, string[]> = {
      discord: ['webhookUrl'],
      telegram: ['botToken'],
      pushover: ['apiToken', 'userKey'],
      slack: ['webhookUrl'],
      gotify: ['appToken'],
      email: ['password'],
      ntfy: ['password'],
    }

    const fieldsToMask = sensitiveFields[type] || []
    const masked = { ...settingsObj }

    for (const field of fieldsToMask) {
      if (masked[field] && typeof masked[field] === 'string') {
        const value = masked[field] as string
        if (value.length > 8) {
          masked[field] = value.substring(0, 4) + '****' + value.substring(value.length - 4)
        } else {
          masked[field] = '****'
        }
      }
    }

    return masked
  }

  /**
   * Merge settings, keeping existing values for unchanged masked fields
   */
  private mergeSettings(existing: unknown, incoming: unknown): Record<string, unknown> {
    const existingObj = existing as Record<string, unknown>
    const incomingObj = incoming as Record<string, unknown>
    const merged = { ...incomingObj }

    // If incoming value looks like a masked value, keep the existing one
    for (const [key, value] of Object.entries(incomingObj)) {
      if (typeof value === 'string' && value.includes('****')) {
        merged[key] = existingObj[key]
      }
    }

    return merged
  }
}
