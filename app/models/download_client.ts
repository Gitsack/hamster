import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Download from './download.js'

export type DownloadClientType = 'sabnzbd' | 'nzbget'

export interface DownloadClientSettings {
  host?: string
  port?: number
  apiKey?: string
  useSsl?: boolean
  category?: string
}

export default class DownloadClient extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare type: DownloadClientType

  @column()
  declare enabled: boolean

  @column()
  declare priority: number

  @column()
  declare settings: DownloadClientSettings

  @column()
  declare removeCompletedDownloads: boolean

  @column()
  declare removeFailedDownloads: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Download)
  declare downloads: HasMany<typeof Download>
}
