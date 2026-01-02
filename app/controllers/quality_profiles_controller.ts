import type { HttpContext } from '@adonisjs/core/http'
import QualityProfile from '#models/quality_profile'
import vine from '@vinejs/vine'

const qualityProfileValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    mediaType: vine.string().optional(),
    cutoff: vine.number(),
    upgradeAllowed: vine.boolean().optional(),
    items: vine.array(
      vine.object({
        id: vine.number(),
        name: vine.string(),
        allowed: vine.boolean(),
      })
    ),
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
      items: data.items,
    })
    await profile.save()

    return response.json(profile)
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
