import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Artist from './artist.js'

export default class MetadataProfile extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare primaryAlbumTypes: string[]

  @column()
  declare secondaryAlbumTypes: string[]

  @column()
  declare releaseStatuses: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Artist)
  declare artists: HasMany<typeof Artist>
}
