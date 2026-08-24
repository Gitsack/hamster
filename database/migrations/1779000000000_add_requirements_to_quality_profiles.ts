import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'quality_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Attribute rules (audio, HDR, codecs, custom-format floor) that the
      // resolution/source bucket list cannot express. Nullable so existing
      // profiles keep their behaviour until edited.
      table.jsonb('requirements').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('requirements')
    })
  }
}
