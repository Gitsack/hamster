import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Add scan status columns to root_folders
    this.schema.alterTable('root_folders', (table) => {
      table.timestamp('last_scanned_at').nullable()
      table.string('scan_status', 50).defaultTo('idle') // 'idle', 'scanning', 'completed', 'failed'
    })

    // Add needs_review flag to media entities
    this.schema.alterTable('movies', (table) => {
      table.boolean('needs_review').defaultTo(false)
    })

    this.schema.alterTable('tv_shows', (table) => {
      table.boolean('needs_review').defaultTo(false)
    })

    this.schema.alterTable('artists', (table) => {
      table.boolean('needs_review').defaultTo(false)
    })

    this.schema.alterTable('authors', (table) => {
      table.boolean('needs_review').defaultTo(false)
    })

    // Create unmatched_files table
    this.schema.createTable('unmatched_files', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('root_folder_id').references('id').inTable('root_folders').onDelete('CASCADE')

      table.text('relative_path').notNullable()
      table.string('file_name', 500).notNullable()
      table.string('media_type', 50).notNullable() // 'music', 'movies', 'tv', 'books'
      table.bigint('file_size_bytes').nullable()

      // Parsed information from folder/file name
      table.json('parsed_info').nullable()

      // Status for manual review workflow
      table.string('status', 50).defaultTo('pending') // 'pending', 'matched', 'ignored'

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Index for querying by status and media type
      table.index(['status', 'media_type'])
      table.index(['root_folder_id'])
    })
  }

  async down() {
    // Drop unmatched_files table
    this.schema.dropTable('unmatched_files')

    // Remove needs_review from media entities
    this.schema.alterTable('authors', (table) => {
      table.dropColumn('needs_review')
    })

    this.schema.alterTable('artists', (table) => {
      table.dropColumn('needs_review')
    })

    this.schema.alterTable('tv_shows', (table) => {
      table.dropColumn('needs_review')
    })

    this.schema.alterTable('movies', (table) => {
      table.dropColumn('needs_review')
    })

    // Remove scan status columns from root_folders
    this.schema.alterTable('root_folders', (table) => {
      table.dropColumn('scan_status')
      table.dropColumn('last_scanned_at')
    })
  }
}
