import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Movie from './movie.js'
import Episode from './episode.js'
import Album from './album.js'
import Book from './book.js'

export type FailureType =
  | 'download_failed'
  | 'extraction_failed'
  | 'verification_failed'
  | 'import_failed'
  | 'missing_files'

export default class BlacklistedRelease extends BaseModel {
  static table = 'blacklisted_releases'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare guid: string

  @column()
  declare indexer: string

  @column()
  declare title: string

  @column()
  declare movieId: string | null

  @column()
  declare episodeId: string | null

  @column()
  declare albumId: string | null

  @column()
  declare bookId: string | null

  @column()
  declare reason: string

  @column()
  declare failureType: FailureType

  @column.dateTime()
  declare blacklistedAt: DateTime

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Movie)
  declare movie: BelongsTo<typeof Movie>

  @belongsTo(() => Episode)
  declare episode: BelongsTo<typeof Episode>

  @belongsTo(() => Album)
  declare album: BelongsTo<typeof Album>

  @belongsTo(() => Book)
  declare book: BelongsTo<typeof Book>

  /**
   * Check if this blacklist entry is still active (not expired)
   */
  isActive(): boolean {
    return this.expiresAt > DateTime.now()
  }
}
