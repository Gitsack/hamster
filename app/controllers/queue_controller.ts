import type { HttpContext } from '@adonisjs/core/http'
import Download from '#models/download'
import DownloadClient from '#models/download_client'
import { downloadManager } from '#services/download_clients/download_manager'
import { downloadImportService } from '#services/media/download_import_service'
import { sabnzbdService, type SabnzbdConfig } from '#services/download_clients/sabnzbd_service'
import { wantedSearchTask } from '#services/tasks/wanted_search_task'

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

      // Now find all downloads that can be imported
      const completedDownloads = await Download.query()
        .whereNotNull('outputPath')
        .whereIn('status', ['completed', 'importing'])
        .whereNotNull('albumId')
        .preload('album')

      // Also check for downloads without albumId that might need manual matching
      const orphanedDownloads = await Download.query()
        .whereNotNull('outputPath')
        .whereIn('status', ['completed', 'importing'])
        .whereNull('albumId')

      if (orphanedDownloads.length > 0) {
        results.errors.push(
          `Found ${orphanedDownloads.length} completed downloads without album association: ${orphanedDownloads.map((d) => d.title).join(', ')}`
        )
      }

      for (const download of completedDownloads) {
        results.scanned++

        console.log(`Attempting to import: ${download.title}`)
        console.log(`  Output path: ${download.outputPath}`)
        console.log(`  Album ID: ${download.albumId}`)

        try {
          const importResult = await downloadImportService.importDownload(download)

          console.log(`  Import result: ${importResult.filesImported} files, errors: ${importResult.errors.join(', ')}`)

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

      const result = await downloadImportService.importDownload(download)

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
   * Search for all wanted albums and grab releases
   */
  async searchWanted({ response }: HttpContext) {
    if (wantedSearchTask.running) {
      return response.json({
        status: 'running',
        message: 'Search is already in progress',
      })
    }

    // Run the search in background
    wantedSearchTask.run().catch(console.error)

    return response.json({
      status: 'started',
      message: 'Search for wanted albums started',
    })
  }

  /**
   * Get wanted search task status
   */
  async wantedStatus({ response }: HttpContext) {
    return response.json({
      running: wantedSearchTask.running,
      intervalMinutes: wantedSearchTask.interval,
    })
  }
}
