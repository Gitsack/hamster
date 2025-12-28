import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'track_files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('track_id').unsigned().references('id').inTable('tracks').onDelete('CASCADE')
      table.integer('album_id').unsigned().notNullable().references('id').inTable('albums').onDelete('CASCADE').index()
      table.text('relative_path').notNullable()
      table.bigInteger('size_bytes').notNullable()
      table.string('quality', 50).nullable()
      table.jsonb('media_info').defaultTo('{}')
      table.timestamp('date_added').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Add foreign key from tracks to track_files after track_files table exists
    this.schema.alterTable('tracks', (table) => {
      table.foreign('track_file_id').references('id').inTable('track_files').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('tracks', (table) => {
      table.dropForeign('track_file_id')
    })
    this.schema.dropTable(this.tableName)
  }
}
