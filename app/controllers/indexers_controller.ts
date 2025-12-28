import type { HttpContext } from '@adonisjs/core/http'
import Indexer from '#models/indexer'
import vine from '@vinejs/vine'
import { indexerManager } from '#services/indexers/indexer_manager'

const indexerValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    url: vine.string().url(),
    apiKey: vine.string().minLength(1),
    categories: vine.array(vine.number()).optional(),
    enabled: vine.boolean().optional(),
    priority: vine.number().optional(),
  })
)

export default class IndexersController {
  async index({ response }: HttpContext) {
    const indexers = await Indexer.query().orderBy('priority', 'asc').orderBy('name', 'asc')

    // Transform to include url and apiKey at top level for frontend
    const transformed = indexers.map((indexer) => ({
      id: indexer.id,
      name: indexer.name,
      url: indexer.settings.baseUrl || '',
      apiKey: indexer.settings.apiKey || '',
      categories: indexer.settings.categories || [],
      enabled: indexer.enabled,
      priority: indexer.priority,
    }))

    return response.json(transformed)
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(indexerValidator)

    const indexer = await Indexer.create({
      name: data.name,
      type: 'newznab',
      enabled: data.enabled ?? true,
      priority: data.priority ?? 25,
      supportsSearch: true,
      supportsRss: true,
      prowlarrIndexerId: null,
      settings: {
        baseUrl: data.url,
        apiKey: data.apiKey,
        categories: data.categories || [],
      },
    })

    return response.created({
      id: indexer.id,
      name: indexer.name,
      url: indexer.settings.baseUrl,
      apiKey: indexer.settings.apiKey,
      categories: indexer.settings.categories,
      enabled: indexer.enabled,
      priority: indexer.priority,
    })
  }

  async show({ params, response }: HttpContext) {
    const indexer = await Indexer.find(params.id)
    if (!indexer) {
      return response.notFound({ error: 'Indexer not found' })
    }

    return response.json({
      id: indexer.id,
      name: indexer.name,
      url: indexer.settings.baseUrl || '',
      apiKey: indexer.settings.apiKey || '',
      categories: indexer.settings.categories || [],
      enabled: indexer.enabled,
      priority: indexer.priority,
    })
  }

  async update({ params, request, response }: HttpContext) {
    const indexer = await Indexer.find(params.id)
    if (!indexer) {
      return response.notFound({ error: 'Indexer not found' })
    }

    const data = await request.validateUsing(indexerValidator)

    indexer.merge({
      name: data.name,
      enabled: data.enabled ?? indexer.enabled,
      priority: data.priority ?? indexer.priority,
      settings: {
        baseUrl: data.url,
        apiKey: data.apiKey,
        categories: data.categories ?? indexer.settings.categories ?? [],
      },
    })
    await indexer.save()

    return response.json({
      id: indexer.id,
      name: indexer.name,
      url: indexer.settings.baseUrl,
      apiKey: indexer.settings.apiKey,
      categories: indexer.settings.categories,
      enabled: indexer.enabled,
      priority: indexer.priority,
    })
  }

  async destroy({ params, response }: HttpContext) {
    const indexer = await Indexer.find(params.id)
    if (!indexer) {
      return response.notFound({ error: 'Indexer not found' })
    }

    await indexer.delete()
    return response.noContent()
  }

  async test({ request, response }: HttpContext) {
    const { url, apiKey } = request.only(['url', 'apiKey'])

    if (!url || !apiKey) {
      return response.badRequest({ error: 'URL and API key are required' })
    }

    const result = await indexerManager.testIndexer(url, apiKey)

    if (result.success) {
      return response.json({
        success: true,
        categories: result.categories,
      })
    } else {
      return response.json({
        success: false,
        error: result.error,
      })
    }
  }

  async search({ request, response }: HttpContext) {
    const { query, artist, album, year, indexerIds, limit } = request.qs()

    const results = await indexerManager.search({
      query,
      artist,
      album,
      year: year ? parseInt(year, 10) : undefined,
      indexerIds: indexerIds ? indexerIds.split(',').map(Number) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    })

    return response.json(results)
  }
}
