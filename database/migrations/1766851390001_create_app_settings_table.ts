import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'app_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('key', 255).notNullable().unique()
      table.jsonb('value').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add media_type column to root_folders
    this.schema.alterTable('root_folders', (table) => {
      table.string('media_type', 50).defaultTo('music').notNullable()
    })
  }

  async down() {
    this.schema.alterTable('root_folders', (table) => {
      table.dropColumn('media_type')
    })
    this.schema.dropTable(this.tableName)
  }
}
