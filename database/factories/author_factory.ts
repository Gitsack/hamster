import Author from '#models/author'

let counter = 0

export class AuthorFactory {
  static async create(
    overrides: Partial<{
      name: string
      sortName: string
      goodreadsId: string | null
      openlibraryId: string | null
      overview: string | null
      monitored: boolean
      qualityProfileId: string | null
      rootFolderId: string | null
    }> = {}
  ) {
    counter++
    return await Author.create({
      name: overrides.name ?? `Test Author ${counter}`,
      sortName: overrides.sortName ?? `Test Author ${counter}`,
      goodreadsId: overrides.goodreadsId ?? null,
      openlibraryId: overrides.openlibraryId ?? null,
      overview: overrides.overview ?? null,
      monitored: overrides.monitored ?? false,
      needsReview: false,
      qualityProfileId: overrides.qualityProfileId ?? null,
      rootFolderId: overrides.rootFolderId ?? null,
    })
  }
}
