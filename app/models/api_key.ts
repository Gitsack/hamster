import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class ApiKey extends BaseModel {
  static table = 'api_keys'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare name: string

  @column({ serializeAs: null })
  declare key: string

  @column.dateTime()
  declare lastUsedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
