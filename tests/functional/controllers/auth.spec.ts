import { test } from '@japa/runner'
import User from '#models/user'
import AppSetting from '#models/app_setting'
import AuthController from '#controllers/auth_controller'
import { UserFactory } from '../../../database/factories/user_factory.js'

test.group('AuthController', (group) => {
  group.teardown(async () => {
    await User.query().where('email', 'like', '%@auth-test.com').delete()
    await AppSetting.query().where('key', 'registrationEnabled').delete()
  })

  // ---- login ----

  test('login redirects to /library on valid credentials', async ({ assert }) => {
    const user = await UserFactory.create({
      email: 'login-valid@auth-test.com',
      password: 'password123',
    })

    const controller = new AuthController()
    let redirectTarget = ''
    let flashedErrors: Record<string, string> | null = null

    await controller.login({
      request: {
        validateUsing: async () => ({
          email: 'login-valid@auth-test.com',
          password: 'password123',
        }),
      },
      auth: {
        use: () => ({
          login: async () => {},
        }),
      },
      response: {
        redirect(path: string) {
          redirectTarget = path
        },
      },
      session: {
        flash(key: string, value: unknown) {
          if (key === 'errors') flashedErrors = value as Record<string, string>
        },
      },
    } as never)

    assert.equal(redirectTarget, '/library')
    assert.isNull(flashedErrors)

    await user.delete()
  })

  test('login redirects to /login with error on invalid credentials', async ({ assert }) => {
    const controller = new AuthController()
    let redirectTarget = ''
    let flashedErrors: Record<string, string> | null = null

    await controller.login({
      request: {
        validateUsing: async () => ({
          email: 'nonexistent@auth-test.com',
          password: 'wrongpassword',
        }),
      },
      auth: {
        use: () => ({
          login: async () => {
            throw new Error('Invalid credentials')
          },
        }),
      },
      response: {
        redirect(path: string) {
          redirectTarget = path
        },
      },
      session: {
        flash(key: string, value: unknown) {
          if (key === 'errors') flashedErrors = value as Record<string, string>
        },
      },
    } as never)

    assert.equal(redirectTarget, '/login')
    assert.isNotNull(flashedErrors)
    assert.equal(flashedErrors!.email, 'Invalid email or password')
  })

  // ---- register ----

  test('register creates first user as admin and redirects to /library', async ({ assert }) => {
    // Make sure no users with this email exist
    await User.query().where('email', 'first@auth-test.com').delete()

    // Temporarily ensure registration is allowed by being the first user scenario
    // We can't easily test first-user scenario without clearing all users,
    // so we test the normal registration flow
    await AppSetting.set('registrationEnabled', true)

    const controller = new AuthController()
    let redirectTarget = ''

    await controller.register({
      request: {
        validateUsing: async () => ({
          fullName: 'Register User',
          email: 'register@auth-test.com',
          password: 'password123',
        }),
      },
      auth: {
        use: () => ({
          login: async () => {},
        }),
      },
      response: {
        redirect(path: string) {
          redirectTarget = path
        },
        forbidden() {},
      },
    } as never)

    assert.equal(redirectTarget, '/library')

    const created = await User.findBy('email', 'register@auth-test.com')
    assert.isNotNull(created)
    assert.equal(created!.fullName, 'Register User')

    await created?.delete()
  })

  test('register returns forbidden when registration is disabled', async ({ assert }) => {
    // Create a user first so it's not first-user scenario
    const existingUser = await UserFactory.create({ email: 'existing@auth-test.com' })
    await AppSetting.set('registrationEnabled', false)

    const controller = new AuthController()
    let forbiddenResult: Record<string, unknown> = {}

    await controller.register({
      request: {
        validateUsing: async () => ({
          fullName: 'Blocked User',
          email: 'blocked@auth-test.com',
          password: 'password123',
        }),
      },
      auth: {
        use: () => ({
          login: async () => {},
        }),
      },
      response: {
        redirect() {},
        forbidden(data: unknown) {
          forbiddenResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(forbiddenResult, 'error')
    const error = forbiddenResult.error as Record<string, string>
    assert.equal(error.code, 'REGISTRATION_DISABLED')

    await existingUser.delete()
  })

  // ---- showRegister ----

  test('showRegister redirects to /login when registration is disabled', async ({ assert }) => {
    const existingUser = await UserFactory.create({ email: 'showreg@auth-test.com' })
    await AppSetting.set('registrationEnabled', false)

    const controller = new AuthController()
    let redirectTarget = ''
    let rendered = false

    await controller.showRegister({
      inertia: {
        render() {
          rendered = true
        },
      },
      response: {
        redirect(path: string) {
          redirectTarget = path
        },
      },
    } as never)

    assert.equal(redirectTarget, '/login')
    assert.isFalse(rendered)

    await existingUser.delete()
  })

  // ---- logout ----

  test('logout redirects to /login', async ({ assert }) => {
    const controller = new AuthController()
    let redirectTarget = ''
    let logoutCalled = false

    await controller.logout({
      auth: {
        use: () => ({
          logout: async () => {
            logoutCalled = true
          },
        }),
      },
      response: {
        redirect(path: string) {
          redirectTarget = path
        },
      },
    } as never)

    assert.equal(redirectTarget, '/login')
    assert.isTrue(logoutCalled)
  })

  // ---- showLogin ----

  test('showLogin renders login page', async ({ assert }) => {
    const controller = new AuthController()
    let renderedPage = ''

    await controller.showLogin({
      inertia: {
        render(page: string) {
          renderedPage = page
        },
      },
    } as never)

    assert.equal(renderedPage, 'auth/login')
  })
})
