import Album from '#models/album'

let counter = 0

export class AlbumFactory {
  static async create(
    overrides: Partial<{
      artistId: string
      title: string
      musicbrainzId: string | null
      albumType: 'album' | 'ep' | 'single' | 'compilation' | 'live' | 'remix' | 'other'
      monitored: boolean
      requested: boolean
    }> = {}
  ) {
    counter++
    if (!overrides.artistId) {
      throw new Error('artistId is required to create an Album')
    }
    return await Album.create({
      artistId: overrides.artistId,
      title: overrides.title ?? `Test Album ${counter}`,
      musicbrainzId: overrides.musicbrainzId ?? null,
      albumType: overrides.albumType ?? 'album',
      secondaryTypes: [],
      monitored: overrides.monitored ?? true,
      requested: overrides.requested ?? false,
      anyReleaseOk: true,
    })
  }
}
