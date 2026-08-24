import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export interface VideoMediaInfo {
  codec?: string
  resolution?: string
  bitrate?: number
  audioCodec?: string
  audioChannels?: number
  duration?: number
  // Filled in from ffprobe at import time. Without these there is no way to
  // tell that a file with a perfectly good "1080p BluRay" name carries a
  // 96 kbps stereo track — the case that forces a manual re-download.
  width?: number
  height?: number
  videoBitrate?: number
  audioBitrate?: number
  audioProfile?: string
  audioChannelLayout?: string
  container?: string
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
    // The column is `json`, so the pg driver hands back an already-parsed
    // object. JSON.parse on that stringifies it to "[object Object]" and
    // throws — and because consume runs while hydrating rows, one file with
    // media info took down every query that touched this table, which is how
    // a populated library rendered as empty.
    consume: (value: string | VideoMediaInfo | null) => {
      if (!value) return null
      if (typeof value !== 'string') return value
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    },
  })
  declare mediaInfo: VideoMediaInfo | null

  @column.dateTime()
  declare dateAdded: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
