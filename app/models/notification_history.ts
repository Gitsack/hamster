import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import NotificationProvider from './notification_provider.js'

export default class NotificationHistory extends BaseModel {
  static table = 'notification_history'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare providerId: string

  @column()
  declare eventType: string

  @column()
  declare title: string

  @column()
  declare message: string | null

  @column()
  declare success: boolean

  @column()
  declare errorMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => NotificationProvider)
  declare provider: BelongsTo<typeof NotificationProvider>
}
