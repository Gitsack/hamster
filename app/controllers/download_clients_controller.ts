import type { HttpContext } from '@adonisjs/core/http'
import DownloadClient from '#models/download_client'
import vine from '@vinejs/vine'
import { downloadManager } from '#services/download_clients/download_manager'
import { downloadImportService } from '#services/media/download_import_service'

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
    remotePath: vine.string().optional(),
    localPath: vine.string().optional(),
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
        remotePath: client.settings.remotePath || '',
        localPath: client.settings.localPath || '',
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
        remotePath: data.remotePath,
        localPath: data.localPath,
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
      remotePath: client.settings.remotePath || '',
      localPath: client.settings.localPath || '',
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
        remotePath: data.remotePath,
        localPath: data.localPath,
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

  async browseDownloads({ params, request, response }: HttpContext) {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    const client = await DownloadClient.find(params.id)

    if (!client) {
      return response.notFound({ error: 'Download client not found' })
    }

    const basePath = client.settings.localPath
    if (!basePath) {
      return response.badRequest({ error: 'No local path configured for this download client' })
    }

    // Get the requested path from query, default to base path
    const requestedPath = request.qs().path || basePath

    // Security: ensure the requested path is within the base path
    const normalizedBase = path.resolve(basePath)
    const normalizedRequested = path.resolve(requestedPath)
    if (!normalizedRequested.startsWith(normalizedBase)) {
      return response.badRequest({ error: 'Access denied: path outside of downloads folder' })
    }

    try {
      await fs.access(normalizedRequested)
    } catch {
      return response.badRequest({ error: `Path not accessible: ${normalizedRequested}` })
    }

    try {
      const entries = await fs.readdir(normalizedRequested, { withFileTypes: true })
      const items = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(normalizedRequested, entry.name)
          let size = 0
          let modifiedAt = null

          try {
            const stat = await fs.stat(fullPath)
            size = stat.size
            modifiedAt = stat.mtime.toISOString()

            // For directories, calculate total size
            if (entry.isDirectory()) {
              size = await this.getDirSize(fullPath)
            }
          } catch {
            // Ignore stat errors
          }

          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size,
            modifiedAt,
          }
        })
      )

      // Sort: directories first, then by name
      items.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      return response.json({
        basePath: normalizedBase,
        path: normalizedRequested,
        canGoUp: normalizedRequested !== normalizedBase,
        parentPath: path.dirname(normalizedRequested),
        items,
      })
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to read directory',
      })
    }
  }

  async importFromPath({ params, request, response }: HttpContext) {
    const nodePath = await import('node:path')
    const fs = await import('node:fs/promises')

    const client = await DownloadClient.find(params.id)

    if (!client) {
      return response.notFound({ error: 'Download client not found' })
    }

    const basePath = client.settings.localPath
    if (!basePath) {
      return response.badRequest({ error: 'No local path configured for this download client' })
    }

    const importPath = request.input('path')
    if (!importPath) {
      return response.badRequest({ error: 'Path is required' })
    }

    // Security: ensure the path is within the base path
    const normalizedBase = nodePath.resolve(basePath)
    const normalizedImport = nodePath.resolve(importPath)
    if (!normalizedImport.startsWith(normalizedBase)) {
      return response.badRequest({ error: 'Access denied: path outside of downloads folder' })
    }

    try {
      await fs.access(normalizedImport)
    } catch {
      return response.badRequest({ error: `Path not accessible: ${normalizedImport}` })
    }

    try {
      const result = await downloadImportService.importFromPath(normalizedImport)

      return response.json({
        success: result.success,
        message: result.success
          ? `Imported ${result.filesImported} files`
          : 'Import failed',
        filesImported: result.filesImported,
        errors: result.errors,
      })
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to import',
      })
    }
  }

  private async getDirSize(dirPath: string): Promise<number> {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    let size = 0
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          size += await this.getDirSize(fullPath)
        } else {
          const stat = await fs.stat(fullPath)
          size += stat.size
        }
      }
    } catch {
      // Ignore errors
    }
    return size
  }
}
