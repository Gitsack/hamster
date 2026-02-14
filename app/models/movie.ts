import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import QualityProfile from './quality_profile.js'
import RootFolder from './root_folder.js'
import MovieFile from './movie_file.js'

export default class Movie extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  // External IDs
  @column()
  declare tmdbId: string | null

  @column()
  declare imdbId: string | null

  // Basic info
  @column()
  declare title: string

  @column()
  declare originalTitle: string | null

  @column()
  declare sortTitle: string | null

  @column()
  declare overview: string | null

  @column.date()
  declare releaseDate: DateTime | null

  @column()
  declare year: number | null

  @column()
  declare runtime: number | null // minutes

  @column()
  declare status: string | null

  // Media
  @column()
  declare posterUrl: string | null

  @column()
  declare backdropUrl: string | null

  // Ratings
  @column()
  declare rating: number | null

  @column()
  declare votes: number | null

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

  // Library status
  @column()
  declare requested: boolean

  @column()
  declare monitored: boolean

  @column()
  declare hasFile: boolean

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

  @hasOne(() => MovieFile)
  declare movieFile: HasOne<typeof MovieFile>
}
