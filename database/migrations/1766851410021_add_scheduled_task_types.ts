import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Add new task types to the scheduled_tasks type CHECK constraint
    // Knex enum() creates CHECK constraints, not native PG enum types
    this.schema.raw(
      'ALTER TABLE "scheduled_tasks" DROP CONSTRAINT IF EXISTS "scheduled_tasks_type_check"'
    )
    this.schema.raw(`
      ALTER TABLE "scheduled_tasks"
      ADD CONSTRAINT "scheduled_tasks_type_check"
      CHECK ("type" IN (
        'rss_sync', 'library_scan', 'cleanup', 'refresh_artist', 'backup',
        'download_monitor', 'requested_search', 'completed_scanner'
      ))
    `)
  }

  async down() {
    this.schema.raw(
      'ALTER TABLE "scheduled_tasks" DROP CONSTRAINT IF EXISTS "scheduled_tasks_type_check"'
    )
    this.schema.raw(`
      ALTER TABLE "scheduled_tasks"
      ADD CONSTRAINT "scheduled_tasks_type_check"
      CHECK ("type" IN (
        'rss_sync', 'library_scan', 'cleanup', 'refresh_artist', 'backup', 'download_monitor'
      ))
    `)
  }
}
