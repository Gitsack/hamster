import { test } from '@japa/runner'
import env from '#start/env'
import User from '#models/user'
import { localAccessService } from '#services/auth/local_access_service'
import { UserFactory } from '../../../database/factories/user_factory.js'

/**
 * Activity is one Inertia page with a URL per tab. Every old address keeps
 * working: /activity/queue answers with a permanent redirect, and the tab URLs
 * render the same component with the right tab.
 */
const baseUrl = `http://${env.get('HOST')}:${env.get('PORT')}`

test.group('Activity routes', (group) => {
  let member: User

  group.setup(async () => {
    member = await UserFactory.create({ email: 'activity-routes@example.com', isAdmin: false })
    // Sign requests in without a session, as the operator's own machine would be.
    await localAccessService.setOptions({ enabled: true, userId: member.id })
  })

  group.teardown(async () => {
    await localAccessService.setOptions({ enabled: false, userId: null })
    await User.query().where('id', member.id).delete()
  })

  test('/activity/queue redirects permanently to /activity', async ({ assert }) => {
    const response = await fetch(`${baseUrl}/activity/queue`, { redirect: 'manual' })
    assert.equal(response.status, 301)
    assert.equal(new URL(response.headers.get('location')!, baseUrl).pathname, '/activity')
  })

  for (const [path, tab] of [
    ['/activity', 'queue'],
    ['/activity/imports', 'imports'],
    ['/activity/history', 'history'],
  ] as const) {
    test(`${path} renders the ${tab} tab`, async ({ assert }) => {
      // An Inertia visit answers with the page object rather than the HTML shell. The
      // first one learns the asset version (a mismatch answers 409); the second is a
      // normal visit carrying it.
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
      const response = await visit(version ?? '')

      assert.equal(response.status, 200)
      const page = (await response.json()) as { component: string; props: { tab: string } }
      assert.equal(page.component, 'activity/index')
      assert.equal(page.props.tab, tab)
    })
  }

  test('/api/v1/activity/counts answers any signed-in user', async ({ assert }) => {
    const response = await fetch(`${baseUrl}/api/v1/activity/counts`, {
      headers: { Accept: 'application/json' },
    })
    assert.equal(response.status, 200)
    const counts = (await response.json()) as Record<string, unknown>
    for (const key of ['active', 'failed', 'importing', 'stuckImporting', 'unmatchedPending']) {
      assert.isNumber(counts[key], key)
    }
  })
})
