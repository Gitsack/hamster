import Episode from '#models/episode'

let counter = 0

export class EpisodeFactory {
  static async create(
    overrides: Partial<{
      tvShowId: string
      seasonId: string
      tmdbId: string | null
      imdbId: string | null
      seasonNumber: number
      episodeNumber: number
      title: string | null
      overview: string | null
      runtime: number | null
      requested: boolean
      hasFile: boolean
    }> = {}
  ) {
    counter++
    if (!overrides.tvShowId) {
      throw new Error('tvShowId is required to create an Episode')
    }
    if (!overrides.seasonId) {
      throw new Error('seasonId is required to create an Episode')
    }
    return await Episode.create({
      tvShowId: overrides.tvShowId,
      seasonId: overrides.seasonId,
      tmdbId: overrides.tmdbId ?? null,
      imdbId: overrides.imdbId ?? null,
      seasonNumber: overrides.seasonNumber ?? 1,
      episodeNumber: overrides.episodeNumber ?? counter,
      title: overrides.title ?? `Test Episode ${counter}`,
      overview: overrides.overview ?? null,
      runtime: overrides.runtime ?? null,
      requested: overrides.requested ?? false,
      hasFile: overrides.hasFile ?? false,
    })
  }
}
