import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import DownloadClient from './download_client.js'
import Album from './album.js'
import Release from './release.js'
import Indexer from './indexer.js'

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'importing'

export interface NzbInfo {
  guid?: string
  title?: string
  downloadUrl?: string
  size?: number
  indexer?: string
}

export default class Download extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare downloadClientId: number | null

  @column()
  declare externalId: string | null

  @column()
  declare title: string

  @column()
  declare status: DownloadStatus

  @column()
  declare progress: number

  @column()
  declare sizeBytes: number | null

  @column()
  declare remainingBytes: number | null

  @column()
  declare etaSeconds: number | null

  @column()
  declare albumId: number | null

  @column()
  declare releaseId: number | null

  @column()
  declare indexerId: number | null

  @column()
  declare nzbInfo: NzbInfo

  @column()
  declare outputPath: string | null

  @column()
  declare errorMessage: string | null

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => DownloadClient)
  declare downloadClient: BelongsTo<typeof DownloadClient>

  @belongsTo(() => Album)
  declare album: BelongsTo<typeof Album>

  @belongsTo(() => Release)
  declare release: BelongsTo<typeof Release>

  @belongsTo(() => Indexer)
  declare indexer: BelongsTo<typeof Indexer>
}
