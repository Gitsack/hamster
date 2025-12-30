import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import Author from './author.js'
import BookFile from './book_file.js'

export default class Book extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare authorId: string

  // External IDs
  @column()
  declare goodreadsId: string | null

  @column()
  declare openlibraryId: string | null

  @column()
  declare isbn: string | null

  @column({ columnName: 'isbn13' })
  declare isbn13: string | null

  // Basic info
  @column()
  declare title: string

  @column()
  declare sortTitle: string | null

  @column()
  declare overview: string | null

  @column.date()
  declare releaseDate: DateTime | null

  @column()
  declare pageCount: number | null

  @column()
  declare publisher: string | null

  @column()
  declare language: string | null

  // Media
  @column()
  declare coverUrl: string | null

  // Ratings
  @column()
  declare rating: number | null

  @column()
  declare ratingsCount: number | null

  // Genres
  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => {
      if (!value) return []
      if (Array.isArray(value)) return value
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : [value]
      } catch {
        // Handle plain string or comma-separated values
        return value.includes(',') ? value.split(',').map((s) => s.trim()) : [value]
      }
    },
  })
  declare genres: string[]

  // Series info
  @column()
  declare seriesName: string | null

  @column()
  declare seriesPosition: number | null

  // Library status
  @column()
  declare requested: boolean

  @column()
  declare hasFile: boolean

  @column.dateTime()
  declare addedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Author)
  declare author: BelongsTo<typeof Author>

  @hasOne(() => BookFile)
  declare bookFile: HasOne<typeof BookFile>
}
