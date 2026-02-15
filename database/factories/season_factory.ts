import Season from '#models/season'

let counter = 0

export class SeasonFactory {
  static async create(
    overrides: Partial<{
      tvShowId: string
      tmdbId: string | null
      seasonNumber: number
      title: string | null
      overview: string | null
      episodeCount: number
      requested: boolean
    }> = {}
  ) {
    counter++
    if (!overrides.tvShowId) {
      throw new Error('tvShowId is required to create a Season')
    }
    return await Season.create({
      tvShowId: overrides.tvShowId,
      tmdbId: overrides.tmdbId ?? null,
      seasonNumber: overrides.seasonNumber ?? counter,
      title: overrides.title ?? `Season ${overrides.seasonNumber ?? counter}`,
      overview: overrides.overview ?? null,
      episodeCount: overrides.episodeCount ?? 0,
      requested: overrides.requested ?? false,
    })
  }
}
