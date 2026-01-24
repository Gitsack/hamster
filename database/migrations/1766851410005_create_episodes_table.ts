import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'episodes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table
        .uuid('tv_show_id')
        .references('id')
        .inTable('tv_shows')
        .onDelete('CASCADE')
        .notNullable()
      table.uuid('season_id').references('id').inTable('seasons').onDelete('CASCADE').notNullable()

      // External IDs
      table.string('tmdb_id').nullable()
      table.string('imdb_id').nullable()

      // Basic info
      table.integer('season_number').notNullable()
      table.integer('episode_number').notNullable()
      table.string('title').nullable()
      table.text('overview').nullable()
      table.date('air_date').nullable()
      table.integer('runtime').nullable() // minutes

      // Media
      table.string('still_url').nullable()

      // Ratings
      table.float('rating').nullable()
      table.integer('votes').nullable()

      // Library status
      table.boolean('requested').defaultTo(false)
      table.boolean('has_file').defaultTo(false)
      table.uuid('episode_file_id').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Unique constraint
      table.unique(['tv_show_id', 'season_number', 'episode_number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
