import { test } from '@japa/runner'
import env from '#start/env'
import User from '#models/user'
import { localAccessService } from '#services/auth/local_access_service'
import { UserFactory } from '../../../database/factories/user_factory.js'

/**
 * /settings is the Overview for admins and sends everyone else to Profile.
 * Checked over real HTTP, signed in by local access, so the route table and
 * the admin branch are exercised together.
 */
const baseUrl = `http://${env.get('HOST')}:${env.get('PORT')}`

/** An Inertia visit: learn the asset version first (a mismatch answers 409). */
async function inertiaVisit(path: string) {
  const visit = (version = '') =>
    fetch(`${baseUrl}${path}`, {
      redirect: 'manual',
      headers: {
        'X-Inertia': 'true',
        'X-Inertia-Version': version,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
  const probe = await visit()
  const { version } = (await probe.json()) as { version?: string }
  return visit(version ?? '')
}

test.group('Settings routes', (group) => {
  let admin: User
  let member: User

  group.setup(async () => {
    admin = await UserFactory.create({ email: 'settings-routes-admin@example.com', isAdmin: true })
    member = await UserFactory.create({ email: 'settings-routes@example.com', isAdmin: false })
  })

  group.teardown(async () => {
    await localAccessService.setOptions({ enabled: false, userId: null })
    await User.query().whereIn('id', [admin.id, member.id]).delete()
  })

  test('an admin gets the Overview with its facts', async ({ assert }) => {
    await localAccessService.setOptions({ enabled: true, userId: admin.id })
    const response = await inertiaVisit('/settings')
    assert.equal(response.status, 200)
    const page = (await response.json()) as {
      component: string
      props: { overview: Record<string, any> | null; systemHealth?: { failing: string[] } }
    }
    assert.equal(page.component, 'settings/index')
    assert.isNotNull(page.props.overview)
    const overview = page.props.overview!
    for (const key of [
      'media',
      'quality',
      'discovery',
      'indexers',
      'downloadClients',
      'notifications',
      'users',
      'system',
    ]) {
      assert.property(overview, key)
    }
    assert.isAtLeast(overview.users.admins, 1)
    assert.isNumber(overview.notifications.failedDeliveries24h)
    assert.isArray(page.props.systemHealth?.failing)
  })

  test('a non-admin is sent to Profile', async ({ assert }) => {
    await localAccessService.setOptions({ enabled: true, userId: member.id })
    const response = await fetch(`${baseUrl}/settings`, { redirect: 'manual' })
    assert.equal(response.status, 302)
    assert.equal(new URL(response.headers.get('location')!, baseUrl).pathname, '/settings/profile')
  })

  test('a non-admin still cannot open admin settings pages', async ({ assert }) => {
    await localAccessService.setOptions({ enabled: true, userId: member.id })
    const response = await fetch(`${baseUrl}/settings/system`, { redirect: 'manual' })
    assert.notEqual(response.status, 200)
  })

  test('the pages Media Management split into keep their old URLs', async ({ assert }) => {
    await localAccessService.setOptions({ enabled: true, userId: admin.id })
    for (const [from, to] of [
      ['/settings/media-management', '/settings/media'],
      ['/settings/playback', '/settings/media#playback'],
    ]) {
      const response = await fetch(`${baseUrl}${from}`, { redirect: 'manual' })
      assert.equal(response.status, 301, from)
      const location = new URL(response.headers.get('location')!, baseUrl)
      assert.equal(`${location.pathname}${location.hash}`, to, from)
    }
  })

  test('every settings page an admin can reach still renders', async ({ assert }) => {
    await localAccessService.setOptions({ enabled: true, userId: admin.id })
    for (const [path, component] of [
      ['/settings/media', 'settings/media'],
      ['/settings/quality', 'settings/quality'],
      ['/settings/discovery', 'settings/discovery'],
      ['/settings/indexers', 'settings/indexers'],
      ['/settings/download-clients', 'settings/download-clients'],
      ['/settings/notifications', 'settings/notifications'],
      ['/settings/users', 'settings/users'],
      ['/settings/system', 'settings/system'],
      ['/settings/profile', 'settings/ui'],
    ]) {
      const response = await inertiaVisit(path)
      assert.equal(response.status, 200, path)
      const page = (await response.json()) as { component: string }
      assert.equal(page.component, component, path)
    }
  })
})
