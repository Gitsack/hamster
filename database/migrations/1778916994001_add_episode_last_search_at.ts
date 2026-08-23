import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Track when each episode was last searched.
 *
 * The requested-episode search processes a fixed number of episodes per run over
 * an unordered query, so without a round-robin key it re-searched the same first
 * few episodes every hour and the rest of the wanted list was never reached.
 */
export default class extends BaseSchema {
  protected tableName = 'episodes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('last_search_at', { useTz: true }).nullable()
    })

    // Serves the wanted-episode query, which orders by last_search_at with
    // never-searched episodes first.
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['requested', 'has_file', 'last_search_at'], 'episodes_wanted_search_order_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(
        ['requested', 'has_file', 'last_search_at'],
        'episodes_wanted_search_order_index'
      )
      table.dropColumn('last_search_at')
    })
  }
}
