import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS "movies_monitored_index" ON "movies" ("monitored")'
    )
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS "movies_has_file_index" ON "movies" ("has_file")'
    )
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS "episodes_requested_index" ON "episodes" ("requested")'
    )
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS "books_requested_index" ON "books" ("requested")'
    )
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS "tv_shows_monitored_index" ON "tv_shows" ("monitored")'
    )
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
