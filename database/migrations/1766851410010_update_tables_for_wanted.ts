import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Add wanted column to artists (copy from monitored)
    this.schema.alterTable('artists', (table) => {
      table.boolean('wanted').defaultTo(false)
    })

    // Add wanted column to albums
    this.schema.alterTable('albums', (table) => {
      table.boolean('wanted').defaultTo(false)
    })

    // Add wanted column to tracks
    this.schema.alterTable('tracks', (table) => {
      table.boolean('wanted').defaultTo(false)
    })

    // Update downloads table to support all media types
    this.schema.alterTable('downloads', (table) => {
      table.string('media_type').nullable() // music, movies, tv, books
      table.integer('movie_id').unsigned().references('id').inTable('movies').onDelete('SET NULL').nullable()
      table.integer('tv_show_id').unsigned().references('id').inTable('tv_shows').onDelete('SET NULL').nullable()
      table.integer('episode_id').unsigned().references('id').inTable('episodes').onDelete('SET NULL').nullable()
      table.integer('book_id').unsigned().references('id').inTable('books').onDelete('SET NULL').nullable()
    })
  }

  async down() {
    this.schema.alterTable('artists', (table) => {
      table.dropColumn('wanted')
    })

    this.schema.alterTable('albums', (table) => {
      table.dropColumn('wanted')
    })

    this.schema.alterTable('tracks', (table) => {
      table.dropColumn('wanted')
    })

    this.schema.alterTable('downloads', (table) => {
      table.dropColumn('media_type')
      table.dropColumn('movie_id')
      table.dropColumn('tv_show_id')
      table.dropColumn('episode_id')
      table.dropColumn('book_id')
    })
  }
}
