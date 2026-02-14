import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('tv_shows', (table) => {
      table.boolean('monitored').notNullable().defaultTo(false)
    })

    this.schema.alterTable('authors', (table) => {
      table.boolean('monitored').notNullable().defaultTo(false)
    })

    this.schema.alterTable('movies', (table) => {
      table.boolean('monitored').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('tv_shows', (table) => {
      table.dropColumn('monitored')
    })

    this.schema.alterTable('authors', (table) => {
      table.dropColumn('monitored')
    })

    this.schema.alterTable('movies', (table) => {
      table.dropColumn('monitored')
    })
  }
}
