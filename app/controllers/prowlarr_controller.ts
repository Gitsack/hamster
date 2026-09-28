import type { HttpContext } from '@adonisjs/core/http'
import ProwlarrConfigModel from '#models/prowlarr_config'
import vine from '@vinejs/vine'
import { prowlarrService } from '#services/indexers/prowlarr_service'

// Self-hosted services live at LAN or Docker hostnames (http://jellyfin:8096),
// which have no TLD.
const LAN_URL = { require_tld: false, allow_underscores: true }

const prowlarrValidator = vine.compile(
  vine.object({
    url: vine.string().url(LAN_URL),
    apiKey: vine.string().minLength(1),
    syncCategories: vine.array(vine.number()).optional(),
    enabled: vine.boolean().optional(),
  })
)

const prowlarrTestValidator = vine.compile(
  vine.object({
    url: vine.string().url(LAN_URL),
    apiKey: vine.string().minLength(1),
  })
)

/** How long the status read waits for Prowlarr before calling it unreachable. */
const PROWLARR_STATUS_TIMEOUT_MS = 5000

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

  /**
   * What the Indexers page shows on the Prowlarr row: whether Prowlarr answers
   * and how many indexers it would search. Searches go through Prowlarr live,
   * so this is a live read too — the browser asks for it after the page has
   * rendered, never during SSR, and it gives up after a few seconds.
   */
  async status({ response }: HttpContext) {
    const config = await ProwlarrConfigModel.query().first()
    const checkedAt = new Date().toISOString()

    if (!config) {
      return response.json({
        configured: false,
        enabled: false,
        reachable: null,
        indexers: null,
        error: null,
        checkedAt,
      })
    }

    try {
      const indexers = await prowlarrService.getIndexers(
        { url: config.baseUrl, apiKey: config.apiKey },
        AbortSignal.timeout(PROWLARR_STATUS_TIMEOUT_MS)
      )
      const enabled = indexers.filter((indexer) => indexer.enable)
      return response.json({
        configured: true,
        enabled: config.syncEnabled,
        reachable: true,
        indexers: {
          total: indexers.length,
          enabled: enabled.length,
          usenet: enabled.filter((indexer) => indexer.protocol === 'usenet').length,
          torrent: enabled.filter((indexer) => indexer.protocol === 'torrent').length,
        },
        error: null,
        checkedAt,
      })
    } catch (error) {
      const timedOut =
        error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
      return response.json({
        configured: true,
        enabled: config.syncEnabled,
        reachable: false,
        indexers: null,
        error: timedOut
          ? `No answer within ${PROWLARR_STATUS_TIMEOUT_MS / 1000}s`
          : error instanceof Error
            ? error.message
            : 'Connection failed',
        checkedAt,
      })
    }
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
