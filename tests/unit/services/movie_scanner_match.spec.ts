import { test } from '@japa/runner'
import { MovieScannerService } from '#services/media/movie_scanner_service'
import { MovieFactory } from '../../../database/factories/movie_factory.js'
import RootFolder from '#models/root_folder'
import Movie from '#models/movie'

const TEST_PREFIX = 'MovieMatchTest__'

interface ScannerPrivate {
  findExistingMovie(
    parsed: { title: string; year?: number },
    rootFolderId: string
  ): Promise<Movie | null>
}

// Access the private method without exporting it from the class
const scanner = new MovieScannerService() as unknown as ScannerPrivate

test.group('MovieScannerService.findExistingMovie | loose matching', (group) => {
  let rootA: RootFolder
  let rootB: RootFolder
  const movieIds: string[] = []

  group.setup(async () => {
    rootA = await RootFolder.create({
      name: 'movie-match-root-a',
      path: `/tmp/movie-match-a-${Date.now()}`,
      mediaType: 'movies',
      accessible: true,
      scanStatus: 'idle',
    })
    rootB = await RootFolder.create({
      name: 'movie-match-root-b',
      path: `/tmp/movie-match-b-${Date.now()}`,
      mediaType: 'movies',
      accessible: true,
      scanStatus: 'idle',
    })
  })

  group.teardown(async () => {
    await Movie.query().whereIn('id', movieIds).delete()
    await rootA.delete()
    await rootB.delete()
  })

  const track = async (mv: Movie) => {
    movieIds.push(mv.id)
    return mv
  }

  test('matches same-folder Movie by exact normalized title', async ({ assert }) => {
    const mv = await track(
      await MovieFactory.create({
        title: `${TEST_PREFIX}Inception`,
        year: 2010,
        requested: true,
      })
    )
    mv.rootFolderId = rootA.id
    await mv.save()

    const result = await scanner.findExistingMovie(
      { title: `${TEST_PREFIX}Inception`, year: 2010 },
      rootA.id
    )
    assert.equal(result?.id, mv.id)
  })

  test('matches a Movie with rootFolderId=NULL (regression: requested-but-no-folder)', async ({
    assert,
  }) => {
    // This is the user's bug: a movie was requested via TMDB before a root
    // folder was set; rootFolderId is null. The scanner must still match it.
    const mv = await track(
      await MovieFactory.create({
        title: `${TEST_PREFIX}DuneRequested`,
        year: 2021,
        requested: true,
      })
    )
    mv.rootFolderId = null
    await mv.save()

    const result = await scanner.findExistingMovie(
      { title: `${TEST_PREFIX}DuneRequested`, year: 2021 },
      rootA.id
    )
    assert.equal(result?.id, mv.id, 'must match across the null-rootFolderId boundary')
  })

  test('matches with title containing punctuation removed by normalization', async ({ assert }) => {
    // DB has the colon, file does not.
    const mv = await track(
      await MovieFactory.create({
        title: `${TEST_PREFIX}Fantastic Beasts: The Crimes of Grindelwald`,
        year: 2018,
        requested: true,
      })
    )
    mv.rootFolderId = rootA.id
    await mv.save()

    const result = await scanner.findExistingMovie(
      { title: `${TEST_PREFIX}Fantastic Beasts The Crimes of Grindelwald`, year: 2018 },
      rootA.id
    )
    assert.equal(result?.id, mv.id)
  })

  test('matches with year ±1 tolerance', async ({ assert }) => {
    const mv = await track(
      await MovieFactory.create({
        title: `${TEST_PREFIX}YearDriftMovie`,
        year: 2018,
        requested: true,
      })
    )
    // No rootFolderId — so we exercise the wider DB pass that allows ±1
    const result = await scanner.findExistingMovie(
      { title: `${TEST_PREFIX}YearDriftMovie`, year: 2019 },
      rootA.id
    )
    assert.equal(result?.id, mv.id)
  })

  test('rejects mismatched titles even with same year', async ({ assert }) => {
    const mv = await track(
      await MovieFactory.create({
        title: `${TEST_PREFIX}DifferentMovieAlpha`,
        year: 2018,
        requested: true,
      })
    )
    mv.rootFolderId = rootA.id
    await mv.save()

    const result = await scanner.findExistingMovie(
      { title: `${TEST_PREFIX}TotallyUnrelatedTitle`, year: 2018 },
      rootA.id
    )
    assert.isNull(result)
  })

  test('returns null when neither title nor year are in library', async ({ assert }) => {
    const result = await scanner.findExistingMovie(
      { title: `${TEST_PREFIX}NeverSeenTitle`, year: 1995 },
      rootA.id
    )
    assert.isNull(result)
  })

  test('prefers same-folder match over cross-folder one', async ({ assert }) => {
    const movieInB = await track(
      await MovieFactory.create({
        title: `${TEST_PREFIX}AmbiguousTitle`,
        year: 2015,
      })
    )
    movieInB.rootFolderId = rootB.id
    await movieInB.save()

    const movieInA = await track(
      await MovieFactory.create({
        title: `${TEST_PREFIX}AmbiguousTitle`,
        year: 2015,
      })
    )
    movieInA.rootFolderId = rootA.id
    await movieInA.save()

    const result = await scanner.findExistingMovie(
      { title: `${TEST_PREFIX}AmbiguousTitle`, year: 2015 },
      rootA.id
    )
    assert.equal(result?.id, movieInA.id)
  })
})
