import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'api_keys'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.string('key', 64).notNullable().unique()
      table.timestamp('last_used_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['user_id'])
      table.index(['key'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
