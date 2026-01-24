import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'authors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      // External IDs
      table.string('goodreads_id').nullable().unique()
      table.string('openlibrary_id').nullable()

      // Basic info
      table.string('name').notNullable()
      table.string('sort_name').nullable()
      table.text('overview').nullable()

      // Media
      table.string('image_url').nullable()

      // Library status
      table.boolean('requested').defaultTo(false)

      // Configuration
      table
        .uuid('quality_profile_id')
        .references('id')
        .inTable('quality_profiles')
        .onDelete('SET NULL')
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
