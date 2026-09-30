import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { VideoMediaInfo } from '#models/movie_file'
import Movie from './movie.js'
import VersionProfile from './version_profile.js'

export type MovieVersionStatus = 'queued' | 'encoding' | 'ready' | 'failed'

/**
 * A smaller copy of a movie beside its main file, made from a version profile.
 * The row exists from the moment the copy is queued; `relativePath` is only
 * set once the finished file is in the library.
 */
export default class MovieVersion extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare movieId: string

  @column()
  declare profileId: string | null

  /** Copied from the profile, so the file stays identifiable if it is deleted. */
  @column()
  declare label: string

  @column()
  declare status: MovieVersionStatus

  /** Relative to the movie's root folder, like MovieFile.relativePath. */
  @column()
  declare relativePath: string | null

  /** bigint in Postgres, which the driver hands back as a string. */
  @column({ consume: (value: string | number | null) => (value === null ? null : Number(value)) })
  declare sizeBytes: number | null

  @column({
    prepare: (value: VideoMediaInfo | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | VideoMediaInfo | null) => {
      if (!value) return null
      if (typeof value !== 'string') return value
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    },
  })
  declare mediaInfo: VideoMediaInfo | null

  @column()
  declare error: string | null

  /** Local hardlink of the download to encode from, when there is one. */
  @column()
  declare stagedSourcePath: string | null

  /** Which encoder made it: 'vaapi' or 'x265'. */
  @column()
  declare encoder: string | null

  /** Bumped while encoding; a stale one means the process that claimed it died. */
  @column.dateTime()
  declare heartbeatAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Movie)
  declare movie: BelongsTo<typeof Movie>

  @belongsTo(() => VersionProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof VersionProfile>
}
