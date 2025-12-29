import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'books'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('author_id').unsigned().references('id').inTable('authors').onDelete('CASCADE').notNullable()

      // External IDs
      table.string('goodreads_id').nullable()
      table.string('openlibrary_id').nullable()
      table.string('isbn').nullable()
      table.string('isbn13').nullable()

      // Basic info
      table.string('title').notNullable()
      table.string('sort_title').nullable()
      table.text('overview').nullable()
      table.date('release_date').nullable()
      table.integer('page_count').nullable()
      table.string('publisher').nullable()
      table.string('language').nullable()

      // Media
      table.string('cover_url').nullable()

      // Ratings
      table.float('rating').nullable()
      table.integer('ratings_count').nullable()

      // Genres
      table.json('genres').nullable()

      // Series info
      table.string('series_name').nullable()
      table.float('series_position').nullable()

      // Library status
      table.boolean('wanted').defaultTo(false)
      table.boolean('has_file').defaultTo(false)

      table.timestamp('added_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
