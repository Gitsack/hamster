import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { createUserValidator, updateUserValidator } from '#validators/user'

export default class AdminUsersController {
  async index({ response }: HttpContext) {
    const users = await User.query().orderBy('createdAt', 'asc')
    return response.json(
      users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt.toISO(),
      }))
    )
  }

  async show({ params, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    return response.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt.toISO(),
      updatedAt: user.updatedAt?.toISO() ?? null,
    })
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createUserValidator)

    const user = await User.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      isAdmin: data.isAdmin ?? false,
    })

    return response.created({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt.toISO(),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    const validator = updateUserValidator(user.id)
    const data = await request.validateUsing(validator)

    if (data.fullName !== undefined) user.fullName = data.fullName
    if (data.email !== undefined) user.email = data.email
    if (data.isAdmin !== undefined) user.isAdmin = data.isAdmin

    await user.save()

    return response.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt.toISO(),
    })
  }

  async destroy({ params, auth, response }: HttpContext) {
    const user = await User.findOrFail(params.id)

    if (user.id === auth.user!.id) {
      return response.badRequest({ error: 'You cannot delete your own account' })
    }

    await user.delete()

    return response.json({ success: true })
  }

  async resetPassword({ params, request, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    const { newPassword } = request.only(['newPassword'])

    if (!newPassword || newPassword.length < 8) {
      return response.badRequest({ error: 'Password must be at least 8 characters' })
    }

    user.password = newPassword
    await user.save()

    return response.json({ success: true })
  }
}
