import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Webhook from './webhook.js'

export default class WebhookHistory extends BaseModel {
  static table = 'webhook_history'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare webhookId: string

  @column()
  declare eventType: string

  @column({
    prepare: (value: Record<string, unknown>) => JSON.stringify(value),
    consume: (value: string | Record<string, unknown>) => {
      if (!value) return {}
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    },
  })
  declare payload: Record<string, unknown>

  @column()
  declare responseStatus: number | null

  @column()
  declare responseBody: string | null

  @column()
  declare success: boolean

  @column()
  declare errorMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Webhook)
  declare webhook: BelongsTo<typeof Webhook>
}
