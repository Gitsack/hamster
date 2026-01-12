import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Download from './download.js'

export type DownloadClientType =
  | 'sabnzbd'
  | 'nzbget'
  | 'qbittorrent'
  | 'transmission'
  | 'deluge'
  | 'rtorrent'

export type DownloadProtocol = 'usenet' | 'torrent'

export interface DownloadClientSettings {
  // Common
  host?: string
  port?: number
  useSsl?: boolean
  // Remote path mapping (for Docker setups)
  remotePath?: string  // Path as seen by the download client (e.g., /downloads)
  localPath?: string   // Path as seen by Hamster (e.g., /mnt/downloads)

  // Usenet specific
  apiKey?: string
  category?: string

  // Torrent specific
  username?: string
  password?: string
  downloadDirectory?: string
  addPaused?: boolean
  urlBase?: string  // For clients with configurable URL base (e.g., /transmission/)
}

/**
 * Get the protocol for a download client type
 */
export function getClientProtocol(type: DownloadClientType): DownloadProtocol {
  switch (type) {
    case 'sabnzbd':
    case 'nzbget':
      return 'usenet'
    case 'qbittorrent':
    case 'transmission':
    case 'deluge':
    case 'rtorrent':
      return 'torrent'
    default:
      return 'usenet'
  }
}

export default class DownloadClient extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

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
