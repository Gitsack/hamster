import type Author from '#models/author'
import Book from '#models/book'
import { openLibraryService } from '#services/metadata/openlibrary_service'
import { shouldRequestNewBook } from '#services/library/release_follow'

/**
 * Add an author's works from OpenLibrary that the library does not have yet.
 *
 * Works arrive unrequested — the author's page lists them so books can be
 * requested one at a time. The exception is a followed author's new book,
 * which is wanted by default the way a monitored show's new season is.
 * Returns the books that were added.
 */
export async function addAuthorWorks(author: Author): Promise<Book[]> {
  if (!author.openlibraryId) return []

  const works = await openLibraryService.getAuthorWorks(author.openlibraryId, 100)
  const existing = await Book.query().where('authorId', author.id).select('openlibraryId')
  const existingKeys = new Set(existing.map((b) => b.openlibraryId))
  const newWorks = works.filter((work) => !existingKeys.has(work.key))
  if (newWorks.length === 0) return []

  // Publication years only matter when following; skip the lookup otherwise.
  const years = author.monitored
    ? await openLibraryService.getAuthorWorkYears(author.openlibraryId)
    : new Map<string, number>()

  const added: Book[] = []
  for (const work of newWorks) {
    added.push(
      await Book.create({
        authorId: author.id,
        openlibraryId: work.key,
        title: work.title,
        sortTitle: work.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
        overview: work.description,
        coverUrl: openLibraryService.getCoverUrl(work.coverId, 'L'),
        genres: work.subjects || [],
        requested: shouldRequestNewBook(author, years.get(work.key)),
        hasFile: false,
      })
    )
  }
  return added
}
