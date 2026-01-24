import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'episode_files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table
        .uuid('episode_id')
        .references('id')
        .inTable('episodes')
        .onDelete('CASCADE')
        .notNullable()
      table
        .uuid('tv_show_id')
        .references('id')
        .inTable('tv_shows')
        .onDelete('CASCADE')
        .notNullable()

      table.string('relative_path').notNullable()
      table.bigInteger('size_bytes').notNullable()
      table.string('quality').nullable()

      // Media info
      table.json('media_info').nullable() // codec, resolution, bitrate, audio channels, etc.

      table.timestamp('date_added').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
