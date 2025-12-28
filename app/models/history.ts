import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Album from './album.js'
import Artist from './artist.js'
import TrackFile from './track_file.js'
import Download from './download.js'

export type HistoryEventType = 'grabbed' | 'download_completed' | 'import_completed' | 'import_failed' | 'deleted' | 'renamed'

export default class History extends BaseModel {
  static table = 'history'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare eventType: HistoryEventType

  @column()
  declare sourceTitle: string | null

  @column()
  declare albumId: number | null

  @column()
  declare artistId: number | null

  @column()
  declare trackFileId: number | null

  @column()
  declare downloadId: number | null

  @column()
  declare quality: string | null

  @column()
  declare data: Record<string, unknown>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Album)
  declare album: BelongsTo<typeof Album>

  @belongsTo(() => Artist)
  declare artist: BelongsTo<typeof Artist>

  @belongsTo(() => TrackFile)
  declare trackFile: BelongsTo<typeof TrackFile>

  @belongsTo(() => Download)
  declare download: BelongsTo<typeof Download>
}
