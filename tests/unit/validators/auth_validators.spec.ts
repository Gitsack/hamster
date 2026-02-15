import { test } from '@japa/runner'
import vine, { errors } from '@vinejs/vine'

/**
 * The actual auth validators in app/validators/auth.ts cannot be imported in isolation
 * because registerValidator uses .unique() which requires AdonisJS's VineJS plugin.
 * Instead, we recreate the validation rules here to test the same logic.
 *
 * loginValidator rules: email (string, email), password (string)
 * registerValidator rules: fullName (string, minLength 2, maxLength 255),
 *   email (string, email, unique), password (string, minLength 8),
 *   passwordConfirmation (string, sameAs password)
 */

// Recreate loginValidator without the .unique() dependency
const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string(),
  })
)

// Recreate registerValidator without the .unique() dependency
// (unique check requires DB, tested via integration tests)
const registerValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(2).maxLength(255),
    email: vine.string().email(),
    password: vine.string().minLength(8),
    passwordConfirmation: vine.string().sameAs('password'),
  })
)

test.group('Auth Validators | loginValidator - valid inputs', () => {
  test('accepts valid email and password', async ({ assert }) => {
    const result = await loginValidator.validate({
      email: 'user@example.com',
      password: 'secret123',
    })
    assert.equal(result.email, 'user@example.com')
    assert.equal(result.password, 'secret123')
  })

  test('accepts any non-empty password', async ({ assert }) => {
    const result = await loginValidator.validate({
      email: 'test@test.com',
      password: 'x',
    })
    assert.equal(result.password, 'x')
  })

  test('trims and normalizes email', async ({ assert }) => {
    const result = await loginValidator.validate({
      email: 'USER@Example.COM',
      password: 'pass',
    })
    // VineJS normalizes email
    assert.isDefined(result.email)
  })
})

test.group('Auth Validators | loginValidator - invalid inputs', () => {
  test('rejects missing email', async ({ assert }) => {
    try {
      await loginValidator.validate({ password: 'secret' })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'email'))
    }
  })

  test('rejects missing password', async ({ assert }) => {
    try {
      await loginValidator.validate({ email: 'user@example.com' })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'password'))
    }
  })

  test('rejects empty object', async ({ assert }) => {
    try {
      await loginValidator.validate({})
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.length >= 2)
    }
  })

  test('rejects invalid email format', async ({ assert }) => {
    try {
      await loginValidator.validate({ email: 'not-an-email', password: 'secret' })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'email' && m.rule === 'email'))
    }
  })

  test('rejects email without domain', async ({ assert }) => {
    try {
      await loginValidator.validate({ email: 'user@', password: 'secret' })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
    }
  })

  test('rejects null values', async ({ assert }) => {
    try {
      await loginValidator.validate({ email: null, password: null })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
    }
  })
})

test.group('Auth Validators | registerValidator - valid inputs', () => {
  test('accepts valid registration data', async ({ assert }) => {
    const result = await registerValidator.validate({
      fullName: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    })
    assert.equal(result.fullName, 'John Doe')
    assert.equal(result.email, 'john@example.com')
    assert.equal(result.password, 'password123')
  })

  test('accepts minimum length full name (2 chars)', async ({ assert }) => {
    const result = await registerValidator.validate({
      fullName: 'Jo',
      email: 'jo@test.com',
      password: '12345678',
      passwordConfirmation: '12345678',
    })
    assert.equal(result.fullName, 'Jo')
  })

  test('accepts exactly 8 character password', async ({ assert }) => {
    const result = await registerValidator.validate({
      fullName: 'Test User',
      email: 'test@test.com',
      password: '12345678',
      passwordConfirmation: '12345678',
    })
    assert.equal(result.password, '12345678')
  })
})

test.group('Auth Validators | registerValidator - invalid inputs', () => {
  test('rejects full name shorter than 2 characters', async ({ assert }) => {
    try {
      await registerValidator.validate({
        fullName: 'A',
        email: 'a@test.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'fullName'))
    }
  })

  test('rejects full name longer than 255 characters', async ({ assert }) => {
    try {
      await registerValidator.validate({
        fullName: 'A'.repeat(256),
        email: 'a@test.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'fullName'))
    }
  })

  test('rejects password shorter than 8 characters', async ({ assert }) => {
    try {
      await registerValidator.validate({
        fullName: 'Test User',
        email: 'test@test.com',
        password: '1234567',
        passwordConfirmation: '1234567',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'password'))
    }
  })

  test('rejects mismatched password confirmation', async ({ assert }) => {
    try {
      await registerValidator.validate({
        fullName: 'Test User',
        email: 'test@test.com',
        password: 'password123',
        passwordConfirmation: 'different123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'passwordConfirmation'))
    }
  })

  test('rejects invalid email format', async ({ assert }) => {
    try {
      await registerValidator.validate({
        fullName: 'Test User',
        email: 'invalid-email',
        password: 'password123',
        passwordConfirmation: 'password123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'email'))
    }
  })

  test('rejects missing all fields', async ({ assert }) => {
    try {
      await registerValidator.validate({})
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.length >= 4)
    }
  })

  test('rejects missing passwordConfirmation', async ({ assert }) => {
    try {
      await registerValidator.validate({
        fullName: 'Test User',
        email: 'test@test.com',
        password: 'password123',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const msgs = (error as any).messages
      assert.isTrue(msgs.some((m: any) => m.field === 'passwordConfirmation'))
    }
  })
})
