import type { HttpContext } from '@adonisjs/core/http'
import AppSetting, { type MediaType } from '#models/app_setting'
import {
  defaultNamingPatterns,
  templateVariables,
  namingTemplateService,
  type NamingPatterns,
} from '#services/media/naming_template_service'
import { fileNamingService } from '#services/media/file_naming_service'

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
    const traktClientId = await AppSetting.get<string>('traktClientId', '')
    const recommendationSettings = await AppSetting.get('recommendationSettings', {
      traktEnabled: false,
      personalizedEnabled: false,
      maxPersonalizedLanes: 3,
      justwatchEnabled: false,
    })
    const justwatchEnabled = await AppSetting.get<boolean>('justwatchEnabled', false)
    const justwatchLocale = await AppSetting.get<string>('justwatchLocale', 'en_US')

    return response.json({
      enabledMediaTypes,
      tmdbApiKey: tmdbApiKey ? '********' : '', // Don't expose full key
      hasTmdbApiKey: !!tmdbApiKey,
      hasTraktClientId: !!traktClientId,
      recommendationSettings,
      justwatchEnabled,
      justwatchLocale,
    })
  }

  async update({ request, response }: HttpContext) {
    const {
      enabledMediaTypes,
      tmdbApiKey,
      traktClientId,
      recommendationSettings,
      justwatchEnabled,
      justwatchLocale,
    } = request.only([
      'enabledMediaTypes',
      'tmdbApiKey',
      'traktClientId',
      'recommendationSettings',
      'justwatchEnabled',
      'justwatchLocale',
    ])

    if (enabledMediaTypes !== undefined) {
      await AppSetting.set('enabledMediaTypes', enabledMediaTypes)
    }

    if (tmdbApiKey !== undefined && tmdbApiKey !== '********') {
      await AppSetting.set('tmdbApiKey', tmdbApiKey)
      // Update the TMDB service with the new key
      const { tmdbService } = await import('#services/metadata/tmdb_service')
      tmdbService.setApiKey(tmdbApiKey)
    }

    if (traktClientId !== undefined && traktClientId !== '********') {
      await AppSetting.set('traktClientId', traktClientId)
      // Update the Trakt service with the new client ID
      const { traktService } = await import('#services/metadata/trakt_service')
      traktService.setClientId(traktClientId)
    }

    if (recommendationSettings !== undefined) {
      await AppSetting.set('recommendationSettings', recommendationSettings)
      // Clear recommendation cache so new settings take effect immediately
      const { recommendationService } = await import('#services/metadata/recommendation_service')
      recommendationService.clearCache()
    }

    if (justwatchEnabled !== undefined) {
      await AppSetting.set('justwatchEnabled', justwatchEnabled)
    }

    if (justwatchLocale !== undefined) {
      await AppSetting.set('justwatchLocale', justwatchLocale)
      const { justwatchService } = await import('#services/metadata/justwatch_service')
      justwatchService.setLocale(justwatchLocale)
    }

    const rawMediaTypes = await AppSetting.get<MediaType[] | string>('enabledMediaTypes', ['music'])
    const storedTmdbKey = await AppSetting.get<string>('tmdbApiKey', '')
    const storedTraktId = await AppSetting.get<string>('traktClientId', '')
    const storedRecommendationSettings = await AppSetting.get('recommendationSettings', {
      traktEnabled: false,
      personalizedEnabled: false,
      maxPersonalizedLanes: 3,
      justwatchEnabled: false,
    })
    const storedJustwatchEnabled = await AppSetting.get<boolean>('justwatchEnabled', false)
    const storedJustwatchLocale = await AppSetting.get<string>('justwatchLocale', 'en_US')

    return response.json({
      enabledMediaTypes: ensureArray(rawMediaTypes, ['music']),
      tmdbApiKey: storedTmdbKey ? '********' : '',
      hasTmdbApiKey: !!storedTmdbKey,
      hasTraktClientId: !!storedTraktId,
      recommendationSettings: storedRecommendationSettings,
      justwatchEnabled: storedJustwatchEnabled,
      justwatchLocale: storedJustwatchLocale,
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

  /**
   * Get naming patterns for all media types
   */
  async getNamingPatterns({ response }: HttpContext) {
    const stored = await AppSetting.get<Partial<NamingPatterns>>('namingPatterns')
    const patterns: NamingPatterns = {
      music: { ...defaultNamingPatterns.music, ...stored?.music },
      movies: { ...defaultNamingPatterns.movies, ...stored?.movies },
      tv: { ...defaultNamingPatterns.tv, ...stored?.tv },
      books: { ...defaultNamingPatterns.books, ...stored?.books },
    }

    // Generate examples for each pattern
    const examples: Record<string, Record<string, string>> = {}
    for (const mediaType of Object.keys(patterns) as MediaType[]) {
      examples[mediaType] = {}
      const mediaPatterns = patterns[mediaType] as Record<string, string>
      for (const field of Object.keys(mediaPatterns)) {
        examples[mediaType][field] = namingTemplateService.generateExample(
          mediaType,
          field,
          mediaPatterns[field]
        )
      }
    }

    return response.json({
      patterns,
      variables: templateVariables,
      examples,
    })
  }

  /**
   * Update naming patterns for a specific media type
   */
  async updateNamingPatterns({ request, response }: HttpContext) {
    const { mediaType, patterns } = request.only(['mediaType', 'patterns'])

    if (!mediaType || !['music', 'movies', 'tv', 'books'].includes(mediaType)) {
      return response.badRequest({ error: 'Invalid media type' })
    }

    if (!patterns || typeof patterns !== 'object') {
      return response.badRequest({ error: 'Invalid patterns' })
    }

    // Validate patterns
    const validFields = Object.keys(templateVariables[mediaType as MediaType])
    const errors: Record<string, string[]> = {}

    for (const [field, pattern] of Object.entries(patterns)) {
      if (!validFields.includes(field)) {
        errors[field] = [`Invalid field: ${field}`]
        continue
      }

      const validation = namingTemplateService.validatePattern(
        mediaType as MediaType,
        field,
        pattern as string
      )

      if (!validation.valid) {
        errors[field] = validation.invalidVars.map((v) => `Unknown variable: {${v}}`)
      }
    }

    if (Object.keys(errors).length > 0) {
      return response.badRequest({ error: 'Invalid patterns', details: errors })
    }

    // Get current patterns and merge
    const stored = await AppSetting.get<Partial<NamingPatterns>>('namingPatterns', {})
    const updated = {
      ...stored,
      [mediaType]: {
        ...(stored?.[mediaType as MediaType] || {}),
        ...patterns,
      },
    }

    await AppSetting.set('namingPatterns', updated)

    // Clear the file naming service cache
    fileNamingService.clearCache()

    // Return updated patterns with examples
    const mediaPatterns = updated[mediaType as MediaType] as Record<string, string>
    const examples: Record<string, string> = {}
    for (const field of Object.keys(mediaPatterns)) {
      examples[field] = namingTemplateService.generateExample(
        mediaType as MediaType,
        field,
        mediaPatterns[field]
      )
    }

    return response.json({
      patterns: updated[mediaType as MediaType],
      examples,
    })
  }
}
