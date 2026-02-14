import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type TaskType =
  | 'rss_sync'
  | 'library_scan'
  | 'cleanup'
  | 'refresh_artist'
  | 'backup'
  | 'download_monitor'
  | 'requested_search'
  | 'completed_scanner'

export default class ScheduledTask extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare type: TaskType

  @column()
  declare intervalMinutes: number

  @column.dateTime()
  declare lastRunAt: DateTime | null

  @column.dateTime()
  declare nextRunAt: DateTime | null

  @column()
  declare lastDurationMs: number | null

  @column()
  declare enabled: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
