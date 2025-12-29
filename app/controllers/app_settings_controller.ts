import type { HttpContext } from '@adonisjs/core/http'
import AppSetting, { type MediaType } from '#models/app_setting'

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
    const rawMediaTypes = await AppSetting.get<MediaType[] | string>('enabledMediaTypes', ['music'])
    const enabledMediaTypes = ensureArray(rawMediaTypes, ['music'])
    const tmdbApiKey = await AppSetting.get<string>('tmdbApiKey', '')

    return response.json({
      enabledMediaTypes,
      tmdbApiKey: tmdbApiKey ? '********' : '', // Don't expose full key
      hasTmdbApiKey: !!tmdbApiKey,
    })
  }

  async update({ request, response }: HttpContext) {
    const { enabledMediaTypes, tmdbApiKey } = request.only(['enabledMediaTypes', 'tmdbApiKey'])

    if (enabledMediaTypes !== undefined) {
      await AppSetting.set('enabledMediaTypes', enabledMediaTypes)
    }

    if (tmdbApiKey !== undefined && tmdbApiKey !== '********') {
      await AppSetting.set('tmdbApiKey', tmdbApiKey)
      // Update the TMDB service with the new key
      const { tmdbService } = await import('#services/metadata/tmdb_service')
      tmdbService.setApiKey(tmdbApiKey)
    }

    const rawMediaTypes = await AppSetting.get<MediaType[] | string>('enabledMediaTypes', ['music'])
    const storedTmdbKey = await AppSetting.get<string>('tmdbApiKey', '')

    return response.json({
      enabledMediaTypes: ensureArray(rawMediaTypes, ['music']),
      tmdbApiKey: storedTmdbKey ? '********' : '',
      hasTmdbApiKey: !!storedTmdbKey,
    })
  }

  async toggleMediaType({ request, response }: HttpContext) {
    const { mediaType, enabled } = request.only(['mediaType', 'enabled'])

    if (!mediaType || !['music', 'movies', 'tv', 'books'].includes(mediaType)) {
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
