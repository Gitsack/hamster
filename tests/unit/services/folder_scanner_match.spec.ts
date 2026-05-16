import { test } from '@japa/runner'
import { folderScanner } from '#services/tasks/folder_scanner'
import { MovieFactory } from '../../../database/factories/movie_factory.js'
import { TvShowFactory } from '../../../database/factories/tv_show_factory.js'
import { EpisodeFactory } from '../../../database/factories/episode_factory.js'
import { SeasonFactory } from '../../../database/factories/season_factory.js'
import { AlbumFactory } from '../../../database/factories/album_factory.js'
import { ArtistFactory } from '../../../database/factories/artist_factory.js'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Season from '#models/season'
import Album from '#models/album'
import Artist from '#models/artist'

/**
 * These tests verify that FolderScanner.matchToLibrary() picks up library
 * entries regardless of whether they were "requested" through Hamster.
 *
 * Regression for: external-downloaded media (or scan-discovered library
 * entries) were silently ignored because the matcher filtered to
 * requested=true / monitored=true.
 */

const TEST_PREFIX = 'FSMatchTest__'

// Reflect into the private method without leaking it from the class
function matchPrivate(folderName: string) {
  return (folderScanner as any).matchToLibrary(folderName) as Promise<{
    type: string
    id: string
    title: string
    tvShowId?: string
  } | null>
}

test.group('FolderScanner.matchToLibrary | external-file regression', (group) => {
  let movieReq: Movie
  let movieUnreq: Movie
  let tvShow: TvShow
  let season: Season
  let episode: Episode
  let artist: Artist
  let albumUnreq: Album

  group.setup(async () => {
    movieReq = await MovieFactory.create({
      title: `${TEST_PREFIX}DuneRequested`,
      year: 2021,
      requested: true,
    })
    movieUnreq = await MovieFactory.create({
      title: `${TEST_PREFIX}DuneUnrequested`,
      year: 2024,
      requested: false,
    })

    tvShow = await TvShowFactory.create({
      title: `${TEST_PREFIX}AndorUnreq`,
      year: 2022,
      requested: false,
    })
    season = await SeasonFactory.create({
      tvShowId: tvShow.id,
      seasonNumber: 1,
    })
    episode = await EpisodeFactory.create({
      tvShowId: tvShow.id,
      seasonId: season.id,
      seasonNumber: 1,
      episodeNumber: 4,
    })

    artist = await ArtistFactory.create({
      name: `${TEST_PREFIX}KingGizzard`,
    })
    albumUnreq = await AlbumFactory.create({
      artistId: artist.id,
      title: `${TEST_PREFIX}Nonagon`,
      requested: false,
      monitored: false,
    })
  })

  group.teardown(async () => {
    await Episode.query().where('tvShowId', tvShow.id).delete()
    await Season.query().where('tvShowId', tvShow.id).delete()
    await TvShow.query().where('id', tvShow.id).delete()
    await Movie.query().whereIn('id', [movieReq.id, movieUnreq.id]).delete()
    await Album.query().where('id', albumUnreq.id).delete()
    await Artist.query().where('id', artist.id).delete()
  })

  test('matches movie that was requested', async ({ assert }) => {
    const match = await matchPrivate(`${TEST_PREFIX}DuneRequested.2021.2160p.UHD.BluRay-GROUP`)
    assert.isNotNull(match)
    assert.equal(match?.type, 'movie')
    assert.equal(match?.id, movieReq.id)
  })

  test('matches movie that was NOT requested (regression)', async ({ assert }) => {
    // This is the user-reported bug: files downloaded outside Hamster never
    // matched library entries because the matcher filtered requested=true.
    const match = await matchPrivate(`${TEST_PREFIX}DuneUnrequested.2024.1080p.WEB-DL.x264-GROUP`)
    assert.isNotNull(match)
    assert.equal(match?.type, 'movie')
    assert.equal(match?.id, movieUnreq.id)
  })

  test('matches TV episode for non-requested show', async ({ assert }) => {
    const match = await matchPrivate(`${TEST_PREFIX}AndorUnreq.S01E04.1080p.WEB-DL.x264`)
    assert.isNotNull(match)
    assert.equal(match?.type, 'episode')
    if (match?.type === 'episode') {
      assert.equal(match.id, episode.id)
      assert.equal(match.tvShowId, tvShow.id)
    }
  })

  test('matches album that is neither requested nor monitored', async ({ assert }) => {
    const match = await matchPrivate(`${TEST_PREFIX}KingGizzard - ${TEST_PREFIX}Nonagon 2017 FLAC`)
    assert.isNotNull(match)
    assert.equal(match?.type, 'album')
    assert.equal(match?.id, albumUnreq.id)
  })

  test('returns null for content not in library at all', async ({ assert }) => {
    const match = await matchPrivate(`${TEST_PREFIX}NeverSeenMovie.1999.DVDRip.x264-NOBODY`)
    assert.isNull(match)
  })
})

test.group('FolderScanner | TaskRunner interface', () => {
  test('exposes running getter', ({ assert }) => {
    assert.isFalse(folderScanner.running)
  })

  test('start/stop are no-ops without throwing', ({ assert }) => {
    folderScanner.start(60)
    folderScanner.stop()
    assert.isFalse(folderScanner.running)
  })
})
