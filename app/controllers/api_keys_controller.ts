import type { HttpContext } from '@adonisjs/core/http'
import ApiKey from '#models/api_key'
import vine from '@vinejs/vine'
import crypto from 'node:crypto'

const createApiKeyValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
  })
)

export default class ApiKeysController {
  /**
   * List the current user's API keys (without showing full key)
   */
  async index({ auth, response }: HttpContext) {
    const keys = await ApiKey.query().where('userId', auth.user!.id).orderBy('createdAt', 'desc')

    return response.json(
      keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.key.substring(0, 8) + '...',
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      }))
    )
  }

  /**
   * Generate a new API key. The full key is returned only on creation.
   */
  async store({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(createApiKeyValidator)

    const key = crypto.randomBytes(32).toString('hex')

    const apiKey = await ApiKey.create({
      userId: auth.user!.id,
      name: data.name,
      key,
    })

    return response.created({
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key,
      createdAt: apiKey.createdAt,
    })
  }

  /**
   * Revoke (delete) an API key
   */
  async destroy({ auth, params, response }: HttpContext) {
    const apiKey = await ApiKey.query()
      .where('id', params.id)
      .where('userId', auth.user!.id)
      .first()

    if (!apiKey) {
      return response.notFound({
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      })
    }

    await apiKey.delete()
    return response.noContent()
  }
}
