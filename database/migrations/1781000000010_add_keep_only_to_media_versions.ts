import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Archiving: once the version is made and verified, it replaces the
    // original without anyone having to come back and press the button.
    this.schema.alterTable('media_versions', (table) => {
      table.boolean('keep_only').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('media_versions', (table) => {
      table.dropColumn('keep_only')
    })
  }
}
