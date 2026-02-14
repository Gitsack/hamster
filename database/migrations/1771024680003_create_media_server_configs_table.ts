import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'media_server_configs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table.string('name', 255).notNullable()
      table.string('type', 50).notNullable() // plex, emby, jellyfin
      table.string('host', 255).notNullable()
      table.integer('port').notNullable()
      table.string('api_key', 500).notNullable()
      table.boolean('use_ssl').defaultTo(false)
      table.boolean('enabled').defaultTo(true)
      table.jsonb('library_sections').defaultTo('[]')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['enabled'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
