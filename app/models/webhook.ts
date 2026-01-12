import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import WebhookHistory from './webhook_history.js'

export type WebhookEvent =
  | 'grab'
  | 'download.completed'
  | 'import.completed'
  | 'import.failed'
  | 'upgrade'
  | 'rename'
  | 'delete'
  | 'health.issue'
  | 'health.restored'

export type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH'

export interface WebhookHeaders {
  [key: string]: string
}

export default class Webhook extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare url: string

  @column()
  declare enabled: boolean

  @column()
  declare method: WebhookMethod

  @column({
    prepare: (value: WebhookEvent[]) => JSON.stringify(value),
    consume: (value: string | WebhookEvent[]) => {
      if (!value) return []
      if (Array.isArray(value)) return value
      try {
        return JSON.parse(value)
      } catch {
        return []
      }
    },
  })
  declare events: WebhookEvent[]

  @column({
    prepare: (value: WebhookHeaders | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | WebhookHeaders | null) => {
      if (!value) return null
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    },
  })
  declare headers: WebhookHeaders | null

  @column()
  declare payloadTemplate: string | null

  // Event toggles
  @column()
  declare onGrab: boolean

  @column()
  declare onDownloadComplete: boolean

  @column()
  declare onImportComplete: boolean

  @column()
  declare onImportFailed: boolean

  @column()
  declare onUpgrade: boolean

  @column()
  declare onRename: boolean

  @column()
  declare onDelete: boolean

  @column()
  declare onHealthIssue: boolean

  @column()
  declare onHealthRestored: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => WebhookHistory)
  declare history: HasMany<typeof WebhookHistory>

  /**
   * Check if webhook should trigger for given event
   */
  shouldTrigger(event: WebhookEvent): boolean {
    if (!this.enabled) return false

    switch (event) {
      case 'grab':
        return this.onGrab
      case 'download.completed':
        return this.onDownloadComplete
      case 'import.completed':
        return this.onImportComplete
      case 'import.failed':
        return this.onImportFailed
      case 'upgrade':
        return this.onUpgrade
      case 'rename':
        return this.onRename
      case 'delete':
        return this.onDelete
      case 'health.issue':
        return this.onHealthIssue
      case 'health.restored':
        return this.onHealthRestored
      default:
        return this.events.includes(event)
    }
  }
}
