import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quality_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name', 255).notNullable()
      table.integer('cutoff').notNullable()
      table.jsonb('items').notNullable().defaultTo('[]')
      table.boolean('upgrade_allowed').defaultTo(true).notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
