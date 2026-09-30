import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // A version profile describes a smaller copy to keep beside a movie's main
    // file, such as a 1080p HEVC copy for downloading to a phone. `auto`
    // profiles run on every import; the rest are only run by hand.
    this.schema.createTable('version_profiles', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 64).notNullable()
      // Goes into the file name ("Movie (2020) - Mobile.mkv"), which is how
      // Jellyfin recognises the copy as a second version of the same movie.
      table.string('label', 64).notNullable().unique()
      table.integer('max_height').notNullable().defaultTo(1080)
      // A named level rather than a CRF: the GPU and CPU encoders count on
      // different scales, and the profile should not change with the machine.
      table.string('quality', 16).notNullable().defaultTo('balanced')
      table.string('audio', 16).notNullable().defaultTo('stereo')
      table.boolean('subtitles').notNullable().defaultTo(true)
      table.boolean('auto').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })

    // One row per movie and profile, from the moment the copy is queued. The
    // row outlives its profile: deleting a profile must not orphan files on
    // disk that nothing tracks any more.
    this.schema.createTable('movie_versions', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('movie_id').notNullable().references('id').inTable('movies').onDelete('CASCADE')
      table
        .uuid('profile_id')
        .nullable()
        .references('id')
        .inTable('version_profiles')
        .onDelete('SET NULL')
      table.string('label', 64).notNullable()
      table.string('status', 16).notNullable().defaultTo('queued')
      table.string('relative_path').nullable()
      table.bigInteger('size_bytes').nullable()
      table.json('media_info').nullable()
      table.text('error').nullable()
      // A hardlink to the download, left on the local disk at import so the
      // encoder does not have to read the original back off the NAS.
      table.text('staged_source_path').nullable()
      table.string('encoder', 16).nullable()
      table.timestamp('heartbeat_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
      table.unique(['movie_id', 'label'])
      table.index(['status'])
    })

    // Set when the main file is itself a version whose original was removed,
    // so it is not encoded again and the page can say what it is.
    this.schema.alterTable('movie_files', (table) => {
      table.string('version_label', 64).nullable()
    })
  }

  async down() {
    this.schema.alterTable('movie_files', (table) => {
      table.dropColumn('version_label')
    })
    this.schema.dropTable('movie_versions')
    this.schema.dropTable('version_profiles')
  }
}
