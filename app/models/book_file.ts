import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class BookFile extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare bookId: string

  @column()
  declare relativePath: string

  @column()
  declare sizeBytes: number

  @column()
  declare format: string | null // epub, pdf, mobi, azw3

  @column()
  declare quality: string | null

  @column.dateTime()
  declare dateAdded: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
