import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export const VERSION_QUALITIES = ['high', 'balanced', 'small'] as const
export type VersionQuality = (typeof VERSION_QUALITIES)[number]

export const VERSION_AUDIO_MODES = ['stereo', 'surround'] as const
export type VersionAudioMode = (typeof VERSION_AUDIO_MODES)[number]

export const VERSION_MAX_HEIGHTS = [2160, 1080, 720, 480] as const

/**
 * A recipe for a smaller copy of a movie, kept beside the main file.
 */
export default class VersionProfile extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  /** File name suffix: "Movie (2020) - <label>.mkv". */
  @column()
  declare label: string

  @column()
  declare maxHeight: number

  @column()
  declare quality: VersionQuality

  @column()
  declare audio: VersionAudioMode

  @column()
  declare subtitles: boolean

  /** Run on every movie import, not only when asked for. */
  @column()
  declare auto: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
