import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import QualityProfile from './quality_profile.js'
import MetadataProfile from './metadata_profile.js'
import RootFolder from './root_folder.js'
import Album from './album.js'

export type ArtistStatus = 'continuing' | 'ended' | 'unknown'

export default class Artist extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare musicbrainzId: string | null

  @column()
  declare name: string

  @column()
  declare sortName: string | null

  @column()
  declare disambiguation: string | null

  @column()
  declare overview: string | null

  @column()
  declare status: ArtistStatus

  @column()
  declare artistType: string | null

  @column()
  declare country: string | null

  @column.date()
  declare formedAt: DateTime | null

  @column.date()
  declare endedAt: DateTime | null

  @column()
  declare imageUrl: string | null

  @column()
  declare monitored: boolean

  @column()
  declare requested: boolean

  @column()
  declare qualityProfileId: string | null

  @column()
  declare metadataProfileId: string | null

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

  @belongsTo(() => MetadataProfile)
  declare metadataProfile: BelongsTo<typeof MetadataProfile>

  @belongsTo(() => RootFolder)
  declare rootFolder: BelongsTo<typeof RootFolder>

  @hasMany(() => Album)
  declare albums: HasMany<typeof Album>
}
