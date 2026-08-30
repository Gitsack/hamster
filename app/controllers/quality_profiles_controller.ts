import type { HttpContext } from '@adonisjs/core/http'
import QualityProfile from '#models/quality_profile'
import vine from '@vinejs/vine'
import { normalizeRequirements } from '#services/quality/quality_requirements'
import { LANGUAGES } from '#services/quality/language_parser'

const AUDIO_CODECS = [
  'Atmos',
  'TrueHD',
  'DTS-X',
  'DTS-HD MA',
  'DTS-HD',
  'DTS',
  'EAC3',
  'AC3',
  'FLAC',
  'PCM',
  'AAC',
  'Opus',
  'Vorbis',
  'MP3',
] as const

const AUDIO_TIERS = ['unknown', 'lossy-sd', 'lossy-hd', 'lossless', 'lossless-object'] as const

const VIDEO_CODECS = ['x264', 'x265', 'AV1', 'VP9', 'XviD'] as const

/** The picker in settings offers exactly these, so the API accepts exactly these. */
const LANGUAGE_CODES = LANGUAGES.map((language) => language.code)

/**
 * Attribute rules. Every field is optional so an older client that knows
 * nothing about requirements can still save a profile without wiping them.
 */
const requirementsSchema = vine
  .object({
    minAudioChannels: vine.number().min(1).max(10).nullable().optional(),
    minAudioTier: vine.enum(AUDIO_TIERS).nullable().optional(),
    blockedAudioCodecs: vine.array(vine.enum(AUDIO_CODECS)).optional(),
    preferredAudioCodecs: vine.array(vine.enum(AUDIO_CODECS)).optional(),
    requiredAudioLanguages: vine.array(vine.enum(LANGUAGE_CODES)).optional(),
    requireAllAudioLanguages: vine.boolean().optional(),
    preferredAudioLanguages: vine.array(vine.enum(LANGUAGE_CODES)).optional(),
    blockedAudioLanguages: vine.array(vine.enum(LANGUAGE_CODES)).optional(),
    requireHdr: vine.boolean().optional(),
    blockedVideoCodecs: vine.array(vine.enum(VIDEO_CODECS)).optional(),
    blockUpscaled: vine.boolean().optional(),
    blockHardcodedSubs: vine.boolean().optional(),
    blockUnknownQuality: vine.boolean().optional(),
    minCustomFormatScore: vine.number().optional(),
    minVideoBitrateKbps: vine.number().min(0).nullable().optional(),
    minAudioBitrateKbps: vine.number().min(0).nullable().optional(),
  })
  .optional()

const qualityProfileValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    mediaType: vine.string().optional(),
    cutoff: vine.number(),
    upgradeAllowed: vine.boolean().optional(),
    minSizeMb: vine.number().min(0).optional(),
    maxSizeMb: vine.number().min(0).optional(),
    requirements: requirementsSchema,
    items: vine.array(
      vine.object({
        id: vine.number(),
        name: vine.string(),
        allowed: vine.boolean(),
      })
    ),
  })
)

const testReleaseValidator = vine.compile(
  vine.object({
    title: vine.string().minLength(1).maxLength(500),
    mediaType: vine.enum(['movies', 'tv', 'music', 'books'] as const).optional(),
  })
)

export default class QualityProfilesController {
  async index({ response }: HttpContext) {
    const profiles = await QualityProfile.query().orderBy('name', 'asc')
    return response.json(profiles)
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(qualityProfileValidator)

    const profile = await QualityProfile.create({
      name: data.name,
      mediaType: data.mediaType ?? null,
      cutoff: data.cutoff,
      upgradeAllowed: data.upgradeAllowed ?? true,
      minSizeMb: data.minSizeMb ?? null,
      maxSizeMb: data.maxSizeMb ?? null,
      requirements: normalizeRequirements(
        data.requirements as Partial<ReturnType<typeof normalizeRequirements>> | undefined
      ),
      items: data.items,
    })

    return response.created(profile)
  }

  async show({ params, response }: HttpContext) {
    const profile = await QualityProfile.find(params.id)
    if (!profile) {
      return response.notFound({ error: 'Quality profile not found' })
    }
    return response.json(profile)
  }

  async update({ params, request, response }: HttpContext) {
    const profile = await QualityProfile.find(params.id)
    if (!profile) {
      return response.notFound({ error: 'Quality profile not found' })
    }

    const data = await request.validateUsing(qualityProfileValidator)

    profile.merge({
      name: data.name,
      mediaType: data.mediaType ?? profile.mediaType,
      cutoff: data.cutoff,
      upgradeAllowed: data.upgradeAllowed ?? profile.upgradeAllowed,
      minSizeMb: data.minSizeMb ?? null,
      maxSizeMb: data.maxSizeMb ?? null,
      // Merged onto what is stored, so a partial payload narrows nothing.
      requirements: normalizeRequirements({
        ...(profile.requirements ?? {}),
        ...(data.requirements ?? {}),
      }),
      items: data.items,
    })
    await profile.save()

    return response.json(profile)
  }

  /**
   * Score a release title against this profile without grabbing anything.
   *
   * Quality rules are the part of the app people cannot verify by reading the
   * settings — they only find out a rule was too strict, or too loose, days
   * later when the wrong file lands. This makes the rule answerable now.
   */
  async test({ params, request, response }: HttpContext) {
    const profile = await QualityProfile.find(params.id)
    if (!profile) {
      return response.notFound({ error: 'Quality profile not found' })
    }

    const data = await request.validateUsing(testReleaseValidator)
    const mediaType =
      data.mediaType ??
      (profile.mediaType as 'movies' | 'tv' | 'music' | 'books' | null) ??
      'movies'

    const { annotateReleases } = await import('#services/quality/release_annotator')
    const [annotated] = await annotateReleases(
      [
        {
          id: 'test',
          title: data.title,
          size: 0,
          downloadUrl: '',
          indexer: 'test',
          indexerId: null,
        } as never,
      ],
      mediaType,
      profile
    )

    return response.json(annotated)
  }

  async destroy({ params, response }: HttpContext) {
    const profile = await QualityProfile.find(params.id)
    if (!profile) {
      return response.notFound({ error: 'Quality profile not found' })
    }

    // Check if profile is in use
    const artistCount = await profile.related('artists').query().count('* as total')
    if (Number(artistCount[0].$extras.total) > 0) {
      return response.conflict({ error: 'Cannot delete profile that is in use by artists' })
    }

    await profile.delete()
    return response.noContent()
  }
}
