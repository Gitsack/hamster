import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE')
      table.enum('ui_theme', ['light', 'dark', 'system']).defaultTo('system')
      table.integer('default_quality_profile_id').unsigned().references('id').inTable('quality_profiles').onDelete('SET NULL')
      table.integer('default_metadata_profile_id').unsigned().references('id').inTable('metadata_profiles').onDelete('SET NULL')
      table.jsonb('notification_settings').defaultTo('{}')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
