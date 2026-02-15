import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tv_shows'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('alternate_titles').nullable().defaultTo('[]')
      table.string('series_type').nullable().defaultTo('standard')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('alternate_titles')
      table.dropColumn('series_type')
    })
  }
}
