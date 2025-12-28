import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type IndexerType = 'newznab' | 'prowlarr'

export interface IndexerSettings {
  baseUrl?: string
  apiKey?: string
  categories?: number[]
}

export default class Indexer extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare type: IndexerType

  @column()
  declare enabled: boolean

  @column()
  declare priority: number

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: any) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
    },
  })
  declare settings: IndexerSettings

  @column()
  declare supportsSearch: boolean

  @column()
  declare supportsRss: boolean

  @column()
  declare prowlarrIndexerId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
