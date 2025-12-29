import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Movie from './movie.js'

export interface VideoMediaInfo {
  codec?: string
  resolution?: string
  bitrate?: number
  audioCodec?: string
  audioChannels?: number
  duration?: number
}

export default class MovieFile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare movieId: number

  @column()
  declare relativePath: string

  @column()
  declare sizeBytes: number

  @column()
  declare quality: string | null

  @column({
    prepare: (value: VideoMediaInfo) => JSON.stringify(value),
    consume: (value: string) => (value ? JSON.parse(value) : null),
  })
  declare mediaInfo: VideoMediaInfo | null

  @column.dateTime()
  declare dateAdded: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Movie)
  declare movie: BelongsTo<typeof Movie>
}
