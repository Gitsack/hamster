import type { HttpContext } from '@adonisjs/core/http'
import RootFolder from '#models/root_folder'
import vine from '@vinejs/vine'
import fs from 'node:fs/promises'
import { accessWithTimeout, statWithTimeout } from '../utils/fs_utils.js'
import { libraryScannerService } from '#services/media/library_scanner_service'

const rootFolderValidator = vine.compile(
  vine.object({
    path: vine.string().minLength(1),
    name: vine.string().minLength(1).maxLength(255).optional(),
    mediaType: vine.enum(['music', 'movies', 'tv', 'books']).optional(),
    createIfMissing: vine.boolean().optional(),
    scanOnAdd: vine.boolean().optional(),
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
          await accessWithTimeout(folder.path, 2000) // 2s timeout for root folder check
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

    // Check if path exists (with timeout for network paths)
    try {
      const stats = await statWithTimeout(data.path)
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
      scanStatus: 'idle',
    })

    // Trigger scan if requested
    if (data.scanOnAdd) {
      // Start scan in background (don't await)
      libraryScannerService.scanRootFolder(rootFolder.id).catch(() => {
        // Scan errors are logged internally
      })
    }

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

  /**
   * Trigger a scan for a root folder
   */
  async scan({ params, response }: HttpContext) {
    const rootFolder = await RootFolder.find(params.id)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    // Check if scan is already in progress
    const status = await libraryScannerService.getScanStatus(rootFolder.id)
    if (status?.isScanning) {
      return response.conflict({ error: 'Scan already in progress' })
    }

    // Start scan in background
    const scanPromise = libraryScannerService.scanRootFolder(rootFolder.id)

    // Return immediately with accepted status
    response.accepted({
      message: 'Scan started',
      rootFolderId: rootFolder.id,
      mediaType: rootFolder.mediaType,
    })

    // Wait for scan to complete (background)
    scanPromise.catch(() => {
      // Errors are handled internally
    })
  }

  /**
   * Get scan status for a root folder
   */
  async scanStatus({ params, response }: HttpContext) {
    const rootFolder = await RootFolder.find(params.id)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const status = await libraryScannerService.getScanStatus(rootFolder.id)

    return response.json({
      rootFolderId: rootFolder.id,
      status: status?.status || 'idle',
      lastScannedAt: status?.lastScannedAt?.toISO() || null,
      isScanning: status?.isScanning || false,
    })
  }

  /**
   * Scan all root folders
   */
  async scanAll({ response }: HttpContext) {
    // Check if any scan is in progress
    if (libraryScannerService.isAnyScanInProgress()) {
      return response.conflict({ error: 'A scan is already in progress' })
    }

    // Start scan in background
    const scanPromise = libraryScannerService.scanAllRootFolders()

    response.accepted({
      message: 'Scan started for all root folders',
    })

    scanPromise.catch(() => {
      // Errors are handled internally
    })
  }
}
