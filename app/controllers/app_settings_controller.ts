import type { HttpContext } from '@adonisjs/core/http'
import AppSetting, { type MediaType } from '#models/app_setting'
import fs from 'node:fs/promises'

function ensureArray<T>(value: T[] | string | undefined, defaultValue: T[]): T[] {
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : defaultValue
    } catch {
      return defaultValue
    }
  }
  return defaultValue
}

export default class AppSettingsController {
  async index({ response }: HttpContext) {
    const downloadFolder = (await AppSetting.get<string>('downloadFolder', '')) || ''
    const rawMediaTypes = await AppSetting.get<MediaType[] | string>('enabledMediaTypes', ['music'])
    const enabledMediaTypes = ensureArray(rawMediaTypes, ['music'])

    return response.json({
      downloadFolder,
      enabledMediaTypes,
    })
  }

  async update({ request, response }: HttpContext) {
    const { downloadFolder, enabledMediaTypes, createDownloadFolder } = request.only([
      'downloadFolder',
      'enabledMediaTypes',
      'createDownloadFolder',
    ])

    if (downloadFolder !== undefined) {
      // Check if path exists
      try {
        const stats = await fs.stat(downloadFolder)
        if (!stats.isDirectory()) {
          return response.badRequest({ error: 'Path is not a directory' })
        }
      } catch {
        // Path doesn't exist - create it if requested
        if (createDownloadFolder) {
          try {
            await fs.mkdir(downloadFolder, { recursive: true })
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

      await AppSetting.set('downloadFolder', downloadFolder)
    }

    if (enabledMediaTypes !== undefined) {
      await AppSetting.set('enabledMediaTypes', enabledMediaTypes)
    }

    const rawMediaTypes = await AppSetting.get<MediaType[] | string>('enabledMediaTypes', ['music'])

    return response.json({
      downloadFolder: (await AppSetting.get<string>('downloadFolder', '')) || '',
      enabledMediaTypes: ensureArray(rawMediaTypes, ['music']),
    })
  }

  async getDownloadFolder({ response }: HttpContext) {
    const downloadFolder = await AppSetting.get<string>('downloadFolder', '')
    return response.json({ downloadFolder })
  }

  async setDownloadFolder({ request, response }: HttpContext) {
    const { path } = request.only(['path'])

    if (!path) {
      return response.badRequest({ error: 'Path is required' })
    }

    await AppSetting.set('downloadFolder', path)
    return response.json({ downloadFolder: path })
  }

  async getEnabledMediaTypes({ response }: HttpContext) {
    const rawMediaTypes = await AppSetting.get<MediaType[] | string>('enabledMediaTypes', ['music'])
    const enabledMediaTypes = ensureArray(rawMediaTypes, ['music'])
    return response.json({ enabledMediaTypes })
  }

  async toggleMediaType({ request, response }: HttpContext) {
    const { mediaType, enabled } = request.only(['mediaType', 'enabled'])

    if (!mediaType || !['music', 'movies', 'tv'].includes(mediaType)) {
      return response.badRequest({ error: 'Invalid media type' })
    }

    const rawValue = await AppSetting.get<MediaType[] | string>('enabledMediaTypes', ['music'])
    const enabledTypes = ensureArray(rawValue, ['music'])

    if (enabled && !enabledTypes.includes(mediaType)) {
      enabledTypes.push(mediaType)
    } else if (!enabled) {
      const index = enabledTypes.indexOf(mediaType)
      if (index > -1) {
        enabledTypes.splice(index, 1)
      }
    }

    await AppSetting.set('enabledMediaTypes', enabledTypes)
    return response.json({ enabledMediaTypes: enabledTypes })
  }
}
