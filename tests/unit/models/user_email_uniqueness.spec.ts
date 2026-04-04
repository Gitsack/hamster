import { test } from '@japa/runner'
import User from '#models/user'
import { UserFactory } from '../../../database/factories/user_factory.js'

test.group('User email uniqueness constraint', (group) => {
  const testEmail = 'duplicate-test@example.com'

  group.teardown(async () => {
    await User.query().where('email', testEmail).delete()
  })

  test('rejects duplicate email addresses', async ({ assert }) => {
    await UserFactory.create({ email: testEmail })

    try {
      await UserFactory.create({ email: testEmail })
      assert.fail('Expected duplicate email to throw')
    } catch (error) {
      assert.equal(error.code, '23505') // PostgreSQL unique_violation
    }
  })
})
