import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'blacklisted_releases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      // Release identification
      table.string('guid', 500).notNullable()
      table.string('indexer', 255).notNullable()
      table.string('title', 500).notNullable()

      // Associated media (CASCADE delete when media is removed)
      table.uuid('movie_id').references('id').inTable('movies').onDelete('CASCADE').nullable()
      table.uuid('episode_id').references('id').inTable('episodes').onDelete('CASCADE').nullable()
      table.uuid('album_id').references('id').inTable('albums').onDelete('CASCADE').nullable()
      table.uuid('book_id').references('id').inTable('books').onDelete('CASCADE').nullable()

      // Failure details
      table.text('reason').notNullable()
      table.string('failure_type', 100).notNullable()

      // Timestamps
      table.timestamp('blacklisted_at').notNullable()
      table.timestamp('expires_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Indexes for efficient filtering
      table.index(['guid', 'indexer'])
      table.index(['movie_id'])
      table.index(['episode_id'])
      table.index(['album_id'])
      table.index(['book_id'])
      table.index(['expires_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
