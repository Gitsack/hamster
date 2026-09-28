import { BaseSchema } from '@adonisjs/lucid/schema'

const TASK_TYPES = [
  'rss_sync',
  'library_scan',
  'cleanup',
  'refresh_artist',
  'backup',
  'download_monitor',
  'requested_search',
  'completed_scanner',
  'refresh_metadata',
  'folder_scan',
  'stuck_import_recovery',
]

const typeCheck = (types: string[]) => `
  ALTER TABLE "scheduled_tasks"
  ADD CONSTRAINT "scheduled_tasks_type_check"
  CHECK ("type" IN (${types.map((t) => `'${t}'`).join(', ')}))
`

export default class extends BaseSchema {
  async up() {
    // The dashboard's For you deck, built ahead of time: one row per user,
    // deck mode and media type, so the deck is ready when the dashboard opens
    // and one type can be topped up without rebuilding the others. `stale`
    // marks a pool whose user's taste has moved on since it was built.
    this.schema.createTable('for_you_pools', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('mode', 16).notNullable()
      table.string('media_type', 8).notNullable()
      table.jsonb('cards').notNullable().defaultTo('[]')
      table.jsonb('signals').nullable()
      table.boolean('stale').notNullable().defaultTo(false)
      table.timestamp('built_at', { useTz: true }).notNullable()
      table.unique(['user_id', 'mode', 'media_type'])
    })

    this.schema.raw(
      'ALTER TABLE "scheduled_tasks" DROP CONSTRAINT IF EXISTS "scheduled_tasks_type_check"'
    )
    this.schema.raw(typeCheck([...TASK_TYPES, 'for_you_refresh']))
  }

  async down() {
    this.schema.raw(`DELETE FROM "scheduled_tasks" WHERE "type" = 'for_you_refresh'`)
    this.schema.raw(
      'ALTER TABLE "scheduled_tasks" DROP CONSTRAINT IF EXISTS "scheduled_tasks_type_check"'
    )
    this.schema.raw(typeCheck(TASK_TYPES))
    this.schema.dropTable('for_you_pools')
  }
}
