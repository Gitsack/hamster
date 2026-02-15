import { test } from '@japa/runner'
import vine, { errors } from '@vinejs/vine'

/**
 * The actual user validators in app/validators/user.ts cannot be imported in isolation
 * because they use .unique() which requires AdonisJS's VineJS plugin.
 * Instead, we recreate the validation rules here to test the same logic.
 *
 * createUserValidator rules: fullName (string, minLength 2, maxLength 255),
 *   email (string, email, unique), password (string, minLength 8),
 *   isAdmin (boolean, optional)
 *
 * updateUserValidator rules: fullName (string, minLength 2, maxLength 255, optional),
 *   email (string, email, unique excluding current user, optional),
 *   isAdmin (boolean, optional)
 */

// Recreate createUserValidator without the .unique() dependency
const createUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(2).maxLength(255),
    email: vine.string().email(),
    password: vine.string().minLength(8),
    isAdmin: vine.boolean().optional(),
  })
)

// Recreate updateUserValidator without the .unique() dependency
const updateUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(2).maxLength(255).optional(),
    email: vine.string().email().optional(),
    isAdmin: vine.boolean().optional(),
  })
)

test.group('User Validators | createUserValidator - valid inputs', () => {
  test('accepts valid user creation data', async ({ assert }) => {
    const result = await createUserValidator.validate({
      fullName: 'Jane Smith',
      email: 'jane@example.com',
      password: 'securepass',
    })
    assert.equal(result.fullName, 'Jane Smith')
    assert.equal(result.email, 'jane@example.com')
    assert.equal(result.password, 'securepass')
    assert.isUndefined(result.isAdmin)
  })

  test('accepts isAdmin as true', async ({ assert }) => {
    const result = await createUserValidator.validate({
      fullName: 'Admin User',
      email: 'admin@example.com',
      password: 'securepass',
      isAdmin: true,
    })
    assert.isTrue(result.isAdmin)
  })

  test('accepts isAdmin as false', async ({ assert }) => {
    const result = await createUserValidator.validate({
      fullName: 'Normal User',
      email: 'user@example.com',
      password: 'securepass',
      isAdmin: false,
    })
    assert.isFalse(result.isAdmin)
  })

  test('accepts minimum length full name', async ({ assert }) => {
    const result = await createUserValidator.validate({
      fullName: 'AB',
      email: 'ab@test.com',
      password: '12345678',
    })
    assert.equal(result.fullName, 'AB')
  })

  test('accepts exactly 255 character full name', async ({ assert }) => {
    const longName = 'A'.repeat(255)
    const result = await createUserValidator.validate({
      fullName: longName,
      email: 'long@test.com',
      password: '12345678',
    })
    assert.equal(result.fullName, longName)
  })

  test('accepts exactly 8 character password', async ({ assert }) => {
    const result = await createUserValidator.validate({
      fullName: 'User',
      email: 'user@test.com',
      password: '12345678',
    })
    assert.equal(result.password, '12345678')
  })
})

test.group('User Validators | createUserValidator - invalid inputs', () => {
  test('rejects missing fullName', async ({ assert }) => {
    try {
      await createUserValidator.validate({
        email: 'user@test.com',
        password: 'password123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'fullName'))
    }
  })

  test('rejects fullName shorter than 2 characters', async ({ assert }) => {
    try {
      await createUserValidator.validate({
        fullName: 'A',
        email: 'a@test.com',
        password: 'password123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'fullName'))
    }
  })

  test('rejects fullName longer than 255 characters', async ({ assert }) => {
    try {
      await createUserValidator.validate({
        fullName: 'A'.repeat(256),
        email: 'a@test.com',
        password: 'password123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'fullName'))
    }
  })

  test('rejects missing email', async ({ assert }) => {
    try {
      await createUserValidator.validate({
        fullName: 'User',
        password: 'password123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'email'))
    }
  })

  test('rejects invalid email', async ({ assert }) => {
    try {
      await createUserValidator.validate({
        fullName: 'User',
        email: 'not-valid',
        password: 'password123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'email'))
    }
  })

  test('rejects missing password', async ({ assert }) => {
    try {
      await createUserValidator.validate({
        fullName: 'User',
        email: 'user@test.com',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'password'))
    }
  })

  test('rejects password shorter than 8 characters', async ({ assert }) => {
    try {
      await createUserValidator.validate({
        fullName: 'User',
        email: 'user@test.com',
        password: '1234567',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'password'))
    }
  })

  test('rejects empty object', async ({ assert }) => {
    try {
      await createUserValidator.validate({})
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.length >= 3)
    }
  })
})

test.group('User Validators | updateUserValidator - valid inputs', () => {
  test('accepts all fields', async ({ assert }) => {
    const result = await updateUserValidator.validate({
      fullName: 'Updated Name',
      email: 'updated@test.com',
      isAdmin: true,
    })
    assert.equal(result.fullName, 'Updated Name')
    assert.equal(result.email, 'updated@test.com')
    assert.isTrue(result.isAdmin)
  })

  test('accepts empty object (all fields optional)', async ({ assert }) => {
    const result = await updateUserValidator.validate({})
    assert.isUndefined(result.fullName)
    assert.isUndefined(result.email)
    assert.isUndefined(result.isAdmin)
  })

  test('accepts only fullName', async ({ assert }) => {
    const result = await updateUserValidator.validate({
      fullName: 'New Name',
    })
    assert.equal(result.fullName, 'New Name')
    assert.isUndefined(result.email)
  })

  test('accepts only email', async ({ assert }) => {
    const result = await updateUserValidator.validate({
      email: 'new@test.com',
    })
    assert.equal(result.email, 'new@test.com')
  })

  test('accepts only isAdmin', async ({ assert }) => {
    const result = await updateUserValidator.validate({
      isAdmin: false,
    })
    assert.isFalse(result.isAdmin)
  })
})

test.group('User Validators | updateUserValidator - invalid inputs', () => {
  test('rejects fullName shorter than 2 characters when provided', async ({ assert }) => {
    try {
      await updateUserValidator.validate({
        fullName: 'X',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'fullName'))
    }
  })

  test('rejects fullName longer than 255 characters when provided', async ({ assert }) => {
    try {
      await updateUserValidator.validate({
        fullName: 'A'.repeat(256),
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'fullName'))
    }
  })

  test('rejects invalid email when provided', async ({ assert }) => {
    try {
      await updateUserValidator.validate({
        email: 'bad-email',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'email'))
    }
  })

  test('rejects non-boolean isAdmin when provided', async ({ assert }) => {
    try {
      await updateUserValidator.validate({
        isAdmin: 'yes' as any,
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'isAdmin'))
    }
  })
})
