import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'seasons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('tv_show_id').unsigned().references('id').inTable('tv_shows').onDelete('CASCADE').notNullable()

      // External IDs
      table.string('tmdb_id').nullable()

      // Basic info
      table.integer('season_number').notNullable()
      table.string('title').nullable()
      table.text('overview').nullable()
      table.date('air_date').nullable()

      // Media
      table.string('poster_url').nullable()

      // Stats
      table.integer('episode_count').defaultTo(0)

      // Library status
      table.boolean('wanted').defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Unique constraint
      table.unique(['tv_show_id', 'season_number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
