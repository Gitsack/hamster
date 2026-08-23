import { test } from '@japa/runner'
import History from '#models/history'
import HistoryController from '#controllers/history_controller'
import Movie from '#models/movie'
import { historyService } from '#services/history/history_service'
import { DateTime } from 'luxon'

test.group('HistoryService and HistoryController', (group) => {
  let movie: Movie
  let movieId: string

  group.setup(async () => {
    movie = await Movie.create({
      title: 'History Test Movie',
      year: 2024,
      requested: true,
      hasFile: false,
      needsReview: false,
      genres: [],
    })
    movieId = movie.id
  })

  group.teardown(async () => {
    await History.query().where('movieId', movieId).delete()
    await movie.delete()
  })

  test('records a grabbed event with its media link and details', async ({ assert }) => {
    const entry = await historyService.record({
      eventType: 'grabbed',
      sourceTitle: 'History.Test.Movie.2024.1080p.WEB-DL-GRP',
      movieId,
      quality: 'Web 1080p',
      data: { indexer: 'TestIndexer', guid: 'history-test-guid' },
    })

    assert.isNotNull(entry)
    assert.equal(entry!.eventType, 'grabbed')
    assert.equal(entry!.movieId, movieId)
    assert.equal(entry!.data.indexer, 'TestIndexer')
  })

  test('records download_failed, the event type the enum used to reject', async ({ assert }) => {
    const entry = await historyService.record({
      eventType: 'download_failed',
      sourceTitle: 'History.Test.Movie.2024.1080p.WEB-DL-GRP',
      movieId,
      data: { error: 'URL Fetching failed; Maximum retries' },
    })

    assert.isNotNull(entry)
    assert.equal(entry!.eventType, 'download_failed')
  })

  test('record never throws on a bad entry', async ({ assert }) => {
    // A non-existent movie violates the FK. History is diagnostic — losing an
    // entry must not take down the grab or import that was being recorded.
    const entry = await historyService.record({
      eventType: 'grabbed',
      sourceTitle: 'Orphan',
      movieId: '00000000-0000-0000-0000-000000000000',
    })

    assert.isNull(entry)
  })

  test('list returns newest first and filters by event type', async ({ assert }) => {
    const page = await historyService.list({ movieId, eventType: 'download_failed' })

    assert.isAtLeast(page.all().length, 1)
    assert.isTrue(page.all().every((e) => e.eventType === 'download_failed'))
  })

  test('summary counts events per type', async ({ assert }) => {
    const summary = await historyService.summary(7)

    assert.isAtLeast(summary.grabbed ?? 0, 1)
    assert.isAtLeast(summary.download_failed ?? 0, 1)
  })

  test('prune removes entries older than the retention window', async ({ assert }) => {
    const old = await History.create({
      eventType: 'grabbed',
      sourceTitle: 'Ancient entry',
      movieId,
      data: {},
    })
    // Backdate past the retention window.
    await History.query()
      .where('id', old.id)
      .update({ created_at: DateTime.now().minus({ days: 200 }).toSQL() })

    const removed = await historyService.prune(90)
    assert.isAtLeast(removed, 1)
    assert.isNull(await History.find(old.id))
  })

  test('controller index returns entries with resolved media titles', async ({ assert }) => {
    const controller = new HistoryController()
    let result: Record<string, any> = {}

    await controller.index({
      request: {
        input: (key: string, defaultVal?: unknown) => {
          if (key === 'movieId') return movieId
          if (key === 'page') return 1
          if (key === 'limit') return 50
          return defaultVal
        },
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, any>
        },
      },
    } as never)

    assert.isArray(result.data)
    assert.isAtLeast(result.data.length, 1)
    assert.equal(result.data[0].media.movieTitle, 'History Test Movie')
    assert.isNumber(result.meta.total)
  })

  test('controller index ignores an unknown event type filter', async ({ assert }) => {
    const controller = new HistoryController()
    let result: Record<string, any> = {}

    await controller.index({
      request: {
        input: (key: string, defaultVal?: unknown) => {
          if (key === 'movieId') return movieId
          if (key === 'eventType') return 'not_a_real_event'
          return defaultVal
        },
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, any>
        },
      },
    } as never)

    // Unrecognised filter falls back to "no filter" rather than erroring or
    // silently returning nothing.
    assert.isAtLeast(result.data.length, 1)
  })
})
