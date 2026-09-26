import type { HttpContext } from '@adonisjs/core/http'
import Author from '#models/author'
import Book from '#models/book'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { openLibraryService } from '#services/metadata/openlibrary_service'
import { addAuthorWorks } from '#services/library/author_works'

const authorValidator = vine.compile(
  vine.object({
    openlibraryId: vine.string().optional(),
    name: vine.string().minLength(1),
    qualityProfileId: vine.string().optional(),
    rootFolderId: vine.string(),
    /** Follow new releases. Adding an author never requests their existing books. */
    monitored: vine.boolean().optional(),
  })
)

export default class AuthorsController {
  /**
   * Authors in the library: those with a requested or downloaded book, or
   * followed for new releases.
   */
  async index({ response }: HttpContext) {
    const authors = await Author.query()
      .where((query) => {
        query.where('monitored', true).orWhereHas('books', (books) => {
          books.where('requested', true).orWhere('hasFile', true)
        })
      })
      .preload('qualityProfile')
      .preload('rootFolder')
      .withCount('books', (query) => {
        query.where('hasFile', true).as('owned_books_count')
      })
      .withCount('books', (query) => {
        query.where('requested', true).where('hasFile', false).as('requested_books_count')
      })
      .orderBy('sortName', 'asc')

    return response.json(
      authors.map((author) => {
        const ownedBookCount = Number(author.$extras.owned_books_count) || 0
        const requestedBookCount = Number(author.$extras.requested_books_count) || 0
        return {
          id: author.id,
          name: author.name,
          overview: author.overview,
          imageUrl: author.imageUrl,
          monitored: author.monitored,
          ownedBookCount,
          requestedBookCount,
          bookCount: ownedBookCount + requestedBookCount,
          qualityProfile: author.qualityProfile?.name,
          rootFolder: author.rootFolder?.path,
          addedAt: author.addedAt?.toISO(),
        }
      })
    )
  }

  async search({ request, response }: HttpContext) {
    const query = request.input('q', '')

    if (!query) {
      return response.badRequest({ error: 'Search query is required' })
    }

    try {
      const results = await openLibraryService.searchAuthors(query)

      // Check which authors are already in library
      const keys = results.map((r) => r.key)
      const existing = await Author.query().whereIn('openlibraryId', keys)
      const existingKeys = new Set(existing.map((a) => a.openlibraryId))

      return response.json(
        results.map((author) => ({
          openlibraryId: author.key,
          name: author.name,
          birthDate: author.birthDate,
          inLibrary: existingKeys.has(author.key),
        }))
      )
    } catch (error) {
      console.error('OpenLibrary search error:', error)
      return response.badRequest({ error: 'Failed to search authors' })
    }
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(authorValidator)

    // Check if already exists
    if (data.openlibraryId) {
      const existing = await Author.query().where('openlibraryId', data.openlibraryId).first()
      if (existing) {
        return response.conflict({ error: 'Author already in library' })
      }
    }

    let authorData: any = {
      name: data.name,
      sortName: data.name.split(' ').reverse().join(', '),
      monitored: data.monitored ?? false,
      monitoredAt: data.monitored ? DateTime.now() : null,
      qualityProfileId: data.qualityProfileId,
      rootFolderId: data.rootFolderId,
      addedAt: DateTime.now(),
    }

    if (data.openlibraryId) {
      try {
        const olData = await openLibraryService.getAuthor(data.openlibraryId)
        if (olData) {
          authorData = {
            ...authorData,
            openlibraryId: olData.key,
            name: olData.name,
            sortName: olData.name.split(' ').reverse().join(', '),
            overview: olData.bio,
            imageUrl: openLibraryService.getAuthorPhotoUrl(olData.photoId, 'L'),
          }
        }
      } catch (error) {
        console.error('Failed to fetch OpenLibrary data:', error)
      }
    }

    let author: Author
    try {
      author = await Author.create(authorData)
    } catch (error) {
      console.error('Failed to create author in database:', error)
      return response.internalServerError({ error: 'Failed to add author' })
    }

    // Load the bibliography so books can be requested one at a time. Nothing
    // already published is requested here.
    try {
      await addAuthorWorks(author)
    } catch (error) {
      console.error('Failed to fetch books:', error)
    }

    return response.created({
      id: author.id,
      name: author.name,
    })
  }

  async show({ params, response }: HttpContext) {
    const author = await Author.query()
      .where('id', params.id)
      .preload('qualityProfile')
      .preload('rootFolder')
      .preload('books', (query) => {
        query.orderBy('title', 'asc')
      })
      .first()

    if (!author) {
      return response.notFound({ error: 'Author not found' })
    }

    return response.json({
      id: author.id,
      openlibraryId: author.openlibraryId,
      name: author.name,
      overview: author.overview,
      imageUrl: author.imageUrl,
      monitored: author.monitored,
      monitoredAt: author.monitoredAt?.toISO() ?? null,
      qualityProfile: author.qualityProfile,
      rootFolder: author.rootFolder,
      books: author.books.map((b) => ({
        id: b.id,
        title: b.title,
        releaseDate: b.releaseDate?.toISODate(),
        coverUrl: b.coverUrl,
        requested: b.requested,
        hasFile: b.hasFile,
        seriesName: b.seriesName,
        seriesPosition: b.seriesPosition,
      })),
      addedAt: author.addedAt?.toISO(),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const author = await Author.find(params.id)
    if (!author) {
      return response.notFound({ error: 'Author not found' })
    }

    const { monitored, qualityProfileId, rootFolderId } = request.only([
      'monitored',
      'qualityProfileId',
      'rootFolderId',
    ])

    // Following starts now and never reaches back into the bibliography.
    if (typeof monitored === 'boolean' && monitored !== author.monitored) {
      author.monitored = monitored
      author.monitoredAt = monitored ? DateTime.now() : null
    }
    if (qualityProfileId !== undefined) author.qualityProfileId = qualityProfileId
    if (rootFolderId !== undefined) author.rootFolderId = rootFolderId

    await author.save()

    return response.json({
      id: author.id,
      name: author.name,
      monitored: author.monitored,
      monitoredAt: author.monitoredAt?.toISO() ?? null,
    })
  }

  async destroy({ params, response }: HttpContext) {
    const author = await Author.find(params.id)
    if (!author) {
      return response.notFound({ error: 'Author not found' })
    }

    await author.delete()
    return response.noContent()
  }

  /**
   * Get all works for an author by OpenLibrary ID (for exploration)
   */
  async worksByOpenlibraryId({ params, response }: HttpContext) {
    const openlibraryId = params.openlibraryId

    try {
      // Fetch works from OpenLibrary
      const works = await openLibraryService.getAuthorWorks(openlibraryId, 100)

      // Find the author in library if exists
      const author = await Author.query().where('openlibraryId', openlibraryId).first()

      // Get existing books in library for this author
      const existingBooks = author
        ? await Book.query()
            .where('authorId', author.id)
            .select('openlibraryId', 'id', 'requested', 'hasFile')
        : []

      const existingMap = new Map(existingBooks.map((b) => [b.openlibraryId, b]))

      return response.json(
        works.map((work) => {
          const existing = existingMap.get(work.key)
          return {
            openlibraryId: work.key,
            title: work.title,
            description: work.description,
            coverUrl: openLibraryService.getCoverUrl(work.coverId, 'M'),
            subjects: work.subjects,
            inLibrary: !!existing,
            bookId: existing?.id || null,
            requested: existing?.requested || false,
            hasFile: existing?.hasFile || false,
          }
        })
      )
    } catch (error) {
      console.error(`Failed to get works for author ${openlibraryId}:`, error)
      return response.json([])
    }
  }

  /**
   * Refresh author metadata and fetch works from OpenLibrary
   */
  async refresh({ params, response }: HttpContext) {
    const author = await Author.find(params.id)
    if (!author) {
      return response.notFound({ error: 'Author not found' })
    }

    if (!author.openlibraryId) {
      return response.badRequest({ error: 'Author has no OpenLibrary ID' })
    }

    try {
      // Fetch updated author data
      const olData = await openLibraryService.getAuthor(author.openlibraryId)
      if (olData) {
        author.merge({
          name: olData.name,
          sortName: olData.name.split(' ').reverse().join(', '),
          overview: olData.bio,
          imageUrl: openLibraryService.getAuthorPhotoUrl(olData.photoId, 'L'),
        })
        await author.save()
      }

      const added = await addAuthorWorks(author)

      return response.json({
        id: author.id,
        name: author.name,
        refreshed: true,
        booksAdded: added.length,
      })
    } catch (error) {
      console.error(`Failed to refresh author ${author.id}:`, error)
      return response.internalServerError({ error: 'Failed to refresh author' })
    }
  }
}
