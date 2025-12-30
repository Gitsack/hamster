import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ProwlarrConfig extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare baseUrl: string

  @column()
  declare apiKey: string

  @column()
  declare syncEnabled: boolean

  @column()
  declare syncCategories: number[]

  @column.dateTime()
  declare lastSyncedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
