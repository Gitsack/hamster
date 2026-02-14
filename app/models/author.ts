import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import QualityProfile from './quality_profile.js'
import RootFolder from './root_folder.js'
import Book from './book.js'

export default class Author extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  // External IDs
  @column()
  declare goodreadsId: string | null

  @column()
  declare openlibraryId: string | null

  // Basic info
  @column()
  declare name: string

  @column()
  declare sortName: string | null

  @column()
  declare overview: string | null

  // Media
  @column()
  declare imageUrl: string | null

  // Library status
  @column()
  declare requested: boolean

  @column()
  declare monitored: boolean

  @column()
  declare needsReview: boolean

  // Configuration
  @column()
  declare qualityProfileId: string | null

  @column()
  declare rootFolderId: string | null

  @column.dateTime()
  declare addedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => QualityProfile)
  declare qualityProfile: BelongsTo<typeof QualityProfile>

  @belongsTo(() => RootFolder)
  declare rootFolder: BelongsTo<typeof RootFolder>

  @hasMany(() => Book)
  declare books: HasMany<typeof Book>
}
