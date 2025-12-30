import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'indexers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 255).notNullable()
      table.enum('type', ['newznab', 'prowlarr']).notNullable()
      table.boolean('enabled').defaultTo(true).notNullable()
      table.integer('priority').defaultTo(25).notNullable()
      table.jsonb('settings').notNullable().defaultTo('{}')
      table.boolean('supports_search').defaultTo(true).notNullable()
      table.boolean('supports_rss').defaultTo(true).notNullable()
      table.integer('prowlarr_indexer_id').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
