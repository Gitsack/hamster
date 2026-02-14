import type { HttpContext } from '@adonisjs/core/http'
import ProwlarrConfigModel from '#models/prowlarr_config'
import vine from '@vinejs/vine'
import { prowlarrService } from '#services/indexers/prowlarr_service'

const prowlarrValidator = vine.compile(
  vine.object({
    url: vine.string().url(),
    apiKey: vine.string().minLength(1),
    syncCategories: vine.array(vine.number()).optional(),
    enabled: vine.boolean().optional(),
  })
)

const prowlarrTestValidator = vine.compile(
  vine.object({
    url: vine.string().url(),
    apiKey: vine.string().minLength(1),
  })
)

export default class ProwlarrController {
  async show({ response }: HttpContext) {
    const config = await ProwlarrConfigModel.query().first()

    if (!config) {
      return response.json({
        configured: false,
        url: '',
        apiKey: '',
        syncCategories: [],
        enabled: false,
      })
    }

    return response.json({
      configured: true,
      id: config.id,
      url: config.baseUrl,
      apiKey: config.apiKey,
      syncCategories: config.syncCategories,
      enabled: config.syncEnabled,
    })
  }

  async update({ request, response }: HttpContext) {
    const data = await request.validateUsing(prowlarrValidator)

    let config = await ProwlarrConfigModel.query().first()

    if (config) {
      config.merge({
        baseUrl: data.url,
        apiKey: data.apiKey,
        syncCategories: data.syncCategories ?? config.syncCategories,
        syncEnabled: data.enabled ?? config.syncEnabled,
      })
      await config.save()
    } else {
      config = await ProwlarrConfigModel.create({
        baseUrl: data.url,
        apiKey: data.apiKey,
        syncCategories: data.syncCategories || [3000, 3010, 3040],
        syncEnabled: data.enabled ?? true,
      })
    }

    return response.json({
      configured: true,
      id: config.id,
      url: config.baseUrl,
      apiKey: config.apiKey,
      syncCategories: config.syncCategories,
      enabled: config.syncEnabled,
    })
  }

  async test({ request, response }: HttpContext) {
    const data = await request.validateUsing(prowlarrTestValidator)

    const result = await prowlarrService.testConnection({ url: data.url, apiKey: data.apiKey })

    return response.json(result)
  }

  async sync({ response }: HttpContext) {
    const config = await ProwlarrConfigModel.query().where('syncEnabled', true).first()

    if (!config) {
      return response.badRequest({ error: 'Prowlarr is not configured or enabled' })
    }

    try {
      const result = await prowlarrService.syncIndexers({
        url: config.baseUrl,
        apiKey: config.apiKey,
      })

      return response.json({
        success: true,
        ...result,
      })
    } catch (error) {
      return response.json({
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      })
    }
  }

  async indexers({ response }: HttpContext) {
    const config = await ProwlarrConfigModel.query().where('syncEnabled', true).first()

    if (!config) {
      return response.json([])
    }

    try {
      const indexers = await prowlarrService.getIndexers({
        url: config.baseUrl,
        apiKey: config.apiKey,
      })

      // Filter to enabled usenet indexers with music support
      const musicIndexers = indexers.filter((indexer) => {
        if (!indexer.enable) return false
        if (indexer.protocol !== 'usenet') return false

        const hasMusic = indexer.capabilities.categories.some(
          (cat) => cat.id >= 3000 && cat.id < 4000
        )
        return hasMusic
      })

      return response.json(musicIndexers)
    } catch (error) {
      return response.json([])
    }
  }
}
