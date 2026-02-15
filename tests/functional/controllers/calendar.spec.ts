import { test } from '@japa/runner'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Season from '#models/season'
import Episode from '#models/episode'
import CalendarController from '#controllers/calendar_controller'
import { MovieFactory } from '../../../database/factories/movie_factory.js'
import { TvShowFactory } from '../../../database/factories/tv_show_factory.js'
import { SeasonFactory } from '../../../database/factories/season_factory.js'
import { EpisodeFactory } from '../../../database/factories/episode_factory.js'
import { DateTime } from 'luxon'

test.group('CalendarController', (group) => {
  let movie1: Movie
  let tvShow: TvShow
  let season: Season
  let episode1: Episode

  const tomorrow = DateTime.now().plus({ days: 1 })
  const nextWeek = DateTime.now().plus({ days: 7 })

  group.setup(async () => {
    movie1 = await MovieFactory.create({
      title: 'Calendar Test Movie',
      year: 2026,
      requested: true,
    })
    // Set releaseDate directly since factory may not support it
    movie1.releaseDate = tomorrow
    await movie1.save()

    tvShow = await TvShowFactory.create({
      title: 'Calendar Test Show',
      requested: true,
    })
    season = await SeasonFactory.create({
      tvShowId: tvShow.id,
      seasonNumber: 1,
    })
    episode1 = await EpisodeFactory.create({
      tvShowId: tvShow.id,
      seasonId: season.id,
      seasonNumber: 1,
      episodeNumber: 1,
      title: 'Calendar Test Episode',
      requested: true,
    })
    episode1.airDate = nextWeek
    await episode1.save()
  })

  group.teardown(async () => {
    await Episode.query().where('tvShowId', tvShow.id).delete()
    await Season.query().where('tvShowId', tvShow.id).delete()
    await TvShow.query().where('id', tvShow.id).delete()
    await Movie.query().where('id', movie1.id).delete()
  })

  // ---- index ----

  test('index returns calendar events as JSON', async ({ assert }) => {
    const controller = new CalendarController()
    let result: unknown[] = []

    const start = DateTime.now().minus({ days: 1 }).toISODate()!
    const end = DateTime.now().plus({ days: 14 }).toISODate()!

    await controller.index({
      request: {
        qs: () => ({ start, end, unmonitored: 'false' }),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isArray(result)

    // Should contain our movie
    const movieEvent = result.find((e: any) => e.uid === `movie-${movie1.id}@hamster`)
    assert.isNotNull(movieEvent)
    if (movieEvent) {
      assert.equal((movieEvent as any).mediaType, 'movie')
      assert.include((movieEvent as any).title, 'Calendar Test Movie')
    }
  })

  test('index returns episode events within date range', async ({ assert }) => {
    const controller = new CalendarController()
    let result: unknown[] = []

    const start = DateTime.now().toISODate()!
    const end = DateTime.now().plus({ days: 14 }).toISODate()!

    await controller.index({
      request: {
        qs: () => ({ start, end, unmonitored: 'false' }),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const episodeEvent = result.find((e: any) => e.uid === `episode-${episode1.id}@hamster`)
    assert.isNotNull(episodeEvent)
    if (episodeEvent) {
      assert.equal((episodeEvent as any).mediaType, 'episode')
      assert.include((episodeEvent as any).title, 'Calendar Test Show')
    }
  })

  test('index excludes unrequested items when unmonitored is false', async ({ assert }) => {
    const unrequestedMovie = await MovieFactory.create({
      title: 'Calendar Test Unrequested',
      year: 2026,
      requested: false,
    })
    unrequestedMovie.releaseDate = tomorrow
    await unrequestedMovie.save()

    const controller = new CalendarController()
    let result: unknown[] = []

    const start = DateTime.now().minus({ days: 1 }).toISODate()!
    const end = DateTime.now().plus({ days: 14 }).toISODate()!

    await controller.index({
      request: {
        qs: () => ({ start, end, unmonitored: 'false' }),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const found = result.find(
      (e: any) => e.uid === `movie-${unrequestedMovie.id}@hamster`
    )
    assert.isUndefined(found)

    await unrequestedMovie.delete()
  })

  test('index includes unrequested items when unmonitored is true', async ({ assert }) => {
    const unrequestedMovie = await MovieFactory.create({
      title: 'Calendar Test Unmon Include',
      year: 2026,
      requested: false,
    })
    unrequestedMovie.releaseDate = tomorrow
    await unrequestedMovie.save()

    const controller = new CalendarController()
    let result: unknown[] = []

    const start = DateTime.now().minus({ days: 1 }).toISODate()!
    const end = DateTime.now().plus({ days: 14 }).toISODate()!

    await controller.index({
      request: {
        qs: () => ({ start, end, unmonitored: 'true' }),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    const found = result.find(
      (e: any) => e.uid === `movie-${unrequestedMovie.id}@hamster`
    )
    assert.isNotNull(found)

    await unrequestedMovie.delete()
  })

  test('index uses default date range when no params provided', async ({ assert }) => {
    const controller = new CalendarController()
    let result: unknown[] = []

    await controller.index({
      request: {
        qs: () => ({}),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isArray(result)
  })

  test('index returns events sorted by date', async ({ assert }) => {
    const controller = new CalendarController()
    let result: unknown[] = []

    const start = DateTime.now().minus({ days: 1 }).toISODate()!
    const end = DateTime.now().plus({ days: 30 }).toISODate()!

    await controller.index({
      request: {
        qs: () => ({ start, end, unmonitored: 'true' }),
      },
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    // Verify events are sorted by startDate
    for (let i = 1; i < result.length; i++) {
      const prev = (result[i - 1] as any).startDate
      const curr = (result[i] as any).startDate
      assert.isTrue(prev <= curr)
    }
  })

  // ---- ical ----

  test('ical returns iCal formatted content', async ({ assert }) => {
    const controller = new CalendarController()
    let body: string = ''
    const headers: Record<string, string> = {}

    await controller.ical({
      request: {
        qs: () => ({ futureDays: '30', pastDays: '7', unmonitored: 'true' }),
      },
      response: {
        header(key: string, value: string) {
          headers[key] = value
        },
        send(data: unknown) {
          body = data as string
        },
      },
    } as never)

    assert.equal(headers['Content-Type'], 'text/calendar; charset=utf-8')
    assert.include(headers['Content-Disposition'], 'hamster.ics')
    assert.include(body, 'BEGIN:VCALENDAR')
    assert.include(body, 'END:VCALENDAR')
    assert.include(body, 'PRODID:-//Hamster//Media Calendar//EN')
  })

  test('ical contains movie event', async ({ assert }) => {
    const controller = new CalendarController()
    let body: string = ''

    await controller.ical({
      request: {
        qs: () => ({ futureDays: '14', pastDays: '7', unmonitored: 'true' }),
      },
      response: {
        header() {},
        send(data: unknown) {
          body = data as string
        },
      },
    } as never)

    assert.include(body, 'Calendar Test Movie')
    assert.include(body, 'CATEGORIES:Movies')
  })

  test('ical uses default query params', async ({ assert }) => {
    const controller = new CalendarController()
    let body: string = ''

    await controller.ical({
      request: {
        qs: () => ({}),
      },
      response: {
        header() {},
        send(data: unknown) {
          body = data as string
        },
      },
    } as never)

    assert.include(body, 'BEGIN:VCALENDAR')
    assert.include(body, 'END:VCALENDAR')
  })
})
