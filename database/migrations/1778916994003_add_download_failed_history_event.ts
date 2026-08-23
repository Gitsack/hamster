import { BaseSchema } from '@adonisjs/lucid/schema'

const EVENT_TYPES = [
  'grabbed',
  'download_completed',
  'download_failed',
  'import_completed',
  'import_failed',
  'deleted',
  'renamed',
]

const PREVIOUS_EVENT_TYPES = EVENT_TYPES.filter((t) => t !== 'download_failed')

/**
 * Allow 'download_failed' in the history event log.
 *
 * A grab that never became a download is the single most useful thing to have
 * recorded — it is what tells you a release was tried and why it did not work —
 * and it was the one outcome the enum could not express.
 */
export default class extends BaseSchema {
  protected tableName = 'history'

  private async setAllowedTypes(types: string[]) {
    const values = types.map((t) => `'${t}'`).join(', ')
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE history DROP CONSTRAINT IF EXISTS history_event_type_check`)
      await db.rawQuery(
        `ALTER TABLE history ADD CONSTRAINT history_event_type_check CHECK (event_type IN (${values}))`
      )
    })
  }

  async up() {
    await this.setAllowedTypes(EVENT_TYPES)
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DELETE FROM history WHERE event_type = 'download_failed'`)
    })
    await this.setAllowedTypes(PREVIOUS_EVENT_TYPES)
  }
}
