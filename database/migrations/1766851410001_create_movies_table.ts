import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'movies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      // External IDs
      table.string('tmdb_id').nullable().unique()
      table.string('imdb_id').nullable()

      // Basic info
      table.string('title').notNullable()
      table.string('original_title').nullable()
      table.string('sort_title').nullable()
      table.text('overview').nullable()
      table.date('release_date').nullable()
      table.integer('year').nullable()
      table.integer('runtime').nullable() // minutes
      table.string('status').nullable() // released, announced, in_production

      // Media
      table.string('poster_url').nullable()
      table.string('backdrop_url').nullable()

      // Ratings
      table.float('rating').nullable()
      table.integer('votes').nullable()

      // Genres and tags
      table.json('genres').nullable()

      // Library status
      table.boolean('requested').defaultTo(false)
      table.boolean('has_file').defaultTo(false)

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
