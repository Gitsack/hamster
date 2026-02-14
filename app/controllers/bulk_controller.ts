import type { HttpContext } from '@adonisjs/core/http'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Artist from '#models/artist'
import Book from '#models/book'
import vine from '@vinejs/vine'

const bulkValidator = vine.compile(
  vine.object({
    ids: vine.array(vine.string()).minLength(1).maxLength(500),
    action: vine.enum(['delete', 'request', 'unrequest', 'updateQualityProfile']),
    qualityProfileId: vine.string().optional(),
  })
)

interface BulkResult {
  processed: number
  errors: string[]
}

export default class BulkController {
  async movies({ request, response }: HttpContext) {
    const data = await request.validateUsing(bulkValidator)

    if (data.action === 'updateQualityProfile' && !data.qualityProfileId) {
      return response.unprocessableEntity({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'qualityProfileId is required for updateQualityProfile action',
        },
      })
    }

    const result = await this.processBulk(
      data.ids,
      data.action,
      data.qualityProfileId,
      async (id) => Movie.find(id),
      async (model, action, qpId) => {
        const movie = model as Movie
        switch (action) {
          case 'delete':
            await movie.delete()
            break
          case 'request':
            movie.requested = true
            await movie.save()
            break
          case 'unrequest':
            movie.requested = false
            await movie.save()
            break
          case 'updateQualityProfile':
            movie.qualityProfileId = qpId!
            await movie.save()
            break
        }
      }
    )

    return response.json(result)
  }

  async tvshows({ request, response }: HttpContext) {
    const data = await request.validateUsing(bulkValidator)

    if (data.action === 'updateQualityProfile' && !data.qualityProfileId) {
      return response.unprocessableEntity({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'qualityProfileId is required for updateQualityProfile action',
        },
      })
    }

    const result = await this.processBulk(
      data.ids,
      data.action,
      data.qualityProfileId,
      async (id) => TvShow.find(id),
      async (model, action, qpId) => {
        const show = model as TvShow
        switch (action) {
          case 'delete':
            await show.delete()
            break
          case 'request':
            show.requested = true
            await show.save()
            break
          case 'unrequest':
            show.requested = false
            await show.save()
            break
          case 'updateQualityProfile':
            show.qualityProfileId = qpId!
            await show.save()
            break
        }
      }
    )

    return response.json(result)
  }

  async artists({ request, response }: HttpContext) {
    const data = await request.validateUsing(bulkValidator)

    if (data.action === 'updateQualityProfile' && !data.qualityProfileId) {
      return response.unprocessableEntity({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'qualityProfileId is required for updateQualityProfile action',
        },
      })
    }

    const result = await this.processBulk(
      data.ids,
      data.action,
      data.qualityProfileId,
      async (id) => Artist.find(id),
      async (model, action, qpId) => {
        const artist = model as Artist
        switch (action) {
          case 'delete':
            await artist.delete()
            break
          case 'request':
            artist.requested = true
            await artist.save()
            break
          case 'unrequest':
            artist.requested = false
            await artist.save()
            break
          case 'updateQualityProfile':
            artist.qualityProfileId = qpId!
            await artist.save()
            break
        }
      }
    )

    return response.json(result)
  }

  async books({ request, response }: HttpContext) {
    const data = await request.validateUsing(bulkValidator)

    if (data.action === 'updateQualityProfile' && !data.qualityProfileId) {
      return response.unprocessableEntity({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'qualityProfileId is required for updateQualityProfile action',
        },
      })
    }

    const result = await this.processBulk(
      data.ids,
      data.action,
      data.qualityProfileId,
      async (id) => Book.find(id),
      async (model, action, _qpId) => {
        const book = model as Book
        switch (action) {
          case 'delete':
            await book.delete()
            break
          case 'request':
            book.requested = true
            await book.save()
            break
          case 'unrequest':
            book.requested = false
            await book.save()
            break
          case 'updateQualityProfile':
            // Books don't have quality profiles directly, but their authors do
            // For now, skip this action for books
            break
        }
      }
    )

    return response.json(result)
  }

  private async processBulk(
    ids: string[],
    action: string,
    qualityProfileId: string | undefined,
    findModel: (id: string) => Promise<any>,
    processAction: (model: any, action: string, qpId?: string) => Promise<void>
  ): Promise<BulkResult> {
    let processed = 0
    const errors: string[] = []

    for (const id of ids) {
      try {
        const model = await findModel(id)
        if (!model) {
          errors.push(`ID ${id} not found`)
          continue
        }
        await processAction(model, action, qualityProfileId)
        processed++
      } catch (error) {
        errors.push(
          `Failed to process ID ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return { processed, errors }
  }
}
