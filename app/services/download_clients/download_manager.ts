import DownloadClient from '#models/download_client'
import Download from '#models/download'
import Movie from '#models/movie'
import Episode from '#models/episode'
import Book from '#models/book'
import { sabnzbdService, type SabnzbdConfig } from './sabnzbd_service.js'
import { downloadImportService } from '#services/media/download_import_service'
import { movieImportService } from '#services/media/movie_import_service'
import { episodeImportService } from '#services/media/episode_import_service'
import { bookImportService } from '#services/media/book_import_service'
import { fileNamingService } from '#services/media/file_naming_service'
import { blacklistService } from '#services/blacklist/blacklist_service'
import { DateTime } from 'luxon'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface DownloadRequest {
  title: string
  downloadUrl: string
  size?: number
  albumId?: string
  movieId?: string
  tvShowId?: string
  episodeId?: string
  bookId?: string
  releaseId?: string
  indexerId?: string
  indexerName?: string
  guid?: string
}

export interface QueueItem {
  id: string
  externalId: string | null
  title: string
  status: string
  progress: number
  size: number | null
  remaining: number | null
  eta: number | null
  albumId: string | null
  movieId: string | null
  tvShowId: string | null
  episodeId: string | null
  bookId: string | null
  artistId: string | null
  downloadClient: string
  startedAt: string | null
}

export class DownloadManager {
  /**
   * Check if a media item already has a file in the library
   * Returns true if file exists (and updates hasFile flag if needed), false otherwise
   */
  private async checkFileExistsInLibrary(request: DownloadRequest): Promise<boolean> {
    try {
      if (request.movieId) {
        return await this.checkMovieFileExists(request.movieId)
      }

      if (request.episodeId) {
        return await this.checkEpisodeFileExists(request.episodeId)
      }

      if (request.bookId) {
        return await this.checkBookFileExists(request.bookId)
      }

      // For albums/music, we don't have a simple single-file check
      return false
    } catch (error) {
      console.error('[DownloadManager] Error checking if file exists in library:', error)
      return false
    }
  }

  /**
   * Check if a movie file already exists in the library
   */
  private async checkMovieFileExists(movieId: string): Promise<boolean> {
    const movie = await Movie.query()
      .where('id', movieId)
      .preload('rootFolder')
      .first()

    if (!movie || !movie.rootFolder) {
      return false
    }

    // Generate expected folder path
    const folderName = await fileNamingService.getMovieFolderName({ movie })
    const expectedFolderPath = path.join(movie.rootFolder.path, folderName)

    // Check if folder exists and contains a video file
    try {
      const files = await fs.readdir(expectedFolderPath)
      const videoExtensions = fileNamingService.getSupportedVideoExtensions()

      for (const file of files) {
        const ext = path.extname(file).toLowerCase()
        if (videoExtensions.includes(ext)) {
          console.log(`[DownloadManager] Movie file already exists: ${path.join(expectedFolderPath, file)}`)

          // Update hasFile flag if not already set
          if (!movie.hasFile) {
            movie.hasFile = true
            movie.requested = false
            await movie.save()
            console.log(`[DownloadManager] Updated movie hasFile=true for: ${movie.title}`)
          }

          return true
        }
      }
    } catch {
      // Folder doesn't exist, which is fine
    }

    return false
  }

  /**
   * Check if an episode file already exists in the library
   */
  private async checkEpisodeFileExists(episodeId: string): Promise<boolean> {
    const episode = await Episode.query()
      .where('id', episodeId)
      .preload('tvShow', (query) => query.preload('rootFolder'))
      .first()

    if (!episode || !episode.tvShow || !episode.tvShow.rootFolder) {
      return false
    }

    // Generate expected folder path
    const showFolder = await fileNamingService.getTvShowFolderName({ tvShow: episode.tvShow })
    const seasonFolder = await fileNamingService.getSeasonFolderName(episode.seasonNumber)
    const expectedFolderPath = path.join(episode.tvShow.rootFolder.path, showFolder, seasonFolder)

    // Generate expected filename pattern
    const episodeFileName = await fileNamingService.getEpisodeFileName({
      episode,
      tvShow: episode.tvShow,
    })

    // Check if folder exists and contains a matching episode file
    try {
      const files = await fs.readdir(expectedFolderPath)
      const videoExtensions = fileNamingService.getSupportedVideoExtensions()

      for (const file of files) {
        const ext = path.extname(file).toLowerCase()
        const nameWithoutExt = path.basename(file, ext)

        // Check if it's a video file and matches the expected episode pattern
        if (videoExtensions.includes(ext)) {
          // Match by expected name or by S##E## pattern
          const seasonNum = String(episode.seasonNumber).padStart(2, '0')
          const episodeNum = String(episode.episodeNumber).padStart(2, '0')
          const episodePattern = `S${seasonNum}E${episodeNum}`

          if (nameWithoutExt === episodeFileName || nameWithoutExt.toUpperCase().includes(episodePattern)) {
            console.log(`[DownloadManager] Episode file already exists: ${path.join(expectedFolderPath, file)}`)

            // Update hasFile flag if not already set
            if (!episode.hasFile) {
              episode.hasFile = true
              episode.requested = false
              await episode.save()
              console.log(`[DownloadManager] Updated episode hasFile=true for: S${seasonNum}E${episodeNum}`)
            }

            return true
          }
        }
      }
    } catch {
      // Folder doesn't exist, which is fine
    }

    return false
  }

  /**
   * Check if a book file already exists in the library
   */
  private async checkBookFileExists(bookId: string): Promise<boolean> {
    const book = await Book.query()
      .where('id', bookId)
      .preload('author', (query) => query.preload('rootFolder'))
      .first()

    if (!book || !book.author || !book.author.rootFolder) {
      return false
    }

    // Generate expected folder path (author folder)
    const authorFolder = await fileNamingService.getAuthorFolderName({ author: book.author })
    const expectedFolderPath = path.join(book.author.rootFolder.path, authorFolder)

    // Generate expected filename
    const bookFileName = await fileNamingService.getBookFileName({ book, author: book.author })

    // Check if folder exists and contains a matching book file
    try {
      const files = await fs.readdir(expectedFolderPath)
      const bookExtensions = fileNamingService.getSupportedBookExtensions()

      for (const file of files) {
        const ext = path.extname(file).toLowerCase()
        const nameWithoutExt = path.basename(file, ext)

        if (bookExtensions.includes(ext) && nameWithoutExt === bookFileName) {
          console.log(`[DownloadManager] Book file already exists: ${path.join(expectedFolderPath, file)}`)

          // Update hasFile flag if not already set
          if (!book.hasFile) {
            book.hasFile = true
            book.requested = false
            await book.save()
            console.log(`[DownloadManager] Updated book hasFile=true for: ${book.title}`)
          }

          return true
        }
      }
    } catch {
      // Folder doesn't exist, which is fine
    }

    return false
  }

  /**
   * Send a release to the download client
   */
  async grab(request: DownloadRequest): Promise<Download> {
    // Check for existing active downloads for the same media item
    // This prevents duplicate downloads when multiple search tasks run concurrently
    const existingDownloadQuery = Download.query().whereIn('status', [
      'queued',
      'downloading',
      'paused',
      'importing',
    ])

    if (request.episodeId) {
      existingDownloadQuery.where('episodeId', request.episodeId)
    } else if (request.movieId) {
      existingDownloadQuery.where('movieId', request.movieId)
    } else if (request.albumId) {
      existingDownloadQuery.where('albumId', request.albumId)
    } else if (request.bookId) {
      existingDownloadQuery.where('bookId', request.bookId)
    }

    const existingDownload = await existingDownloadQuery.first()
    if (existingDownload) {
      console.log(`[DownloadManager] Skipping duplicate download for: ${request.title} (existing download: ${existingDownload.id})`)
      return existingDownload
    }

    // Check for recently completed downloads (within 1 hour) to prevent duplicate downloads
    // when a download just finished but hasFile hasn't been updated yet
    const recentlyCompletedQuery = Download.query()
      .where('status', 'completed')
      .where('completedAt', '>=', DateTime.now().minus({ hours: 1 }).toSQL())

    if (request.episodeId) {
      recentlyCompletedQuery.where('episodeId', request.episodeId)
    } else if (request.movieId) {
      recentlyCompletedQuery.where('movieId', request.movieId)
    } else if (request.albumId) {
      recentlyCompletedQuery.where('albumId', request.albumId)
    } else if (request.bookId) {
      recentlyCompletedQuery.where('bookId', request.bookId)
    }

    const recentlyCompleted = await recentlyCompletedQuery.first()
    if (recentlyCompleted) {
      console.log(`[DownloadManager] Skipping duplicate download for: ${request.title} (recently completed: ${recentlyCompleted.id})`)
      throw new Error('A download for this item completed recently')
    }

    // Check hasFile flag directly on the media item as a safety net
    if (request.episodeId) {
      const episode = await Episode.find(request.episodeId)
      if (episode?.hasFile) {
        console.log(`[DownloadManager] Skipping download for: ${request.title} (episode already has file)`)
        throw new Error('Episode already has a file')
      }
    } else if (request.movieId) {
      const movie = await Movie.find(request.movieId)
      if (movie?.hasFile) {
        console.log(`[DownloadManager] Skipping download for: ${request.title} (movie already has file)`)
        throw new Error('Movie already has a file')
      }
    } else if (request.bookId) {
      const book = await Book.find(request.bookId)
      if (book?.hasFile) {
        console.log(`[DownloadManager] Skipping download for: ${request.title} (book already has file)`)
        throw new Error('Book already has a file')
      }
    }

    // Check if file already exists in the library (based on expected path from naming settings)
    const fileAlreadyExists = await this.checkFileExistsInLibrary(request)
    if (fileAlreadyExists) {
      console.log(`[DownloadManager] Skipping download for: ${request.title} (file already exists in library)`)
      throw new Error('File already exists in library')
    }

    // Get enabled download client
    const client = await DownloadClient.query().where('enabled', true).orderBy('priority', 'asc').first()

    if (!client) {
      throw new Error('No enabled download client configured')
    }

    // Create download record
    const download = await Download.create({
      downloadClientId: client.id,
      title: request.title,
      status: 'queued',
      progress: 0,
      sizeBytes: request.size || null,
      albumId: request.albumId || null,
      movieId: request.movieId || null,
      tvShowId: request.tvShowId || null,
      episodeId: request.episodeId || null,
      bookId: request.bookId || null,
      releaseId: request.releaseId || null,
      indexerId: request.indexerId || null,
      nzbInfo: {
        guid: request.guid,
        title: request.title,
        downloadUrl: request.downloadUrl,
        size: request.size,
        indexer: request.indexerName,
      },
      startedAt: DateTime.now(),
    })

    try {
      // Send to download client
      const externalId = await this.sendToClient(client, request)
      download.externalId = externalId
      download.status = 'downloading'
      await download.save()

      return download
    } catch (error) {
      download.status = 'failed'
      download.errorMessage = error instanceof Error ? error.message : 'Failed to send to download client'
      await download.save()
      throw error
    }
  }

  /**
   * Send NZB to download client
   */
  private async sendToClient(client: DownloadClient, request: DownloadRequest): Promise<string> {
    switch (client.type) {
      case 'sabnzbd': {
        const config: SabnzbdConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8080,
          apiKey: client.settings.apiKey || '',
          useSsl: client.settings.useSsl || false,
          category: client.settings.category,
        }

        const result = await sabnzbdService.addFromUrl(config, request.downloadUrl, {
          name: request.title,
          category: client.settings.category,
        })

        return result.nzo_ids[0]
      }

      default:
        throw new Error(`Unsupported download client type: ${client.type}`)
    }
  }

  /**
   * Get active queue
   */
  async getQueue(): Promise<QueueItem[]> {
    const downloads = await Download.query()
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
      .preload('downloadClient')
      .orderBy('createdAt', 'asc')

    return downloads.map((d) => ({
      id: d.id,
      externalId: d.externalId,
      title: d.title,
      status: d.status,
      progress: d.progress,
      size: d.sizeBytes,
      remaining: d.remainingBytes,
      eta: d.etaSeconds,
      albumId: d.albumId,
      movieId: d.movieId,
      tvShowId: d.tvShowId,
      episodeId: d.episodeId,
      bookId: d.bookId,
      artistId: null, // We'd need to fetch this from album if needed
      downloadClient: d.downloadClient?.name || 'Unknown',
      startedAt: d.startedAt?.toISO() || null,
    }))
  }

  /**
   * Refresh queue status from download clients
   */
  async refreshQueue(): Promise<void> {
    const clients = await DownloadClient.query().where('enabled', true)

    for (const client of clients) {
      try {
        await this.refreshClientQueue(client)
      } catch (error) {
        console.error(`Failed to refresh queue for ${client.name}:`, error)
      }
    }
  }

  /**
   * Refresh queue from a specific client
   */
  private async refreshClientQueue(client: DownloadClient): Promise<void> {
    switch (client.type) {
      case 'sabnzbd': {
        const config: SabnzbdConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8080,
          apiKey: client.settings.apiKey || '',
          useSsl: client.settings.useSsl || false,
        }

        // Load all downloads for this client at once to avoid N+1 queries
        const allDownloads = await Download.query().where('downloadClientId', client.id)
        const downloadsByExternalId = new Map<string, Download>()
        for (const dl of allDownloads) {
          if (dl.externalId) {
            downloadsByExternalId.set(dl.externalId, dl)
          }
        }

        const queue = await sabnzbdService.getQueue(config)

        // Track all external IDs found in SABnzbd (queue + history)
        const foundExternalIds = new Set<string>()

        // Update local downloads from queue
        for (const slot of queue.slots) {
          foundExternalIds.add(slot.nzo_id)

          const download = downloadsByExternalId.get(slot.nzo_id)

          if (download) {
            download.progress = parseFloat(slot.percentage)
            download.status = this.mapSabnzbdStatus(slot.status)
            download.remainingBytes = Math.floor(parseFloat(slot.mbleft) * 1024 * 1024)
            download.etaSeconds = this.parseTimeLeft(slot.timeleft)
            await download.save()
          }
        }

        // Check history for completed downloads (reduced limit to 50 for performance)
        const history = await sabnzbdService.getHistory(config, 50)
        console.log(`[DownloadManager] Checking SABnzbd history: ${history.slots.length} items`)

        for (const slot of history.slots) {
          foundExternalIds.add(slot.nzo_id)

          const download = downloadsByExternalId.get(slot.nzo_id)

          if (download) {
            console.log(`[DownloadManager] Found download in history: ${download.title}, SABnzbd status: ${slot.status}, DB status: ${download.status}, outputPath: ${download.outputPath || 'none'}`)
          }

          if (download && download.status !== 'completed' && download.status !== 'failed') {
            if (slot.status === 'Completed') {
              console.log(`[DownloadManager] SABnzbd shows Completed for: ${download.title}`)

              // Check if import is stuck (status is 'importing' for more than 2 minutes)
              const isStuck =
                download.status === 'importing' &&
                download.completedAt &&
                download.completedAt < DateTime.now().minus({ minutes: 2 })

              // Trigger import if we haven't already OR if it's stuck
              const shouldTriggerImport = !download.outputPath || isStuck
              console.log(`[DownloadManager] shouldTriggerImport: ${shouldTriggerImport}, isStuck: ${isStuck}, storage path: ${slot.storage}`)

              // Apply remote path mapping to get the local path
              let localPath = slot.storage
              if (client.settings?.remotePath && client.settings?.localPath) {
                if (localPath.startsWith(client.settings.remotePath)) {
                  localPath = localPath.replace(client.settings.remotePath, client.settings.localPath)
                }
              }

              // Check if the path is accessible BEFORE triggering import
              // Use a short timeout to avoid blocking on unmounted network paths
              let pathAccessible = false
              let pathError = ''
              try {
                await Promise.race([
                  fs.access(localPath),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Path check timeout')), 3000)
                  ),
                ])
                pathAccessible = true
              } catch (error) {
                const isTimeout = error instanceof Error && error.message === 'Path check timeout'
                if (isTimeout) {
                  pathError = `Download path not responding: "${localPath}". The network storage may not be mounted or is unresponsive.`
                } else {
                  // Check if parent directory exists (also with timeout)
                  const parentDir = path.dirname(localPath)
                  try {
                    await Promise.race([
                      fs.access(parentDir),
                      new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), 2000)
                      ),
                    ])
                    pathError = `File not found: "${path.basename(localPath)}". The download folder exists but the file is missing.`
                  } catch {
                    // Parent directory doesn't exist either - likely a mount/path mapping issue
                    pathError = `Download path not accessible: "${localPath}". This usually means the network storage is not mounted or the Remote Path Mapping in Download Client settings is incorrect.`
                  }
                }
              }

              // Mark as importing and save the output path
              download.status = 'importing'
              download.progress = 100
              if (!download.completedAt) {
                download.completedAt = DateTime.now()
              }
              download.outputPath = slot.storage
              await download.save()

              // If path is not accessible, fail immediately with a clear error
              if (!pathAccessible) {
                console.error(`[DownloadManager] Path not accessible for ${download.title}: ${pathError}`)
                download.status = 'failed'
                download.errorMessage = pathError
                await download.save()
                continue
              }

              // Trigger import in background
              if (shouldTriggerImport) {
                console.log(`[DownloadManager] Triggering import for: ${download.title}${isStuck ? ' (retry - was stuck)' : ''}`)
                this.triggerImport(download).catch((error) => {
                  console.error(`[DownloadManager] Failed to import download ${download.id}:`, error)
                })
              } else {
                console.log(`[DownloadManager] Import recently triggered for: ${download.title}`)
              }
            } else if (slot.status === 'Failed') {
              const errorMessage = slot.fail_message || 'Download failed'
              download.status = 'failed'
              download.errorMessage = errorMessage
              await download.save()

              // Blacklist the release if it's a genuine download failure (not a config issue)
              if (blacklistService.shouldBlacklist(errorMessage)) {
                const guid = download.nzbInfo?.guid || download.externalId || ''
                const indexer = download.nzbInfo?.indexer || 'unknown'

                console.log(`[DownloadManager] Blacklisting failed release: ${download.title} (guid: ${guid}, indexer: ${indexer})`)

                await blacklistService.blacklist({
                  guid,
                  indexer,
                  title: download.title,
                  movieId: download.movieId,
                  episodeId: download.episodeId,
                  albumId: download.albumId,
                  bookId: download.bookId,
                  reason: errorMessage,
                  failureType: blacklistService.determineFailureType(errorMessage),
                })

                // Check if we've exceeded the retry limit (3 retries max)
                const hasExceeded = await blacklistService.hasExceededRetries({
                  movieId: download.movieId,
                  episodeId: download.episodeId,
                  albumId: download.albumId,
                  bookId: download.bookId,
                })

                if (!hasExceeded) {
                  // Trigger search for alternative release
                  console.log(`[DownloadManager] Searching for alternative release for: ${download.title}`)
                  this.triggerAlternativeSearch(download).catch((error) => {
                    console.error(`[DownloadManager] Failed to find alternative for ${download.title}:`, error)
                  })
                } else {
                  console.log(`[DownloadManager] Max retries (3) exceeded for: ${download.title}, not searching for alternatives`)
                }
              }
            } else {
              // Post-processing statuses (Extracting, Verifying, Repairing, Moving, Running)
              console.log(`[DownloadManager] SABnzbd post-processing: ${download.title} - ${slot.status}`)
              if (download.status !== 'importing') {
                download.status = 'importing'
                download.progress = 100
                await download.save()
              }
            }
          }
        }

        // Remove orphaned downloads that no longer exist in SABnzbd
        // These are downloads with an externalId that wasn't found in queue or history
        const orphanedDownloads = await Download.query()
          .where('downloadClientId', client.id)
          .whereNotNull('externalId')
          .whereIn('status', ['queued', 'downloading', 'paused'])

        for (const orphan of orphanedDownloads) {
          if (orphan.externalId && !foundExternalIds.has(orphan.externalId)) {
            console.log(`[DownloadManager] Removing orphaned download: ${orphan.title} (externalId: ${orphan.externalId})`)
            await orphan.delete()
          }
        }

        break
      }
    }
  }

  /**
   * Trigger import for a completed download
   * Routes to the appropriate import service based on media type
   */
  private async triggerImport(download: Download): Promise<void> {
    console.log(`[DownloadManager] Starting import for download: ${download.title}`)
    console.log(`[DownloadManager]   Original output path: ${download.outputPath}`)

    try {
      // Apply remote path mapping if configured
      if (download.downloadClientId && download.outputPath) {
        const client = await DownloadClient.find(download.downloadClientId)
        if (client?.settings?.remotePath && client?.settings?.localPath) {
          if (download.outputPath.startsWith(client.settings.remotePath)) {
            const oldPath = download.outputPath
            download.outputPath = download.outputPath.replace(
              client.settings.remotePath,
              client.settings.localPath
            )
            console.log(`[DownloadManager]   Mapped path: ${oldPath} -> ${download.outputPath}`)
            await download.save()
          }
        }
      }

      let result: { success: boolean; filesImported: number; errors: string[] }

      // Route to appropriate import service based on media type
      if (download.albumId) {
        // Music album
        console.log(`[DownloadManager] Importing as music album (albumId: ${download.albumId})`)
        result = await downloadImportService.importDownload(download, (progress) => {
          console.log(`[DownloadManager] Music import progress: ${progress.phase} - ${progress.current}/${progress.total}`)
        })
      } else if (download.movieId) {
        // Movie
        console.log(`[DownloadManager] Importing as movie (movieId: ${download.movieId})`)
        result = await movieImportService.importDownload(download, (progress) => {
          console.log(`[DownloadManager] Movie import progress: ${progress.phase} - ${progress.current}/${progress.total}`)
        })
      } else if (download.tvShowId || download.episodeId) {
        // TV Episode
        console.log(`[DownloadManager] Importing as TV episode (tvShowId: ${download.tvShowId}, episodeId: ${download.episodeId})`)
        result = await episodeImportService.importDownload(download, (progress) => {
          console.log(`[DownloadManager] Episode import progress: ${progress.phase} - ${progress.current}/${progress.total}`)
        })
      } else if (download.bookId) {
        // Book
        console.log(`[DownloadManager] Importing as book (bookId: ${download.bookId})`)
        result = await bookImportService.importDownload(download, (progress) => {
          console.log(`[DownloadManager] Book import progress: ${progress.phase} - ${progress.current}/${progress.total}`)
        })
      } else {
        // Unknown media type
        console.error(`[DownloadManager] Unknown media type for download: ${download.title}`)
        download.status = 'failed'
        download.errorMessage = 'Unknown media type - cannot determine import service'
        await download.save()
        return
      }

      if (result.success) {
        console.log(`[DownloadManager] Import completed: ${result.filesImported} files imported for ${download.title}`)
        download.status = 'completed'
      } else {
        console.error(`[DownloadManager] Import failed for ${download.title}:`, result.errors)
        download.status = 'failed'
        download.errorMessage = result.errors.join('; ') || 'Import failed'
      }

      await download.save()
    } catch (error) {
      console.error(`[DownloadManager] Import error for ${download.title}:`, error)
      download.status = 'failed'
      download.errorMessage = error instanceof Error ? error.message : 'Import failed'
      await download.save()
    }
  }

  /**
   * Search for and grab an alternative release after a failure
   * Imports requestedSearchTask dynamically to avoid circular dependency
   */
  private async triggerAlternativeSearch(failedDownload: Download): Promise<void> {
    // Dynamic import to avoid circular dependency
    const { requestedSearchTask } = await import('#services/tasks/requested_search_task')

    try {
      if (failedDownload.movieId) {
        const result = await requestedSearchTask.searchSingleMovie(failedDownload.movieId)
        if (result.grabbed) {
          console.log(`[DownloadManager] Found and grabbed alternative for movie: ${failedDownload.title}`)
        } else if (result.error) {
          console.log(`[DownloadManager] No alternative found for movie: ${result.error}`)
        } else {
          console.log(`[DownloadManager] No alternative releases available for movie: ${failedDownload.title}`)
        }
      } else if (failedDownload.episodeId) {
        const result = await requestedSearchTask.searchSingleEpisode(failedDownload.episodeId)
        if (result.grabbed) {
          console.log(`[DownloadManager] Found and grabbed alternative for episode: ${failedDownload.title}`)
        } else if (result.error) {
          console.log(`[DownloadManager] No alternative found for episode: ${result.error}`)
        } else {
          console.log(`[DownloadManager] No alternative releases available for episode: ${failedDownload.title}`)
        }
      } else if (failedDownload.albumId) {
        const result = await requestedSearchTask.searchSingleAlbum(failedDownload.albumId)
        if (result.grabbed) {
          console.log(`[DownloadManager] Found and grabbed alternative for album: ${failedDownload.title}`)
        } else if (result.error) {
          console.log(`[DownloadManager] No alternative found for album: ${result.error}`)
        } else {
          console.log(`[DownloadManager] No alternative releases available for album: ${failedDownload.title}`)
        }
      } else if (failedDownload.bookId) {
        const result = await requestedSearchTask.searchSingleBook(failedDownload.bookId)
        if (result.grabbed) {
          console.log(`[DownloadManager] Found and grabbed alternative for book: ${failedDownload.title}`)
        } else if (result.error) {
          console.log(`[DownloadManager] No alternative found for book: ${result.error}`)
        } else {
          console.log(`[DownloadManager] No alternative releases available for book: ${failedDownload.title}`)
        }
      }
    } catch (error) {
      console.error(`[DownloadManager] Error searching for alternative:`, error)
    }
  }

  /**
   * Map SABnzbd status to our status
   */
  private mapSabnzbdStatus(
    status: string
  ): 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'importing' {
    switch (status) {
      case 'Downloading':
      case 'Grabbing':
      case 'Fetching':
        return 'downloading'
      case 'Paused':
        return 'paused'
      case 'Queued':
        return 'queued'
      // Post-processing states - show as importing
      case 'Verifying':
      case 'Repairing':
      case 'Extracting':
      case 'Moving':
      case 'Running':
        return 'importing'
      default:
        return 'queued'
    }
  }

  /**
   * Parse SABnzbd time left string to seconds
   */
  private parseTimeLeft(timeleft: string): number {
    if (!timeleft || timeleft === 'Unknown') return 0

    const parts = timeleft.split(':')
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
    }
    return 0
  }

  /**
   * Cancel a download
   */
  async cancel(downloadId: string, deleteFiles = false): Promise<void> {
    const download = await Download.query().where('id', downloadId).preload('downloadClient').first()

    if (!download) {
      throw new Error('Download not found')
    }

    if (download.externalId && download.downloadClient) {
      const client = download.downloadClient

      switch (client.type) {
        case 'sabnzbd': {
          const config: SabnzbdConfig = {
            host: client.settings.host || 'localhost',
            port: client.settings.port || 8080,
            apiKey: client.settings.apiKey || '',
            useSsl: client.settings.useSsl || false,
          }

          await sabnzbdService.delete(config, download.externalId, deleteFiles)
          break
        }
      }
    }

    await download.delete()
  }

  /**
   * Test a download client connection
   */
  async testClient(
    type: string,
    settings: { host?: string; port?: number; apiKey?: string; useSsl?: boolean }
  ): Promise<{ success: boolean; version?: string; error?: string; remotePath?: string; pathAccessible?: boolean }> {
    switch (type) {
      case 'sabnzbd': {
        const config: SabnzbdConfig = {
          host: settings.host || 'localhost',
          port: settings.port || 8080,
          apiKey: settings.apiKey || '',
          useSsl: settings.useSsl || false,
        }

        const result = await sabnzbdService.testConnection(config)

        if (result.success) {
          // Also fetch the complete directory to help with path mapping
          try {
            const sabConfig = await sabnzbdService.getConfig(config)
            if (sabConfig.completeDir) {
              // Check if the path is accessible locally
              const fs = await import('node:fs/promises')
              let pathAccessible = false
              try {
                await fs.access(sabConfig.completeDir)
                pathAccessible = true
              } catch {
                pathAccessible = false
              }

              return {
                ...result,
                remotePath: sabConfig.completeDir,
                pathAccessible,
              }
            }
          } catch {
            // Ignore config fetch errors, connection still succeeded
          }
        }

        return result
      }

      default:
        return { success: false, error: `Unsupported client type: ${type}` }
    }
  }
}

export const downloadManager = new DownloadManager()
