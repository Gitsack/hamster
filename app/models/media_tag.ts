import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Tag from './tag.js'

export type TaggableMediaType = 'movie' | 'tvshow' | 'artist' | 'author'

export default class MediaTag extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tagId: string

  @column()
  declare mediaType: TaggableMediaType

  @column()
  declare mediaId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Tag)
  declare tag: BelongsTo<typeof Tag>
}
