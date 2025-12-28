import type { HttpContext } from '@adonisjs/core/http'
import MetadataProfile from '#models/metadata_profile'
import vine from '@vinejs/vine'

const metadataProfileValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    primaryAlbumTypes: vine.array(vine.string()),
    secondaryAlbumTypes: vine.array(vine.string()),
    releaseStatuses: vine.array(vine.string()).optional(),
  })
)

export default class MetadataProfilesController {
  async index({ response }: HttpContext) {
    const profiles = await MetadataProfile.query().orderBy('name', 'asc')
    return response.json(profiles)
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(metadataProfileValidator)

    const profile = await MetadataProfile.create({
      name: data.name,
      primaryAlbumTypes: data.primaryAlbumTypes,
      secondaryAlbumTypes: data.secondaryAlbumTypes,
      releaseStatuses: data.releaseStatuses ?? ['Official'],
    })

    return response.created(profile)
  }

  async show({ params, response }: HttpContext) {
    const profile = await MetadataProfile.find(params.id)
    if (!profile) {
      return response.notFound({ error: 'Metadata profile not found' })
    }
    return response.json(profile)
  }

  async update({ params, request, response }: HttpContext) {
    const profile = await MetadataProfile.find(params.id)
    if (!profile) {
      return response.notFound({ error: 'Metadata profile not found' })
    }

    const data = await request.validateUsing(metadataProfileValidator)

    profile.merge({
      name: data.name,
      primaryAlbumTypes: data.primaryAlbumTypes,
      secondaryAlbumTypes: data.secondaryAlbumTypes,
      releaseStatuses: data.releaseStatuses ?? profile.releaseStatuses,
    })
    await profile.save()

    return response.json(profile)
  }

  async destroy({ params, response }: HttpContext) {
    const profile = await MetadataProfile.find(params.id)
    if (!profile) {
      return response.notFound({ error: 'Metadata profile not found' })
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
