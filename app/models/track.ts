import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import Album from './album.js'
import Release from './release.js'
import TrackFile from './track_file.js'

export default class Track extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare releaseId: number | null

  @column()
  declare albumId: number

  @column()
  declare musicbrainzId: string | null

  @column()
  declare title: string

  @column()
  declare discNumber: number

  @column()
  declare trackNumber: number

  @column()
  declare durationMs: number | null

  @column()
  declare hasFile: boolean

  @column()
  declare trackFileId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Album)
  declare album: BelongsTo<typeof Album>

  @belongsTo(() => Release)
  declare release: BelongsTo<typeof Release>

  @hasOne(() => TrackFile, {
    foreignKey: 'trackId',
  })
  declare file: HasOne<typeof TrackFile>
}
