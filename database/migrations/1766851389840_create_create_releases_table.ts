import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'releases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('album_id').unsigned().notNullable().references('id').inTable('albums').onDelete('CASCADE').index()
      table.uuid('musicbrainz_id').unique().index()
      table.string('title', 500).nullable()
      table.string('country', 3).nullable()
      table.string('label', 500).nullable()
      table.string('catalog_number', 100).nullable()
      table.string('format', 100).nullable()
      table.integer('track_count').nullable()
      table.integer('disc_count').defaultTo(1)
      table.date('release_date').nullable()
      table.boolean('monitored').defaultTo(false).notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
