import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import QualityProfile from './quality_profile.js'

export type UiTheme = 'light' | 'dark' | 'system'

export interface NotificationSettings {
  onGrab?: boolean
  onDownload?: boolean
  onImport?: boolean
  onUpgrade?: boolean
}

export default class UserSetting extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare uiTheme: UiTheme

  @column()
  declare defaultQualityProfileId: string | null

  @column()
  declare notificationSettings: NotificationSettings

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => QualityProfile, {
    foreignKey: 'defaultQualityProfileId',
  })
  declare defaultQualityProfile: BelongsTo<typeof QualityProfile>
}
