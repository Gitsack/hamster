import type { HttpContext } from '@adonisjs/core/http'
import { blacklistService } from '#services/blacklist/blacklist_service'

export default class BlacklistController {
  /**
   * Get all blacklisted releases with pagination
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 50)

    // Optional media type filter
    const mediaType = request.input('mediaType')
    const mediaId = request.input('mediaId')

    if (mediaType && mediaId) {
      const options: Record<string, string> = {}
      switch (mediaType) {
        case 'movie':
          options.movieId = mediaId
          break
        case 'episode':
          options.episodeId = mediaId
          break
        case 'album':
          options.albumId = mediaId
          break
        case 'book':
          options.bookId = mediaId
          break
        default:
          return response.badRequest({ error: 'Invalid media type' })
      }

      const entries = await blacklistService.getForMedia(options)
      return response.json({
        data: entries.map((e) => ({
          id: e.id,
          guid: e.guid,
          indexer: e.indexer,
          title: e.title,
          reason: e.reason,
          failureType: e.failureType,
          movieId: e.movieId,
          episodeId: e.episodeId,
          albumId: e.albumId,
          bookId: e.bookId,
          blacklistedAt: e.blacklistedAt?.toISO(),
          expiresAt: e.expiresAt?.toISO(),
          isActive: e.isActive(),
        })),
        meta: {
          total: entries.length,
        },
      })
    }

    const result = await blacklistService.getAll(page, limit)
    return response.json({
      data: result.data.map((e) => ({
        id: e.id,
        guid: e.guid,
        indexer: e.indexer,
        title: e.title,
        reason: e.reason,
        failureType: e.failureType,
        movieId: e.movieId,
        episodeId: e.episodeId,
        albumId: e.albumId,
        bookId: e.bookId,
        blacklistedAt: e.blacklistedAt?.toISO(),
        expiresAt: e.expiresAt?.toISO(),
        isActive: e.isActive(),
      })),
      meta: {
        total: result.total,
        perPage: limit,
        currentPage: page,
      },
    })
  }

  /**
   * Remove a blacklist entry
   */
  async destroy({ params, response }: HttpContext) {
    const removed = await blacklistService.remove(params.id)

    if (!removed) {
      return response.notFound({ error: 'Blacklist entry not found' })
    }

    return response.noContent()
  }

  /**
   * Clear all blacklist entries for a media item
   */
  async clearMedia({ params, response }: HttpContext) {
    const { type, id } = params

    const options: { movieId?: string; episodeId?: string; albumId?: string; bookId?: string } = {}
    switch (type) {
      case 'movie':
        options.movieId = id
        break
      case 'episode':
        options.episodeId = id
        break
      case 'album':
        options.albumId = id
        break
      case 'book':
        options.bookId = id
        break
      default:
        return response.badRequest({ error: 'Invalid media type' })
    }

    const deleted = await blacklistService.removeForMedia(options)
    return response.json({ deleted })
  }

  /**
   * Manually cleanup expired blacklist entries
   */
  async cleanup({ response }: HttpContext) {
    const cleaned = await blacklistService.cleanupExpired()
    return response.json({
      message: `Cleaned up ${cleaned} expired entries`,
      count: cleaned,
    })
  }
}
