import Movie from '#models/movie'

let counter = 0

export class MovieFactory {
  static async create(
    overrides: Partial<{
      title: string
      year: number | null
      tmdbId: string | null
      imdbId: string | null
      requested: boolean
      hasFile: boolean
      overview: string | null
      genres: string[]
    }> = {}
  ) {
    counter++
    return await Movie.create({
      title: overrides.title ?? `Test Movie ${counter}`,
      year: overrides.year ?? 2024,
      tmdbId: overrides.tmdbId ?? null,
      imdbId: overrides.imdbId ?? null,
      requested: overrides.requested ?? false,
      hasFile: overrides.hasFile ?? false,
      needsReview: false,
      genres: overrides.genres ?? [],
      overview: overrides.overview ?? null,
    })
  }
}
