import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ─── Tags table ───
    this.schema.createTable('tags', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 255).notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // ─── Media tags junction table ───
    this.schema.createTable('media_tags', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tag_id').notNullable().references('id').inTable('tags').onDelete('CASCADE')
      table.string('media_type', 50).notNullable() // 'movie' | 'tvshow' | 'artist' | 'author'
      table.uuid('media_id').notNullable()
      table.timestamp('created_at').notNullable()

      table.unique(['tag_id', 'media_type', 'media_id'])
      table.index(['media_type', 'media_id'], 'media_tags_media_index')
      table.index(['tag_id'], 'media_tags_tag_id_index')
    })

    // ─── Indexer tags junction table ───
    this.schema.createTable('indexer_tags', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tag_id').notNullable().references('id').inTable('tags').onDelete('CASCADE')
      table
        .uuid('indexer_id')
        .notNullable()
        .references('id')
        .inTable('indexers')
        .onDelete('CASCADE')
      table.timestamp('created_at').notNullable()

      table.unique(['tag_id', 'indexer_id'])
    })

    // ─── Download client tags junction table ───
    this.schema.createTable('download_client_tags', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tag_id').notNullable().references('id').inTable('tags').onDelete('CASCADE')
      table
        .uuid('download_client_id')
        .notNullable()
        .references('id')
        .inTable('download_clients')
        .onDelete('CASCADE')
      table.timestamp('created_at').notNullable()

      table.unique(['tag_id', 'download_client_id'])
    })

    // ─── Custom formats table ───
    this.schema.createTable('custom_formats', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 255).notNullable()
      table.boolean('include_when_renaming').notNullable().defaultTo(false)
      table.jsonb('specifications').notNullable().defaultTo('[]')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // ─── Quality profile custom formats junction table ───
    this.schema.createTable('quality_profile_custom_formats', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('quality_profile_id')
        .notNullable()
        .references('id')
        .inTable('quality_profiles')
        .onDelete('CASCADE')
      table
        .uuid('custom_format_id')
        .notNullable()
        .references('id')
        .inTable('custom_formats')
        .onDelete('CASCADE')
      table.integer('score').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()

      table.unique(['quality_profile_id', 'custom_format_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('quality_profile_custom_formats')
    this.schema.dropTableIfExists('custom_formats')
    this.schema.dropTableIfExists('download_client_tags')
    this.schema.dropTableIfExists('indexer_tags')
    this.schema.dropTableIfExists('media_tags')
    this.schema.dropTableIfExists('tags')
  }
}
