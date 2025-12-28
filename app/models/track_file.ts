import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Album from './album.js'
import Track from './track.js'

export interface MediaInfo {
  bitrate?: number
  sampleRate?: number
  channels?: number
  codec?: string
  bitsPerSample?: number
  duration?: number
}

export default class TrackFile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare trackId: number | null

  @column()
  declare albumId: number

  @column()
  declare relativePath: string

  @column()
  declare sizeBytes: number

  @column()
  declare quality: string | null

  @column()
  declare mediaInfo: MediaInfo

  @column.dateTime()
  declare dateAdded: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Album)
  declare album: BelongsTo<typeof Album>

  @belongsTo(() => Track)
  declare track: BelongsTo<typeof Track>
}
