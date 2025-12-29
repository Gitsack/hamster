import type { HttpContext } from '@adonisjs/core/http'
import Author from '#models/author'
import Book from '#models/book'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { openLibraryService } from '#services/metadata/openlibrary_service'

const authorValidator = vine.compile(
  vine.object({
    openlibraryId: vine.string().optional(),
    name: vine.string().minLength(1),
    qualityProfileId: vine.number().optional(),
    rootFolderId: vine.number(),
    wanted: vine.boolean().optional(),
    addBooks: vine.boolean().optional(),
  })
)

export default class AuthorsController {
  async index({ response }: HttpContext) {
    const authors = await Author.query()
      .preload('qualityProfile')
      .preload('rootFolder')
      .withCount('books')
      .orderBy('sortName', 'asc')

    return response.json(
      authors.map((author) => ({
        id: author.id,
        name: author.name,
        overview: author.overview,
        imageUrl: author.imageUrl,
        wanted: author.wanted,
        bookCount: author.$extras.books_count,
        qualityProfile: author.qualityProfile?.name,
        rootFolder: author.rootFolder?.path,
        addedAt: author.addedAt?.toISO(),
      }))
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
      wanted: data.wanted ?? true,
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

    const author = await Author.create(authorData)

    // Fetch and add books if requested
    if (data.addBooks && data.openlibraryId) {
      try {
        const works = await openLibraryService.getAuthorWorks(data.openlibraryId)

        for (const work of works.slice(0, 50)) {
          // Limit to 50 books
          await Book.create({
            authorId: author.id,
            openlibraryId: work.key,
            title: work.title,
            sortTitle: work.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
            overview: work.description,
            coverUrl: openLibraryService.getCoverUrl(work.coverId, 'L'),
            genres: work.subjects || [],
            wanted: data.wanted ?? true,
            hasFile: false,
          })
        }
      } catch (error) {
        console.error('Failed to fetch books:', error)
      }
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
      wanted: author.wanted,
      qualityProfile: author.qualityProfile,
      rootFolder: author.rootFolder,
      books: author.books.map((b) => ({
        id: b.id,
        title: b.title,
        releaseDate: b.releaseDate?.toISODate(),
        coverUrl: b.coverUrl,
        wanted: b.wanted,
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

    const { wanted, qualityProfileId, rootFolderId } = request.only([
      'wanted',
      'qualityProfileId',
      'rootFolderId',
    ])

    if (wanted !== undefined) author.wanted = wanted
    if (qualityProfileId !== undefined) author.qualityProfileId = qualityProfileId
    if (rootFolderId !== undefined) author.rootFolderId = rootFolderId

    await author.save()

    return response.json({ id: author.id, name: author.name, wanted: author.wanted })
  }

  async destroy({ params, response }: HttpContext) {
    const author = await Author.find(params.id)
    if (!author) {
      return response.notFound({ error: 'Author not found' })
    }

    await author.delete()
    return response.noContent()
  }
}
