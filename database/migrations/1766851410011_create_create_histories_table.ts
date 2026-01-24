import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'history'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .enum('event_type', [
          'grabbed',
          'download_completed',
          'import_completed',
          'import_failed',
          'deleted',
          'renamed',
        ])
        .notNullable()
      table.text('source_title').nullable()
      table.uuid('album_id').references('id').inTable('albums').onDelete('SET NULL')
      table.uuid('artist_id').references('id').inTable('artists').onDelete('SET NULL')
      table.uuid('track_file_id').references('id').inTable('track_files').onDelete('SET NULL')
      table.uuid('download_id').references('id').inTable('downloads').onDelete('SET NULL')
      table.string('quality', 50).nullable()
      table.jsonb('data').defaultTo('{}')

      table.timestamp('created_at').notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
