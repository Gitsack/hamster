import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { VideoMediaInfo } from './movie_file.js'

export default class EpisodeFile extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare episodeId: string

  @column()
  declare tvShowId: string

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
}
