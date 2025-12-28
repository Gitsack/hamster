import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'history'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.enum('event_type', ['grabbed', 'download_completed', 'import_completed', 'import_failed', 'deleted', 'renamed']).notNullable()
      table.text('source_title').nullable()
      table.integer('album_id').unsigned().references('id').inTable('albums').onDelete('SET NULL')
      table.integer('artist_id').unsigned().references('id').inTable('artists').onDelete('SET NULL')
      table.integer('track_file_id').unsigned().references('id').inTable('track_files').onDelete('SET NULL')
      table.integer('download_id').unsigned().references('id').inTable('downloads').onDelete('SET NULL')
      table.string('quality', 50).nullable()
      table.jsonb('data').defaultTo('{}')

      table.timestamp('created_at').notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
