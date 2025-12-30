import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tracks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('release_id').references('id').inTable('releases').onDelete('CASCADE').index()
      table.uuid('album_id').notNullable().references('id').inTable('albums').onDelete('CASCADE').index()
      table.uuid('musicbrainz_id').nullable().index()
      table.string('title', 500).notNullable()
      table.integer('disc_number').defaultTo(1).notNullable()
      table.integer('track_number').notNullable()
      table.integer('duration_ms').nullable()
      table.boolean('has_file').defaultTo(false).notNullable()
      table.boolean('requested').defaultTo(false).notNullable()
      table.uuid('track_file_id').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
