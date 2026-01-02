import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Drop the foreign key column from artists
    this.schema.alterTable('artists', (table) => {
      table.dropColumn('metadata_profile_id')
    })

    // Drop the foreign key column from user_settings
    this.schema.alterTable('user_settings', (table) => {
      table.dropColumn('default_metadata_profile_id')
    })
  }

  async afterUp() {
    // Then drop the metadata_profiles table with CASCADE
    this.defer(async (db) => {
      await db.rawQuery('DROP TABLE IF EXISTS metadata_profiles CASCADE')
    })
  }

  async down() {
    // Recreate metadata_profiles table
    this.schema.createTable('metadata_profiles', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 255).notNullable()
      table.json('primary_album_types').notNullable()
      table.json('secondary_album_types').notNullable()
      table.json('release_statuses').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Re-add the foreign key column to artists
    this.schema.alterTable('artists', (table) => {
      table
        .uuid('metadata_profile_id')
        .nullable()
        .references('id')
        .inTable('metadata_profiles')
        .onDelete('SET NULL')
    })

    // Re-add the foreign key column to user_settings
    this.schema.alterTable('user_settings', (table) => {
      table
        .uuid('default_metadata_profile_id')
        .nullable()
        .references('id')
        .inTable('metadata_profiles')
        .onDelete('SET NULL')
    })
  }
}
