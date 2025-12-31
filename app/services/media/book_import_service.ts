import fs from 'node:fs/promises'
import path from 'node:path'
import { fileNamingService } from './file_naming_service.js'
import Download from '#models/download'
import Book from '#models/book'
import Author from '#models/author'
import BookFile from '#models/book_file'
import RootFolder from '#models/root_folder'
import { DateTime } from 'luxon'

export interface BookImportProgress {
  phase: 'scanning' | 'importing' | 'cleaning' | 'complete'
  total: number
  current: number
  currentFile?: string
}

export interface BookImportResult {
  success: boolean
  downloadId: string
  bookId: string | null
  filesImported: number
  filesSkipped: number
  errors: string[]
  importedPath?: string
}

/**
 * Service for importing completed book downloads into the library.
 */
export class BookImportService {
  /**
   * Import a completed book download
   */
  async importDownload(
    download: Download,
    onProgress?: (progress: BookImportProgress) => void
  ): Promise<BookImportResult> {
    const result: BookImportResult = {
      success: false,
      downloadId: download.id,
      bookId: download.bookId,
      filesImported: 0,
      filesSkipped: 0,
      errors: [],
    }

    console.log(`[BookImportService] Starting import for download: ${download.title}`)

    try {
      // Verify download has output path
      if (!download.outputPath) {
        console.log(`[BookImportService] No output path for download`)
        result.errors.push('Download has no output path')
        return result
      }

      // Apply remote path mapping if configured
      let outputPath = download.outputPath
      console.log(`[BookImportService] Original output path: ${outputPath}`)

      if (download.downloadClientId) {
        const DownloadClient = (await import('#models/download_client')).default
        const client = await DownloadClient.find(download.downloadClientId)
        if (client?.settings?.remotePath && client?.settings?.localPath) {
          const oldPath = outputPath
          outputPath = outputPath.replace(client.settings.remotePath, client.settings.localPath)
          console.log(`[BookImportService] Mapped path: ${oldPath} -> ${outputPath}`)
        }
      }

      // Check if path exists (with timeout to prevent blocking on unmounted network storage)
      try {
        await Promise.race([
          fs.access(outputPath),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Path check timeout')), 3000)
          ),
        ])
        console.log(`[BookImportService] Path accessible: ${outputPath}`)
      } catch (error) {
        const isTimeout = error instanceof Error && error.message === 'Path check timeout'
        if (isTimeout) {
          console.log(`[BookImportService] Path timeout: ${outputPath}`)
          result.errors.push(`Path not responding: ${outputPath}. Network storage may not be mounted or is unresponsive.`)
        } else {
          console.log(`[BookImportService] Path NOT accessible: ${outputPath}`, error)
          result.errors.push(`Path not accessible: ${outputPath}. If SABnzbd runs in Docker, configure Remote Path Mapping in Download Client settings.`)
        }
        return result
      }

      // Get the book this download is for
      const book = download.bookId ? await Book.find(download.bookId) : null
      if (!book) {
        console.log(`[BookImportService] Book not found for bookId: ${download.bookId}`)
        result.errors.push('Book not found for download')
        return result
      }
      console.log(`[BookImportService] Found book: ${book.title}`)

      // Get author for the book
      const author = await Author.find(book.authorId)
      if (!author) {
        console.log(`[BookImportService] Author not found for authorId: ${book.authorId}`)
        result.errors.push('Author not found')
        return result
      }
      console.log(`[BookImportService] Found author: ${author.name}`)

      const rootFolder = await RootFolder.find(author.rootFolderId)
      if (!rootFolder) {
        console.log(`[BookImportService] Root folder not found for rootFolderId: ${author.rootFolderId}`)
        result.errors.push('Root folder not found for author')
        return result
      }
      console.log(`[BookImportService] Root folder: ${rootFolder.path}`)

      // Scan for book files in download folder
      onProgress?.({ phase: 'scanning', total: 0, current: 0 })
      console.log(`[BookImportService] Scanning for book files in: ${outputPath}`)
      const bookFiles = await this.findBookFiles(outputPath)
      console.log(`[BookImportService] Found ${bookFiles.length} book files: ${bookFiles.join(', ')}`)

      if (bookFiles.length === 0) {
        // List all files in the directory to help debug
        try {
          const allFiles = await this.listAllFiles(outputPath)
          console.log(`[BookImportService] All files in download folder: ${allFiles.join(', ')}`)
        } catch {
          console.log(`[BookImportService] Could not list files in: ${outputPath}`)
        }
        result.errors.push('No book files found in download')
        return result
      }

      onProgress?.({ phase: 'importing', total: 1, current: 0 })

      // Find the preferred book file (EPUB > MOBI > PDF > others)
      const preferredFile = this.findPreferredBookFile(bookFiles)

      if (!preferredFile) {
        result.errors.push('No suitable book file found')
        return result
      }

      onProgress?.({
        phase: 'importing',
        total: 1,
        current: 1,
        currentFile: path.basename(preferredFile),
      })

      try {
        console.log(`[BookImportService] Importing file: ${preferredFile}`)
        const importResult = await this.importBookFile(
          preferredFile,
          book,
          author,
          rootFolder
        )

        if (importResult.success) {
          console.log(`[BookImportService] Successfully imported to: ${importResult.destinationPath}`)
          result.filesImported++
          result.importedPath = importResult.destinationPath
        } else {
          console.log(`[BookImportService] Import failed: ${importResult.error}`)
          result.filesSkipped++
          if (importResult.error) {
            result.errors.push(importResult.error)
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.log(`[BookImportService] Import exception: ${errorMsg}`)
        result.filesSkipped++
        result.errors.push(errorMsg)
      }

      // Only clean up download folder if files were actually imported
      if (result.filesImported > 0) {
        result.success = true
        onProgress?.({ phase: 'cleaning', total: 1, current: 0 })
        await this.cleanupDownloadFolder(outputPath)
        console.log(`[BookImportService] Import complete - success`)
      } else {
        console.log(`[BookImportService] Import complete - no files imported`)
      }

      onProgress?.({ phase: 'complete', total: 1, current: 1 })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Import failed'
      console.log(`[BookImportService] Import exception: ${errorMsg}`)
      result.errors.push(errorMsg)
    }

    console.log(`[BookImportService] Final result: success=${result.success}, imported=${result.filesImported}, errors=${result.errors.join('; ')}`)
    return result
  }

  /**
   * List all files in a directory recursively (for debugging)
   */
  private async listAllFiles(dir: string): Promise<string[]> {
    const results: string[] = []

    try {
      const stats = await fs.stat(dir)

      if (stats.isFile()) {
        return [dir]
      }

      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          const subFiles = await this.listAllFiles(fullPath)
          results.push(...subFiles)
        } else if (entry.isFile()) {
          results.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`Error listing files in ${dir}:`, error)
    }

    return results
  }

  /**
   * Import a single book file into the library
   */
  private async importBookFile(
    sourcePath: string,
    book: Book,
    author: Author,
    rootFolder: RootFolder
  ): Promise<{ success: boolean; error?: string; destinationPath?: string }> {
    // Get format from extension
    const extension = path.extname(sourcePath)
    const format = fileNamingService.getBookFormat(sourcePath)

    // Generate destination path
    const relativePath = await fileNamingService.getBookPath(
      { book, author, format },
      extension
    )
    const absolutePath = path.join(rootFolder.path, relativePath)

    // Create directories
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })

    // Move file to destination
    try {
      await fs.rename(sourcePath, absolutePath)
    } catch (error) {
      // If rename fails (cross-device), try copy + delete
      await fs.copyFile(sourcePath, absolutePath)
      await fs.unlink(sourcePath)
    }

    // Get file stats
    const stats = await fs.stat(absolutePath)

    // Create or update book file record
    let bookFile = await BookFile.query().where('bookId', book.id).first()

    if (bookFile) {
      bookFile.merge({
        relativePath,
        sizeBytes: stats.size,
        format,
        dateAdded: DateTime.now(),
      })
      await bookFile.save()
    } else {
      bookFile = await BookFile.create({
        bookId: book.id,
        relativePath,
        sizeBytes: stats.size,
        format,
        dateAdded: DateTime.now(),
      })
    }

    // Update book to indicate it has a file
    book.hasFile = true
    await book.save()

    return { success: true, destinationPath: absolutePath }
  }

  /**
   * Find all book files in a directory recursively
   */
  private async findBookFiles(dir: string): Promise<string[]> {
    const results: string[] = []

    try {
      const stats = await fs.stat(dir)

      if (stats.isFile()) {
        if (fileNamingService.isBookFile(dir)) {
          return [dir]
        }
        return []
      }

      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          const subFiles = await this.findBookFiles(fullPath)
          results.push(...subFiles)
        } else if (entry.isFile() && fileNamingService.isBookFile(entry.name)) {
          results.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error)
    }

    return results
  }

  /**
   * Find the preferred book file based on format priority
   * Priority: EPUB > MOBI > AZW3 > PDF > others
   */
  private findPreferredBookFile(files: string[]): string | null {
    if (files.length === 0) return null

    const priority: Record<string, number> = {
      '.epub': 1,
      '.mobi': 2,
      '.azw3': 3,
      '.azw': 4,
      '.pdf': 5,
      '.fb2': 6,
      '.djvu': 7,
      '.cbz': 8,
      '.cbr': 9,
    }

    const sorted = [...files].sort((a, b) => {
      const extA = path.extname(a).toLowerCase()
      const extB = path.extname(b).toLowerCase()
      const prioA = priority[extA] || 100
      const prioB = priority[extB] || 100
      return prioA - prioB
    })

    return sorted[0]
  }

  /**
   * Clean up download folder after import
   */
  private async cleanupDownloadFolder(downloadPath: string): Promise<void> {
    try {
      const stats = await fs.stat(downloadPath)

      if (stats.isFile()) {
        return
      }

      const deletePatterns = [
        /\.nfo$/i,
        /\.sfv$/i,
        /\.txt$/i,
        /\.url$/i,
        /\.nzb$/i,
        /thumbs\.db$/i,
        /\.ds_store$/i,
      ]

      await this.cleanDirectory(downloadPath, deletePatterns)
      await this.removeEmptyDirectories(downloadPath)

      try {
        const remaining = await fs.readdir(downloadPath)
        if (remaining.length === 0) {
          await fs.rmdir(downloadPath)
        }
      } catch {
        // Folder not empty, that's fine
      }
    } catch (error) {
      console.error('Error cleaning up download folder:', error)
    }
  }

  private async cleanDirectory(dir: string, deletePatterns: RegExp[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          await this.cleanDirectory(fullPath, deletePatterns)
        } else if (entry.isFile()) {
          const shouldDelete = deletePatterns.some((pattern) => pattern.test(entry.name))
          if (shouldDelete) {
            try {
              await fs.unlink(fullPath)
            } catch {
              // Ignore errors
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  private async removeEmptyDirectories(dir: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(dir, entry.name)
          await this.removeEmptyDirectories(subPath)
        }
      }

      const remainingEntries = await fs.readdir(dir)
      if (remainingEntries.length === 0) {
        await fs.rmdir(dir)
        return true
      }
    } catch {
      // Ignore errors
    }

    return false
  }
}

export const bookImportService = new BookImportService()
