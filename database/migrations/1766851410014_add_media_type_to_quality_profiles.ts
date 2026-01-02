import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quality_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('media_type', 50).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('media_type')
    })
  }
}
