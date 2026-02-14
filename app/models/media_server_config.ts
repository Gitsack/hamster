import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type MediaServerType = 'plex' | 'emby' | 'jellyfin'

export default class MediaServerConfig extends BaseModel {
  static table = 'media_server_configs'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare type: MediaServerType

  @column()
  declare host: string

  @column()
  declare port: number

  @column({ serializeAs: null })
  declare apiKey: string

  @column()
  declare useSsl: boolean

  @column()
  declare enabled: boolean

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => {
      if (!value) return []
      if (Array.isArray(value)) return value
      try {
        return JSON.parse(value)
      } catch {
        return []
      }
    },
  })
  declare librarySections: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
