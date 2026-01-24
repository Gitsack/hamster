import type { HttpContext } from '@adonisjs/core/http'
import Book from '#models/book'
import BookFile from '#models/book_file'
import Author from '#models/author'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { openLibraryService } from '#services/metadata/openlibrary_service'
import { requestedSearchTask } from '#services/tasks/requested_search_task'
import { libraryCleanupService } from '#services/library/library_cleanup_service'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const bookValidator = vine.compile(
  vine.object({
    openlibraryId: vine.string().optional(),
    authorId: vine.string().optional(),
    authorKey: vine.string().optional(), // OpenLibrary author key
    authorName: vine.string().optional(),
    title: vine.string().minLength(1),
    rootFolderId: vine.string(),
    qualityProfileId: vine.string().optional(),
    requested: vine.boolean().optional(),
  })
)

export default class BooksController {
  async index({ request, response }: HttpContext) {
    const authorId = request.input('authorId')

    let query = Book.query().preload('author').preload('bookFile').orderBy('sortTitle', 'asc')

    if (authorId) {
      query = query.where('authorId', authorId)
    }

    const books = await query

    return response.json(
      books.map((book) => ({
        id: book.id,
        title: book.title,
        authorId: book.authorId,
        authorName: book.author?.name,
        releaseDate: book.releaseDate?.toISODate(),
        coverUrl: book.coverUrl,
        requested: book.requested,
        hasFile: book.hasFile,
        seriesName: book.seriesName,
        seriesPosition: book.seriesPosition,
      }))
    )
  }

  async search({ request, response }: HttpContext) {
    const query = request.input('q', '')

    if (!query) {
      return response.badRequest({ error: 'Search query is required' })
    }

    try {
      const results = await openLibraryService.searchBooks(query)

      // Check which books are already in library
      const keys = results.map((r) => r.key)
      const existing = await Book.query().whereIn('openlibraryId', keys)
      const existingKeys = new Set(existing.map((b) => b.openlibraryId))

      return response.json(
        results.map((book) => ({
          openlibraryId: book.key,
          title: book.title,
          authorName: book.authorName[0] || 'Unknown',
          authorKey: book.authorKey[0],
          year: book.firstPublishYear,
          coverUrl: openLibraryService.getCoverUrl(book.coverId, 'M'),
          inLibrary: existingKeys.has(book.key),
        }))
      )
    } catch (error) {
      console.error('OpenLibrary search error:', error)
      return response.badRequest({ error: 'Failed to search books' })
    }
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(bookValidator)

    // Check if already exists
    if (data.openlibraryId) {
      const existing = await Book.query().where('openlibraryId', data.openlibraryId).first()
      if (existing) {
        return response.conflict({ error: 'Book already in library' })
      }
    }

    // Find or create author
    let author: Author | null = null

    if (data.authorId) {
      author = await Author.find(data.authorId)
      if (!author) {
        return response.badRequest({ error: 'Author not found' })
      }
    } else if (data.authorKey) {
      // Try to find existing author by OpenLibrary key
      const cleanKey = data.authorKey.startsWith('/authors/')
        ? data.authorKey
        : `/authors/${data.authorKey}`
      author = await Author.query().where('openlibraryId', cleanKey).first()

      if (!author) {
        // Create the author from OpenLibrary
        try {
          const olAuthor = await openLibraryService.getAuthor(cleanKey)
          if (olAuthor) {
            author = await Author.create({
              openlibraryId: olAuthor.key,
              name: olAuthor.name,
              sortName: olAuthor.name.split(' ').reverse().join(', '),
              overview: olAuthor.bio,
              imageUrl: openLibraryService.getAuthorPhotoUrl(olAuthor.photoId, 'L'),
              rootFolderId: data.rootFolderId,
              qualityProfileId: data.qualityProfileId,
              requested: data.requested ?? true,
              addedAt: DateTime.now(),
            })
          }
        } catch (error) {
          console.error('Failed to fetch author from OpenLibrary:', error)
        }

        // Fallback: create author with just the name if OpenLibrary fetch failed
        if (!author && data.authorName) {
          author = await Author.create({
            openlibraryId: cleanKey,
            name: data.authorName,
            sortName: data.authorName.split(' ').reverse().join(', '),
            rootFolderId: data.rootFolderId,
            qualityProfileId: data.qualityProfileId,
            requested: data.requested ?? true,
            addedAt: DateTime.now(),
          })
        }
      }
    }

    if (!author) {
      return response.badRequest({ error: 'Author ID or author key is required' })
    }

    let bookData: any = {
      authorId: author.id,
      title: data.title,
      sortTitle: data.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
      requested: data.requested ?? true,
      hasFile: false,
    }

    if (data.openlibraryId) {
      try {
        const olData = await openLibraryService.getBook(data.openlibraryId)
        if (olData) {
          bookData = {
            ...bookData,
            openlibraryId: olData.key,
            title: olData.title,
            sortTitle: olData.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
            overview: olData.description,
            coverUrl: openLibraryService.getCoverUrl(olData.coverId, 'L'),
            genres: olData.subjects || [],
          }

          // Try to get edition details (ISBN, page count, etc.)
          const editions = await openLibraryService.getBookEditions(data.openlibraryId, 1)
          if (editions.length > 0) {
            const edition = editions[0]
            bookData.isbn = edition.isbn10
            bookData.isbn13 = edition.isbn13
            bookData.pageCount = edition.numberOfPages
            bookData.publisher = edition.publishers?.[0]
            if (edition.publishDate) {
              const year = parseInt(edition.publishDate.match(/\d{4}/)?.[0] || '0')
              if (year > 0) {
                bookData.releaseDate = DateTime.fromObject({ year })
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch OpenLibrary data:', error)
      }
    }

    const book = await Book.create(bookData)

    // Trigger immediate search if requested
    if (data.requested ?? true) {
      requestedSearchTask.searchSingleBook(book.id).catch((error) => {
        console.error('Failed to trigger search for book:', error)
      })
    }

    return response.created({
      id: book.id,
      title: book.title,
    })
  }

  async show({ params, response }: HttpContext) {
    const book = await Book.query()
      .where('id', params.id)
      .preload('author')
      .preload('bookFile')
      .first()

    if (!book) {
      return response.notFound({ error: 'Book not found' })
    }

    return response.json({
      id: book.id,
      openlibraryId: book.openlibraryId,
      isbn: book.isbn,
      isbn13: book.isbn13,
      title: book.title,
      overview: book.overview,
      releaseDate: book.releaseDate?.toISODate(),
      pageCount: book.pageCount,
      publisher: book.publisher,
      coverUrl: book.coverUrl,
      rating: book.rating,
      genres: book.genres,
      seriesName: book.seriesName,
      seriesPosition: book.seriesPosition,
      requested: book.requested,
      hasFile: book.hasFile,
      author: book.author,
      bookFile: book.bookFile
        ? {
            id: book.bookFile.id,
            path: book.bookFile.relativePath,
            size: book.bookFile.sizeBytes,
            format: book.bookFile.format,
            downloadUrl: `/api/v1/files/books/${book.bookFile.id}/download`,
          }
        : null,
    })
  }

  async update({ params, request, response }: HttpContext) {
    const book = await Book.find(params.id)
    if (!book) {
      return response.notFound({ error: 'Book not found' })
    }

    const { requested } = request.only(['requested'])

    if (requested !== undefined) book.requested = requested

    await book.save()

    return response.json({ id: book.id, title: book.title, requested: book.requested })
  }

  async destroy({ params, request, response }: HttpContext) {
    const book = await Book.query()
      .where('id', params.id)
      .preload('author', (query) => query.preload('rootFolder'))
      .preload('bookFile')
      .first()

    if (!book) {
      return response.notFound({ error: 'Book not found' })
    }

    const deleteFile = request.input('deleteFile') === 'true'
    let fileDeleted = false
    const authorId = book.authorId

    // If book has a file and deleteFile is requested, delete the file first
    if (deleteFile && book.bookFile && book.author?.rootFolder) {
      const absolutePath = path.join(book.author.rootFolder.path, book.bookFile.relativePath)
      const folderPath = path.dirname(absolutePath)

      try {
        await fs.unlink(absolutePath)
        console.log(`[BooksController] Deleted book file: ${absolutePath}`)
        fileDeleted = true

        // Try to remove the folder if empty
        try {
          const remainingFiles = await fs.readdir(folderPath)
          if (remainingFiles.length === 0) {
            await fs.rmdir(folderPath)
            console.log(`[BooksController] Removed empty folder: ${folderPath}`)
          }
        } catch {
          // Folder might not be empty or other error, ignore
        }
      } catch (error) {
        console.error(`[BooksController] Failed to delete file: ${absolutePath}`, error)
        // Continue with record deletion even if file deletion fails
      }

      // Delete the BookFile record
      await BookFile.query().where('id', book.bookFile.id).delete()
    }

    await book.delete()

    // Check if author should be removed
    await libraryCleanupService.removeAuthorIfEmpty(authorId)

    return response.json({ id: book.id, deleted: true, fileDeleted })
  }

  async setWanted({ params, request, response }: HttpContext) {
    const book = await Book.find(params.id)
    if (!book) {
      return response.notFound({ error: 'Book not found' })
    }

    const { requested } = request.only(['requested'])
    const newStatus = requested ?? true

    // If unrequesting (setting to false)
    if (!newStatus) {
      // If book has a file, return error - frontend should show confirmation dialog
      if (book.hasFile) {
        return response.badRequest({
          error: 'Book has downloaded files',
          hasFile: true,
          message: 'Use DELETE endpoint with deleteFile=true to remove files and record',
        })
      }

      // Book has no file - delete it from library
      const authorId = book.authorId
      console.log(`[BooksController] Unrequesting book without file, deleting: ${book.title}`)
      await book.delete()

      // Check if author should be removed
      await libraryCleanupService.removeAuthorIfEmpty(authorId)

      return response.json({
        id: book.id,
        deleted: true,
        message: 'Removed from library',
      })
    }

    // Requesting (setting to true)
    book.requested = true
    await book.save()

    // Trigger immediate search if marking as requested
    if (!book.hasFile) {
      requestedSearchTask.searchSingleBook(book.id).catch((error) => {
        console.error('Failed to trigger search for book:', error)
      })
    }

    return response.json({ id: book.id, requested: book.requested })
  }

  /**
   * Get requested (missing) books
   */
  async requested({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 50)

    const books = await Book.query()
      .where('requested', true)
      .where('hasFile', false)
      .preload('author')
      .orderBy('createdAt', 'desc')
      .paginate(page, limit)

    return response.json({
      data: books.all().map((book) => ({
        id: book.id,
        title: book.title,
        authorId: book.authorId,
        authorName: book.author?.name,
        openlibraryId: book.openlibraryId,
        releaseDate: book.releaseDate?.toISODate(),
        coverUrl: book.coverUrl,
        seriesName: book.seriesName,
        seriesPosition: book.seriesPosition,
      })),
      meta: {
        total: books.total,
        perPage: books.perPage,
        currentPage: books.currentPage,
        lastPage: books.lastPage,
      },
    })
  }

  async download({ params, response }: HttpContext) {
    const book = await Book.query().where('id', params.id).preload('author').first()

    if (!book) {
      return response.notFound({ error: 'Book not found' })
    }

    // Check if there's already an active download for this book
    const { default: Download } = await import('#models/download')
    const existingDownload = await Download.query()
      .where('bookId', book.id)
      .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
      .first()

    if (existingDownload) {
      return response.conflict({
        error: 'Book already has an active download',
        downloadId: existingDownload.id,
        status: existingDownload.status,
      })
    }

    try {
      const { indexerManager } = await import('#services/indexers/indexer_manager')
      const { downloadManager } = await import('#services/download_clients/download_manager')

      const results = await indexerManager.searchBooks({
        title: book.title,
        author: book.author?.name,
        limit: 25,
      })

      if (results.length === 0) {
        return response.notFound({ error: 'No releases found for this book' })
      }

      // Best result is already sorted by size
      const bestResult = results[0]

      const download = await downloadManager.grab({
        title: bestResult.title,
        downloadUrl: bestResult.downloadUrl,
        size: bestResult.size,
        bookId: book.id,
        indexerId: bestResult.indexerId,
        indexerName: bestResult.indexer,
        guid: bestResult.id,
      })

      return response.created({
        id: download.id,
        title: download.title,
        status: download.status,
        release: {
          title: bestResult.title,
          indexer: bestResult.indexer,
          size: bestResult.size,
        },
      })
    } catch (error) {
      return response.badRequest({
        error: error instanceof Error ? error.message : 'Failed to search and download',
      })
    }
  }

  /**
   * Trigger immediate search for a book
   */
  async searchNow({ params, response }: HttpContext) {
    const book = await Book.find(params.id)
    if (!book) {
      return response.notFound({ error: 'Book not found' })
    }

    try {
      const result = await requestedSearchTask.searchSingleBook(book.id)
      return response.json({
        found: result.found,
        grabbed: result.grabbed,
        error: result.error,
      })
    } catch (error) {
      return response.internalServerError({
        error: error instanceof Error ? error.message : 'Search failed',
      })
    }
  }

  /**
   * Delete the book file from disk and database
   */
  async deleteFile({ params, response }: HttpContext) {
    const book = await Book.query()
      .where('id', params.id)
      .preload('author', (query) => query.preload('rootFolder'))
      .preload('bookFile')
      .first()

    if (!book) {
      return response.notFound({ error: 'Book not found' })
    }

    if (!book.bookFile) {
      return response.notFound({ error: 'Book has no file' })
    }

    if (!book.author?.rootFolder) {
      return response.badRequest({ error: 'Author has no root folder configured' })
    }

    const absolutePath = path.join(book.author.rootFolder.path, book.bookFile.relativePath)
    const folderPath = path.dirname(absolutePath)

    try {
      // Delete the file from disk
      await fs.unlink(absolutePath)
      console.log(`[BooksController] Deleted book file: ${absolutePath}`)

      // Try to remove the author folder if empty
      try {
        const remainingFiles = await fs.readdir(folderPath)
        if (remainingFiles.length === 0) {
          await fs.rmdir(folderPath)
          console.log(`[BooksController] Removed empty folder: ${folderPath}`)
        }
      } catch {
        // Folder might not be empty or other error, ignore
      }
    } catch (error) {
      console.error(`[BooksController] Failed to delete file: ${absolutePath}`, error)
      // Continue with database cleanup even if file deletion fails
    }

    // Delete the BookFile record
    await BookFile.query().where('id', book.bookFile.id).delete()

    // Update book hasFile flag
    book.hasFile = false
    await book.save()

    return response.json({
      message: 'File deleted successfully',
      bookId: book.id,
    })
  }
}
