import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'

export default class UserController {
  async updateProfile({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { fullName } = request.only(['fullName'])

    user.fullName = fullName || null
    await user.save()

    return response.json({ success: true })
  }

  async changePassword({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { currentPassword, newPassword } = request.only(['currentPassword', 'newPassword'])

    if (!currentPassword || !newPassword) {
      return response.badRequest({ error: 'Both current and new passwords are required' })
    }

    if (newPassword.length < 8) {
      return response.badRequest({ error: 'New password must be at least 8 characters' })
    }

    const isValid = await hash.verify(user.password, currentPassword)
    if (!isValid) {
      return response.badRequest({ error: 'Current password is incorrect' })
    }

    user.password = newPassword
    await user.save()

    return response.json({ success: true })
  }
}
