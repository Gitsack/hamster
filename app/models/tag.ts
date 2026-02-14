import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Indexer from './indexer.js'
import DownloadClient from './download_client.js'

export default class Tag extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @manyToMany(() => Indexer, {
    pivotTable: 'indexer_tags',
    pivotForeignKey: 'tag_id',
    pivotRelatedForeignKey: 'indexer_id',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare indexers: ManyToMany<typeof Indexer>

  @manyToMany(() => DownloadClient, {
    pivotTable: 'download_client_tags',
    pivotForeignKey: 'tag_id',
    pivotRelatedForeignKey: 'download_client_id',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare downloadClients: ManyToMany<typeof DownloadClient>
}
