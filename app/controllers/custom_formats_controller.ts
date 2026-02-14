import type { HttpContext } from '@adonisjs/core/http'
import CustomFormat from '#models/custom_format'
import { customFormatMatcher } from '#services/quality/custom_format_matcher'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'

const specificationSchema = vine.object({
  name: vine.string().minLength(1).maxLength(255),
  implementation: vine.enum([
    'contains',
    'notContains',
    'resolution',
    'source',
    'codec',
    'releaseGroup',
  ] as const),
  negate: vine.boolean(),
  required: vine.boolean(),
  value: vine.string().minLength(1),
})

const customFormatValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    includeWhenRenaming: vine.boolean().optional(),
    specifications: vine.array(specificationSchema).minLength(1),
  })
)

const testFormatValidator = vine.compile(
  vine.object({
    releaseTitle: vine.string().minLength(1),
    customFormatId: vine.string().uuid().optional(),
    qualityProfileId: vine.string().uuid().optional(),
  })
)

const assignToProfileValidator = vine.compile(
  vine.object({
    qualityProfileId: vine.string().uuid(),
    score: vine.number(),
  })
)

export default class CustomFormatsController {
  /**
   * List all custom formats
   */
  async index({ response }: HttpContext) {
    const formats = await CustomFormat.query().orderBy('name', 'asc')
    return response.json(formats)
  }

  /**
   * Create a new custom format
   */
  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(customFormatValidator)

    const format = await CustomFormat.create({
      name: data.name,
      includeWhenRenaming: data.includeWhenRenaming ?? false,
      specifications: data.specifications,
    })

    return response.created(format)
  }

  /**
   * Get a single custom format with its quality profile assignments
   */
  async show({ params, response }: HttpContext) {
    const format = await CustomFormat.find(params.id)
    if (!format) {
      return response.notFound({
        error: { code: 'NOT_FOUND', message: 'Custom format not found' },
      })
    }

    const assignments = await db
      .from('quality_profile_custom_formats')
      .join(
        'quality_profiles',
        'quality_profiles.id',
        'quality_profile_custom_formats.quality_profile_id'
      )
      .where('quality_profile_custom_formats.custom_format_id', format.id)
      .select(
        'quality_profiles.id',
        'quality_profiles.name',
        'quality_profile_custom_formats.score'
      )

    return response.json({
      ...format.serialize(),
      qualityProfiles: assignments,
    })
  }

  /**
   * Update a custom format
   */
  async update({ params, request, response }: HttpContext) {
    const format = await CustomFormat.find(params.id)
    if (!format) {
      return response.notFound({
        error: { code: 'NOT_FOUND', message: 'Custom format not found' },
      })
    }

    const data = await request.validateUsing(customFormatValidator)

    format.merge({
      name: data.name,
      includeWhenRenaming: data.includeWhenRenaming ?? format.includeWhenRenaming,
      specifications: data.specifications,
    })
    await format.save()

    return response.json(format)
  }

  /**
   * Delete a custom format
   */
  async destroy({ params, response }: HttpContext) {
    const format = await CustomFormat.find(params.id)
    if (!format) {
      return response.notFound({
        error: { code: 'NOT_FOUND', message: 'Custom format not found' },
      })
    }

    // Remove quality profile assignments first
    await db.from('quality_profile_custom_formats').where('custom_format_id', format.id).delete()

    await format.delete()
    return response.noContent()
  }

  /**
   * Test a release title against custom formats
   */
  async test({ request, response }: HttpContext) {
    const data = await request.validateUsing(testFormatValidator)

    if (data.customFormatId) {
      // Test against a specific custom format
      const format = await CustomFormat.find(data.customFormatId)
      if (!format) {
        return response.notFound({
          error: { code: 'NOT_FOUND', message: 'Custom format not found' },
        })
      }

      const matches = customFormatMatcher.matchesFormat(format, data.releaseTitle)
      return response.json({ matches, formatName: format.name })
    }

    if (data.qualityProfileId) {
      // Score against all custom formats for a quality profile
      const result = await customFormatMatcher.scoreRelease(
        data.releaseTitle,
        data.qualityProfileId
      )
      return response.json(result)
    }

    // Test against all custom formats
    const allFormats = await CustomFormat.all()
    const results = allFormats.map((format) => ({
      id: format.id,
      name: format.name,
      matches: customFormatMatcher.matchesFormat(format, data.releaseTitle),
    }))

    return response.json(results)
  }

  /**
   * Assign a custom format to a quality profile with a score
   */
  async assignToProfile({ params, request, response }: HttpContext) {
    const format = await CustomFormat.find(params.id)
    if (!format) {
      return response.notFound({
        error: { code: 'NOT_FOUND', message: 'Custom format not found' },
      })
    }

    const data = await request.validateUsing(assignToProfileValidator)

    // Check if assignment already exists
    const existing = await db
      .from('quality_profile_custom_formats')
      .where('quality_profile_id', data.qualityProfileId)
      .where('custom_format_id', format.id)
      .first()

    if (existing) {
      await db
        .from('quality_profile_custom_formats')
        .where('quality_profile_id', data.qualityProfileId)
        .where('custom_format_id', format.id)
        .update({ score: data.score })
    } else {
      await db.table('quality_profile_custom_formats').insert({
        id: db.rawQuery('gen_random_uuid()').knexQuery,
        quality_profile_id: data.qualityProfileId,
        custom_format_id: format.id,
        score: data.score,
        created_at: new Date(),
      })
    }

    return response.json({ qualityProfileId: data.qualityProfileId, score: data.score })
  }

  /**
   * Remove a custom format from a quality profile
   */
  async removeFromProfile({ params, response }: HttpContext) {
    const { id, profileId } = params

    const deleted = await db
      .from('quality_profile_custom_formats')
      .where('custom_format_id', id)
      .where('quality_profile_id', profileId)
      .delete()

    if (!deleted[0]) {
      return response.notFound({
        error: { code: 'NOT_FOUND', message: 'Assignment not found' },
      })
    }

    return response.noContent()
  }
}
