import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // "Interested" is a third answer to a For you card: the user wants it but
    // won't request it here, usually because it streams on a service they
    // have. It hides the card like the others and counts for its genres, a
    // little under a request.
    //
    // Saved and skipped titles are listed for the user to review, so each row
    // keeps the poster and year it was shown with.
    this.schema.alterTable('recommendation_feedback', (table) => {
      table.string('poster_url', 512).nullable()
      table.integer('year').nullable()
    })
    this.schema.raw(`
      ALTER TABLE recommendation_feedback DROP CONSTRAINT recommendation_feedback_action_check;
      ALTER TABLE recommendation_feedback ADD CONSTRAINT recommendation_feedback_action_check
        CHECK (action IN ('requested', 'skipped', 'interested'));
    `)
  }

  async down() {
    this.schema.alterTable('recommendation_feedback', (table) => {
      table.dropColumn('poster_url')
      table.dropColumn('year')
    })
    this.schema.raw(`
      DELETE FROM recommendation_feedback WHERE action = 'interested';
      ALTER TABLE recommendation_feedback DROP CONSTRAINT recommendation_feedback_action_check;
      ALTER TABLE recommendation_feedback ADD CONSTRAINT recommendation_feedback_action_check
        CHECK (action IN ('requested', 'skipped'));
    `)
  }
}
