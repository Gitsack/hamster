import { test } from '@japa/runner'
import env from '#start/env'
import User from '#models/user'
import Webhook from '#models/webhook'
import { localAccessService } from '#services/auth/local_access_service'
import { UserFactory } from '../../../database/factories/user_factory.js'

/**
 * Webhooks and the notification delivery log moved onto the Notifications page.
 * Their old addresses answer with permanent redirects, and the new delivery-log
 * endpoints are reachable over real HTTP (not shadowed by /webhooks/:id).
 */
const baseUrl = `http://${env.get('HOST')}:${env.get('PORT')}`

test.group('Notifications routes', (group) => {
  let admin: User

  group.setup(async () => {
    admin = await UserFactory.create({ email: 'notifications-routes@example.com', isAdmin: true })
    await localAccessService.setOptions({ enabled: true, userId: admin.id })
  })

  group.teardown(async () => {
    await localAccessService.setOptions({ enabled: false, userId: null })
    await User.query().where('id', admin.id).delete()
  })

  for (const [from, to] of [
    ['/settings/webhooks', '/settings/notifications'],
    ['/system/events', '/settings/notifications#deliveries'],
  ] as const) {
    test(`${from} redirects permanently to ${to}`, async ({ assert }) => {
      const response = await fetch(`${baseUrl}${from}`, { redirect: 'manual' })
      assert.equal(response.status, 301)
      const location = new URL(response.headers.get('location')!, baseUrl)
      assert.equal(`${location.pathname}${location.hash}`, to)
    })
  }

  test('GET /api/v1/webhooks/history lists deliveries rather than looking up an id', async ({
    assert,
  }) => {
    const response = await fetch(`${baseUrl}/api/v1/webhooks/history?limit=5`, {
      headers: { Accept: 'application/json' },
    })
    assert.equal(response.status, 200)
    assert.isArray(await response.json())
  })

  test('DELETE /api/v1/notifications/history is routed to clearHistory', async ({ assert }) => {
    const response = await fetch(
      `${baseUrl}/api/v1/notifications/history?providerId=00000000-0000-0000-0000-000000000000`,
      { method: 'DELETE', headers: { Accept: 'application/json' } }
    )
    assert.equal(response.status, 204)
  })

  test('a webhook stores the headers it was given, not the request carrying them', async ({
    assert,
  }) => {
    const json = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    const created = await fetch(`${baseUrl}/api/v1/webhooks`, {
      method: 'POST',
      headers: { ...json, Cookie: 'hamster-session=browser-session' },
      body: JSON.stringify({
        name: 'Routes test Jellyfin',
        // A Docker service name: no TLD.
        url: 'http://jellyfin:8096/Library/Refresh',
        headers: { Authorization: 'MediaBrowser Token="k3y"' },
      }),
    })
    assert.equal(created.status, 201)
    const { id } = (await created.json()) as { id: string }

    try {
      let stored = await Webhook.findOrFail(id)
      assert.deepEqual(stored.headers, { Authorization: 'MediaBrowser Token="k3y"' })

      const updated = await fetch(`${baseUrl}/api/v1/webhooks/${id}`, {
        method: 'PUT',
        headers: { ...json, Cookie: 'hamster-session=browser-session' },
        body: JSON.stringify({
          name: 'Routes test Jellyfin',
          url: 'http://jellyfin:8096/Library/Refresh',
          headers: { 'Authorization': '****', 'X-Extra': 'yes' },
        }),
      })
      assert.equal(updated.status, 200)
      stored = await Webhook.findOrFail(id)
      assert.deepEqual(stored.headers, {
        'Authorization': 'MediaBrowser Token="k3y"',
        'X-Extra': 'yes',
      })
    } finally {
      await Webhook.query().where('id', id).delete()
    }
  })
})
