import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export interface CustomFormatSpecification {
  name: string
  implementation: 'contains' | 'notContains' | 'resolution' | 'source' | 'codec' | 'releaseGroup'
  negate: boolean
  required: boolean
  value: string
}

export default class CustomFormat extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare includeWhenRenaming: boolean

  @column({
    prepare: (value: CustomFormatSpecification[]) => JSON.stringify(value),
    consume: (value: string | CustomFormatSpecification[]) => {
      if (!value) return []
      if (Array.isArray(value)) return value
      try {
        return JSON.parse(value)
      } catch {
        return []
      }
    },
  })
  declare specifications: CustomFormatSpecification[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
