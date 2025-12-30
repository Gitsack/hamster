import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'scheduled_tasks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 255).notNullable().unique()
      table.enum('type', ['rss_sync', 'library_scan', 'cleanup', 'refresh_artist', 'backup', 'download_monitor']).notNullable()
      table.integer('interval_minutes').notNullable()
      table.timestamp('last_run_at').nullable()
      table.timestamp('next_run_at').nullable()
      table.integer('last_duration_ms').nullable()
      table.boolean('enabled').defaultTo(true).notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
