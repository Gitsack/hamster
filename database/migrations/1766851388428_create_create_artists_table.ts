import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'artists'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('musicbrainz_id').unique().index()
      table.string('name', 500).notNullable().index()
      table.string('sort_name', 500).nullable()
      table.text('disambiguation').nullable()
      table.text('overview').nullable()
      table.enum('status', ['continuing', 'ended', 'unknown']).defaultTo('unknown')
      table.string('artist_type', 100).nullable()
      table.string('country', 3).nullable()
      table.date('formed_at').nullable()
      table.date('ended_at').nullable()
      table.text('image_url').nullable()
      table.boolean('monitored').defaultTo(true).notNullable()
      table.boolean('requested').defaultTo(false).notNullable()
      table.uuid('quality_profile_id').references('id').inTable('quality_profiles').onDelete('SET NULL')
      table.uuid('metadata_profile_id').references('id').inTable('metadata_profiles').onDelete('SET NULL')
      table.uuid('root_folder_id').references('id').inTable('root_folders').onDelete('SET NULL')
      table.timestamp('added_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
