import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notification_providers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table.string('name', 255).notNullable()
      table.string('type', 50).notNullable() // email, discord, telegram, pushover, slack, gotify, apprise

      table.boolean('enabled').defaultTo(true)

      // Provider-specific settings (encrypted for sensitive data)
      table.jsonb('settings').notNullable()

      // Events to notify on
      table.boolean('on_grab').defaultTo(false)
      table.boolean('on_download_complete').defaultTo(true)
      table.boolean('on_import_complete').defaultTo(true)
      table.boolean('on_import_failed').defaultTo(true)
      table.boolean('on_upgrade').defaultTo(true)
      table.boolean('on_rename').defaultTo(false)
      table.boolean('on_delete').defaultTo(false)
      table.boolean('on_health_issue').defaultTo(true)
      table.boolean('on_health_restored').defaultTo(false)

      // Include media-specific events
      table.boolean('include_music').defaultTo(true)
      table.boolean('include_movies').defaultTo(true)
      table.boolean('include_tv').defaultTo(true)
      table.boolean('include_books').defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['type'])
      table.index(['enabled'])
    })

    // Notification history for debugging
    this.schema.createTable('notification_history', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table
        .uuid('provider_id')
        .references('id')
        .inTable('notification_providers')
        .onDelete('CASCADE')
      table.string('event_type', 50).notNullable()
      table.string('title', 255).notNullable()
      table.text('message').nullable()
      table.boolean('success').defaultTo(false)
      table.text('error_message').nullable()

      table.timestamp('created_at').notNullable()

      table.index(['provider_id'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable('notification_history')
    this.schema.dropTable(this.tableName)
  }
}
