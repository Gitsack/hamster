import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Jellyfin 10.11 and later answer 401 to `?api_key=` in the URL, so the
 * library refresh webhooks made from the Jellyfin preset stopped working.
 * Move the key into the MediaBrowser Authorization header, which every
 * Jellyfin version accepts. Emby still takes `api_key`, so its hooks (told
 * apart by name, as the settings page does) are left alone.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      const hooks = await db
        .from('webhooks')
        .select('id', 'name', 'url', 'headers')
        .where('url', 'like', '%/Library/Refresh%api_key=%')

      for (const hook of hooks) {
        if (/emby/i.test(hook.name ?? '')) continue

        let url: URL
        try {
          url = new URL(hook.url)
        } catch {
          continue
        }
        if (!/\/Library\/Refresh\/?$/.test(url.pathname)) continue
        const apiKey = url.searchParams.get('api_key')
        if (!apiKey) continue

        const headers: Record<string, string> =
          typeof hook.headers === 'string' ? JSON.parse(hook.headers) : (hook.headers ?? {})
        const hasAuth = Object.keys(headers).some((name) => name.toLowerCase() === 'authorization')
        if (!hasAuth) headers.Authorization = `MediaBrowser Token="${apiKey}"`

        url.searchParams.delete('api_key')
        await db
          .from('webhooks')
          .where('id', hook.id)
          .update({ url: url.toString(), headers: JSON.stringify(headers) })
      }
    })
  }

  async down() {
    // The header form works on every Jellyfin version; nothing to undo.
  }
}
