import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Versions now belong to a movie or to an episode, so the table loses
    // "movie" from its name and gains the episode it may belong to instead.
    this.schema.renameTable('movie_versions', 'media_versions')

    this.schema.alterTable('media_versions', (table) => {
      table.uuid('movie_id').nullable().alter()
      table.uuid('episode_id').nullable().references('id').inTable('episodes').onDelete('CASCADE')
      // Lets a show page count and list its versions without a join per row.
      table.uuid('tv_show_id').nullable().references('id').inTable('tv_shows').onDelete('CASCADE')
      table.unique(['episode_id', 'label'])
      table.index(['tv_show_id'])
    })

    this.schema.raw(`
      ALTER TABLE "media_versions"
      ADD CONSTRAINT "media_versions_one_owner"
      CHECK (("movie_id" IS NULL) <> ("episode_id" IS NULL))
    `)

    this.schema.alterTable('episode_files', (table) => {
      table.string('version_label', 64).nullable()
    })

    // Which libraries a profile is for: automatic runs, "create for all" and
    // the pages that offer it all follow these.
    this.schema.alterTable('version_profiles', (table) => {
      table.boolean('for_movies').notNullable().defaultTo(true)
      table.boolean('for_tv').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable('version_profiles', (table) => {
      table.dropColumn('for_movies')
      table.dropColumn('for_tv')
    })
    this.schema.alterTable('episode_files', (table) => {
      table.dropColumn('version_label')
    })
    this.schema.raw(`DELETE FROM "media_versions" WHERE "episode_id" IS NOT NULL`)
    this.schema.raw(
      'ALTER TABLE "media_versions" DROP CONSTRAINT IF EXISTS "media_versions_one_owner"'
    )
    this.schema.alterTable('media_versions', (table) => {
      table.dropUnique(['episode_id', 'label'])
      table.dropIndex(['tv_show_id'])
      table.dropColumn('episode_id')
      table.dropColumn('tv_show_id')
      table.uuid('movie_id').notNullable().alter()
    })
    this.schema.renameTable('media_versions', 'movie_versions')
  }
}
