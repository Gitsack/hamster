import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import RecommendationFeedback from '#models/recommendation_feedback'
import { forYouService } from '#services/recommendations/for_you_service'

/**
 * The user's watchlist: titles they want but won't necessarily get here —
 * saved from the dashboard deck, a preview or a detail page. Stored as
 * "interested" feedback, so a saved title stays out of the deck and counts
 * towards its genres wherever it was saved from.
 */

const saveValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(255),
    year: vine.number().withoutDecimals().nullable().optional(),
    posterUrl: vine.string().trim().maxLength(512).nullable().optional(),
    genres: vine.array(vine.string().trim().maxLength(64)).maxLength(20).optional(),
  })
)

const MEDIA_TYPES = ['movie', 'tv', 'album', 'book'] as const
type MediaType = (typeof MEDIA_TYPES)[number]

function target(params: Record<string, string>) {
  const mediaType = params.mediaType as MediaType
  const externalId = String(params.externalId ?? '')
  if (!MEDIA_TYPES.includes(mediaType) || !externalId || externalId.length > 64) return null
  return { mediaType, externalId }
}

export default class WatchlistController {
  async index({ auth, response }: HttpContext) {
    const rows = await RecommendationFeedback.query()
      .where('userId', auth.user!.id)
      .where('action', 'interested')
      .orderBy('createdAt', 'desc')
      .limit(1000)
    return response.json({
      items: rows.map((r) => ({
        key: `${r.mediaType}:${r.externalId}`,
        mediaType: r.mediaType,
        externalId: r.externalId,
        title: r.title,
        year: r.year,
        posterUrl: r.posterUrl,
        genres: r.genres,
        createdAt: r.createdAt.toISO(),
      })),
    })
  }

  /** Whether one title is on the watchlist. */
  async show({ auth, params, response }: HttpContext) {
    const t = target(params)
    if (!t) return response.badRequest({ error: 'Bad media type or id' })
    const row = await RecommendationFeedback.query()
      .where('userId', auth.user!.id)
      .where('mediaType', t.mediaType)
      .where('externalId', t.externalId)
      .where('action', 'interested')
      .first()
    return response.json({ saved: !!row })
  }

  async save({ auth, params, request, response }: HttpContext) {
    const t = target(params)
    if (!t) return response.badRequest({ error: 'Bad media type or id' })
    const data = await request.validateUsing(saveValidator)
    const userId = auth.user!.id

    // One answer per title: saving replaces an earlier skip or request of it.
    await RecommendationFeedback.updateOrCreate(
      { userId, ...t },
      {
        action: 'interested',
        title: data.title,
        year: data.year ?? null,
        posterUrl: data.posterUrl ?? null,
        genres: data.genres ?? [],
      }
    )
    forYouService.invalidate(userId)
    return response.noContent()
  }

  async destroy({ auth, params, response }: HttpContext) {
    const t = target(params)
    if (!t) return response.badRequest({ error: 'Bad media type or id' })
    await RecommendationFeedback.query()
      .where('userId', auth.user!.id)
      .where('mediaType', t.mediaType)
      .where('externalId', t.externalId)
      .where('action', 'interested')
      .delete()
    forYouService.invalidate(auth.user!.id)
    return response.noContent()
  }
}
