import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import TvShow from './tv_show.js'
import Season from './season.js'
import EpisodeFile from './episode_file.js'

export default class Episode extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tvShowId: number

  @column()
  declare seasonId: number

  // External IDs
  @column()
  declare tmdbId: string | null

  @column()
  declare imdbId: string | null

  // Basic info
  @column()
  declare seasonNumber: number

  @column()
  declare episodeNumber: number

  @column()
  declare title: string | null

  @column()
  declare overview: string | null

  @column.date()
  declare airDate: DateTime | null

  @column()
  declare runtime: number | null

  // Media
  @column()
  declare stillUrl: string | null

  // Ratings
  @column()
  declare rating: number | null

  @column()
  declare votes: number | null

  // Library status
  @column()
  declare wanted: boolean

  @column()
  declare hasFile: boolean

  @column()
  declare episodeFileId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => TvShow)
  declare tvShow: BelongsTo<typeof TvShow>

  @belongsTo(() => Season)
  declare season: BelongsTo<typeof Season>

  @hasOne(() => EpisodeFile)
  declare episodeFile: HasOne<typeof EpisodeFile>
}
