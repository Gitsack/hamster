import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('movies', (table) => {
      table.index(['monitored'])
      table.index(['has_file'])
    })
    this.schema.alterTable('episodes', (table) => {
      table.index(['requested'])
    })
    this.schema.alterTable('books', (table) => {
      table.index(['requested'])
    })
    this.schema.alterTable('tv_shows', (table) => {
      table.index(['monitored'])
    })
  }

  async down() {
    this.schema.alterTable('movies', (table) => {
      table.dropIndex(['monitored'])
      table.dropIndex(['has_file'])
    })
    this.schema.alterTable('episodes', (table) => {
      table.dropIndex(['requested'])
    })
    this.schema.alterTable('books', (table) => {
      table.dropIndex(['requested'])
    })
    this.schema.alterTable('tv_shows', (table) => {
      table.dropIndex(['monitored'])
    })
  }
}
