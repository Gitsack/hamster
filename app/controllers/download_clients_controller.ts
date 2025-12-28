import type { HttpContext } from '@adonisjs/core/http'
import DownloadClient from '#models/download_client'
import vine from '@vinejs/vine'
import { downloadManager } from '#services/download_clients/download_manager'

const downloadClientValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    type: vine.enum(['sabnzbd', 'nzbget']),
    host: vine.string().minLength(1),
    port: vine.number().min(1).max(65535),
    apiKey: vine.string().minLength(1),
    useSsl: vine.boolean().optional(),
    category: vine.string().optional(),
    enabled: vine.boolean().optional(),
    priority: vine.number().optional(),
    removeCompletedDownloads: vine.boolean().optional(),
    removeFailedDownloads: vine.boolean().optional(),
  })
)

export default class DownloadClientsController {
  async index({ response }: HttpContext) {
    const clients = await DownloadClient.query().orderBy('priority', 'asc').orderBy('name', 'asc')

    return response.json(
      clients.map((client) => ({
        id: client.id,
        name: client.name,
        type: client.type,
        host: client.settings.host || '',
        port: client.settings.port || 8080,
        apiKey: client.settings.apiKey || '',
        useSsl: client.settings.useSsl || false,
        category: client.settings.category || '',
        enabled: client.enabled,
        priority: client.priority,
        removeCompletedDownloads: client.removeCompletedDownloads,
        removeFailedDownloads: client.removeFailedDownloads,
      }))
    )
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(downloadClientValidator)

    const client = await DownloadClient.create({
      name: data.name,
      type: data.type,
      enabled: data.enabled ?? true,
      priority: data.priority ?? 1,
      removeCompletedDownloads: data.removeCompletedDownloads ?? true,
      removeFailedDownloads: data.removeFailedDownloads ?? true,
      settings: {
        host: data.host,
        port: data.port,
        apiKey: data.apiKey,
        useSsl: data.useSsl || false,
        category: data.category,
      },
    })

    return response.created({
      id: client.id,
      name: client.name,
      type: client.type,
      host: client.settings.host,
      port: client.settings.port,
      enabled: client.enabled,
    })
  }

  async show({ params, response }: HttpContext) {
    const client = await DownloadClient.find(params.id)
    if (!client) {
      return response.notFound({ error: 'Download client not found' })
    }

    return response.json({
      id: client.id,
      name: client.name,
      type: client.type,
      host: client.settings.host || '',
      port: client.settings.port || 8080,
      apiKey: client.settings.apiKey || '',
      useSsl: client.settings.useSsl || false,
      category: client.settings.category || '',
      enabled: client.enabled,
      priority: client.priority,
      removeCompletedDownloads: client.removeCompletedDownloads,
      removeFailedDownloads: client.removeFailedDownloads,
    })
  }

  async update({ params, request, response }: HttpContext) {
    const client = await DownloadClient.find(params.id)
    if (!client) {
      return response.notFound({ error: 'Download client not found' })
    }

    const data = await request.validateUsing(downloadClientValidator)

    client.merge({
      name: data.name,
      type: data.type,
      enabled: data.enabled ?? client.enabled,
      priority: data.priority ?? client.priority,
      removeCompletedDownloads: data.removeCompletedDownloads ?? client.removeCompletedDownloads,
      removeFailedDownloads: data.removeFailedDownloads ?? client.removeFailedDownloads,
      settings: {
        host: data.host,
        port: data.port,
        apiKey: data.apiKey,
        useSsl: data.useSsl || false,
        category: data.category,
      },
    })
    await client.save()

    return response.json({
      id: client.id,
      name: client.name,
      type: client.type,
      enabled: client.enabled,
    })
  }

  async destroy({ params, response }: HttpContext) {
    const client = await DownloadClient.find(params.id)
    if (!client) {
      return response.notFound({ error: 'Download client not found' })
    }

    await client.delete()
    return response.noContent()
  }

  async test({ request, response }: HttpContext) {
    const { type, host, port, apiKey, useSsl } = request.only(['type', 'host', 'port', 'apiKey', 'useSsl'])

    if (!type || !host || !port || !apiKey) {
      return response.badRequest({ error: 'Type, host, port, and API key are required' })
    }

    const result = await downloadManager.testClient(type, { host, port, apiKey, useSsl })

    return response.json(result)
  }
}
