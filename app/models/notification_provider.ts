import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import NotificationHistory from './notification_history.js'

export type NotificationProviderType =
  | 'email'
  | 'discord'
  | 'telegram'
  | 'pushover'
  | 'slack'
  | 'gotify'
  | 'ntfy'

export type NotificationEvent =
  | 'grab'
  | 'download.completed'
  | 'import.completed'
  | 'import.failed'
  | 'upgrade'
  | 'rename'
  | 'delete'
  | 'health.issue'
  | 'health.restored'

export interface EmailSettings {
  host: string
  port: number
  secure: boolean
  username?: string
  password?: string
  from: string
  to: string
}

export interface DiscordSettings {
  webhookUrl: string
  username?: string
  avatarUrl?: string
}

export interface TelegramSettings {
  botToken: string
  chatId: string
}

export interface PushoverSettings {
  apiToken: string
  userKey: string
  priority?: number
  sound?: string
}

export interface SlackSettings {
  webhookUrl: string
  channel?: string
  username?: string
  iconUrl?: string
}

export interface GotifySettings {
  serverUrl: string
  appToken: string
  priority?: number
}

export interface NtfySettings {
  serverUrl?: string
  topic: string
  username?: string
  password?: string
  priority?: number
}

export type NotificationSettings =
  | EmailSettings
  | DiscordSettings
  | TelegramSettings
  | PushoverSettings
  | SlackSettings
  | GotifySettings
  | NtfySettings

export default class NotificationProvider extends BaseModel {
  static table = 'notification_providers'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare type: NotificationProviderType

  @column()
  declare enabled: boolean

  @column({
    prepare: (value: NotificationSettings) => JSON.stringify(value),
    consume: (value: string | NotificationSettings) => {
      if (!value) return {}
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    },
  })
  declare settings: NotificationSettings

  // Event toggles
  @column()
  declare onGrab: boolean

  @column()
  declare onDownloadComplete: boolean

  @column()
  declare onImportComplete: boolean

  @column()
  declare onImportFailed: boolean

  @column()
  declare onUpgrade: boolean

  @column()
  declare onRename: boolean

  @column()
  declare onDelete: boolean

  @column()
  declare onHealthIssue: boolean

  @column()
  declare onHealthRestored: boolean

  // Media type filters
  @column()
  declare includeMusic: boolean

  @column()
  declare includeMovies: boolean

  @column()
  declare includeTv: boolean

  @column()
  declare includeBooks: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => NotificationHistory)
  declare history: HasMany<typeof NotificationHistory>

  /**
   * Check if provider should notify for given event
   */
  shouldNotify(event: NotificationEvent, mediaType?: 'music' | 'movies' | 'tv' | 'books'): boolean {
    if (!this.enabled) return false

    // Check media type filter
    if (mediaType) {
      switch (mediaType) {
        case 'music':
          if (!this.includeMusic) return false
          break
        case 'movies':
          if (!this.includeMovies) return false
          break
        case 'tv':
          if (!this.includeTv) return false
          break
        case 'books':
          if (!this.includeBooks) return false
          break
      }
    }

    switch (event) {
      case 'grab':
        return this.onGrab
      case 'download.completed':
        return this.onDownloadComplete
      case 'import.completed':
        return this.onImportComplete
      case 'import.failed':
        return this.onImportFailed
      case 'upgrade':
        return this.onUpgrade
      case 'rename':
        return this.onRename
      case 'delete':
        return this.onDelete
      case 'health.issue':
        return this.onHealthIssue
      case 'health.restored':
        return this.onHealthRestored
      default:
        return false
    }
  }
}
