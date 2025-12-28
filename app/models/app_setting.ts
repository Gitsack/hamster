import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type MediaType = 'music' | 'movies' | 'tv'

export interface AppSettings {
  downloadFolder: string
  enabledMediaTypes: MediaType[]
}

export default class AppSetting extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare key: string

  @column()
  declare value: any

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  static async get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    const setting = await this.query().where('key', key).first()
    return setting ? (setting.value as T) : defaultValue
  }

  static async set(key: string, value: any): Promise<void> {
    const existing = await this.query().where('key', key).first()
    if (existing) {
      existing.value = value
      await existing.save()
    } else {
      await this.create({ key, value })
    }
  }

  static async getAll(): Promise<Record<string, any>> {
    const settings = await this.query()
    return settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value
        return acc
      },
      {} as Record<string, any>
    )
  }
}
