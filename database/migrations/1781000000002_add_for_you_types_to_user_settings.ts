import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Which media types the dashboard's For you deck shows, as last picked by
    // the user. Null means everything.
    this.schema.alterTable('user_settings', (table) => {
      table.specificType('for_you_types', 'text[]').nullable()
    })
  }

  async down() {
    this.schema.alterTable('user_settings', (table) => {
      table.dropColumn('for_you_types')
    })
  }
}
