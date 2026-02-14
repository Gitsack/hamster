import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import AppSetting from '#models/app_setting'
import { loginValidator, registerValidator } from '#validators/auth'

export default class AuthController {
  async showLogin({ inertia }: HttpContext) {
    return inertia.render('auth/login')
  }

  async login({ request, auth, response, session }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await User.verifyCredentials(email, password)
      await auth.use('web').login(user)
      return response.redirect('/library')
    } catch {
      session.flash('errors', { email: 'Invalid email or password' })
      return response.redirect('/login')
    }
  }

  async showRegister({ inertia, response }: HttpContext) {
    const allowed = await this.isRegistrationAllowed()
    if (!allowed) {
      return response.redirect('/login')
    }
    return inertia.render('auth/register')
  }

  async register({ request, auth, response }: HttpContext) {
    const allowed = await this.isRegistrationAllowed()
    if (!allowed) {
      return response.forbidden({
        error: { code: 'REGISTRATION_DISABLED', message: 'Registration is disabled' },
      })
    }

    const data = await request.validateUsing(registerValidator)

    const userCount = await User.query().count('* as total')
    const isFirstUser = Number(userCount[0].$extras.total) === 0

    const user = await User.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      isAdmin: isFirstUser,
      preferences: {},
    })

    // After first user registers, disable open registration by default
    if (isFirstUser) {
      await AppSetting.set('registrationEnabled', false)
    }

    await auth.use('web').login(user)
    return response.redirect('/library')
  }

  async logout({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect('/login')
  }

  private async isRegistrationAllowed(): Promise<boolean> {
    // Always allow registration if no users exist (first user setup)
    const userCount = await User.query().count('* as total')
    if (Number(userCount[0].$extras.total) === 0) {
      return true
    }

    // Check the app setting
    const enabled = await AppSetting.get<boolean>('registrationEnabled', true)
    return !!enabled
  }
}
