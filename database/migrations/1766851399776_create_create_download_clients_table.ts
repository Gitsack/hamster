import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'download_clients'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 255).notNullable()
      table.enum('type', ['sabnzbd', 'nzbget']).notNullable()
      table.boolean('enabled').defaultTo(true).notNullable()
      table.integer('priority').defaultTo(1).notNullable()
      table.jsonb('settings').notNullable().defaultTo('{}')
      table.boolean('remove_completed_downloads').defaultTo(true).notNullable()
      table.boolean('remove_failed_downloads').defaultTo(true).notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
