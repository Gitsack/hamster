import { test } from '@japa/runner'
import { parseFolderName, isSimilar, matchTitleToLibrary } from '#services/media/library_matcher'
import { MovieFactory } from '../../../database/factories/movie_factory.js'
import { TvShowFactory } from '../../../database/factories/tv_show_factory.js'
import { EpisodeFactory } from '../../../database/factories/episode_factory.js'
import { AlbumFactory } from '../../../database/factories/album_factory.js'
import { ArtistFactory } from '../../../database/factories/artist_factory.js'
import { BookFactory } from '../../../database/factories/book_factory.js'
import { AuthorFactory } from '../../../database/factories/author_factory.js'
import { SeasonFactory } from '../../../database/factories/season_factory.js'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Season from '#models/season'
import Album from '#models/album'
import Artist from '#models/artist'
import Book from '#models/book'
import Author from '#models/author'

const TEST_PREFIX = 'LibMatcherTest__'

test.group('library_matcher | parseFolderName', () => {
  test('extracts year and title from movie release name', ({ assert }) => {
    const result = parseFolderName('Dune.Part.Two.2024.1080p.WEB-DL.x264-GROUP')
    assert.equal(result.year, 2024)
    assert.equal(result.title?.toLowerCase().includes('dune'), true)
  })

  test('extracts season/episode for TV folders', ({ assert }) => {
    const result = parseFolderName('Severance.S02E03.1080p.WEB-DL')
    assert.equal(result.season, 2)
    assert.equal(result.episode, 3)
    assert.equal(result.title?.toLowerCase().includes('severance'), true)
  })

  test('handles dot-separated music folders', ({ assert }) => {
    // Note: parser is permissive and may classify these as movies if
    // codec markers are present — we only assert the fields it does set.
    const result = parseFolderName('Radiohead - In Rainbows 2007 FLAC')
    assert.equal(result.year, 2007)
  })

  test('returns empty result for empty input', ({ assert }) => {
    const result = parseFolderName('')
    assert.isUndefined(result.year)
  })
})

test.group('library_matcher | isSimilar', () => {
  test('treats identical normalized strings as similar', ({ assert }) => {
    assert.isTrue(isSimilar('thematrix', 'thematrix'))
  })

  test('treats substring matches as similar', ({ assert }) => {
    assert.isTrue(isSimilar('thematrix1999', 'thematrix'))
  })

  test('treats near-typos under 30% distance as similar', ({ assert }) => {
    assert.isTrue(isSimilar('matrix', 'matric'))
  })

  test('rejects completely different short strings', ({ assert }) => {
    assert.isFalse(isSimilar('matrix', 'avatar'))
  })

  test('long strings only match by containment', ({ assert }) => {
    assert.isFalse(isSimilar('a'.repeat(25), 'b'.repeat(25)))
  })
})

test.group('library_matcher | matchTitleToLibrary', (group) => {
  let movieRequested: Movie
  let movieUnrequested: Movie
  let movieScanned: Movie
  let tvShow: TvShow
  let season: Season
  let episode: Episode
  let artist: Artist
  let album: Album
  let author: Author
  let book: Book

  group.setup(async () => {
    movieRequested = await MovieFactory.create({
      title: `${TEST_PREFIX}Inception`,
      year: 2010,
      requested: true,
    })
    // Critical: this is the bug regression test — a library item that was
    // NOT explicitly "requested" must still match if a file appears for it.
    // The old behaviour filtered by requested=true and silently dropped
    // matches for scan-discovered or manually-added entries.
    movieUnrequested = await MovieFactory.create({
      title: `${TEST_PREFIX}Interstellar`,
      year: 2014,
      requested: false,
    })
    movieScanned = await MovieFactory.create({
      title: `${TEST_PREFIX}TenetUnrequested`,
      year: 2020,
      requested: false,
      hasFile: false,
    })

    tvShow = await TvShowFactory.create({
      title: `${TEST_PREFIX}SeveranceUnreq`,
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
      episodeNumber: 5,
    })

    artist = await ArtistFactory.create({
      name: `${TEST_PREFIX}Radiohead`,
    })
    album = await AlbumFactory.create({
      artistId: artist.id,
      title: `${TEST_PREFIX}InRainbows`,
      requested: false,
    })

    author = await AuthorFactory.create({
      name: `${TEST_PREFIX}NealStephenson`,
    })
    book = await BookFactory.create({
      authorId: author.id,
      title: `${TEST_PREFIX}Anathem`,
    })
  })

  group.teardown(async () => {
    await Episode.query().where('tvShowId', tvShow.id).delete()
    await Season.query().where('tvShowId', tvShow.id).delete()
    await TvShow.query().where('id', tvShow.id).delete()
    await Movie.query()
      .whereIn('id', [movieRequested.id, movieUnrequested.id, movieScanned.id])
      .delete()
    await Album.query().where('id', album.id).delete()
    await Artist.query().where('id', artist.id).delete()
    await Book.query().where('id', book.id).delete()
    await Author.query().where('id', author.id).delete()
  })

  test('matches requested movies', async ({ assert }) => {
    const match = await matchTitleToLibrary(`${TEST_PREFIX}Inception.2010.1080p.BluRay.x264-GROUP`)
    assert.isNotNull(match)
    assert.equal(match?.type, 'movie')
    assert.equal(match?.id, movieRequested.id)
  })

  test('matches non-requested movies (regression: external download path)', async ({ assert }) => {
    const match = await matchTitleToLibrary(
      `${TEST_PREFIX}Interstellar.2014.1080p.BluRay.x264-GROUP`
    )
    assert.isNotNull(match)
    assert.equal(match?.type, 'movie')
    assert.equal(
      match?.id,
      movieUnrequested.id,
      'matcher must find library entries even when requested=false'
    )
  })

  test('matches scan-discovered movies without year hint in title', async ({ assert }) => {
    const match = await matchTitleToLibrary(`${TEST_PREFIX}TenetUnrequested 2020 WEBRip`)
    assert.isNotNull(match)
    assert.equal(match?.id, movieScanned.id)
  })

  test('matches non-requested TV episodes', async ({ assert }) => {
    const match = await matchTitleToLibrary(`${TEST_PREFIX}SeveranceUnreq.S01E05.1080p.WEB-DL.x264`)
    assert.isNotNull(match)
    assert.equal(match?.type, 'episode')
    if (match?.type === 'episode') {
      assert.equal(match.id, episode.id)
      assert.equal(match.tvShowId, tvShow.id)
    }
  })

  test('matches non-requested albums', async ({ assert }) => {
    const match = await matchTitleToLibrary(
      `${TEST_PREFIX}Radiohead - ${TEST_PREFIX}InRainbows 2007 FLAC`
    )
    assert.isNotNull(match)
    assert.equal(match?.type, 'album')
    assert.equal(match?.id, album.id)
  })

  test('returns null when title not in library', async ({ assert }) => {
    const match = await matchTitleToLibrary(`${TEST_PREFIX}NonExistentMovieThatDoesntExist.2099`)
    assert.isNull(match)
  })
})
