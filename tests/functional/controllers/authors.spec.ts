import { test } from '@japa/runner'
import Author from '#models/author'
import Book from '#models/book'
import AuthorsController from '#controllers/authors_controller'
import { AuthorFactory } from '../../../database/factories/author_factory.js'
import { BookFactory } from '../../../database/factories/book_factory.js'

test.group('AuthorsController', (group) => {
  let author1: Author
  let author2: Author
  let book1: Book

  group.setup(async () => {
    author1 = await AuthorFactory.create({
      name: 'Authors Test Alice',
      openlibraryId: 'OL9999901A',
      requested: true,
      monitored: true,
    })

    author2 = await AuthorFactory.create({
      name: 'Authors Test Bob',
      openlibraryId: 'OL9999902A',
      requested: false,
      monitored: false,
    })

    book1 = await BookFactory.create({
      authorId: author1.id,
      title: 'Authors Test Book One',
      requested: true,
      hasFile: false,
    })
  })

  group.teardown(async () => {
    await Book.query().whereIn('authorId', [author1.id, author2.id]).delete()
    await Author.query().whereIn('id', [author1.id, author2.id]).delete()
    await Author.query().where('name', 'like', 'Authors Test%').delete()
  })

  // ---- index ----

  test('index returns list of authors', async ({ assert }) => {
    const controller = new AuthorsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const names = result.map((a: any) => a.name)
    assert.include(names, 'Authors Test Alice')
    assert.include(names, 'Authors Test Bob')
  })

  test('index returns expected author shape', async ({ assert }) => {
    const controller = new AuthorsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const author = result.find((a: any) => a.id === author1.id) as Record<string, unknown>
    assert.isNotNull(author)
    assert.equal(author.name, 'Authors Test Alice')
    assert.equal(author.requested, true)
    assert.equal(author.monitored, true)
    assert.property(author, 'bookCount')
    assert.property(author, 'addedAt')
  })

  // ---- show ----

  test('show returns author details with books', async ({ assert }) => {
    const controller = new AuthorsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: author1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, author1.id)
    assert.equal(result.name, 'Authors Test Alice')
    assert.equal(result.openlibraryId, 'OL9999901A')
    assert.property(result, 'books')

    const books = result.books as any[]
    assert.isTrue(books.length >= 1)
    const bookTitles = books.map((b: any) => b.title)
    assert.include(bookTitles, 'Authors Test Book One')
  })

  test('show returns book shape with expected fields', async ({ assert }) => {
    const controller = new AuthorsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: author1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    const books = result.books as Record<string, unknown>[]
    const book = books.find((b) => b.title === 'Authors Test Book One')
    assert.isNotNull(book)
    assert.property(book!, 'id')
    assert.property(book!, 'title')
    assert.property(book!, 'requested')
    assert.property(book!, 'hasFile')
    assert.property(book!, 'coverUrl')
  })

  test('show returns notFound for non-existent author', async ({ assert }) => {
    const controller = new AuthorsController()
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

    assert.equal(notFoundResult.error, 'Author not found')
  })

  // ---- store ----

  test('store creates a new author without openlibraryId', async ({ assert }) => {
    const controller = new AuthorsController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          name: 'Authors Test New Author',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
          requested: true,
          monitored: false,
        }),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
        conflict() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.name, 'Authors Test New Author')
    assert.isNotNull(result.id)

    // Cleanup
    if (result.id) {
      await Author.query().where('id', result.id as string).delete()
    }
  })

  test('store returns conflict for duplicate openlibraryId', async ({ assert }) => {
    const controller = new AuthorsController()
    let conflictResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          openlibraryId: 'OL9999901A',
          name: 'Duplicate Author',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
        }),
      },
      response: {
        created() {},
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.equal(conflictResult.error, 'Author already in library')
  })

  // ---- update ----

  test('update modifies author properties', async ({ assert }) => {
    const controller = new AuthorsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: author2.id },
      request: {
        only: () => ({ requested: true, monitored: true }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, author2.id)
    assert.equal(result.requested, true)
    assert.equal(result.monitored, true)

    // Verify in database
    await author2.refresh()
    assert.equal(author2.requested, true)
    assert.equal(author2.monitored, true)

    // Reset
    author2.requested = false
    author2.monitored = false
    await author2.save()
  })

  test('update returns notFound for non-existent author', async ({ assert }) => {
    const controller = new AuthorsController()
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

    assert.equal(notFoundResult.error, 'Author not found')
  })

  // ---- destroy ----

  test('destroy deletes an author', async ({ assert }) => {
    const toDelete = await AuthorFactory.create({
      name: 'Authors Test Delete Me',
    })

    const controller = new AuthorsController()
    let noContentCalled = false

    await controller.destroy({
      params: { id: toDelete.id },
      response: {
        noContent() {
          noContentCalled = true
        },
        notFound() {},
      },
    } as never)

    assert.isTrue(noContentCalled)

    const deleted = await Author.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent author', async ({ assert }) => {
    const controller = new AuthorsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        noContent() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Author not found')
  })

  // ---- search ----

  test('search returns badRequest when query is empty', async ({ assert }) => {
    const controller = new AuthorsController()
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

  // ---- refresh ----

  test('refresh returns notFound for non-existent author', async ({ assert }) => {
    const controller = new AuthorsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.refresh({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Author not found')
  })

  test('refresh returns badRequest when author has no openlibraryId', async ({ assert }) => {
    const noOlAuthor = await AuthorFactory.create({
      name: 'Authors Test No OL',
      openlibraryId: null,
    })

    const controller = new AuthorsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.refresh({
      params: { id: noOlAuthor.id },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.equal(badRequestResult.error, 'Author has no OpenLibrary ID')

    await noOlAuthor.delete()
  })

  // ---- worksByOpenlibraryId ----

  // Note: worksByOpenlibraryId calls openLibraryService externally.
  // We test the notFound/empty path when the external service throws.
  // The method catches errors and returns an empty array.
})
