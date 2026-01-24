import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'albums'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('artist_id')
        .notNullable()
        .references('id')
        .inTable('artists')
        .onDelete('CASCADE')
        .index()
      table.uuid('musicbrainz_id').unique().index()
      table.uuid('musicbrainz_release_group_id').nullable()
      table.string('title', 500).notNullable().index()
      table.text('overview').nullable()
      table
        .enum('album_type', ['album', 'ep', 'single', 'compilation', 'live', 'remix', 'other'])
        .defaultTo('album')
      table.specificType('secondary_types', 'varchar[]').defaultTo('{}')
      table.date('release_date').nullable().index()
      table.text('image_url').nullable()
      table.boolean('monitored').defaultTo(true).notNullable()
      table.boolean('requested').defaultTo(false).notNullable()
      table.boolean('any_release_ok').defaultTo(true).notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
