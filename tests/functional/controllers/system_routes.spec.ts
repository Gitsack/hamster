import { test } from '@japa/runner'
import env from '#start/env'
import User from '#models/user'
import { localAccessService } from '#services/auth/local_access_service'
import { UserFactory } from '../../../database/factories/user_factory.js'

/**
 * Status moved to Settings → System, and /health reads the health monitor's
 * cache. Checked over real HTTP so the route table itself is exercised.
 */
const baseUrl = `http://${env.get('HOST')}:${env.get('PORT')}`

test.group('System routes', (group) => {
  let admin: User

  group.setup(async () => {
    admin = await UserFactory.create({ email: 'system-routes@example.com', isAdmin: true })
    await localAccessService.setOptions({ enabled: true, userId: admin.id })
  })

  group.teardown(async () => {
    await localAccessService.setOptions({ enabled: false, userId: null })
    await User.query().where('id', admin.id).delete()
  })

  test('/system/status redirects permanently to /settings/system#health', async ({ assert }) => {
    const response = await fetch(`${baseUrl}/system/status`, { redirect: 'manual' })
    assert.equal(response.status, 301)
    const location = new URL(response.headers.get('location')!, baseUrl)
    assert.equal(`${location.pathname}${location.hash}`, '/settings/system#health')
  })

  test('/health answers without a session and never 5xx while starting', async ({ assert }) => {
    const response = await fetch(`${baseUrl}/health`)
    const body = (await response.json()) as { status: string; version: string }
    assert.oneOf(body.status, ['starting', 'ok', 'warning', 'error'])
    if (body.status === 'starting') assert.equal(response.status, 200)
    assert.isString(body.version)
  })

  test('GET /api/v1/system/health-summary returns the cached verdict', async ({ assert }) => {
    const response = await fetch(`${baseUrl}/api/v1/system/health-summary`, {
      headers: { Accept: 'application/json' },
    })
    assert.equal(response.status, 200)
    const body = (await response.json()) as Record<string, unknown>
    assert.oneOf(body.level as string, ['starting', 'ok', 'warning', 'error'])
    assert.isArray(body.checks)
    assert.isArray(body.downloadClients)
    assert.isArray(body.failedTasks)
  })

  test('POST /api/v1/system/health/check starts a background run', async ({ assert }) => {
    const response = await fetch(`${baseUrl}/api/v1/system/health/check`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    assert.equal(response.status, 202)
  })
})
