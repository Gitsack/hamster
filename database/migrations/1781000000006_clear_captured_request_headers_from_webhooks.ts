import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * request.validateUsing() mixed the incoming request's own headers into the
 * webhook form's `headers` field, so saving a webhook stored the browser's
 * Host, Cookie (the admin's session) and friends as the webhook's headers,
 * and sent them with every delivery. The headers the operator typed were
 * lost in the same step, so nothing worth keeping is in these rows: clear
 * them. A browser request always carries `host`; a hand-written webhook
 * header set never does.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      const hooks = await db.from('webhooks').select('id', 'headers').whereNotNull('headers')

      for (const hook of hooks) {
        const headers: Record<string, unknown> =
          typeof hook.headers === 'string' ? JSON.parse(hook.headers) : hook.headers
        if (!headers || typeof headers !== 'object') continue
        const names = Object.keys(headers)
        const captured =
          names.includes('host') && (names.includes('cookie') || names.includes('user-agent'))
        if (captured) await db.from('webhooks').where('id', hook.id).update({ headers: null })
      }
    })
  }

  async down() {
    // The captured headers held a session cookie; they are not restored.
  }
}
