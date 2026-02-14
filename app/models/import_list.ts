import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import QualityProfile from './quality_profile.js'
import RootFolder from './root_folder.js'

export type ImportListType = 'trakt_watchlist' | 'trakt_list' | 'imdb_list'
export type ImportListMediaType = 'movies' | 'tv' | 'music' | 'books'

export interface ImportListSettings {
  // Trakt settings
  traktListSlug?: string
  traktUsername?: string
  // IMDb settings
  imdbListId?: string
}

export default class ImportList extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare type: ImportListType

  @column()
  declare enabled: boolean

  @column({
    prepare: (value: ImportListSettings) => JSON.stringify(value),
    consume: (value: string | ImportListSettings) => {
      if (!value) return {}
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    },
  })
  declare settings: ImportListSettings

  @column()
  declare mediaType: ImportListMediaType

  @column()
  declare qualityProfileId: string | null

  @column()
  declare rootFolderId: string | null

  @column()
  declare autoAdd: boolean

  @column()
  declare syncIntervalMinutes: number

  @column.dateTime()
  declare lastSyncedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => QualityProfile)
  declare qualityProfile: BelongsTo<typeof QualityProfile>

  @belongsTo(() => RootFolder)
  declare rootFolder: BelongsTo<typeof RootFolder>
}
