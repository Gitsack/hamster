import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Artist from './artist.js'
import type { MediaType } from './app_setting.js'

export default class RootFolder extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare path: string

  @column()
  declare mediaType: MediaType

  @column()
  declare accessible: boolean

  @column()
  declare freeSpaceBytes: number | null

  @column()
  declare totalSpaceBytes: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Artist)
  declare artists: HasMany<typeof Artist>
}
