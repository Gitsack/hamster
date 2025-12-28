import type { HttpContext } from '@adonisjs/core/http'
import Download from '#models/download'
import { downloadManager } from '#services/download_clients/download_manager'

export default class QueueController {
  /**
   * Get active download queue
   */
  async index({ response }: HttpContext) {
    const queue = await downloadManager.getQueue()
    return response.json(queue)
  }

  /**
   * Refresh queue status from download clients
   */
  async refresh({ response }: HttpContext) {
    await downloadManager.refreshQueue()
    const queue = await downloadManager.getQueue()
    return response.json(queue)
  }

  /**
   * Cancel a download
   */
  async destroy({ params, request, response }: HttpContext) {
    const deleteFiles = request.input('deleteFiles', false)

    try {
      await downloadManager.cancel(params.id, deleteFiles)
      return response.noContent()
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to cancel download',
      })
    }
  }

  /**
   * Get download history
   */
  async history({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 50)

    const downloads = await Download.query()
      .whereIn('status', ['completed', 'failed'])
      .preload('album')
      .preload('downloadClient')
      .orderBy('completedAt', 'desc')
      .paginate(page, limit)

    return response.json({
      data: downloads.all().map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        size: d.sizeBytes,
        albumId: d.albumId,
        albumTitle: d.album?.title,
        downloadClient: d.downloadClient?.name,
        errorMessage: d.errorMessage,
        startedAt: d.startedAt?.toISO(),
        completedAt: d.completedAt?.toISO(),
      })),
      meta: {
        total: downloads.total,
        perPage: downloads.perPage,
        currentPage: downloads.currentPage,
        lastPage: downloads.lastPage,
      },
    })
  }

  /**
   * Grab a release
   */
  async grab({ request, response }: HttpContext) {
    const { title, downloadUrl, size, albumId, releaseId, indexerId, indexerName, guid } = request.only([
      'title',
      'downloadUrl',
      'size',
      'albumId',
      'releaseId',
      'indexerId',
      'indexerName',
      'guid',
    ])

    if (!title || !downloadUrl) {
      return response.badRequest({ error: 'Title and download URL are required' })
    }

    try {
      const download = await downloadManager.grab({
        title,
        downloadUrl,
        size,
        albumId,
        releaseId,
        indexerId,
        indexerName,
        guid,
      })

      return response.created({
        id: download.id,
        title: download.title,
        status: download.status,
      })
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to grab release',
      })
    }
  }
}
