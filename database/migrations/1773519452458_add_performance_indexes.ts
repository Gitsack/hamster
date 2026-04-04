import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('download_clients', (table) => {
      table.index(['type'])
    })
    this.schema.alterTable('quality_profiles', (table) => {
      table.index(['media_type'])
    })
  }

  async down() {
    this.schema.alterTable('download_clients', (table) => {
      table.dropIndex(['type'])
    })
    this.schema.alterTable('quality_profiles', (table) => {
      table.dropIndex(['media_type'])
    })
  }
}
