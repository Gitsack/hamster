import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // What each user did with a "For you" card on the dashboard. A skip hides
    // the title for good and counts against its genres; a request is a
    // stronger taste signal than simply owning something. `external_id` is the
    // TMDB id for movies and shows, and our own id for albums and books, which
    // are only ever suggested from rows already in the library.
    this.schema.createTable('recommendation_feedback', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.enum('media_type', ['movie', 'tv', 'album', 'book']).notNullable()
      table.string('external_id', 64).notNullable()
      table.enum('action', ['requested', 'skipped']).notNullable()
      table.string('title').nullable()
      table.specificType('genres', 'text[]').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.unique(['user_id', 'media_type', 'external_id'])
    })

    // Artists used to be stored with their whole MusicBrainz discography,
    // compilations and live records included: 21k album rows for under 100
    // artists, most of them budget compilations nobody would request. The
    // import no longer stores those; this clears the ones already there.
    // Anything requested, on disk, or tied to a download stays.
    this.defer(async (db) => {
      await db.rawQuery(`
        DELETE FROM albums a
        WHERE a.requested = false
          AND cardinality(a.secondary_types) > 0
          AND NOT EXISTS (SELECT 1 FROM track_files tf WHERE tf.album_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM tracks t WHERE t.album_id = a.id AND t.has_file = true)
          AND NOT EXISTS (SELECT 1 FROM downloads d WHERE d.album_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM history h WHERE h.album_id = a.id)
      `)
    })
  }

  async down() {
    // The pruned albums come back with the next artist metadata refresh only if
    // the import filter is reverted too, so there is nothing to restore here.
    this.schema.dropTable('recommendation_feedback')
  }
}
