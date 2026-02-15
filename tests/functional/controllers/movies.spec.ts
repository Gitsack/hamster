import { test } from '@japa/runner'
import Movie from '#models/movie'
import MoviesController from '#controllers/movies_controller'
import { MovieFactory } from '../../../database/factories/movie_factory.js'

test.group('MoviesController', (group) => {
  let movie1: Movie
  let movie2: Movie

  group.setup(async () => {
    movie1 = await MovieFactory.create({
      title: 'Movies Test Alpha',
      year: 2020,
      tmdbId: '99901',
      requested: true,
      hasFile: false,
    })
    movie2 = await MovieFactory.create({
      title: 'Movies Test Beta',
      year: 2021,
      tmdbId: '99902',
      requested: false,
      hasFile: false,
    })
  })

  group.teardown(async () => {
    await Movie.query().whereIn('id', [movie1.id, movie2.id]).delete()
    await Movie.query().where('title', 'like', 'Movies Test%').delete()
  })

  // ---- index ----

  test('index returns list of movies', async ({ assert }) => {
    const controller = new MoviesController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const titles = result.map((m: any) => m.title)
    assert.include(titles, 'Movies Test Alpha')
    assert.include(titles, 'Movies Test Beta')
  })

  test('index returns expected movie shape', async ({ assert }) => {
    const controller = new MoviesController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const movie = result.find((m: any) => m.id === movie1.id) as Record<string, unknown>
    assert.isNotNull(movie)
    assert.equal(movie.title, 'Movies Test Alpha')
    assert.equal(movie.year, 2020)
    assert.equal(movie.tmdbId, '99901')
    assert.equal(movie.requested, true)
    assert.equal(movie.hasFile, false)
  })

  // ---- show ----

  test('show returns movie details', async ({ assert }) => {
    const controller = new MoviesController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: movie1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, movie1.id)
    assert.equal(result.title, 'Movies Test Alpha')
    assert.equal(result.year, 2020)
    assert.equal(result.tmdbId, '99901')
  })

  test('show returns notFound for non-existent movie', async ({ assert }) => {
    const controller = new MoviesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.show({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Movie not found')
  })

  // ---- update ----

  test('update modifies movie properties', async ({ assert }) => {
    const controller = new MoviesController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: movie2.id },
      request: {
        only: () => ({ requested: true, monitored: true }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, movie2.id)
    assert.equal(result.requested, true)
    assert.equal(result.monitored, true)

    // Verify in database
    await movie2.refresh()
    assert.equal(movie2.requested, true)

    // Reset
    movie2.requested = false
    movie2.monitored = false
    await movie2.save()
  })

  test('update returns notFound for non-existent movie', async ({ assert }) => {
    const controller = new MoviesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.update({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        only: () => ({ requested: true }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Movie not found')
  })

  // ---- destroy ----

  test('destroy deletes a movie', async ({ assert }) => {
    const toDelete = await MovieFactory.create({
      title: 'Movies Test Destroy',
      year: 2023,
    })

    const controller = new MoviesController()
    let result: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: toDelete.id },
      request: {
        input: () => 'false',
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.deleted, true)
    assert.equal(result.id, toDelete.id)

    const deleted = await Movie.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent movie', async ({ assert }) => {
    const controller = new MoviesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        input: () => 'false',
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Movie not found')
  })

  // ---- store ----

  test('store creates a new movie without tmdbId', async ({ assert }) => {
    const controller = new MoviesController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          title: 'Movies Test New Movie',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
          requested: true,
          monitored: false,
          searchOnAdd: false,
        }),
        body: () => ({}),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
        unprocessableEntity() {},
        conflict() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.title, 'Movies Test New Movie')
    assert.isNotNull(result.id)

    // Cleanup
    if (result.id) {
      await Movie.query().where('id', result.id as string).delete()
    }
  })

  test('store returns conflict for duplicate tmdbId', async ({ assert }) => {
    const controller = new MoviesController()
    let conflictResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          tmdbId: '99901',
          title: 'Duplicate Movie',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
        }),
        body: () => ({}),
      },
      response: {
        created() {},
        unprocessableEntity() {},
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.equal(conflictResult.error, 'Movie already in library')
  })

  // ---- setWanted ----

  test('setWanted sets movie as requested', async ({ assert }) => {
    const wantedMovie = await MovieFactory.create({
      title: 'Movies Test Wanted',
      requested: false,
      hasFile: false,
    })

    const controller = new MoviesController()
    let result: Record<string, unknown> = {}

    await controller.setWanted({
      params: { id: wantedMovie.id },
      request: {
        only: () => ({ requested: true }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
        badRequest() {},
      },
    } as never)

    assert.equal(result.requested, true)

    await wantedMovie.delete()
  })

  test('setWanted deletes unrequested movie without file', async ({ assert }) => {
    const unwantedMovie = await MovieFactory.create({
      title: 'Movies Test Unwanted',
      requested: true,
      hasFile: false,
    })
    const movieId = unwantedMovie.id

    const controller = new MoviesController()
    let result: Record<string, unknown> = {}

    await controller.setWanted({
      params: { id: movieId },
      request: {
        only: () => ({ requested: false }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
        badRequest() {},
      },
    } as never)

    assert.equal(result.deleted, true)

    const deleted = await Movie.find(movieId)
    assert.isNull(deleted)
  })

  test('setWanted returns badRequest when unrequesting movie with file', async ({ assert }) => {
    const movieWithFile = await MovieFactory.create({
      title: 'Movies Test WithFile',
      requested: true,
      hasFile: true,
    })

    const controller = new MoviesController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.setWanted({
      params: { id: movieWithFile.id },
      request: {
        only: () => ({ requested: false }),
      },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.hasFile, true)

    await movieWithFile.delete()
  })

  test('setWanted returns notFound for non-existent movie', async ({ assert }) => {
    const controller = new MoviesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.setWanted({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        only: () => ({ requested: true }),
      },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Movie not found')
  })

  // ---- search ----

  test('search returns badRequest when query is empty', async ({ assert }) => {
    const controller = new MoviesController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.search({
      request: {
        input: (key: string, defaultVal: string) => (key === 'q' ? '' : defaultVal),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Search query is required')
  })
})
