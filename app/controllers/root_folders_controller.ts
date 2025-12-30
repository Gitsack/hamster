import type { HttpContext } from '@adonisjs/core/http'
import RootFolder from '#models/root_folder'
import vine from '@vinejs/vine'
import fs from 'node:fs/promises'

const rootFolderValidator = vine.compile(
  vine.object({
    path: vine.string().minLength(1),
    name: vine.string().minLength(1).maxLength(255).optional(),
    mediaType: vine.enum(['music', 'movies', 'tv', 'books']).optional(),
    createIfMissing: vine.boolean().optional(),
  })
)

export default class RootFoldersController {
  async index({ response }: HttpContext) {
    const rootFolders = await RootFolder.query().orderBy('name', 'asc')

    // Get free space for each folder
    const foldersWithSpace = await Promise.all(
      rootFolders.map(async (folder) => {
        let freeSpace: number | null = null
        let totalSpace: number | null = null
        let accessible = false

        try {
          await fs.access(folder.path)
          accessible = true
          // Note: Getting disk space requires platform-specific code
          // For now, we'll just check accessibility
        } catch {
          accessible = false
        }

        return {
          ...folder.serialize(),
          freeSpace,
          totalSpace,
          accessible,
        }
      })
    )

    return response.json(foldersWithSpace)
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(rootFolderValidator)

    // Check if path exists
    try {
      const stats = await fs.stat(data.path)
      if (!stats.isDirectory()) {
        return response.badRequest({ error: 'Path is not a directory' })
      }
    } catch {
      // Path doesn't exist - create it if requested
      if (data.createIfMissing) {
        try {
          await fs.mkdir(data.path, { recursive: true })
        } catch (mkdirError) {
          return response.badRequest({
            error: 'Failed to create directory',
            details: mkdirError instanceof Error ? mkdirError.message : 'Unknown error',
          })
        }
      } else {
        return response.badRequest({ error: 'Path does not exist or is not accessible' })
      }
    }

    // Check if path is already added
    const existing = await RootFolder.findBy('path', data.path)
    if (existing) {
      return response.conflict({ error: 'This path is already added as a root folder' })
    }

    const rootFolder = await RootFolder.create({
      path: data.path,
      name: data.name || data.path.split('/').pop() || data.path,
      mediaType: data.mediaType || 'music',
    })

    return response.created(rootFolder)
  }

  async show({ params, response }: HttpContext) {
    const rootFolder = await RootFolder.find(params.id)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }
    return response.json(rootFolder)
  }

  async update({ params, request, response }: HttpContext) {
    const rootFolder = await RootFolder.find(params.id)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const data = await request.validateUsing(rootFolderValidator)

    // Check if new path exists
    try {
      const stats = await fs.stat(data.path)
      if (!stats.isDirectory()) {
        return response.badRequest({ error: 'Path is not a directory' })
      }
    } catch {
      return response.badRequest({ error: 'Path does not exist or is not accessible' })
    }

    rootFolder.merge({
      path: data.path,
      name: data.name || data.path.split('/').pop() || data.path,
      mediaType: data.mediaType || rootFolder.mediaType,
    })
    await rootFolder.save()

    return response.json(rootFolder)
  }

  async destroy({ params, response }: HttpContext) {
    const rootFolder = await RootFolder.find(params.id)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    await rootFolder.delete()
    return response.noContent()
  }
}
