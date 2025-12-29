import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TvShow from './tv_show.js'
import Episode from './episode.js'

export default class Season extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tvShowId: number

  // External IDs
  @column()
  declare tmdbId: string | null

  // Basic info
  @column()
  declare seasonNumber: number

  @column()
  declare title: string | null

  @column()
  declare overview: string | null

  @column.date()
  declare airDate: DateTime | null

  // Media
  @column()
  declare posterUrl: string | null

  // Stats
  @column()
  declare episodeCount: number

  // Library status
  @column()
  declare wanted: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => TvShow)
  declare tvShow: BelongsTo<typeof TvShow>

  @hasMany(() => Episode)
  declare episodes: HasMany<typeof Episode>
}
