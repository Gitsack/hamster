import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import QualityProfile from '#models/quality_profile'
import RootFolder from '#models/root_folder'
import UserSetting from '#models/user_setting'
import RecommendationFeedback from '#models/recommendation_feedback'
import { forYouService, DECK_MODES } from '#services/recommendations/for_you_service'
import type { DeckMode } from '#services/recommendations/for_you_service'
import { tmdbService } from '#services/metadata/tmdb_service'
import { cache, CACHE_TTL } from '#services/cache/cache_service'

const feedbackValidator = vine.compile(
  vine.object({
    mediaType: vine.enum(['movie', 'tv', 'album', 'book'] as const),
    externalId: vine.string().trim().maxLength(64),
    action: vine.enum(['requested', 'skipped'] as const),
    title: vine.string().trim().maxLength(255).optional(),
    genres: vine.array(vine.string().trim().maxLength(64)).maxLength(20).optional(),
  })
)

const preferencesValidator = vine.compile(
  vine.object({
    types: vine
      .array(vine.enum(['movie', 'tv', 'album', 'book'] as const))
      .maxLength(4)
      .nullable()
      .optional(),
    mode: vine.enum(DECK_MODES).optional(),
  })
)

export default class ForYouController {
  /** The deck, plus the profile and folder a one-tap request will use. */
  async index({ auth, request, response }: HttpContext) {
    const userId = auth.user!.id
    const refresh = request.qs().refresh === '1'

    const userSetting = await UserSetting.findBy('userId', userId)
    const asked = request.qs().mode as DeckMode | undefined
    const mode: DeckMode = DECK_MODES.includes(asked as DeckMode)
      ? (asked as DeckMode)
      : DECK_MODES.includes(userSetting?.forYouMode as DeckMode)
        ? (userSetting!.forYouMode as DeckMode)
        : 'for-you'

    const [deck, profiles, folders] = await Promise.all([
      forYouService.getDeck(userId, { refresh, mode }),
      QualityProfile.query().orderBy('createdAt', 'asc').select('id', 'mediaType'),
      RootFolder.query().select('id', 'mediaType'),
    ])

    const defaultsFor = (mediaType: 'movies' | 'tv' | 'music') => {
      const preferred = profiles.find(
        (p) => p.id === userSetting?.defaultQualityProfileId && p.mediaType === mediaType
      )
      const profile = preferred ?? profiles.find((p) => p.mediaType === mediaType)
      const folder = folders.find((f) => f.mediaType === mediaType)
      return profile && folder ? { qualityProfileId: profile.id, rootFolderId: folder.id } : null
    }

    return response.json({
      ...deck,
      requestDefaults: {
        movie: defaultsFor('movies'),
        tv: defaultsFor('tv'),
        album: defaultsFor('music'),
      },
      mode,
      preferences: { types: userSetting?.forYouTypes ?? null, mode },
    })
  }

  /** Remember which media types the user's deck shows. */
  async savePreferences({ auth, request, response }: HttpContext) {
    const { types, mode } = await request.validateUsing(preferencesValidator)
    const setting = await UserSetting.firstOrNew({ userId: auth.user!.id })
    // Nothing selected, or everything, both mean "all": store null.
    if (types !== undefined) {
      setting.forYouTypes =
        types && types.length > 0 && types.length < 4 ? [...new Set(types)] : null
    }
    if (mode !== undefined) setting.forYouMode = mode === 'for-you' ? null : mode
    await setting.save()
    return response.noContent()
  }

  async feedback({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(feedbackValidator)
    const userId = auth.user!.id

    await RecommendationFeedback.updateOrCreate(
      { userId, mediaType: data.mediaType, externalId: data.externalId },
      { action: data.action, title: data.title ?? null, genres: data.genres ?? [] }
    )

    // A request is a new seed; rebuild on the next load rather than serving
    // the neighbourhood of titles from before it.
    if (data.action === 'requested') forYouService.invalidate(userId)

    return response.noContent()
  }

  /** Undo a skip. */
  async undo({ auth, params, response }: HttpContext) {
    await RecommendationFeedback.query()
      .where('userId', auth.user!.id)
      .where('mediaType', params.mediaType)
      .where('externalId', params.externalId)
      .where('action', 'skipped')
      .delete()
    return response.noContent()
  }

  /**
   * What a card shows once it comes up: the YouTube key of its trailer and the
   * top-billed cast. Fetched one card at a time, not for the whole deck — that
   * would be ninety-six lookups to show one card.
   */
  async extras({ params, response }: HttpContext) {
    const tmdbId = Number(params.tmdbId)
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return response.badRequest({ error: 'Bad id' })
    const tv = params.mediaType === 'tv'

    const [url, cast] = await Promise.all([
      (tv ? tmdbService.getTvShowTrailerUrl(tmdbId) : tmdbService.getMovieTrailerUrl(tmdbId)).catch(
        () => null
      ),
      cache
        .getOrSet(`tmdb:${tv ? 'tv' : 'movie'}:${tmdbId}:cast8`, CACHE_TTL.METADATA, () =>
          tv ? tmdbService.getTvShowCredits(tmdbId, 8) : tmdbService.getMovieCredits(tmdbId, 8)
        )
        .catch(() => []),
    ])

    response.header('Cache-Control', 'private, max-age=3600')
    return response.json({
      key: url?.match(/embed\/([\w-]{6,})/)?.[1] ?? null,
      cast: cast.map((c) => ({ name: c.name, character: c.character, photo: c.profilePath })),
    })
  }
}
