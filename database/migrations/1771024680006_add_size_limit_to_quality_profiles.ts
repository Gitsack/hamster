import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quality_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('min_size_mb').nullable()
      table.integer('max_size_mb').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('min_size_mb')
      table.dropColumn('max_size_mb')
    })
  }
}
