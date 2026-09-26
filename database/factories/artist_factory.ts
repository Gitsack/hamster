import Artist from '#models/artist'

let counter = 0

export class ArtistFactory {
  static async create(
    overrides: Partial<{
      name: string
      sortName: string
      musicbrainzId: string | null
      status: 'continuing' | 'ended' | 'unknown'
      monitored: boolean
    }> = {}
  ) {
    counter++
    return await Artist.create({
      name: overrides.name ?? `Test Artist ${counter}`,
      sortName: overrides.sortName ?? `Test Artist ${counter}`,
      musicbrainzId: overrides.musicbrainzId ?? null,
      status: overrides.status ?? 'continuing',
      monitored: overrides.monitored ?? false,
      needsReview: false,
    })
  }
}
