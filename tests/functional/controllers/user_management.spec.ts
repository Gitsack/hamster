import { test } from '@japa/runner'
import User from '#models/user'
import { UserFactory } from '../../../database/factories/user_factory.js'
import AdminUsersController from '#controllers/admin/users_controller'

/**
 * These tests validate the AdminUsersController business logic.
 * They require a running database (functional test suite).
 */

test.group('AdminUsersController', (group) => {
  let admin: User
  let regularUser: User

  group.setup(async () => {
    admin = await UserFactory.createAdmin({ email: 'admin-mgmt@test.com' })
    regularUser = await UserFactory.create({ email: 'regular-mgmt@test.com' })
  })

  group.teardown(async () => {
    await User.query().whereIn('email', ['admin-mgmt@test.com', 'regular-mgmt@test.com']).delete()
    // Clean up any users created in tests
    await User.query().where('email', 'like', '%@mgmt-test.com').delete()
  })

  test('index returns all users', async ({ assert }) => {
    const controller = new AdminUsersController()
    const users: Array<{ id: string; email: string }> = []

    await controller.index({
      response: {
        json(data: unknown) {
          Object.assign(users, data as unknown[])
        },
      },
    } as never)

    assert.isTrue(users.length >= 2)
    const emails = users.map((u) => u.email)
    assert.include(emails, 'admin-mgmt@test.com')
    assert.include(emails, 'regular-mgmt@test.com')
  })

  test('show returns a single user', async ({ assert }) => {
    const controller = new AdminUsersController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: admin.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.email, 'admin-mgmt@test.com')
    assert.equal(result.isAdmin, true)
  })

  test('store creates a new user', async ({ assert }) => {
    const controller = new AdminUsersController()
    let result: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          fullName: 'New User',
          email: 'new@mgmt-test.com',
          password: 'password123',
          isAdmin: false,
        }),
      },
      response: {
        created(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.email, 'new@mgmt-test.com')
    assert.equal(result.isAdmin, false)

    // Verify in DB
    const newUser = await User.findBy('email', 'new@mgmt-test.com')
    assert.isNotNull(newUser)

    // Cleanup
    await newUser?.delete()
  })

  test('update modifies user properties', async ({ assert }) => {
    const testUser = await UserFactory.create({ email: 'update@mgmt-test.com' })
    const controller = new AdminUsersController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: testUser.id },
      request: {
        validateUsing: async () => ({
          fullName: 'Updated Name',
          isAdmin: true,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.fullName, 'Updated Name')
    assert.equal(result.isAdmin, true)

    // Cleanup
    await testUser.delete()
  })

  test('destroy deletes a user', async ({ assert }) => {
    const testUser = await UserFactory.create({ email: 'delete@mgmt-test.com' })
    const controller = new AdminUsersController()
    let result: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: testUser.id },
      auth: { user: admin },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.deepEqual(result, { success: true })

    const deleted = await User.findBy('email', 'delete@mgmt-test.com')
    assert.isNull(deleted)
  })

  test('destroy prevents self-deletion', async ({ assert }) => {
    const controller = new AdminUsersController()
    let errorResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: admin.id },
      auth: { user: admin },
      response: {
        json() {},
        badRequest(data: unknown) {
          errorResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(errorResult.error, 'You cannot delete your own account')

    // Verify admin still exists
    const stillExists = await User.find(admin.id)
    assert.isNotNull(stillExists)
  })

  test('resetPassword changes user password', async ({ assert }) => {
    const testUser = await UserFactory.create({ email: 'reset@mgmt-test.com' })
    const controller = new AdminUsersController()
    let result: Record<string, unknown> = {}

    await controller.resetPassword({
      params: { id: testUser.id },
      request: {
        only: () => ({ newPassword: 'newpassword123' }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.deepEqual(result, { success: true })

    // Cleanup
    await testUser.delete()
  })

  test('resetPassword rejects short password', async ({ assert }) => {
    const controller = new AdminUsersController()
    let errorResult: Record<string, unknown> = {}

    await controller.resetPassword({
      params: { id: regularUser.id },
      request: {
        only: () => ({ newPassword: 'short' }),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          errorResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(errorResult.error, 'Password must be at least 8 characters')
  })
})
