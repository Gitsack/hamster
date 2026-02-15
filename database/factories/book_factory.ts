import Book from '#models/book'

let counter = 0

export class BookFactory {
  static async create(
    overrides: Partial<{
      authorId: string
      title: string
      goodreadsId: string | null
      openlibraryId: string | null
      isbn: string | null
      isbn13: string | null
      overview: string | null
      pageCount: number | null
      publisher: string | null
      language: string | null
      genres: string[]
      requested: boolean
      hasFile: boolean
    }> = {}
  ) {
    counter++
    if (!overrides.authorId) {
      throw new Error('authorId is required to create a Book')
    }
    return await Book.create({
      authorId: overrides.authorId,
      title: overrides.title ?? `Test Book ${counter}`,
      goodreadsId: overrides.goodreadsId ?? null,
      openlibraryId: overrides.openlibraryId ?? null,
      isbn: overrides.isbn ?? null,
      isbn13: overrides.isbn13 ?? null,
      overview: overrides.overview ?? null,
      pageCount: overrides.pageCount ?? null,
      publisher: overrides.publisher ?? null,
      language: overrides.language ?? null,
      genres: overrides.genres ?? [],
      requested: overrides.requested ?? false,
      hasFile: overrides.hasFile ?? false,
    })
  }
}
