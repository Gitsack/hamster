import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('import_lists', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 255).notNullable()
      table
        .enum('type', ['trakt_watchlist', 'trakt_list', 'imdb_list'], {
          useNative: true,
          enumName: 'import_list_type',
          existingType: false,
        })
        .notNullable()
      table.boolean('enabled').notNullable().defaultTo(true)
      table.jsonb('settings').notNullable().defaultTo('{}')
      table
        .enum('media_type', ['movies', 'tv', 'music', 'books'], {
          useNative: true,
          enumName: 'import_list_media_type',
          existingType: false,
        })
        .notNullable()
      table
        .uuid('quality_profile_id')
        .nullable()
        .references('id')
        .inTable('quality_profiles')
        .onDelete('SET NULL')
      table
        .uuid('root_folder_id')
        .nullable()
        .references('id')
        .inTable('root_folders')
        .onDelete('SET NULL')
      table.boolean('auto_add').notNullable().defaultTo(false)
      table.integer('sync_interval_minutes').notNullable().defaultTo(360)
      table.timestamp('last_synced_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists('import_lists')
    this.schema.raw('DROP TYPE IF EXISTS "import_list_type"')
    this.schema.raw('DROP TYPE IF EXISTS "import_list_media_type"')
  }
}
