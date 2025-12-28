import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_admin').defaultTo(false).notNullable()
      table.jsonb('preferences').defaultTo('{}')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_admin')
      table.dropColumn('preferences')
    })
  }
}
