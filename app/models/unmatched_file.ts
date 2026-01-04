import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import RootFolder from './root_folder.js'
import type { MediaType } from './app_setting.js'

export type UnmatchedFileStatus = 'pending' | 'matched' | 'ignored'

export interface ParsedInfo {
  // Common
  title?: string
  year?: number

  // Movies
  quality?: string
  releaseGroup?: string

  // TV Shows
  showTitle?: string
  seasonNumber?: number
  episodeNumber?: number
  episodeTitle?: string

  // Music
  artistName?: string
  albumTitle?: string
  trackNumber?: number
  discNumber?: number

  // Books
  authorName?: string
  bookTitle?: string
  format?: string
}

export default class UnmatchedFile extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare rootFolderId: string

  @column()
  declare relativePath: string

  @column()
  declare fileName: string

  @column()
  declare mediaType: MediaType

  @column()
  declare fileSizeBytes: number | null

  @column({
    prepare: (value: ParsedInfo) => JSON.stringify(value),
    consume: (value: string | ParsedInfo | null) => {
      if (!value) return null
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value) as ParsedInfo
      } catch {
        return null
      }
    },
  })
  declare parsedInfo: ParsedInfo | null

  @column()
  declare status: UnmatchedFileStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => RootFolder)
  declare rootFolder: BelongsTo<typeof RootFolder>
}
