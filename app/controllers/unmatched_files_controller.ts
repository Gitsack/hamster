import type { HttpContext } from '@adonisjs/core/http'
import UnmatchedFile from '#models/unmatched_file'
import vine from '@vinejs/vine'

const updateStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(['pending', 'matched', 'ignored']),
  })
)

const queryValidator = vine.compile(
  vine.object({
    mediaType: vine.enum(['music', 'movies', 'tv', 'books']).optional(),
    status: vine.enum(['pending', 'matched', 'ignored']).optional(),
    rootFolderId: vine.string().uuid().optional(),
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
  })
)

export default class UnmatchedFilesController {
  /**
   * List unmatched files with optional filtering
   */
  async index({ request, response }: HttpContext) {
    const query = await request.validateUsing(queryValidator)
    const page = query.page || 1
    const limit = query.limit || 50

    const filesQuery = UnmatchedFile.query().preload('rootFolder').orderBy('createdAt', 'desc')

    if (query.mediaType) {
      filesQuery.where('mediaType', query.mediaType)
    }

    if (query.status) {
      filesQuery.where('status', query.status)
    }

    if (query.rootFolderId) {
      filesQuery.where('rootFolderId', query.rootFolderId)
    }

    const files = await filesQuery.paginate(page, limit)

    return response.json(files)
  }

  /**
   * Get a single unmatched file
   */
  async show({ params, response }: HttpContext) {
    const file = await UnmatchedFile.query().where('id', params.id).preload('rootFolder').first()

    if (!file) {
      return response.notFound({ error: 'Unmatched file not found' })
    }

    return response.json(file)
  }

  /**
   * Update unmatched file status (mark as matched or ignored)
   */
  async update({ params, request, response }: HttpContext) {
    const file = await UnmatchedFile.find(params.id)
    if (!file) {
      return response.notFound({ error: 'Unmatched file not found' })
    }

    const data = await request.validateUsing(updateStatusValidator)

    file.status = data.status
    await file.save()

    return response.json(file)
  }

  /**
   * Mark file as ignored
   */
  async ignore({ params, response }: HttpContext) {
    const file = await UnmatchedFile.find(params.id)
    if (!file) {
      return response.notFound({ error: 'Unmatched file not found' })
    }

    file.status = 'ignored'
    await file.save()

    return response.json(file)
  }

  /**
   * Delete unmatched file record
   */
  async destroy({ params, response }: HttpContext) {
    const file = await UnmatchedFile.find(params.id)
    if (!file) {
      return response.notFound({ error: 'Unmatched file not found' })
    }

    await file.delete()
    return response.noContent()
  }

  /**
   * Bulk update status for multiple files
   */
  async bulkUpdate({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        ids: vine.array(vine.string().uuid()),
        status: vine.enum(['matched', 'ignored']),
      })
    )

    const data = await request.validateUsing(validator)

    await UnmatchedFile.query().whereIn('id', data.ids).update({ status: data.status })

    return response.json({
      message: `Updated ${data.ids.length} files`,
      count: data.ids.length,
    })
  }

  /**
   * Bulk delete files
   */
  async bulkDestroy({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        ids: vine.array(vine.string().uuid()),
      })
    )

    const data = await request.validateUsing(validator)

    await UnmatchedFile.query().whereIn('id', data.ids).delete()

    return response.json({
      message: `Deleted ${data.ids.length} files`,
      count: data.ids.length,
    })
  }

  /**
   * Get stats about unmatched files
   */
  async stats({ response }: HttpContext) {
    const [pending, matched, ignored, byMediaType] = await Promise.all([
      UnmatchedFile.query().where('status', 'pending').count('* as count'),
      UnmatchedFile.query().where('status', 'matched').count('* as count'),
      UnmatchedFile.query().where('status', 'ignored').count('* as count'),
      UnmatchedFile.query()
        .select('mediaType')
        .count('* as count')
        .where('status', 'pending')
        .groupBy('mediaType'),
    ])

    return response.json({
      pending: Number(pending[0].$extras.count) || 0,
      matched: Number(matched[0].$extras.count) || 0,
      ignored: Number(ignored[0].$extras.count) || 0,
      byMediaType: byMediaType.reduce(
        (acc, row) => {
          acc[row.mediaType] = Number(row.$extras.count) || 0
          return acc
        },
        {} as Record<string, number>
      ),
    })
  }
}
