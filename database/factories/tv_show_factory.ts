import TvShow from '#models/tv_show'

let counter = 0

export class TvShowFactory {
  static async create(
    overrides: Partial<{
      title: string
      year: number | null
      tmdbId: string | null
      imdbId: string | null
      tvdbId: string | null
      overview: string | null
      status: string | null
      network: string | null
      genres: string[]
      seasonCount: number
      episodeCount: number
      requested: boolean
      monitored: boolean
      qualityProfileId: string | null
      rootFolderId: string | null
    }> = {}
  ) {
    counter++
    return await TvShow.create({
      title: overrides.title ?? `Test TV Show ${counter}`,
      year: overrides.year ?? 2024,
      tmdbId: overrides.tmdbId ?? null,
      imdbId: overrides.imdbId ?? null,
      tvdbId: overrides.tvdbId ?? null,
      overview: overrides.overview ?? null,
      status: overrides.status ?? 'continuing',
      network: overrides.network ?? null,
      genres: overrides.genres ?? [],
      seasonCount: overrides.seasonCount ?? 1,
      episodeCount: overrides.episodeCount ?? 0,
      requested: overrides.requested ?? false,
      monitored: overrides.monitored ?? true,
      needsReview: false,
      qualityProfileId: overrides.qualityProfileId ?? null,
      rootFolderId: overrides.rootFolderId ?? null,
    })
  }
}
