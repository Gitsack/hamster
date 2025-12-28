import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prowlarr_configs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.text('base_url').notNullable()
      table.text('api_key').notNullable()
      table.boolean('sync_enabled').defaultTo(true).notNullable()
      table.specificType('sync_categories', 'integer[]').defaultTo('{}')
      table.timestamp('last_synced_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
