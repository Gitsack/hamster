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
  // Remote path mapping (for Docker setups)
  remotePath?: string  // Path as seen by the download client (e.g., /downloads)
  localPath?: string   // Path as seen by MediaBox (e.g., /mnt/downloads)
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
