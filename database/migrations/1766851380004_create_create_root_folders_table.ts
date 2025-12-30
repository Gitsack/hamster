import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'root_folders'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 255).notNullable()
      table.text('path').notNullable().unique()
      table.string('media_type', 50).nullable()
      table.boolean('accessible').defaultTo(true).notNullable()
      table.bigInteger('free_space_bytes').nullable()
      table.bigInteger('total_space_bytes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
