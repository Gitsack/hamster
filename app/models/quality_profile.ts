import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Artist from './artist.js'

export interface QualityItem {
  id: number
  name: string
  allowed: boolean
}

export default class QualityProfile extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare mediaType: string | null

  @column()
  declare cutoff: number

  @column({
    prepare: (value: QualityItem[]) => JSON.stringify(value),
    consume: (value: string) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare items: QualityItem[]

  @column()
  declare upgradeAllowed: boolean

  @column()
  declare minSizeMb: number | null

  @column()
  declare maxSizeMb: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Artist)
  declare artists: HasMany<typeof Artist>
}
