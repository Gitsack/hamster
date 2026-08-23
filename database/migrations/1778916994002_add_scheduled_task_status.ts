import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Record the outcome of each scheduled task run.
 *
 * Previously only timing was persisted, so a task that failed on every single
 * run looked identical to one that succeeded — the failure was visible nowhere
 * except the server log.
 */
export default class extends BaseSchema {
  protected tableName = 'scheduled_tasks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('last_status').nullable()
      table.text('last_error').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('last_status')
      table.dropColumn('last_error')
    })
  }
}
