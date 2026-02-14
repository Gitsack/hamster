import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import QualityProfile from './quality_profile.js'
import RootFolder from './root_folder.js'
import Season from './season.js'
import Episode from './episode.js'

export default class TvShow extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  // External IDs
  @column()
  declare tmdbId: string | null

  @column()
  declare imdbId: string | null

  @column()
  declare tvdbId: string | null

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
  declare firstAired: DateTime | null

  @column()
  declare year: number | null

  @column()
  declare runtime: number | null

  @column()
  declare status: string | null

  @column()
  declare network: string | null

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

  // Stats
  @column()
  declare seasonCount: number

  @column()
  declare episodeCount: number

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

  @hasMany(() => Season)
  declare seasons: HasMany<typeof Season>

  @hasMany(() => Episode)
  declare episodes: HasMany<typeof Episode>
}
