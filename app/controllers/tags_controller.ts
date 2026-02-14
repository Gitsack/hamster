import type { HttpContext } from '@adonisjs/core/http'
import Tag from '#models/tag'
import MediaTag from '#models/media_tag'
import vine from '@vinejs/vine'

const tagValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
  })
)

const assignTagValidator = vine.compile(
  vine.object({
    mediaType: vine.enum(['movie', 'tvshow', 'artist', 'author'] as const),
    mediaId: vine.string().uuid(),
  })
)

const bulkAssignValidator = vine.compile(
  vine.object({
    mediaType: vine.enum(['movie', 'tvshow', 'artist', 'author'] as const),
    mediaIds: vine.array(vine.string().uuid()).minLength(1),
  })
)

export default class TagsController {
  /**
   * List all tags with usage counts
   */
  async index({ response }: HttpContext) {
    const tags = await Tag.query().orderBy('name', 'asc')

    const tagsWithCounts = await Promise.all(
      tags.map(async (tag) => {
        const count = await MediaTag.query().where('tagId', tag.id).count('* as total').first()
        return {
          ...tag.serialize(),
          mediaCount: Number(count?.$extras.total || 0),
        }
      })
    )

    return response.json(tagsWithCounts)
  }

  /**
   * Create a new tag
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(tagValidator)

    const existing = await Tag.query().whereILike('name', data.name).first()
    if (existing) {
      return response.conflict({ error: { code: 'DUPLICATE', message: 'Tag already exists' } })
    }

    const tag = await Tag.create({ name: data.name })
    return response.created(tag)
  }

  /**
   * Get a single tag with its media items
   */
  async show({ params, response }: HttpContext) {
    const tag = await Tag.find(params.id)
    if (!tag) {
      return response.notFound({ error: { code: 'NOT_FOUND', message: 'Tag not found' } })
    }

    const mediaTags = await MediaTag.query().where('tagId', tag.id)
    const mediaByType: Record<string, string[]> = {}
    for (const mt of mediaTags) {
      if (!mediaByType[mt.mediaType]) {
        mediaByType[mt.mediaType] = []
      }
      mediaByType[mt.mediaType].push(mt.mediaId)
    }

    return response.json({
      ...tag.serialize(),
      media: mediaByType,
    })
  }

  /**
   * Update a tag
   */
  async update({ params, request, response }: HttpContext) {
    const tag = await Tag.find(params.id)
    if (!tag) {
      return response.notFound({ error: { code: 'NOT_FOUND', message: 'Tag not found' } })
    }

    const data = await request.validateUsing(tagValidator)

    const existing = await Tag.query().whereILike('name', data.name).whereNot('id', tag.id).first()
    if (existing) {
      return response.conflict({
        error: { code: 'DUPLICATE', message: 'A tag with that name already exists' },
      })
    }

    tag.name = data.name
    await tag.save()
    return response.json(tag)
  }

  /**
   * Delete a tag
   */
  async destroy({ params, response }: HttpContext) {
    const tag = await Tag.find(params.id)
    if (!tag) {
      return response.notFound({ error: { code: 'NOT_FOUND', message: 'Tag not found' } })
    }

    await tag.delete()
    return response.noContent()
  }

  /**
   * Assign a tag to a media item
   */
  async assign({ params, request, response }: HttpContext) {
    const tag = await Tag.find(params.id)
    if (!tag) {
      return response.notFound({ error: { code: 'NOT_FOUND', message: 'Tag not found' } })
    }

    const data = await request.validateUsing(assignTagValidator)

    const existing = await MediaTag.query()
      .where('tagId', tag.id)
      .where('mediaType', data.mediaType)
      .where('mediaId', data.mediaId)
      .first()

    if (existing) {
      return response.json(existing)
    }

    const mediaTag = await MediaTag.create({
      tagId: tag.id,
      mediaType: data.mediaType,
      mediaId: data.mediaId,
    })

    return response.created(mediaTag)
  }

  /**
   * Remove a tag from a media item
   */
  async unassign({ params, request, response }: HttpContext) {
    const tag = await Tag.find(params.id)
    if (!tag) {
      return response.notFound({ error: { code: 'NOT_FOUND', message: 'Tag not found' } })
    }

    const data = await request.validateUsing(assignTagValidator)

    const mediaTag = await MediaTag.query()
      .where('tagId', tag.id)
      .where('mediaType', data.mediaType)
      .where('mediaId', data.mediaId)
      .first()

    if (!mediaTag) {
      return response.notFound({
        error: { code: 'NOT_FOUND', message: 'Tag assignment not found' },
      })
    }

    await mediaTag.delete()
    return response.noContent()
  }

  /**
   * Bulk assign a tag to multiple media items
   */
  async bulkAssign({ params, request, response }: HttpContext) {
    const tag = await Tag.find(params.id)
    if (!tag) {
      return response.notFound({ error: { code: 'NOT_FOUND', message: 'Tag not found' } })
    }

    const data = await request.validateUsing(bulkAssignValidator)

    // Get existing assignments to avoid duplicates
    const existing = await MediaTag.query()
      .where('tagId', tag.id)
      .where('mediaType', data.mediaType)
      .whereIn('mediaId', data.mediaIds)
      .select('mediaId')

    const existingIds = new Set(existing.map((mt) => mt.mediaId))
    const newIds = data.mediaIds.filter((id) => !existingIds.has(id))

    if (newIds.length > 0) {
      await MediaTag.createMany(
        newIds.map((mediaId) => ({
          tagId: tag.id,
          mediaType: data.mediaType,
          mediaId,
        }))
      )
    }

    return response.json({ assigned: newIds.length, skipped: existingIds.size })
  }

  /**
   * List media items by tag
   */
  async media({ params, request, response }: HttpContext) {
    const tag = await Tag.find(params.id)
    if (!tag) {
      return response.notFound({ error: { code: 'NOT_FOUND', message: 'Tag not found' } })
    }

    const mediaType = request.input('mediaType')
    const query = MediaTag.query().where('tagId', tag.id)

    if (mediaType) {
      query.where('mediaType', mediaType)
    }

    const mediaTags = await query.orderBy('createdAt', 'desc')

    return response.json(mediaTags)
  }

  /**
   * Get all tags for a specific media item
   */
  async forMedia({ request, response }: HttpContext) {
    const mediaType = request.input('mediaType')
    const mediaId = request.input('mediaId')

    if (!mediaType || !mediaId) {
      return response.badRequest({
        error: { code: 'VALIDATION_ERROR', message: 'mediaType and mediaId are required' },
      })
    }

    const mediaTags = await MediaTag.query()
      .where('mediaType', mediaType)
      .where('mediaId', mediaId)
      .preload('tag')

    const tags = mediaTags.map((mt) => mt.tag)
    return response.json(tags)
  }
}
