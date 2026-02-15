import { test } from '@japa/runner'
import TvShow from '#models/tv_show'
import Season from '#models/season'
import Episode from '#models/episode'
import TvShowsController from '#controllers/tv_shows_controller'
import { TvShowFactory } from '../../../database/factories/tv_show_factory.js'
import { SeasonFactory } from '../../../database/factories/season_factory.js'
import { EpisodeFactory } from '../../../database/factories/episode_factory.js'

test.group('TvShowsController', (group) => {
  let show1: TvShow
  let show2: TvShow
  let season1: Season

  group.setup(async () => {
    show1 = await TvShowFactory.create({
      title: 'TvShows Test Alpha',
      year: 2020,
      tmdbId: '88801',
      requested: true,
      monitored: true,
      seasonCount: 2,
      episodeCount: 10,
    })
    show2 = await TvShowFactory.create({
      title: 'TvShows Test Beta',
      year: 2021,
      tmdbId: '88802',
      requested: false,
      monitored: false,
    })

    season1 = await SeasonFactory.create({
      tvShowId: show1.id,
      seasonNumber: 1,
      title: 'Season 1',
      episodeCount: 5,
      requested: true,
    })

    await EpisodeFactory.create({
      tvShowId: show1.id,
      seasonId: season1.id,
      seasonNumber: 1,
      episodeNumber: 1,
      title: 'Pilot',
      requested: true,
      hasFile: false,
    })
  })

  group.teardown(async () => {
    // Clean up in reverse order of dependencies
    await Episode.query().where('tvShowId', show1.id).delete()
    await Season.query().where('tvShowId', show1.id).delete()
    await TvShow.query().whereIn('id', [show1.id, show2.id]).delete()
    await TvShow.query().where('title', 'like', 'TvShows Test%').delete()
  })

  // ---- index ----

  test('index returns list of tv shows', async ({ assert }) => {
    const controller = new TvShowsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isTrue(result.length >= 2)
    const titles = result.map((s: any) => s.title)
    assert.include(titles, 'TvShows Test Alpha')
    assert.include(titles, 'TvShows Test Beta')
  })

  test('index returns expected show shape', async ({ assert }) => {
    const controller = new TvShowsController()
    let result: unknown[] = []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const show = result.find((s: any) => s.id === show1.id) as Record<string, unknown>
    assert.isNotNull(show)
    assert.equal(show.title, 'TvShows Test Alpha')
    assert.equal(show.year, 2020)
    assert.equal(show.tmdbId, '88801')
    assert.equal(show.requested, true)
    assert.equal(show.seasonCount, 2)
  })

  // ---- show ----

  test('show returns tv show details with seasons', async ({ assert }) => {
    const controller = new TvShowsController()
    let result: Record<string, unknown> = {}

    await controller.show({
      params: { id: show1.id },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.id, show1.id)
    assert.equal(result.title, 'TvShows Test Alpha')
    assert.equal(result.tmdbId, '88801')
    assert.isArray(result.seasons)
    const seasons = result.seasons as unknown[]
    assert.isTrue(seasons.length >= 1)
  })

  test('show returns notFound for non-existent show', async ({ assert }) => {
    const controller = new TvShowsController()
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

    assert.equal(notFoundResult.error, 'TV show not found')
  })

  // ---- showSeason ----

  test('showSeason returns season details with episodes', async ({ assert }) => {
    const controller = new TvShowsController()
    let result: Record<string, unknown> = {}

    await controller.showSeason({
      params: { id: show1.id, seasonNumber: 1 },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        notFound() {},
      },
    } as never)

    assert.equal(result.seasonNumber, 1)
    assert.equal(result.title, 'Season 1')
    assert.isArray(result.episodes)
    const episodes = result.episodes as unknown[]
    assert.isTrue(episodes.length >= 1)
  })

  test('showSeason returns notFound for non-existent season', async ({ assert }) => {
    const controller = new TvShowsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.showSeason({
      params: { id: show1.id, seasonNumber: 99 },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'Season not found')
  })

  // ---- update ----

  test('update modifies tv show properties', async ({ assert }) => {
    const controller = new TvShowsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      params: { id: show2.id },
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

    assert.equal(result.id, show2.id)
    assert.equal(result.requested, true)
    assert.equal(result.monitored, true)

    // Verify in database
    await show2.refresh()
    assert.equal(show2.requested, true)

    // Reset
    show2.requested = false
    show2.monitored = false
    await show2.save()
  })

  test('update returns notFound for non-existent show', async ({ assert }) => {
    const controller = new TvShowsController()
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

    assert.equal(notFoundResult.error, 'TV show not found')
  })

  // ---- destroy ----

  test('destroy deletes a tv show', async ({ assert }) => {
    const toDelete = await TvShowFactory.create({
      title: 'TvShows Test Destroy',
      year: 2023,
    })

    const controller = new TvShowsController()
    let noContentCalled = false

    await controller.destroy({
      params: { id: toDelete.id },
      response: {
        noContent() {
          noContentCalled = true
        },
        notFound() {},
      },
    } as never)

    assert.isTrue(noContentCalled)

    const deleted = await TvShow.find(toDelete.id)
    assert.isNull(deleted)
  })

  test('destroy returns notFound for non-existent show', async ({ assert }) => {
    const controller = new TvShowsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        noContent() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(notFoundResult.error, 'TV show not found')
  })

  // ---- store ----

  test('store creates a new tv show without tmdbId', async ({ assert }) => {
    const controller = new TvShowsController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    await controller.store({
      request: {
        validateUsing: async () => ({
          title: 'TvShows Test New Show',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
          requested: true,
          monitored: false,
          searchOnAdd: false,
        }),
      },
      response: {
        created(data: unknown) {
          statusCode = 201
          result = data as Record<string, unknown>
        },
        conflict() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.equal(result.title, 'TvShows Test New Show')
    assert.isNotNull(result.id)

    // Cleanup
    if (result.id) {
      await TvShow.query().where('id', result.id as string).delete()
    }
  })

  test('store returns conflict for duplicate tmdbId', async ({ assert }) => {
    const controller = new TvShowsController()
    let conflictResult: Record<string, unknown> = {}

    await controller.store({
      request: {
        validateUsing: async () => ({
          tmdbId: '88801',
          title: 'Duplicate Show',
          rootFolderId: '00000000-0000-0000-0000-000000000001',
        }),
      },
      response: {
        created() {},
        conflict(data: unknown) {
          conflictResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.equal(conflictResult.error, 'TV show already in library')
  })

  // ---- setEpisodeWanted ----

  test('setEpisodeWanted sets episode as requested', async ({ assert }) => {
    const ep = await EpisodeFactory.create({
      tvShowId: show1.id,
      seasonId: season1.id,
      seasonNumber: 1,
      episodeNumber: 2,
      title: 'Episode 2',
      requested: false,
      hasFile: false,
    })

    const controller = new TvShowsController()
    let result: Record<string, unknown> = {}

    await controller.setEpisodeWanted({
      params: { id: show1.id, episodeId: ep.id },
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

    await ep.delete()
  })

  test('setEpisodeWanted returns notFound for non-existent episode', async ({ assert }) => {
    const controller = new TvShowsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.setEpisodeWanted({
      params: { id: show1.id, episodeId: '00000000-0000-0000-0000-000000000000' },
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

    assert.equal(notFoundResult.error, 'Episode not found')
  })

  // ---- search ----

  test('search returns badRequest when query is empty', async ({ assert }) => {
    const controller = new TvShowsController()
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

  // ---- enrich ----

  test('enrich returns badRequest when show already has tmdbId', async ({ assert }) => {
    const controller = new TvShowsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.enrich({
      params: { id: show1.id },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.include(badRequestResult.error as string, 'already has a TMDB ID')
  })

  test('enrich returns notFound for non-existent show', async ({ assert }) => {
    const controller = new TvShowsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.enrich({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'TV show not found')
  })

  // ---- refresh ----

  test('refresh returns notFound for non-existent show', async ({ assert }) => {
    const controller = new TvShowsController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.refresh({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
        internalServerError() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'TV show not found')
  })

  test('refresh returns badRequest when show has no tmdbId', async ({ assert }) => {
    const noTmdbShow = await TvShowFactory.create({
      title: 'TvShows Test No TMDB',
      tmdbId: null,
    })

    const controller = new TvShowsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.refresh({
      params: { id: noTmdbShow.id },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        internalServerError() {},
      },
    } as never)

    assert.include(badRequestResult.error as string, 'no TMDB ID')

    await noTmdbShow.delete()
  })

  // ---- preview ----

  test('preview returns badRequest when tmdbId is missing', async ({ assert }) => {
    const controller = new TvShowsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.preview({
      request: {
        input: () => undefined,
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'tmdbId is required')
  })

  // ---- previewSeasons ----

  test('previewSeasons returns badRequest when tmdbId is missing', async ({ assert }) => {
    const controller = new TvShowsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.previewSeasons({
      request: {
        input: () => undefined,
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'tmdbId is required')
  })

  // ---- previewEpisodes ----

  test('previewEpisodes returns badRequest when tmdbId or seasonNumber is missing', async ({
    assert,
  }) => {
    const controller = new TvShowsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.previewEpisodes({
      request: {
        input: () => undefined,
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'tmdbId and seasonNumber are required')
  })
})
