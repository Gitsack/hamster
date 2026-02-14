import type { HttpContext } from '@adonisjs/core/http'
import MediaServerConfig from '#models/media_server_config'
import vine from '@vinejs/vine'
import { mediaServerService } from '#services/media_servers/media_server_service'

const mediaServerValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    type: vine.enum(['plex', 'emby', 'jellyfin'] as const),
    host: vine.string().minLength(1).maxLength(255),
    port: vine.number().positive(),
    apiKey: vine.string().minLength(1).maxLength(500),
    useSsl: vine.boolean().optional(),
    enabled: vine.boolean().optional(),
    librarySections: vine.array(vine.string()).optional(),
  })
)

export default class MediaServersController {
  /**
   * List all media server configs
   */
  async index({ response }: HttpContext) {
    const servers = await MediaServerConfig.query().orderBy('name', 'asc')

    return response.json(
      servers.map((s) => ({
        ...s.toJSON(),
        apiKey: s.apiKey ? s.apiKey.substring(0, 4) + '****' : undefined,
      }))
    )
  }

  /**
   * Create a new media server config
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(mediaServerValidator)

    const server = await MediaServerConfig.create({
      name: data.name,
      type: data.type,
      host: data.host,
      port: data.port,
      apiKey: data.apiKey,
      useSsl: data.useSsl ?? false,
      enabled: data.enabled ?? true,
      librarySections: data.librarySections ?? [],
    })

    return response.created({
      ...server.toJSON(),
      apiKey: server.apiKey.substring(0, 4) + '****',
    })
  }

  /**
   * Get a single media server config
   */
  async show({ params, response }: HttpContext) {
    const server = await MediaServerConfig.find(params.id)
    if (!server) {
      return response.notFound({ error: 'Media server not found' })
    }

    return response.json({
      ...server.toJSON(),
      apiKey: server.apiKey ? server.apiKey.substring(0, 4) + '****' : undefined,
    })
  }

  /**
   * Update a media server config
   */
  async update({ params, request, response }: HttpContext) {
    const server = await MediaServerConfig.find(params.id)
    if (!server) {
      return response.notFound({ error: 'Media server not found' })
    }

    const data = await request.validateUsing(mediaServerValidator)

    // If apiKey looks masked, preserve existing
    const apiKey = data.apiKey.includes('****') ? server.apiKey : data.apiKey

    server.merge({
      name: data.name,
      type: data.type,
      host: data.host,
      port: data.port,
      apiKey,
      useSsl: data.useSsl ?? server.useSsl,
      enabled: data.enabled ?? server.enabled,
      librarySections: data.librarySections ?? server.librarySections,
    })
    await server.save()

    return response.json({
      ...server.toJSON(),
      apiKey: server.apiKey ? server.apiKey.substring(0, 4) + '****' : undefined,
    })
  }

  /**
   * Delete a media server config
   */
  async destroy({ params, response }: HttpContext) {
    const server = await MediaServerConfig.find(params.id)
    if (!server) {
      return response.notFound({ error: 'Media server not found' })
    }

    await server.delete()
    return response.noContent()
  }

  /**
   * Test connection to a media server
   */
  async test({ params, response }: HttpContext) {
    const server = await MediaServerConfig.find(params.id)
    if (!server) {
      return response.notFound({ error: 'Media server not found' })
    }

    const result = await mediaServerService.testConnection({
      type: server.type,
      host: server.host,
      port: server.port,
      apiKey: server.apiKey,
      useSsl: server.useSsl,
    })

    return response.json(result)
  }

  /**
   * Trigger a library refresh on a media server
   */
  async refresh({ params, response }: HttpContext) {
    const server = await MediaServerConfig.find(params.id)
    if (!server) {
      return response.notFound({ error: 'Media server not found' })
    }

    try {
      await mediaServerService.triggerRefresh({
        type: server.type,
        host: server.host,
        port: server.port,
        apiKey: server.apiKey,
        useSsl: server.useSsl,
        librarySections: server.librarySections,
      })
      return response.json({ success: true })
    } catch (error) {
      return response.json({
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed',
      })
    }
  }
}
