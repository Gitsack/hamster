import { test } from '@japa/runner'
import Book from '#models/book'
import Author from '#models/author'
import BooksController from '#controllers/books_controller'
import { BookFactory } from '../../../database/factories/book_factory.js'
import { DateTime } from 'luxon'

test.group('BooksController', (group) => {
  let author: Author
  let book1: Book
  let book2: Book

  group.setup(async () => {
    author = await Author.create({
      name: 'Books Test Author',
      sortName: 'Test Author, Books',
      requested: true,
      monitored: false,
      needsReview: false,
      addedAt: DateTime.now(),
    })

    book1 = await BookFactory.create({
      authorId: author.id,
      title: 'Books Test Alpha',
      openlibraryId: '/works/OL-test-001',
      requested: true,
      hasFile: false,
    })
    book2 = await BookFactory.create({
      authorId: author.id,
      title: 'Books Test Beta',
      openlibraryId: '/works/OL-test-002',
      requested: false,
      hasFile: false,
    })
  })

  group.teardown(async () => {
    await Book.query().where('authorId', author.id).delete()
    await Book.query().where('title', 'like', 'Books Test%').delete()
    await author.delete()
  })

  // ---- index ----

  test('index returns list of books', async ({ assert }) => {
    const controller = new BooksController()
    let result: unknown[] = []

    await controller.index({
      request: {
        input: () => undefined,
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const titles = result.map((b: any) => b.title)
    assert.include(titles, 'Books Test Alpha')
    assert.include(titles, 'Books Test Beta')
  })

  test('index filters by authorId', async ({ assert }) => {
    const controller = new BooksController()
    let result: unknown[] = []

    await controller.index({
      request: {
        input: (key: string) => (key === 'authorId' ? author.id : undefined),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    for (const book of result as any[]) {
      assert.equal(book.authorId, author.id)
    }
  })

  test('index returns expected book shape', async ({ assert }) => {
    const controller = new BooksController()
    let result: unknown[] = []

    await controller.index({
      request: {
        input: () => undefined,
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const book = result.find((b: any) => b.id === book1.id) as Record<string, unknown>
    assert.isNotNull(book)
    assert.equal(book.title, 'Books Test Alpha')
    assert.equal(book.authorId, author.id)
    assert.equal(book.authorName, 'Books Test Author')
    assert.equal(book.requested, true)
    assert.equal(book.hasFile, false)
  })

  // ---- show ----

  test('show returns book details', async ({ assert }) => {
    const controller = new BooksController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: book1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, book1.id)
    assert.equal(result.title, 'Books Test Alpha')
    assert.equal(result.openlibraryId, '/works/OL-test-001')
    assert.isNotNull(result.author)
  })

  test('show returns notFound for non-existent book', async ({ assert }) => {
    const controller = new BooksController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.show({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Book not found')
  })

  // ---- update ----

  test('update modifies book properties', async ({ assert }) => {
    const controller = new BooksController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: book2.id },
      request: {
        only: () => ({ requested: true }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, book2.id)
    assert.equal(result.requested, true)

    // Verify in database
    await book2.refresh()
    assert.equal(book2.requested, true)

    // Reset
    book2.requested = false
    await book2.save()
  })

  test('update returns notFound for non-existent book', async ({ assert }) => {
    const controller = new BooksController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        only: () => ({ requested: true }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Book not found')
  })

  // ---- destroy ----

  test('destroy deletes a book', async ({ assert }) => {
    const toDelete = await BookFactory.create({
      authorId: author.id,
      title: 'Books Test Destroy',
    })

    const controller = new BooksController()
    let result: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: toDelete.id },
      request: {
        input: () => 'false',
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.deleted, true)
    assert.equal(result.id, toDelete.id)

    const deleted = await Book.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent book', async ({ assert }) => {
    const controller = new BooksController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        input: () => 'false',
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Book not found')
  })

  // ---- store ----

  test('store returns conflict for duplicate openlibraryId', async ({ assert }) => {
    const controller = new BooksController()
    let conflictResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          openlibraryId: '/works/OL-test-001',
          authorId: author.id,
          title: 'Duplicate Book',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
        }),
      },
      response: {
        created() {},
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
        badRequest() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(conflictResult.error, 'Book already in library')
  })

  test('store returns badRequest when no author info provided', async ({ assert }) => {
    const controller = new BooksController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          title: 'Orphan Book',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
        }),
      },
      response: {
        created() {},
        conflict() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.equal(badRequestResult.error, 'Author ID or author key is required')
  })

  test('store creates book with existing authorId', async ({ assert }) => {
    const controller = new BooksController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          authorId: author.id,
          title: 'Books Test New Book',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
          requested: true,
        }),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
        conflict() {},
        badRequest() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.title, 'Books Test New Book')
    assert.isNotNull(result.id)

    // Cleanup
    if (result.id) {
      await Book.query().where('id', result.id as string).delete()
    }
  })

  test('store returns badRequest when authorId is invalid', async ({ assert }) => {
    const controller = new BooksController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          authorId: '00000000-0000-0000-0000-000000000000',
          title: 'Book With Bad Author',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
        }),
      },
      response: {
        created() {},
        conflict() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.equal(badRequestResult.error, 'Author not found')
  })

  // ---- setWanted ----

  test('setWanted sets book as requested', async ({ assert }) => {
    const wantedBook = await BookFactory.create({
      authorId: author.id,
      title: 'Books Test Wanted',
      requested: false,
      hasFile: false,
    })

    const controller = new BooksController()
    let result: Record<string, unknown> = {}

    await controller.setWanted({
      params: { id: wantedBook.id },
      request: {
        only: () => ({ requested: true }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
        badRequest() {},
      },
    } as never)

    assert.equal(result.requested, true)

    await wantedBook.delete()
  })

  test('setWanted deletes unrequested book without file', async ({ assert }) => {
    const unwantedBook = await BookFactory.create({
      authorId: author.id,
      title: 'Books Test Unwanted',
      requested: true,
      hasFile: false,
    })
    const bookId = unwantedBook.id

    const controller = new BooksController()
    let result: Record<string, unknown> = {}

    await controller.setWanted({
      params: { id: bookId },
      request: {
        only: () => ({ requested: false }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
        badRequest() {},
      },
    } as never)

    assert.equal(result.deleted, true)

    const deleted = await Book.find(bookId)
    assert.isNull(deleted)
  })

  test('setWanted returns badRequest when unrequesting book with file', async ({ assert }) => {
    const bookWithFile = await BookFactory.create({
      authorId: author.id,
      title: 'Books Test WithFile',
      requested: true,
      hasFile: true,
    })

    const controller = new BooksController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.setWanted({
      params: { id: bookWithFile.id },
      request: {
        only: () => ({ requested: false }),
      },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.hasFile, true)

    await bookWithFile.delete()
  })

  test('setWanted returns notFound for non-existent book', async ({ assert }) => {
    const controller = new BooksController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.setWanted({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        only: () => ({ requested: true }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Book not found')
  })

  // ---- search ----

  test('search returns badRequest when query is empty', async ({ assert }) => {
    const controller = new BooksController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.search({
      request: {
        input: (key: string, defaultVal: string) => (key === 'q' ? '' : defaultVal),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Search query is required')
  })
})
