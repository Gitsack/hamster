import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Artist from './artist.js'
import Release from './release.js'
import Track from './track.js'
import TrackFile from './track_file.js'

export type AlbumType = 'album' | 'ep' | 'single' | 'compilation' | 'live' | 'remix' | 'other'

export default class Album extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare artistId: string

  @column()
  declare musicbrainzId: string | null

  @column()
  declare musicbrainzReleaseGroupId: string | null

  @column()
  declare title: string

  @column()
  declare overview: string | null

  @column()
  declare albumType: AlbumType

  @column()
  declare secondaryTypes: string[]

  @column.date()
  declare releaseDate: DateTime | null

  @column()
  declare imageUrl: string | null

  @column()
  declare monitored: boolean

  @column()
  declare requested: boolean

  @column()
  declare anyReleaseOk: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Artist)
  declare artist: BelongsTo<typeof Artist>

  @hasMany(() => Release)
  declare releases: HasMany<typeof Release>

  @hasMany(() => Track)
  declare tracks: HasMany<typeof Track>

  @hasMany(() => TrackFile)
  declare trackFiles: HasMany<typeof TrackFile>
}
