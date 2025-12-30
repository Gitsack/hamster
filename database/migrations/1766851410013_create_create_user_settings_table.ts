import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE')
      table.enum('ui_theme', ['light', 'dark', 'system']).defaultTo('system')
      table.uuid('default_quality_profile_id').references('id').inTable('quality_profiles').onDelete('SET NULL')
      table.uuid('default_metadata_profile_id').references('id').inTable('metadata_profiles').onDelete('SET NULL')
      table.jsonb('notification_settings').defaultTo('{}')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
