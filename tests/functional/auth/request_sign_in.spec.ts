import { test } from '@japa/runner'
import env from '#start/env'
import ApiKey from '#models/api_key'
import User from '#models/user'
import { localAccessService } from '#services/auth/local_access_service'
import { UserFactory } from '../../../database/factories/user_factory.js'

/**
 * Sign-ins that bypass the session — local access and API keys — through the
 * real HTTP stack. Both used to assign `ctx.auth.user`, which only has a
 * getter: every such request died with "Attempted to assign to readonly
 * property" (a 500) instead of being let in.
 *
 * `/api/v1/users` is admin-only, so the status also says which account the
 * request ended up acting as.
 */
const baseUrl = `http://${env.get('HOST')}:${env.get('PORT')}`
const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}${path}`, { headers: { Accept: 'application/json', ...headers } })

test.group('Request sign-in without a session', (group) => {
  let admin: User
  let member: User
  let apiKey: ApiKey

  group.setup(async () => {
    admin = await UserFactory.create({ email: 'signin-admin@example.com', isAdmin: true })
    member = await UserFactory.create({ email: 'signin-member@example.com', isAdmin: false })
    apiKey = await ApiKey.create({ userId: admin.id, name: 'signin test', key: 'signin-test-key' })
  })

  group.each.teardown(async () => {
    await localAccessService.setOptions({ enabled: false, userId: null })
  })

  group.teardown(async () => {
    await apiKey.delete()
    await User.query().whereIn('id', [admin.id, member.id]).delete()
  })

  test('local access signs a local request in as the picked admin', async ({ assert }) => {
    await localAccessService.setOptions({ enabled: true, userId: admin.id })
    const response = await get('/api/v1/users')
    assert.equal(response.status, 200)
  })

  test('local access acts as the picked account, not an admin', async ({ assert }) => {
    await localAccessService.setOptions({ enabled: true, userId: member.id })
    const response = await get('/api/v1/users')
    assert.equal(response.status, 403)
  })

  test('local access also serves pages behind silent auth', async ({ assert }) => {
    await localAccessService.setOptions({ enabled: true, userId: admin.id })
    const response = await fetch(`${baseUrl}/`)
    assert.notEqual(response.status, 500)
  })

  test('an API key signs the request in as its owner', async ({ assert }) => {
    const response = await get('/api/v1/users', { 'X-Api-Key': 'signin-test-key' })
    assert.equal(response.status, 200)
  })

  test('without local access or a key the request is refused', async ({ assert }) => {
    const response = await get('/api/v1/users')
    assert.equal(response.status, 401)
  })
})
