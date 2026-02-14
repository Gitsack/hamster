import logger from '@adonisjs/core/services/logger'
import DownloadClient from '#models/download_client'
import Download from '#models/download'
import Movie from '#models/movie'
import Episode from '#models/episode'
import Book from '#models/book'
import { sabnzbdService, type SabnzbdConfig } from './sabnzbd_service.js'
import { nzbgetService, type NzbgetConfig } from './nzbget_service.js'
import { qbittorrentService, type QBittorrentConfig } from './qbittorrent_service.js'
import { transmissionService, type TransmissionConfig } from './transmission_service.js'
import { delugeService, type DelugeConfig } from './deluge_service.js'
import { downloadImportService } from '#services/media/download_import_service'
import { movieImportService } from '#services/media/movie_import_service'
import { episodeImportService } from '#services/media/episode_import_service'
import { bookImportService } from '#services/media/book_import_service'
import { fileNamingService } from '#services/media/file_naming_service'
import { blacklistService } from '#services/blacklist/blacklist_service'
import { eventEmitter } from '#services/events/event_emitter'
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
      logger.error({ err: error }, 'DownloadManager: Error checking if file exists in library')
      return false
    }
  }

  /**
   * Check if a movie file already exists in the library
   */
  private async checkMovieFileExists(movieId: string): Promise<boolean> {
    const movie = await Movie.query().where('id', movieId).preload('rootFolder').first()

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
          logger.info(
            { movie: movie.title, path: path.join(expectedFolderPath, file) },
            'DownloadManager: Movie file already exists'
          )

          // Update hasFile flag if not already set
          if (!movie.hasFile) {
            movie.hasFile = true
            movie.requested = false
            await movie.save()
            logger.info({ movie: movie.title }, 'DownloadManager: Updated movie hasFile=true')
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

          if (
            nameWithoutExt === episodeFileName ||
            nameWithoutExt.toUpperCase().includes(episodePattern)
          ) {
            logger.info(
              { episode: `S${seasonNum}E${episodeNum}`, path: path.join(expectedFolderPath, file) },
              'DownloadManager: Episode file already exists'
            )

            // Update hasFile flag if not already set
            if (!episode.hasFile) {
              episode.hasFile = true
              episode.requested = false
              await episode.save()
              logger.info(
                { episode: `S${seasonNum}E${episodeNum}` },
                'DownloadManager: Updated episode hasFile=true'
              )
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
          logger.info(
            { book: book.title, path: path.join(expectedFolderPath, file) },
            'DownloadManager: Book file already exists'
          )

          // Update hasFile flag if not already set
          if (!book.hasFile) {
            book.hasFile = true
            book.requested = false
            await book.save()
            logger.info({ book: book.title }, 'DownloadManager: Updated book hasFile=true')
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
      logger.info(
        { title: request.title, existingId: existingDownload.id },
        'DownloadManager: Skipping duplicate download'
      )
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
      logger.info(
        { title: request.title, completedId: recentlyCompleted.id },
        'DownloadManager: Skipping recently completed download'
      )
      throw new Error('A download for this item completed recently')
    }

    // Check hasFile flag directly on the media item as a safety net
    if (request.episodeId) {
      const episode = await Episode.find(request.episodeId)
      if (episode?.hasFile) {
        logger.info(
          { title: request.title },
          'DownloadManager: Skipping download, episode already has file'
        )
        throw new Error('Episode already has a file')
      }
    } else if (request.movieId) {
      const movie = await Movie.find(request.movieId)
      if (movie?.hasFile) {
        logger.info(
          { title: request.title },
          'DownloadManager: Skipping download, movie already has file'
        )
        throw new Error('Movie already has a file')
      }
    } else if (request.bookId) {
      const book = await Book.find(request.bookId)
      if (book?.hasFile) {
        logger.info(
          { title: request.title },
          'DownloadManager: Skipping download, book already has file'
        )
        throw new Error('Book already has a file')
      }
    }

    // Check if file already exists in the library (based on expected path from naming settings)
    const fileAlreadyExists = await this.checkFileExistsInLibrary(request)
    if (fileAlreadyExists) {
      logger.info(
        { title: request.title },
        'DownloadManager: Skipping download, file already exists in library'
      )
      throw new Error('File already exists in library')
    }

    // Get enabled download client
    const client = await DownloadClient.query()
      .where('enabled', true)
      .orderBy('priority', 'asc')
      .first()

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

      // Emit grab event
      const mediaType = request.movieId
        ? 'movies'
        : request.episodeId || request.tvShowId
          ? 'tv'
          : request.bookId
            ? 'books'
            : 'music'
      eventEmitter
        .emitGrab({
          media: {
            id: request.movieId || request.episodeId || request.bookId || request.albumId || '',
            title: request.title,
            mediaType,
          },
          release: {
            title: request.title,
            indexer: request.indexerName || 'unknown',
            size: request.size,
            protocol: client.type === 'sabnzbd' || client.type === 'nzbget' ? 'usenet' : 'torrent',
            guid: request.guid,
          },
          downloadClient: client.name,
          downloadId: externalId,
        })
        .catch((err) => logger.error({ err }, 'DownloadManager: Failed to emit grab event'))

      return download
    } catch (error) {
      download.status = 'failed'
      download.errorMessage =
        error instanceof Error ? error.message : 'Failed to send to download client'
      await download.save()
      throw error
    }
  }

  /**
   * Send download to client (NZB or torrent)
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

      case 'nzbget': {
        const config: NzbgetConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 6789,
          username: client.settings.username,
          password: client.settings.password,
          useSsl: client.settings.useSsl || false,
          category: client.settings.category,
        }

        const nzbId = await nzbgetService.addFromUrl(config, request.downloadUrl, {
          nzbName: request.title,
          category: client.settings.category,
        })

        return String(nzbId)
      }

      case 'qbittorrent': {
        const config: QBittorrentConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8080,
          username: client.settings.username,
          password: client.settings.password,
          useSsl: client.settings.useSsl || false,
          category: client.settings.category,
        }

        // qBittorrent doesn't return the hash directly when adding
        // We need to add and then find it by name
        await qbittorrentService.addTorrent(config, request.downloadUrl, {
          category: client.settings.category,
          savePath: client.settings.downloadDirectory,
          paused: client.settings.addPaused,
          rename: request.title,
        })

        // Wait a moment for the torrent to be added, then find it
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const torrents = await qbittorrentService.getTorrents(config)
        const added = torrents.find(
          (t) => t.name === request.title || t.name.includes(request.title.substring(0, 50))
        )

        if (added) {
          return added.hash
        }

        // Return a placeholder - we'll find it during queue refresh
        return `qbt_${Date.now()}`
      }

      case 'transmission': {
        const config: TransmissionConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 9091,
          username: client.settings.username,
          password: client.settings.password,
          useSsl: client.settings.useSsl || false,
          urlBase: client.settings.urlBase,
        }

        const result = await transmissionService.addTorrent(config, request.downloadUrl, {
          downloadDir: client.settings.downloadDirectory,
          paused: client.settings.addPaused,
        })

        return result.hashString
      }

      case 'deluge': {
        const config: DelugeConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8112,
          password: client.settings.password || '',
          useSsl: client.settings.useSsl || false,
        }

        return delugeService.addTorrent(config, request.downloadUrl, {
          downloadPath: client.settings.downloadDirectory,
          addPaused: client.settings.addPaused,
        })
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
        logger.error(
          { client: client.name, err: error },
          'DownloadManager: Failed to refresh queue'
        )
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
            download.progress = Number.parseFloat(slot.percentage)
            download.status = this.mapSabnzbdStatus(slot.status)
            download.remainingBytes = Math.floor(Number.parseFloat(slot.mbleft) * 1024 * 1024)
            download.etaSeconds = this.parseTimeLeft(slot.timeleft)
            await download.save()
          }
        }

        // Check history for completed downloads (reduced limit to 50 for performance)
        const history = await sabnzbdService.getHistory(config, 50)
        logger.debug({ count: history.slots.length }, 'DownloadManager: Checking SABnzbd history')

        for (const slot of history.slots) {
          foundExternalIds.add(slot.nzo_id)

          const download = downloadsByExternalId.get(slot.nzo_id)

          if (download) {
            logger.debug(
              {
                title: download.title,
                sabStatus: slot.status,
                dbStatus: download.status,
                outputPath: download.outputPath || 'none',
              },
              'DownloadManager: Found download in history'
            )
          }

          if (download && download.status !== 'completed' && download.status !== 'failed') {
            if (slot.status === 'Completed') {
              logger.info({ title: download.title }, 'DownloadManager: SABnzbd shows Completed')

              // Check if import is stuck (status is 'importing' for more than 2 minutes)
              const isStuck =
                download.status === 'importing' &&
                download.completedAt &&
                download.completedAt < DateTime.now().minus({ minutes: 2 })

              // Trigger import if we haven't already OR if it's stuck
              const shouldTriggerImport = !download.outputPath || isStuck
              logger.debug(
                { shouldTriggerImport, isStuck, storagePath: slot.storage },
                'DownloadManager: Import trigger check'
              )

              // Apply remote path mapping to get the local path
              let localPath = slot.storage
              if (client.settings?.remotePath && client.settings?.localPath) {
                if (localPath.startsWith(client.settings.remotePath)) {
                  localPath = localPath.replace(
                    client.settings.remotePath,
                    client.settings.localPath
                  )
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

              // Emit download completed event
              const dlMediaType = download.movieId
                ? 'movies'
                : download.tvShowId || download.episodeId
                  ? 'tv'
                  : download.bookId
                    ? 'books'
                    : 'music'
              eventEmitter
                .emitDownloadCompleted({
                  media: {
                    id:
                      download.movieId ||
                      download.episodeId ||
                      download.bookId ||
                      download.albumId ||
                      '',
                    title: download.title,
                    mediaType: dlMediaType,
                  },
                  release: {
                    title: download.title,
                    indexer: download.nzbInfo?.indexer || 'unknown',
                    size: download.sizeBytes ? Number(download.sizeBytes) : undefined,
                    protocol: 'usenet',
                  },
                  downloadClient: client.name,
                  downloadId: download.externalId || download.id,
                  outputPath: localPath,
                })
                .catch((err) =>
                  logger.error({ err }, 'DownloadManager: Failed to emit download completed event')
                )

              // If path is not accessible, fail immediately with a clear error
              if (!pathAccessible) {
                logger.error(
                  { title: download.title, pathError },
                  'DownloadManager: Path not accessible'
                )
                download.status = 'failed'
                download.errorMessage = pathError
                await download.save()
                continue
              }

              // Trigger import in background
              if (shouldTriggerImport) {
                logger.info(
                  { title: download.title, retry: isStuck },
                  'DownloadManager: Triggering import'
                )
                this.triggerImport(download).catch((error) => {
                  logger.error(
                    { downloadId: download.id, err: error },
                    'DownloadManager: Failed to import download'
                  )
                })
              } else {
                logger.debug(
                  { title: download.title },
                  'DownloadManager: Import recently triggered'
                )
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

                logger.info(
                  { title: download.title, guid, indexer },
                  'DownloadManager: Blacklisting failed release'
                )

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
                  logger.info(
                    { title: download.title },
                    'DownloadManager: Searching for alternative release'
                  )
                  this.triggerAlternativeSearch(download).catch((error) => {
                    logger.error(
                      { title: download.title, err: error },
                      'DownloadManager: Failed to find alternative'
                    )
                  })
                } else {
                  logger.info(
                    { title: download.title },
                    'DownloadManager: Max retries exceeded, not searching for alternatives'
                  )
                }
              }
            } else {
              // Post-processing statuses (Extracting, Verifying, Repairing, Moving, Running)
              logger.debug(
                { title: download.title, status: slot.status },
                'DownloadManager: SABnzbd post-processing'
              )
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
            logger.info(
              { title: orphan.title, externalId: orphan.externalId },
              'DownloadManager: Removing orphaned download'
            )
            await orphan.delete()
          }
        }

        break
      }

      case 'nzbget': {
        const config: NzbgetConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 6789,
          username: client.settings.username,
          password: client.settings.password,
          useSsl: client.settings.useSsl || false,
        }

        const allDownloads = await Download.query().where('downloadClientId', client.id)
        const downloadsByExternalId = new Map<string, Download>()
        for (const dl of allDownloads) {
          if (dl.externalId) {
            downloadsByExternalId.set(dl.externalId, dl)
          }
        }

        const foundExternalIds = new Set<string>()

        // Check queue
        const queue = await nzbgetService.getQueue(config)
        for (const item of queue) {
          const externalId = String(item.NZBID)
          foundExternalIds.add(externalId)

          const download = downloadsByExternalId.get(externalId)
          if (download) {
            const totalSize = item.FileSizeMB * 1024 * 1024
            const downloadedSize = item.DownloadedSizeMB * 1024 * 1024
            download.progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0
            download.status = nzbgetService.mapStatusToDownloadStatus(item.Status)
            download.remainingBytes = item.RemainingFileSizeMB * 1024 * 1024
            await download.save()
          }
        }

        // Check history
        const history = await nzbgetService.getHistory(config)
        for (const item of history.slice(0, 50)) {
          const externalId = String(item.NZBID)
          foundExternalIds.add(externalId)

          const download = downloadsByExternalId.get(externalId)
          if (download && download.status !== 'completed' && download.status !== 'failed') {
            if (item.Status === 'SUCCESS') {
              download.status = 'importing'
              download.progress = 100
              download.outputPath = item.FinalDir || item.DestDir
              if (!download.completedAt) {
                download.completedAt = DateTime.now()
              }
              await download.save()

              // Emit download completed event
              const nzbMediaType = download.movieId
                ? 'movies'
                : download.tvShowId || download.episodeId
                  ? 'tv'
                  : download.bookId
                    ? 'books'
                    : 'music'
              eventEmitter
                .emitDownloadCompleted({
                  media: {
                    id:
                      download.movieId ||
                      download.episodeId ||
                      download.bookId ||
                      download.albumId ||
                      '',
                    title: download.title,
                    mediaType: nzbMediaType,
                  },
                  release: {
                    title: download.title,
                    indexer: download.nzbInfo?.indexer || 'unknown',
                    size: download.sizeBytes ? Number(download.sizeBytes) : undefined,
                    protocol: 'usenet',
                  },
                  downloadClient: client.name,
                  downloadId: download.externalId || download.id,
                  outputPath: download.outputPath || '',
                })
                .catch((err) =>
                  logger.error({ err }, 'DownloadManager: Failed to emit download completed event')
                )

              // Trigger import
              this.triggerImport(download).catch((error) => {
                logger.error(
                  { downloadId: download.id, err: error },
                  'DownloadManager: Failed to import download'
                )
              })
            } else if (nzbgetService.mapStatusToDownloadStatus(item.Status) === 'failed') {
              download.status = 'failed'
              download.errorMessage = `NZBGet: ${item.Status}`
              await download.save()
            }
          }
        }

        break
      }

      case 'qbittorrent': {
        const config: QBittorrentConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8080,
          username: client.settings.username,
          password: client.settings.password,
          useSsl: client.settings.useSsl || false,
          category: client.settings.category,
        }

        const allDownloads = await Download.query().where('downloadClientId', client.id)
        const downloadsByExternalId = new Map<string, Download>()
        for (const dl of allDownloads) {
          if (dl.externalId) {
            downloadsByExternalId.set(dl.externalId, dl)
          }
        }

        const torrents = await qbittorrentService.getTorrents(config)
        const foundExternalIds = new Set<string>()

        for (const torrent of torrents) {
          foundExternalIds.add(torrent.hash)

          const download = downloadsByExternalId.get(torrent.hash)
          if (download) {
            download.progress = torrent.progress * 100
            download.status = qbittorrentService.mapStateToStatus(torrent.state)
            download.remainingBytes = torrent.size - torrent.size * torrent.progress
            download.etaSeconds = torrent.eta >= 0 ? torrent.eta : 0

            // Check if completed (seeding)
            if (download.status === 'completed' && download.outputPath !== torrent.content_path) {
              download.outputPath = torrent.content_path
              if (!download.completedAt) {
                download.completedAt = DateTime.now()
              }

              // Emit download completed event
              const qbtMediaType = download.movieId
                ? 'movies'
                : download.tvShowId || download.episodeId
                  ? 'tv'
                  : download.bookId
                    ? 'books'
                    : 'music'
              eventEmitter
                .emitDownloadCompleted({
                  media: {
                    id:
                      download.movieId ||
                      download.episodeId ||
                      download.bookId ||
                      download.albumId ||
                      '',
                    title: download.title,
                    mediaType: qbtMediaType,
                  },
                  release: {
                    title: download.title,
                    indexer: download.nzbInfo?.indexer || 'unknown',
                    size: download.sizeBytes ? Number(download.sizeBytes) : undefined,
                    protocol: 'torrent',
                  },
                  downloadClient: client.name,
                  downloadId: download.externalId || download.id,
                  outputPath: torrent.content_path,
                })
                .catch((err) =>
                  logger.error({ err }, 'DownloadManager: Failed to emit download completed event')
                )

              // Trigger import
              this.triggerImport(download).catch((error) => {
                logger.error(
                  { downloadId: download.id, err: error },
                  'DownloadManager: Failed to import download'
                )
              })
            }

            await download.save()
          }
        }

        // Remove orphaned downloads
        const orphanedDownloads = await Download.query()
          .where('downloadClientId', client.id)
          .whereNotNull('externalId')
          .whereIn('status', ['queued', 'downloading', 'paused'])

        for (const orphan of orphanedDownloads) {
          if (orphan.externalId && !foundExternalIds.has(orphan.externalId)) {
            logger.info(
              { title: orphan.title },
              'DownloadManager: Removing orphaned qBittorrent download'
            )
            await orphan.delete()
          }
        }

        break
      }

      case 'transmission': {
        const config: TransmissionConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 9091,
          username: client.settings.username,
          password: client.settings.password,
          useSsl: client.settings.useSsl || false,
          urlBase: client.settings.urlBase,
        }

        const allDownloads = await Download.query().where('downloadClientId', client.id)
        const downloadsByExternalId = new Map<string, Download>()
        for (const dl of allDownloads) {
          if (dl.externalId) {
            downloadsByExternalId.set(dl.externalId, dl)
          }
        }

        const torrents = await transmissionService.getTorrents(config)
        const foundExternalIds = new Set<string>()

        for (const torrent of torrents) {
          foundExternalIds.add(torrent.hashString)

          const download = downloadsByExternalId.get(torrent.hashString)
          if (download) {
            download.progress = torrent.percentDone * 100
            download.status = transmissionService.mapStatusToDownloadStatus(
              torrent.status,
              torrent.isFinished
            )
            download.remainingBytes = torrent.totalSize - torrent.downloadedEver
            download.etaSeconds = torrent.eta >= 0 ? torrent.eta : 0

            // Check if completed (seeding)
            if (torrent.isFinished || torrent.percentDone === 1) {
              if (download.status !== 'completed' && download.status !== 'failed') {
                download.status = 'importing'
                download.progress = 100
                download.outputPath = torrent.downloadDir
                if (!download.completedAt) {
                  download.completedAt = DateTime.now()
                }

                // Emit download completed event
                const trMediaType = download.movieId
                  ? 'movies'
                  : download.tvShowId || download.episodeId
                    ? 'tv'
                    : download.bookId
                      ? 'books'
                      : 'music'
                eventEmitter
                  .emitDownloadCompleted({
                    media: {
                      id:
                        download.movieId ||
                        download.episodeId ||
                        download.bookId ||
                        download.albumId ||
                        '',
                      title: download.title,
                      mediaType: trMediaType,
                    },
                    release: {
                      title: download.title,
                      indexer: download.nzbInfo?.indexer || 'unknown',
                      size: download.sizeBytes ? Number(download.sizeBytes) : undefined,
                      protocol: 'torrent',
                    },
                    downloadClient: client.name,
                    downloadId: download.externalId || download.id,
                    outputPath: torrent.downloadDir,
                  })
                  .catch((err) =>
                    logger.error(
                      { err },
                      'DownloadManager: Failed to emit download completed event'
                    )
                  )

                // Trigger import
                this.triggerImport(download).catch((error) => {
                  logger.error(
                    { downloadId: download.id, err: error },
                    'DownloadManager: Failed to import download'
                  )
                })
              }
            }

            if (torrent.error > 0) {
              download.status = 'failed'
              download.errorMessage = torrent.errorString || 'Transmission error'
            }

            await download.save()
          }
        }

        // Remove orphaned downloads
        const orphanedDownloads = await Download.query()
          .where('downloadClientId', client.id)
          .whereNotNull('externalId')
          .whereIn('status', ['queued', 'downloading', 'paused'])

        for (const orphan of orphanedDownloads) {
          if (orphan.externalId && !foundExternalIds.has(orphan.externalId)) {
            logger.info(
              { title: orphan.title },
              'DownloadManager: Removing orphaned Transmission download'
            )
            await orphan.delete()
          }
        }

        break
      }

      case 'deluge': {
        const config: DelugeConfig = {
          host: client.settings.host || 'localhost',
          port: client.settings.port || 8112,
          password: client.settings.password || '',
          useSsl: client.settings.useSsl || false,
        }

        const allDownloads = await Download.query().where('downloadClientId', client.id)
        const downloadsByExternalId = new Map<string, Download>()
        for (const dl of allDownloads) {
          if (dl.externalId) {
            downloadsByExternalId.set(dl.externalId, dl)
          }
        }

        const torrents = await delugeService.getTorrents(config)
        const foundExternalIds = new Set<string>()

        for (const torrent of torrents) {
          foundExternalIds.add(torrent.hash)

          const download = downloadsByExternalId.get(torrent.hash)
          if (download) {
            download.progress = torrent.progress
            download.status = delugeService.mapStateToStatus(torrent.state, torrent.isFinished)
            download.remainingBytes = torrent.totalSize - torrent.totalDone
            download.etaSeconds = torrent.eta >= 0 ? torrent.eta : 0

            if (
              (torrent.isFinished || torrent.state === 'Seeding') &&
              download.status !== 'failed'
            ) {
              if (download.outputPath !== torrent.savePath) {
                download.status = 'importing'
                download.progress = 100
                download.outputPath = torrent.moveCompletedPath || torrent.savePath
                if (!download.completedAt) {
                  download.completedAt = DateTime.now()
                }

                const delMediaType = download.movieId
                  ? 'movies'
                  : download.tvShowId || download.episodeId
                    ? 'tv'
                    : download.bookId
                      ? 'books'
                      : 'music'
                eventEmitter
                  .emitDownloadCompleted({
                    media: {
                      id:
                        download.movieId ||
                        download.episodeId ||
                        download.bookId ||
                        download.albumId ||
                        '',
                      title: download.title,
                      mediaType: delMediaType,
                    },
                    release: {
                      title: download.title,
                      indexer: download.nzbInfo?.indexer || 'unknown',
                      size: download.sizeBytes ? Number(download.sizeBytes) : undefined,
                      protocol: 'torrent',
                    },
                    downloadClient: client.name,
                    downloadId: download.externalId || download.id,
                    outputPath: download.outputPath || '',
                  })
                  .catch((err) =>
                    logger.error(
                      { err },
                      'DownloadManager: Failed to emit download completed event'
                    )
                  )

                this.triggerImport(download).catch((error) => {
                  logger.error(
                    { downloadId: download.id, err: error },
                    'DownloadManager: Failed to import download'
                  )
                })
              }
            }

            await download.save()
          }
        }

        // Remove orphaned downloads
        const orphanedDownloads = await Download.query()
          .where('downloadClientId', client.id)
          .whereNotNull('externalId')
          .whereIn('status', ['queued', 'downloading', 'paused'])

        for (const orphan of orphanedDownloads) {
          if (orphan.externalId && !foundExternalIds.has(orphan.externalId)) {
            logger.info(
              { title: orphan.title },
              'DownloadManager: Removing orphaned Deluge download'
            )
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
    logger.info({ title: download.title }, 'DownloadManager: Starting import')
    logger.debug({ outputPath: download.outputPath }, 'DownloadManager: Original output path')

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
            logger.debug(
              { oldPath, newPath: download.outputPath },
              'DownloadManager: Mapped remote path'
            )
            await download.save()
          }
        }
      }

      let result: { success: boolean; filesImported: number; errors: string[] }

      // Route to appropriate import service based on media type
      if (download.albumId) {
        // Music album
        logger.info({ albumId: download.albumId }, 'DownloadManager: Importing as music album')
        result = await downloadImportService.importDownload(download, (progress) => {
          logger.debug(
            { phase: progress.phase, current: progress.current, total: progress.total },
            'DownloadManager: Music import progress'
          )
        })
      } else if (download.movieId) {
        // Movie
        logger.info({ movieId: download.movieId }, 'DownloadManager: Importing as movie')
        result = await movieImportService.importDownload(download, (progress) => {
          logger.debug(
            { phase: progress.phase, current: progress.current, total: progress.total },
            'DownloadManager: Movie import progress'
          )
        })
      } else if (download.tvShowId || download.episodeId) {
        // TV Episode
        logger.info(
          { tvShowId: download.tvShowId, episodeId: download.episodeId },
          'DownloadManager: Importing as TV episode'
        )
        result = await episodeImportService.importDownload(download, (progress) => {
          logger.debug(
            { phase: progress.phase, current: progress.current, total: progress.total },
            'DownloadManager: Episode import progress'
          )
        })
      } else if (download.bookId) {
        // Book
        logger.info({ bookId: download.bookId }, 'DownloadManager: Importing as book')
        result = await bookImportService.importDownload(download, (progress) => {
          logger.debug(
            { phase: progress.phase, current: progress.current, total: progress.total },
            'DownloadManager: Book import progress'
          )
        })
      } else {
        // Unknown media type
        logger.error({ title: download.title }, 'DownloadManager: Unknown media type')
        download.status = 'failed'
        download.errorMessage = 'Unknown media type - cannot determine import service'
        await download.save()
        return
      }

      if (result.success) {
        logger.info(
          { title: download.title, filesImported: result.filesImported },
          'DownloadManager: Import completed'
        )
        download.status = 'completed'
      } else {
        logger.error(
          { title: download.title, errors: result.errors },
          'DownloadManager: Import failed'
        )
        download.status = 'failed'
        download.errorMessage = result.errors.join('; ') || 'Import failed'

        // Emit import failed event
        const failedMediaType = download.movieId
          ? 'movies'
          : download.tvShowId || download.episodeId
            ? 'tv'
            : download.bookId
              ? 'books'
              : 'music'
        eventEmitter
          .emitImportFailed({
            media: {
              id:
                download.movieId || download.episodeId || download.bookId || download.albumId || '',
              title: download.title,
              mediaType: failedMediaType,
            },
            errorMessage: result.errors.join('; ') || 'Import failed',
            downloadId: download.externalId || download.id,
          })
          .catch((err) =>
            logger.error({ err }, 'DownloadManager: Failed to emit import failed event')
          )
      }

      await download.save()
    } catch (error) {
      logger.error({ title: download.title, err: error }, 'DownloadManager: Import error')
      download.status = 'failed'
      download.errorMessage = error instanceof Error ? error.message : 'Import failed'
      await download.save()

      // Emit import failed event for unexpected errors
      const errorMediaType = download.movieId
        ? 'movies'
        : download.tvShowId || download.episodeId
          ? 'tv'
          : download.bookId
            ? 'books'
            : 'music'
      eventEmitter
        .emitImportFailed({
          media: {
            id: download.movieId || download.episodeId || download.bookId || download.albumId || '',
            title: download.title,
            mediaType: errorMediaType,
          },
          errorMessage: error instanceof Error ? error.message : 'Import failed',
          downloadId: download.externalId || download.id,
        })
        .catch((err) =>
          logger.error({ err }, 'DownloadManager: Failed to emit import failed event')
        )
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
          logger.info(
            { title: failedDownload.title },
            'DownloadManager: Found and grabbed alternative movie'
          )
        } else if (result.error) {
          logger.info(
            { title: failedDownload.title, error: result.error },
            'DownloadManager: No alternative found for movie'
          )
        } else {
          logger.info(
            { title: failedDownload.title },
            'DownloadManager: No alternative releases available for movie'
          )
        }
      } else if (failedDownload.episodeId) {
        const result = await requestedSearchTask.searchSingleEpisode(failedDownload.episodeId)
        if (result.grabbed) {
          logger.info(
            { title: failedDownload.title },
            'DownloadManager: Found and grabbed alternative episode'
          )
        } else if (result.error) {
          logger.info(
            { title: failedDownload.title, error: result.error },
            'DownloadManager: No alternative found for episode'
          )
        } else {
          logger.info(
            { title: failedDownload.title },
            'DownloadManager: No alternative releases available for episode'
          )
        }
      } else if (failedDownload.albumId) {
        const result = await requestedSearchTask.searchSingleAlbum(failedDownload.albumId)
        if (result.grabbed) {
          logger.info(
            { title: failedDownload.title },
            'DownloadManager: Found and grabbed alternative album'
          )
        } else if (result.error) {
          logger.info(
            { title: failedDownload.title, error: result.error },
            'DownloadManager: No alternative found for album'
          )
        } else {
          logger.info(
            { title: failedDownload.title },
            'DownloadManager: No alternative releases available for album'
          )
        }
      } else if (failedDownload.bookId) {
        const result = await requestedSearchTask.searchSingleBook(failedDownload.bookId)
        if (result.grabbed) {
          logger.info(
            { title: failedDownload.title },
            'DownloadManager: Found and grabbed alternative book'
          )
        } else if (result.error) {
          logger.info(
            { title: failedDownload.title, error: result.error },
            'DownloadManager: No alternative found for book'
          )
        } else {
          logger.info(
            { title: failedDownload.title },
            'DownloadManager: No alternative releases available for book'
          )
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'DownloadManager: Error searching for alternative')
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
      return (
        Number.parseInt(parts[0]) * 3600 +
        Number.parseInt(parts[1]) * 60 +
        Number.parseInt(parts[2])
      )
    }
    return 0
  }

  /**
   * Cancel a download
   */
  async cancel(downloadId: string, deleteFiles = false): Promise<void> {
    const download = await Download.query()
      .where('id', downloadId)
      .preload('downloadClient')
      .first()

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

        case 'nzbget': {
          const config: NzbgetConfig = {
            host: client.settings.host || 'localhost',
            port: client.settings.port || 6789,
            username: client.settings.username,
            password: client.settings.password,
            useSsl: client.settings.useSsl || false,
          }

          const nzbId = Number.parseInt(download.externalId, 10)
          // Try to delete from queue first, then from history
          try {
            await nzbgetService.deleteFromQueue(config, nzbId)
          } catch {
            await nzbgetService.deleteFromHistory(config, nzbId, deleteFiles)
          }
          break
        }

        case 'qbittorrent': {
          const config: QBittorrentConfig = {
            host: client.settings.host || 'localhost',
            port: client.settings.port || 8080,
            username: client.settings.username,
            password: client.settings.password,
            useSsl: client.settings.useSsl || false,
          }

          await qbittorrentService.delete(config, download.externalId, deleteFiles)
          break
        }

        case 'transmission': {
          const config: TransmissionConfig = {
            host: client.settings.host || 'localhost',
            port: client.settings.port || 9091,
            username: client.settings.username,
            password: client.settings.password,
            useSsl: client.settings.useSsl || false,
            urlBase: client.settings.urlBase,
          }

          // Find the torrent by hash to get its numeric ID
          const torrents = await transmissionService.getTorrents(config)
          const torrent = torrents.find((t) => t.hashString === download.externalId)
          if (torrent) {
            await transmissionService.remove(config, torrent.id, deleteFiles)
          }
          break
        }

        case 'deluge': {
          const config: DelugeConfig = {
            host: client.settings.host || 'localhost',
            port: client.settings.port || 8112,
            password: client.settings.password || '',
            useSsl: client.settings.useSsl || false,
          }

          await delugeService.remove(config, download.externalId, deleteFiles)
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
    settings: {
      host?: string
      port?: number
      apiKey?: string
      username?: string
      password?: string
      useSsl?: boolean
      urlBase?: string
    }
  ): Promise<{
    success: boolean
    version?: string
    error?: string
    remotePath?: string
    pathAccessible?: boolean
  }> {
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

      case 'nzbget': {
        const config: NzbgetConfig = {
          host: settings.host || 'localhost',
          port: settings.port || 6789,
          username: settings.username,
          password: settings.password,
          useSsl: settings.useSsl || false,
        }

        const result = await nzbgetService.testConnection(config)

        if (result.success) {
          // Get the destination directory for path mapping
          try {
            const destDir = await nzbgetService.getConfigValue(config, 'DestDir')
            if (destDir) {
              const fs = await import('node:fs/promises')
              let pathAccessible = false
              try {
                await fs.access(destDir)
                pathAccessible = true
              } catch {
                pathAccessible = false
              }

              return {
                ...result,
                remotePath: destDir,
                pathAccessible,
              }
            }
          } catch {
            // Ignore config fetch errors
          }
        }

        return result
      }

      case 'qbittorrent': {
        const config: QBittorrentConfig = {
          host: settings.host || 'localhost',
          port: settings.port || 8080,
          username: settings.username,
          password: settings.password,
          useSsl: settings.useSsl || false,
        }

        return qbittorrentService.testConnection(config)
      }

      case 'transmission': {
        const config: TransmissionConfig = {
          host: settings.host || 'localhost',
          port: settings.port || 9091,
          username: settings.username,
          password: settings.password,
          useSsl: settings.useSsl || false,
          urlBase: settings.urlBase,
        }

        return transmissionService.testConnection(config)
      }

      case 'deluge': {
        const config: DelugeConfig = {
          host: settings.host || 'localhost',
          port: settings.port || 8112,
          password: settings.password || '',
          useSsl: settings.useSsl || false,
        }

        return delugeService.testConnection(config)
      }

      default:
        return { success: false, error: `Unsupported client type: ${type}` }
    }
  }
}

export const downloadManager = new DownloadManager()
