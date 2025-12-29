import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tv_shows'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // External IDs
      table.string('tmdb_id').nullable().unique()
      table.string('imdb_id').nullable()
      table.string('tvdb_id').nullable()

      // Basic info
      table.string('title').notNullable()
      table.string('original_title').nullable()
      table.string('sort_title').nullable()
      table.text('overview').nullable()
      table.date('first_aired').nullable()
      table.integer('year').nullable()
      table.integer('runtime').nullable() // average episode runtime
      table.string('status').nullable() // continuing, ended, upcoming
      table.string('network').nullable()

      // Media
      table.string('poster_url').nullable()
      table.string('backdrop_url').nullable()

      // Ratings
      table.float('rating').nullable()
      table.integer('votes').nullable()

      // Genres
      table.json('genres').nullable()

      // Stats
      table.integer('season_count').defaultTo(0)
      table.integer('episode_count').defaultTo(0)

      // Library status
      table.boolean('wanted').defaultTo(false)

      // Configuration
      table.integer('quality_profile_id').unsigned().references('id').inTable('quality_profiles').onDelete('SET NULL')
      table.integer('root_folder_id').unsigned().references('id').inTable('root_folders').onDelete('SET NULL')

      table.timestamp('added_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
