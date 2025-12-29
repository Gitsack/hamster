import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'book_files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('book_id').unsigned().references('id').inTable('books').onDelete('CASCADE').notNullable()

      table.string('relative_path').notNullable()
      table.bigInteger('size_bytes').notNullable()
      table.string('format').nullable() // epub, pdf, mobi, azw3, etc.
      table.string('quality').nullable()

      table.timestamp('date_added').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
