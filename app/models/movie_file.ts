import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

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
  declare id: string

  @column()
  declare movieId: string

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
