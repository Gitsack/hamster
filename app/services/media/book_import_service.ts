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

    try {
      // Verify download has output path
      if (!download.outputPath) {
        result.errors.push('Download has no output path')
        return result
      }

      // Apply remote path mapping if configured
      let outputPath = download.outputPath
      if (download.downloadClientId) {
        const DownloadClient = (await import('#models/download_client')).default
        const client = await DownloadClient.find(download.downloadClientId)
        if (client?.settings?.remotePath && client?.settings?.localPath) {
          outputPath = outputPath.replace(client.settings.remotePath, client.settings.localPath)
        }
      }

      // Check if path exists
      try {
        await fs.access(outputPath)
      } catch {
        result.errors.push(`Path not accessible: ${outputPath}. If SABnzbd runs in Docker, configure Remote Path Mapping in Download Client settings.`)
        return result
      }

      // Get the book this download is for
      const book = download.bookId ? await Book.find(download.bookId) : null
      if (!book) {
        result.errors.push('Book not found for download')
        return result
      }

      // Get author for the book
      const author = await Author.find(book.authorId)
      if (!author) {
        result.errors.push('Author not found')
        return result
      }

      const rootFolder = await RootFolder.find(author.rootFolderId)
      if (!rootFolder) {
        result.errors.push('Root folder not found')
        return result
      }

      // Scan for book files in download folder
      onProgress?.({ phase: 'scanning', total: 0, current: 0 })
      const bookFiles = await this.findBookFiles(outputPath)

      if (bookFiles.length === 0) {
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
        const importResult = await this.importBookFile(
          preferredFile,
          book,
          author,
          rootFolder
        )

        if (importResult.success) {
          result.filesImported++
          result.importedPath = importResult.destinationPath
        } else {
          result.filesSkipped++
          if (importResult.error) {
            result.errors.push(importResult.error)
          }
        }
      } catch (error) {
        result.filesSkipped++
        result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      }

      // Only clean up download folder if files were actually imported
      if (result.filesImported > 0) {
        result.success = true
        onProgress?.({ phase: 'cleaning', total: 1, current: 0 })
        await this.cleanupDownloadFolder(outputPath)
      }

      onProgress?.({ phase: 'complete', total: 1, current: 1 })
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Import failed')
    }

    return result
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
