import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'webhooks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table.string('name', 255).notNullable()
      table.text('url').notNullable()
      table.boolean('enabled').defaultTo(true)
      table.string('method', 10).defaultTo('POST')

      // Events to trigger on (array of event types)
      table.jsonb('events').notNullable()

      // Custom headers (e.g., Authorization)
      table.jsonb('headers').nullable()

      // Custom payload template (optional, uses default if not set)
      table.text('payload_template').nullable()

      // On grab settings
      table.boolean('on_grab').defaultTo(true)
      table.boolean('on_download_complete').defaultTo(true)
      table.boolean('on_import_complete').defaultTo(true)
      table.boolean('on_import_failed').defaultTo(true)
      table.boolean('on_upgrade').defaultTo(true)
      table.boolean('on_rename').defaultTo(false)
      table.boolean('on_delete').defaultTo(false)
      table.boolean('on_health_issue').defaultTo(true)
      table.boolean('on_health_restored').defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Webhook history for debugging
    this.schema.createTable('webhook_history', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table.uuid('webhook_id').references('id').inTable('webhooks').onDelete('CASCADE')
      table.string('event_type', 50).notNullable()
      table.jsonb('payload').notNullable()
      table.integer('response_status').nullable()
      table.text('response_body').nullable()
      table.boolean('success').defaultTo(false)
      table.text('error_message').nullable()

      table.timestamp('created_at').notNullable()

      table.index(['webhook_id'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable('webhook_history')
    this.schema.dropTable(this.tableName)
  }
}
