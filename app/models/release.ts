import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Album from './album.js'
import Track from './track.js'

export default class Release extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare albumId: number

  @column()
  declare musicbrainzId: string | null

  @column()
  declare title: string | null

  @column()
  declare country: string | null

  @column()
  declare label: string | null

  @column()
  declare catalogNumber: string | null

  @column()
  declare format: string | null

  @column()
  declare trackCount: number | null

  @column()
  declare discCount: number

  @column.date()
  declare releaseDate: DateTime | null

  @column()
  declare monitored: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Album)
  declare album: BelongsTo<typeof Album>

  @hasMany(() => Track)
  declare tracks: HasMany<typeof Track>
}
