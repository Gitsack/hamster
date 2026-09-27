import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // What the For you deck is about (for-you, new, classics, top-rated), as
    // last picked by the user. Null means the default.
    this.schema.alterTable('user_settings', (table) => {
      table.string('for_you_mode', 20).nullable()
    })
  }

  async down() {
    this.schema.alterTable('user_settings', (table) => {
      table.dropColumn('for_you_mode')
    })
  }
}
