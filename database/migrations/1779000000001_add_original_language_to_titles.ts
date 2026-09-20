import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // The language a title was made in, as TMDB reports it (ISO 639-1). Lets a
    // quality profile ask for "whatever this was filmed in" instead of naming
    // every language in the library one at a time.
    //
    // Nullable: TMDB does not always know, and nothing here should start
    // rejecting releases because a metadata refresh has not run yet.
    this.schema.alterTable('movies', (table) => {
      table.string('original_language', 10).nullable()
    })

    this.schema.alterTable('tv_shows', (table) => {
      table.string('original_language', 10).nullable()
    })
  }

  async down() {
    this.schema.alterTable('movies', (table) => {
      table.dropColumn('original_language')
    })

    this.schema.alterTable('tv_shows', (table) => {
      table.dropColumn('original_language')
    })
  }
}
