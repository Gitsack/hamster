import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ─── Single-column indexes on movies ───
    this.schema.alterTable('movies', (table) => {
      table.index(['title'], 'movies_title_index')
      table.index(['requested'], 'movies_requested_index')
      table.index(['has_file'], 'movies_has_file_index')
      table.index(['release_date'], 'movies_release_date_index')
      // Composite index for common filtered queries
      table.index(['requested', 'has_file'], 'movies_requested_has_file_index')
    })

    // ─── Single-column indexes on tv_shows ───
    this.schema.alterTable('tv_shows', (table) => {
      table.index(['title'], 'tv_shows_title_index')
      table.index(['requested'], 'tv_shows_requested_index')
    })

    // ─── Single-column indexes on episodes ───
    this.schema.alterTable('episodes', (table) => {
      table.index(['has_file'], 'episodes_has_file_index')
      table.index(['air_date'], 'episodes_air_date_index')
      // Composite index for common filtered queries
      table.index(['requested', 'has_file'], 'episodes_requested_has_file_index')
    })

    // ─── Single-column indexes on books ───
    this.schema.alterTable('books', (table) => {
      table.index(['title'], 'books_title_index')
      table.index(['requested'], 'books_requested_index')
      table.index(['has_file'], 'books_has_file_index')
      table.index(['author_id'], 'books_author_id_index')
      // Composite index for common filtered queries
      table.index(['requested', 'has_file'], 'books_requested_has_file_index')
    })

    // ─── Single-column indexes on artists ───
    this.schema.alterTable('artists', (table) => {
      table.index(['monitored'], 'artists_monitored_index')
    })

    // ─── Single-column indexes on albums ───
    this.schema.alterTable('albums', (table) => {
      table.index(['monitored'], 'albums_monitored_index')
      table.index(['requested'], 'albums_requested_index')
    })

    // ─── Single-column indexes on downloads ───
    this.schema.alterTable('downloads', (table) => {
      table.index(['status'], 'downloads_status_index')
      table.index(['media_type'], 'downloads_media_type_index')
    })

    // ─── Single-column indexes on movie_files ───
    this.schema.alterTable('movie_files', (table) => {
      table.index(['movie_id'], 'movie_files_movie_id_index')
    })

    // ─── Indexes and new FK columns on history ───
    this.schema.alterTable('history', (table) => {
      // Indexes on existing columns
      table.index(['event_type'], 'history_event_type_index')
      table.index(['album_id'], 'history_album_id_index')
      table.index(['artist_id'], 'history_artist_id_index')

      // New nullable FK columns for non-music media types
      table.uuid('movie_id').nullable()
      table.uuid('tv_show_id').nullable()
      table.uuid('episode_id').nullable()
      table.uuid('book_id').nullable()
      table.uuid('movie_file_id').nullable()
      table.uuid('episode_file_id').nullable()
      table.uuid('book_file_id').nullable()

      // Foreign key constraints
      table.foreign('movie_id').references('id').inTable('movies').onDelete('SET NULL')
      table.foreign('tv_show_id').references('id').inTable('tv_shows').onDelete('SET NULL')
      table.foreign('episode_id').references('id').inTable('episodes').onDelete('SET NULL')
      table.foreign('book_id').references('id').inTable('books').onDelete('SET NULL')
      table.foreign('movie_file_id').references('id').inTable('movie_files').onDelete('SET NULL')
      table
        .foreign('episode_file_id')
        .references('id')
        .inTable('episode_files')
        .onDelete('SET NULL')
      table.foreign('book_file_id').references('id').inTable('book_files').onDelete('SET NULL')

      // Indexes on new FK columns
      table.index(['movie_id'], 'history_movie_id_index')
      table.index(['tv_show_id'], 'history_tv_show_id_index')
      table.index(['episode_id'], 'history_episode_id_index')
      table.index(['book_id'], 'history_book_id_index')
    })

    // ─── Fix download_clients type column to support torrent clients ───
    // Knex enum() creates a CHECK constraint, not a native PG enum type.
    // Drop the old constraint and add an expanded one.
    this.schema.raw('ALTER TABLE "download_clients" DROP CONSTRAINT IF EXISTS "download_clients_type_check"')
    this.schema.raw(`
      ALTER TABLE "download_clients"
      ADD CONSTRAINT "download_clients_type_check"
      CHECK ("type" IN ('sabnzbd', 'nzbget', 'qbittorrent', 'transmission', 'deluge', 'rtorrent'))
    `)
  }

  async down() {
    // ─── Remove history FK columns and indexes ───
    this.schema.alterTable('history', (table) => {
      table.dropIndex([], 'history_book_id_index')
      table.dropIndex([], 'history_episode_id_index')
      table.dropIndex([], 'history_tv_show_id_index')
      table.dropIndex([], 'history_movie_id_index')

      table.dropForeign(['book_file_id'])
      table.dropForeign(['episode_file_id'])
      table.dropForeign(['movie_file_id'])
      table.dropForeign(['book_id'])
      table.dropForeign(['episode_id'])
      table.dropForeign(['tv_show_id'])
      table.dropForeign(['movie_id'])

      table.dropColumn('book_file_id')
      table.dropColumn('episode_file_id')
      table.dropColumn('movie_file_id')
      table.dropColumn('book_id')
      table.dropColumn('episode_id')
      table.dropColumn('tv_show_id')
      table.dropColumn('movie_id')

      table.dropIndex([], 'history_artist_id_index')
      table.dropIndex([], 'history_album_id_index')
      table.dropIndex([], 'history_event_type_index')
    })

    // ─── Remove movie_files index ───
    this.schema.alterTable('movie_files', (table) => {
      table.dropIndex([], 'movie_files_movie_id_index')
    })

    // ─── Remove downloads indexes ───
    this.schema.alterTable('downloads', (table) => {
      table.dropIndex([], 'downloads_media_type_index')
      table.dropIndex([], 'downloads_status_index')
    })

    // ─── Remove albums indexes ───
    this.schema.alterTable('albums', (table) => {
      table.dropIndex([], 'albums_requested_index')
      table.dropIndex([], 'albums_monitored_index')
    })

    // ─── Remove artists index ───
    this.schema.alterTable('artists', (table) => {
      table.dropIndex([], 'artists_monitored_index')
    })

    // ─── Remove books indexes ───
    this.schema.alterTable('books', (table) => {
      table.dropIndex([], 'books_requested_has_file_index')
      table.dropIndex([], 'books_author_id_index')
      table.dropIndex([], 'books_has_file_index')
      table.dropIndex([], 'books_requested_index')
      table.dropIndex([], 'books_title_index')
    })

    // ─── Remove episodes indexes ───
    this.schema.alterTable('episodes', (table) => {
      table.dropIndex([], 'episodes_requested_has_file_index')
      table.dropIndex([], 'episodes_air_date_index')
      table.dropIndex([], 'episodes_has_file_index')
    })

    // ─── Remove tv_shows indexes ───
    this.schema.alterTable('tv_shows', (table) => {
      table.dropIndex([], 'tv_shows_requested_index')
      table.dropIndex([], 'tv_shows_title_index')
    })

    // ─── Remove movies indexes ───
    this.schema.alterTable('movies', (table) => {
      table.dropIndex([], 'movies_requested_has_file_index')
      table.dropIndex([], 'movies_release_date_index')
      table.dropIndex([], 'movies_has_file_index')
      table.dropIndex([], 'movies_requested_index')
      table.dropIndex([], 'movies_title_index')
    })

    // Restore original CHECK constraint for download_clients type
    this.schema.raw('ALTER TABLE "download_clients" DROP CONSTRAINT IF EXISTS "download_clients_type_check"')
    this.schema.raw(`
      ALTER TABLE "download_clients"
      ADD CONSTRAINT "download_clients_type_check"
      CHECK ("type" IN ('sabnzbd', 'nzbget'))
    `)
  }
}
