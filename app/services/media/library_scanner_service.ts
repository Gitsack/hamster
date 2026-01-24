import { DateTime } from 'luxon'
import RootFolder, { type ScanStatus } from '#models/root_folder'
import { fileScannerService } from './file_scanner_service.js'
import { movieScannerService } from './movie_scanner_service.js'
import { tvShowScannerService } from './tv_show_scanner_service.js'
import { bookScannerService } from './book_scanner_service.js'

export interface ScanProgress {
  rootFolderId: string
  mediaType: string
  phase: 'discovering' | 'parsing' | 'metadata' | 'importing' | 'complete' | 'failed'
  totalFiles: number
  processedFiles: number
  currentItem?: string
  newEntities: number
  updatedEntities: number
  unmatchedFiles: number
  errors: string[]
}

export interface ScanResult {
  rootFolderId: string
  mediaType: string
  success: boolean
  filesFound: number
  entitiesCreated: number
  entitiesUpdated: number
  unmatchedFiles: number
  errors: string[]
  duration: number
}

type ProgressCallback = (progress: ScanProgress) => void

// Track active scans to prevent concurrent scans on same folder
const activeScans = new Map<string, boolean>()

/**
 * Central service for orchestrating library scans across all media types.
 * Delegates to specialized scanners based on root folder media type.
 */
export class LibraryScannerService {
  /**
   * Scan a single root folder
   */
  async scanRootFolder(rootFolderId: string, onProgress?: ProgressCallback): Promise<ScanResult> {
    const rootFolder = await RootFolder.find(rootFolderId)
    if (!rootFolder) {
      return {
        rootFolderId,
        mediaType: 'unknown',
        success: false,
        filesFound: 0,
        entitiesCreated: 0,
        entitiesUpdated: 0,
        unmatchedFiles: 0,
        errors: ['Root folder not found'],
        duration: 0,
      }
    }

    // Check if scan is already in progress
    if (activeScans.get(rootFolderId)) {
      return {
        rootFolderId,
        mediaType: rootFolder.mediaType,
        success: false,
        filesFound: 0,
        entitiesCreated: 0,
        entitiesUpdated: 0,
        unmatchedFiles: 0,
        errors: ['Scan already in progress for this folder'],
        duration: 0,
      }
    }

    const startTime = Date.now()
    activeScans.set(rootFolderId, true)

    try {
      // Update status to scanning
      await this.updateScanStatus(rootFolder, 'scanning')

      // Route to appropriate scanner
      const result = await this.routeToScanner(rootFolder, onProgress)

      // Update status to completed
      await this.updateScanStatus(rootFolder, result.success ? 'completed' : 'failed')

      return {
        ...result,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      await this.updateScanStatus(rootFolder, 'failed')

      return {
        rootFolderId,
        mediaType: rootFolder.mediaType,
        success: false,
        filesFound: 0,
        entitiesCreated: 0,
        entitiesUpdated: 0,
        unmatchedFiles: 0,
        errors: [error instanceof Error ? error.message : 'Scan failed'],
        duration: Date.now() - startTime,
      }
    } finally {
      activeScans.delete(rootFolderId)
    }
  }

  /**
   * Scan all root folders
   */
  async scanAllRootFolders(onProgress?: ProgressCallback): Promise<ScanResult[]> {
    const rootFolders = await RootFolder.query().where('accessible', true).exec()
    const results: ScanResult[] = []

    for (const rootFolder of rootFolders) {
      const result = await this.scanRootFolder(rootFolder.id, onProgress)
      results.push(result)
    }

    return results
  }

  /**
   * Get scan status for a root folder
   */
  async getScanStatus(rootFolderId: string): Promise<{
    status: ScanStatus
    lastScannedAt: DateTime | null
    isScanning: boolean
  } | null> {
    const rootFolder = await RootFolder.find(rootFolderId)
    if (!rootFolder) return null

    return {
      status: rootFolder.scanStatus,
      lastScannedAt: rootFolder.lastScannedAt,
      isScanning: activeScans.get(rootFolderId) || false,
    }
  }

  /**
   * Check if any scan is in progress
   */
  isAnyScanInProgress(): boolean {
    return activeScans.size > 0
  }

  /**
   * Route to appropriate scanner based on media type
   */
  private async routeToScanner(
    rootFolder: RootFolder,
    onProgress?: ProgressCallback
  ): Promise<Omit<ScanResult, 'duration'>> {
    const progress: ScanProgress = {
      rootFolderId: rootFolder.id,
      mediaType: rootFolder.mediaType,
      phase: 'discovering',
      totalFiles: 0,
      processedFiles: 0,
      newEntities: 0,
      updatedEntities: 0,
      unmatchedFiles: 0,
      errors: [],
    }

    const wrapProgress = (scannerProgress: any) => {
      progress.phase = scannerProgress.phase
      progress.totalFiles = scannerProgress.total
      progress.processedFiles = scannerProgress.current
      progress.currentItem = scannerProgress.currentItem || scannerProgress.currentFile
      onProgress?.(progress)
    }

    switch (rootFolder.mediaType) {
      case 'music': {
        const result = await fileScannerService.scanRootFolder(
          rootFolder.id as unknown as number,
          wrapProgress
        )
        progress.newEntities = result.filesImported
        progress.updatedEntities = result.filesUpdated
        progress.errors = result.errors
        return {
          rootFolderId: rootFolder.id,
          mediaType: 'music',
          success: result.errors.length === 0,
          filesFound: result.filesFound,
          entitiesCreated: result.filesImported,
          entitiesUpdated: result.filesUpdated,
          unmatchedFiles: result.filesSkipped,
          errors: result.errors,
        }
      }

      case 'movies': {
        const result = await movieScannerService.scanRootFolder(rootFolder.id, wrapProgress)
        progress.newEntities = result.moviesCreated
        progress.updatedEntities = result.moviesUpdated
        progress.unmatchedFiles = result.unmatchedFiles
        progress.errors = result.errors
        return {
          rootFolderId: rootFolder.id,
          mediaType: 'movies',
          success: result.errors.length === 0,
          filesFound: result.filesFound,
          entitiesCreated: result.moviesCreated,
          entitiesUpdated: result.moviesUpdated,
          unmatchedFiles: result.unmatchedFiles,
          errors: result.errors,
        }
      }

      case 'tv': {
        const result = await tvShowScannerService.scanRootFolder(rootFolder.id, wrapProgress)
        progress.newEntities = result.showsCreated + result.episodesCreated
        progress.updatedEntities = result.episodesUpdated
        progress.unmatchedFiles = result.unmatchedFiles
        progress.errors = result.errors
        return {
          rootFolderId: rootFolder.id,
          mediaType: 'tv',
          success: result.errors.length === 0,
          filesFound: result.filesFound,
          entitiesCreated: result.showsCreated + result.episodesCreated,
          entitiesUpdated: result.episodesUpdated,
          unmatchedFiles: result.unmatchedFiles,
          errors: result.errors,
        }
      }

      case 'books': {
        const result = await bookScannerService.scanRootFolder(rootFolder.id, wrapProgress)
        progress.newEntities = result.authorsCreated + result.booksCreated
        progress.updatedEntities = result.booksUpdated
        progress.unmatchedFiles = result.unmatchedFiles
        progress.errors = result.errors
        return {
          rootFolderId: rootFolder.id,
          mediaType: 'books',
          success: result.errors.length === 0,
          filesFound: result.filesFound,
          entitiesCreated: result.authorsCreated + result.booksCreated,
          entitiesUpdated: result.booksUpdated,
          unmatchedFiles: result.unmatchedFiles,
          errors: result.errors,
        }
      }

      default:
        return {
          rootFolderId: rootFolder.id,
          mediaType: rootFolder.mediaType,
          success: false,
          filesFound: 0,
          entitiesCreated: 0,
          entitiesUpdated: 0,
          unmatchedFiles: 0,
          errors: [`Unsupported media type: ${rootFolder.mediaType}`],
        }
    }
  }

  /**
   * Update root folder scan status
   */
  private async updateScanStatus(rootFolder: RootFolder, status: ScanStatus): Promise<void> {
    rootFolder.scanStatus = status
    if (status === 'completed' || status === 'failed') {
      rootFolder.lastScannedAt = DateTime.now()
    }
    await rootFolder.save()
  }
}

export const libraryScannerService = new LibraryScannerService()
