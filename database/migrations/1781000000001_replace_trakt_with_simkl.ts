import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  // ALTER TYPE ... ADD VALUE cannot run inside a transaction block on every
  // Postgres version this app supports.
  static disableTransactions = true

  async up() {
    // Trakt made API apps a paid (VIP) feature in August 2026 and deleted the
    // free ones, so every Trakt integration here stopped working. Simkl takes
    // its place: trending lanes, a watchlist import list, and taste signals
    // for the For you deck.
    this.schema.raw(`ALTER TYPE import_list_type ADD VALUE IF NOT EXISTS 'simkl_watchlist'`)

    this.defer(async (db) => {
      // Postgres cannot drop enum values; the Trakt ones stay in the type but
      // nothing accepts or creates them any more.
      await db.from('import_lists').whereIn('type', ['trakt_watchlist', 'trakt_list']).delete()

      await db
        .from('app_settings')
        .whereIn('key', ['traktClientId', 'traktClientSecret', 'traktSession', 'traktUsername'])
        .delete()

      // Whoever had the Trakt lanes switched on gets the Simkl ones instead.
      const row = await db.from('app_settings').where('key', 'recommendationSettings').first()
      if (row) {
        const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
        if (value && typeof value === 'object') {
          const { traktEnabled, ...rest } = value as Record<string, unknown>
          await db
            .from('app_settings')
            .where('key', 'recommendationSettings')
            .update({
              value: JSON.stringify({ ...rest, simklEnabled: rest.simklEnabled ?? !!traktEnabled }),
            })
        }
      }
    })
  }

  async down() {
    // Nothing to restore: the Trakt credentials no longer work.
  }
}
