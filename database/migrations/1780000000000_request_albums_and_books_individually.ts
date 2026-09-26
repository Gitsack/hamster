import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Music and books are requested one album / one book at a time, the way
    // movies and episodes are. An artist or author is a container, never a
    // request: its `requested` flag suggested "get everything by them" and is
    // gone. `monitored` now means what it means for a show — follow new
    // releases — and starts off for everyone. `monitored_at` records when it
    // was switched on, so only releases from then on are requested, never the
    // back catalogue.
    this.schema.alterTable('artists', (table) => {
      table.dropColumn('requested')
      table.boolean('monitored').notNullable().defaultTo(false).alter()
      table.timestamp('monitored_at', { useTz: true }).nullable()
    })

    this.schema.alterTable('authors', (table) => {
      table.dropColumn('requested')
      table.boolean('monitored').notNullable().defaultTo(false).alter()
      table.timestamp('monitored_at', { useTz: true }).nullable()
    })

    this.defer(async (db) => {
      await db.from('artists').update({ monitored: false })
      await db.from('authors').update({ monitored: false })

      // A fresh start for what is still missing. Requests used to be made a
      // whole artist or author at a time, so the wanted list is full of things
      // nobody picked; everything not yet on disk goes back to unrequested and
      // is re-requested by hand. Albums and books already downloaded keep
      // their files and are untouched.
      await db.rawQuery(`
        UPDATE albums SET requested = false
        WHERE requested = true
          AND (
            NOT EXISTS (SELECT 1 FROM tracks t WHERE t.album_id = albums.id)
            OR EXISTS (SELECT 1 FROM tracks t WHERE t.album_id = albums.id AND t.has_file = false)
          )
      `)
      await db.from('books').where('requested', true).where('has_file', false).update({
        requested: false,
      })
    })
  }

  async down() {
    this.schema.alterTable('artists', (table) => {
      table.boolean('requested').notNullable().defaultTo(false)
      table.boolean('monitored').notNullable().defaultTo(true).alter()
      table.dropColumn('monitored_at')
    })

    this.schema.alterTable('authors', (table) => {
      table.boolean('requested').defaultTo(false)
      table.dropColumn('monitored_at')
    })
  }
}
