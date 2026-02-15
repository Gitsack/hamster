import { test } from '@japa/runner'
import ApiKey from '#models/api_key'
import User from '#models/user'
import ApiKeysController from '#controllers/api_keys_controller'

test.group('ApiKeysController', (group) => {
  let user: User

  group.setup(async () => {
    user = await User.create({
      fullName: 'ApiKeys Test User',
      email: 'apikeys-test@example.com',
      password: 'password123',
      isAdmin: false,
      preferences: {},
    })
  })

  group.teardown(async () => {
    await ApiKey.query().where('userId', user.id).delete()
    await User.query().where('id', user.id).delete()
  })

  // ---- index ----

  test('index returns list of API keys for the authenticated user', async ({ assert }) => {
    const key1 = await ApiKey.create({ userId: user.id, name: 'ApiKeys Test Key 1', key: 'abcdefgh1234567890abcdefgh123456' })
    const key2 = await ApiKey.create({ userId: user.id, name: 'ApiKeys Test Key 2', key: 'zyxwvuts0987654321zyxwvuts098765' })

    const controller = new ApiKeysController()
    let result: unknown[] = []

    await controller.index({
      auth: { user },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((k: any) => k.name)
    assert.include(names, 'ApiKeys Test Key 1')
    assert.include(names, 'ApiKeys Test Key 2')

    // Verify key is masked (prefix only)
    const entry = result.find((k: any) => k.name === 'ApiKeys Test Key 1') as Record<string, unknown>
    assert.isTrue((entry.keyPrefix as string).endsWith('...'))
    assert.equal((entry.keyPrefix as string).length, 11) // 8 chars + '...'

    // Cleanup
    await ApiKey.query().whereIn('id', [key1.id, key2.id]).delete()
  })

  test('index returns empty list when user has no keys', async ({ assert }) => {
    const controller = new ApiKeysController()
    let result: unknown[] = []

    await controller.index({
      auth: { user },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isArray(result)
    // Filter to only keys belonging to our test user (there may be none)
    const userKeys = result.filter((k: any) => k.name?.startsWith('ApiKeys Test'))
    assert.equal(userKeys.length, 0)
  })

  // ---- store ----

  test('store creates a new API key and returns full key', async ({ assert }) => {
    const controller = new ApiKeysController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      auth: { user },
      request: {
        validateUsing: async () => ({ name: 'ApiKeys Test New Key' }),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.name, 'ApiKeys Test New Key')
    assert.isNotNull(result.id)
    assert.isString(result.key)
    // The full key should be a 64-char hex string (32 bytes)
    assert.equal((result.key as string).length, 64)
    assert.isNotNull(result.createdAt)

    // Cleanup
    if (result.id) {
      await ApiKey.query().where('id', result.id as string).delete()
    }
  })

  // ---- destroy ----

  test('destroy deletes an API key belonging to the user', async ({ assert }) => {
    const apiKey = await ApiKey.create({
      userId: user.id,
      name: 'ApiKeys Test Delete Me',
      key: 'deleteme12345678901234567890abcd',
    })

    const controller = new ApiKeysController()
    let noContentCalled = false

    await controller.destroy({
      auth: { user },
      params: { id: apiKey.id },
      response: {
        noContent() {
          noContentCalled = true
        },
        notFound() {},
      },
    } as never)

    assert.isTrue(noContentCalled)

    const deleted = await ApiKey.find(apiKey.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent API key', async ({ assert }) => {
    const controller = new ApiKeysController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.destroy({
      auth: { user },
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        noContent() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = notFoundResult.error as Record<string, string>
    assert.equal(error.code, 'NOT_FOUND')
  })

  test('destroy returns notFound when key belongs to another user', async ({ assert }) => {
    const otherUser = await User.create({
      fullName: 'ApiKeys Other User',
      email: 'apikeys-other@example.com',
      password: 'password123',
      isAdmin: false,
      preferences: {},
    })

    const otherKey = await ApiKey.create({
      userId: otherUser.id,
      name: 'ApiKeys Test Other Key',
      key: 'otheruser12345678901234567890ab',
    })

    const controller = new ApiKeysController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.destroy({
      auth: { user },
      params: { id: otherKey.id },
      response: {
        noContent() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    const error = notFoundResult.error as Record<string, string>
    assert.equal(error.code, 'NOT_FOUND')

    // Key should still exist
    const stillExists = await ApiKey.find(otherKey.id)
    assert.isNotNull(stillExists)

    // Cleanup
    await ApiKey.query().where('id', otherKey.id).delete()
    await User.query().where('id', otherUser.id).delete()
  })
})
