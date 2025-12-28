import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
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

  async showRegister({ inertia }: HttpContext) {
    return inertia.render('auth/register')
  }

  async register({ request, auth, response }: HttpContext) {
    const data = await request.validateUsing(registerValidator)

    const user = await User.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      isAdmin: false,
      preferences: {},
    })

    await auth.use('web').login(user)
    return response.redirect('/library')
  }

  async logout({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect('/login')
  }
}
