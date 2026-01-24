import type { HttpContext } from '@adonisjs/core/http'
import Download from '#models/download'
import DownloadClient from '#models/download_client'
import { downloadManager } from '#services/download_clients/download_manager'
import { downloadImportService } from '#services/media/download_import_service'
import { bookImportService } from '#services/media/book_import_service'
import { movieImportService } from '#services/media/movie_import_service'
import { episodeImportService } from '#services/media/episode_import_service'
import { sabnzbdService, type SabnzbdConfig } from '#services/download_clients/sabnzbd_service'
import { requestedSearchTask } from '#services/tasks/requested_search_task'

export default class QueueController {
  private static lastRefresh: Date | null = null
  private static isRefreshing = false
  private static REFRESH_INTERVAL_MS = 5000 // Refresh from SABnzbd at most every 5 seconds

  /**
   * Get active download queue - triggers background refresh if stale, returns cached data immediately
   */
  async index({ response }: HttpContext) {
    // Trigger a background refresh from SABnzbd if it's been more than 5 seconds
    // This is non-blocking to prevent UI freezes when SABnzbd is slow/unresponsive
    const now = new Date()
    if (
      !QueueController.isRefreshing &&
      (!QueueController.lastRefresh ||
        now.getTime() - QueueController.lastRefresh.getTime() > QueueController.REFRESH_INTERVAL_MS)
    ) {
      QueueController.isRefreshing = true
      QueueController.lastRefresh = now

      // Fire and forget - don't await
      downloadManager
        .refreshQueue()
        .catch((error) => {
          console.error('[QueueController] Background refresh failed:', error)
        })
        .finally(() => {
          QueueController.isRefreshing = false
        })
    }

    // Always return cached queue data immediately (from database)
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
    const { title, downloadUrl, size, albumId, releaseId, indexerId, indexerName, guid } =
      request.only([
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

  /**
   * Scan and import completed downloads
   */
  async scanCompleted({ response }: HttpContext) {
    try {
      const results = {
        scanned: 0,
        updated: 0,
        imported: 0,
        failed: 0,
        errors: [] as string[],
      }

      // First, check SABnzbd history to update any stuck downloads
      const clients = await DownloadClient.query().where('enabled', true)

      for (const client of clients) {
        if (client.type === 'sabnzbd') {
          const config: SabnzbdConfig = {
            host: client.settings.host || 'localhost',
            port: client.settings.port || 8080,
            apiKey: client.settings.apiKey || '',
            useSsl: client.settings.useSsl || false,
          }

          try {
            const history = await sabnzbdService.getHistory(config, 50)

            for (const slot of history.slots) {
              // Find download by externalId
              const download = await Download.query()
                .where('downloadClientId', client.id)
                .where('externalId', slot.nzo_id)
                .whereIn('status', ['queued', 'downloading', 'paused'])
                .first()

              if (download && slot.status === 'Completed') {
                download.status = 'importing'
                download.progress = 100
                download.outputPath = slot.storage
                await download.save()
                results.updated++
              }
            }
          } catch (error) {
            console.error(`Failed to check SABnzbd history for ${client.name}:`, error)
          }
        }
      }

      // Now find all downloads that can be imported (any media type)
      const completedDownloads = await Download.query()
        .whereNotNull('outputPath')
        .whereIn('status', ['completed', 'importing'])
        .where((query) => {
          query
            .whereNotNull('albumId')
            .orWhereNotNull('bookId')
            .orWhereNotNull('movieId')
            .orWhereNotNull('episodeId')
        })
        .preload('album')

      // Also check for downloads without any media association that might need manual matching
      const orphanedDownloads = await Download.query()
        .whereNotNull('outputPath')
        .whereIn('status', ['completed', 'importing'])
        .whereNull('albumId')
        .whereNull('bookId')
        .whereNull('movieId')
        .whereNull('episodeId')

      if (orphanedDownloads.length > 0) {
        results.errors.push(
          `Found ${orphanedDownloads.length} completed downloads without media association: ${orphanedDownloads.map((d) => d.title).join(', ')}`
        )
      }

      for (const download of completedDownloads) {
        results.scanned++

        console.log(`Attempting to import: ${download.title}`)
        console.log(`  Output path: ${download.outputPath}`)
        console.log(
          `  Album ID: ${download.albumId}, Book ID: ${download.bookId}, Movie ID: ${download.movieId}, Episode ID: ${download.episodeId}`
        )

        try {
          let importResult: { success: boolean; filesImported: number; errors: string[] }

          // Use appropriate import service based on media type
          if (download.albumId) {
            importResult = await downloadImportService.importDownload(download)
          } else if (download.bookId) {
            importResult = await bookImportService.importDownload(download)
          } else if (download.movieId) {
            importResult = await movieImportService.importDownload(download)
          } else if (download.episodeId) {
            importResult = await episodeImportService.importDownload(download)
          } else {
            continue // Should not happen due to query filter
          }

          console.log(
            `  Import result: ${importResult.filesImported} files, errors: ${importResult.errors.join(', ')}`
          )

          if (importResult.success && importResult.filesImported > 0) {
            results.imported++
            download.status = 'completed'
            await download.save()
          } else if (importResult.errors.length > 0) {
            results.failed++
            results.errors.push(`${download.title}: ${importResult.errors.join(', ')}`)
          }
        } catch (error) {
          results.failed++
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.error(`  Import error: ${errorMsg}`)
          results.errors.push(`${download.title}: ${errorMsg}`)
        }
      }

      return response.json({
        message: `Updated ${results.updated}, scanned ${results.scanned} downloads, imported ${results.imported}, failed ${results.failed}`,
        ...results,
      })
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to scan completed downloads',
      })
    }
  }

  /**
   * Debug endpoint to see raw data
   */
  async debug({ response }: HttpContext) {
    const downloads = await Download.query()
      .preload('downloadClient')
      .orderBy('createdAt', 'desc')
      .limit(20)

    const clients = await DownloadClient.query().where('enabled', true)
    const historyData: Record<string, unknown[]> = {}

    for (const client of clients) {
      if (client.type === 'sabnzbd') {
        const config: SabnzbdConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8080,
          apiKey: client.settings.apiKey || '',
          useSsl: client.settings.useSsl || false,
        }

        try {
          const history = await sabnzbdService.getHistory(config, 20)
          historyData[client.name] = history.slots.map((s) => ({
            nzo_id: s.nzo_id,
            name: s.name,
            status: s.status,
            storage: s.storage,
          }))
        } catch (error) {
          historyData[client.name] = [{ error: String(error) }]
        }
      }
    }

    return response.json({
      downloads: downloads.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        externalId: d.externalId,
        outputPath: d.outputPath,
        albumId: d.albumId,
        clientName: d.downloadClient?.name,
      })),
      sabnzbdHistory: historyData,
    })
  }

  /**
   * Manually import a specific download
   */
  async import({ params, response }: HttpContext) {
    try {
      const download = await Download.query()
        .where('id', params.id)
        .whereNotNull('outputPath')
        .first()

      if (!download) {
        return response.notFound({ error: 'Download not found or has no output path' })
      }

      let result: { success: boolean; filesImported: number; errors: string[] }

      // Use appropriate import service based on media type
      if (download.albumId) {
        result = await downloadImportService.importDownload(download)
      } else if (download.bookId) {
        result = await bookImportService.importDownload(download)
      } else if (download.movieId) {
        result = await movieImportService.importDownload(download)
      } else if (download.episodeId) {
        result = await episodeImportService.importDownload(download)
      } else {
        return response.badRequest({ error: 'Download has no associated media' })
      }

      if (result.success) {
        download.status = 'completed'
        await download.save()
        return response.json({
          message: `Imported ${result.filesImported} files`,
          ...result,
        })
      } else {
        return response.badRequest({
          error: result.errors.join('; ') || 'Import failed',
          ...result,
        })
      }
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to import download',
      })
    }
  }

  /**
   * Retry a failed download import
   */
  async retryImport({ params, response }: HttpContext) {
    try {
      const download = await Download.query()
        .where('id', params.id)
        .whereNotNull('outputPath')
        .first()

      if (!download) {
        return response.notFound({ error: 'Download not found or has no output path' })
      }

      if (download.status !== 'failed') {
        return response.badRequest({ error: 'Only failed downloads can be retried' })
      }

      // Reset status to importing
      download.status = 'importing'
      download.errorMessage = null
      await download.save()

      let result: { success: boolean; filesImported: number; errors: string[] }

      // Use appropriate import service based on media type
      if (download.albumId) {
        result = await downloadImportService.importDownload(download)
      } else if (download.bookId) {
        result = await bookImportService.importDownload(download)
      } else if (download.movieId) {
        result = await movieImportService.importDownload(download)
      } else if (download.episodeId) {
        result = await episodeImportService.importDownload(download)
      } else {
        return response.badRequest({ error: 'Download has no associated media' })
      }

      if (result.success) {
        download.status = 'completed'
        await download.save()
        return response.json({
          message: `Imported ${result.filesImported} files`,
          ...result,
        })
      } else {
        download.status = 'failed'
        download.errorMessage = result.errors.join('; ') || 'Import failed'
        await download.save()
        return response.badRequest({
          error: result.errors.join('; ') || 'Import failed',
          ...result,
        })
      }
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to retry import',
      })
    }
  }

  /**
   * Get all failed downloads with their error messages
   */
  async failed({ response }: HttpContext) {
    const downloads = await Download.query()
      .where('status', 'failed')
      .orderBy('createdAt', 'desc')
      .limit(50)

    return response.json(
      downloads.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        errorMessage: d.errorMessage,
        outputPath: d.outputPath,
        albumId: d.albumId,
        bookId: d.bookId,
        movieId: d.movieId,
        episodeId: d.episodeId,
        createdAt: d.createdAt?.toISO(),
      }))
    )
  }

  /**
   * Clear all failed downloads (removes from database, doesn't touch files)
   */
  async clearFailed({ response }: HttpContext) {
    const deleted = await Download.query().where('status', 'failed').delete()

    return response.json({
      message: `Cleared ${deleted} failed downloads`,
      count: deleted,
    })
  }

  /**
   * Search for all requested items and grab releases
   */
  async searchRequested({ response }: HttpContext) {
    if (requestedSearchTask.running) {
      return response.json({
        status: 'running',
        message: 'Search is already in progress',
      })
    }

    // Run the search in background
    requestedSearchTask.run().catch(console.error)

    return response.json({
      status: 'started',
      message: 'Search for requested items started',
    })
  }

  /**
   * Get requested search task status
   */
  async requestedStatus({ response }: HttpContext) {
    return response.json({
      running: requestedSearchTask.running,
      intervalMinutes: requestedSearchTask.interval,
    })
  }
}
