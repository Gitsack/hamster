import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'downloads'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('download_client_id').references('id').inTable('download_clients').onDelete('SET NULL')
      table.string('external_id', 255).nullable()
      table.string('title', 500).notNullable()
      table.enum('status', ['queued', 'downloading', 'paused', 'completed', 'failed', 'importing']).defaultTo('queued')
      table.decimal('progress', 5, 2).defaultTo(0)
      table.bigInteger('size_bytes').nullable()
      table.bigInteger('remaining_bytes').nullable()
      table.integer('eta_seconds').nullable()
      table.uuid('album_id').references('id').inTable('albums').onDelete('SET NULL')
      table.uuid('release_id').references('id').inTable('releases').onDelete('SET NULL')
      table.uuid('indexer_id').references('id').inTable('indexers').onDelete('SET NULL')
      table.string('media_type').nullable() // music, movies, tv, books
      table.uuid('movie_id').references('id').inTable('movies').onDelete('SET NULL').nullable()
      table.uuid('tv_show_id').references('id').inTable('tv_shows').onDelete('SET NULL').nullable()
      table.uuid('episode_id').references('id').inTable('episodes').onDelete('SET NULL').nullable()
      table.uuid('book_id').references('id').inTable('books').onDelete('SET NULL').nullable()
      table.jsonb('nzb_info').defaultTo('{}')
      table.text('output_path').nullable()
      table.text('error_message').nullable()
      table.timestamp('started_at').nullable()
      table.timestamp('completed_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
