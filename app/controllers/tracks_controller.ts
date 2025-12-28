import type { HttpContext } from '@adonisjs/core/http'
import Track from '#models/track'
import { musicBrainzService } from '#services/metadata/musicbrainz_service'

export default class TracksController {
  /**
   * Search MusicBrainz for tracks (recordings)
   */
  async search({ request, response }: HttpContext) {
    const query = request.input('q', '')
    const artistName = request.input('artist', '')

    if (!query || query.length < 2) {
      return response.json([])
    }

    const results = await musicBrainzService.searchTracks(query, artistName || undefined, 25)

    // Check which tracks are already in the library by their musicbrainz recording ID
    const existingMbIds = await Track.query()
      .whereIn(
        'musicbrainzId',
        results.map((r) => r.id)
      )
      .select('musicbrainzId')

    const existingSet = new Set(existingMbIds.map((t) => t.musicbrainzId))

    return response.json(
      results.map((track) => ({
        musicbrainzId: track.id,
        title: track.title,
        artistName: track.artistName,
        artistMusicbrainzId: track.artistId,
        albumTitle: track.albumTitle,
        albumMusicbrainzId: track.albumId,
        duration: track.duration,
        inLibrary: existingSet.has(track.id),
      }))
    )
  }
}
