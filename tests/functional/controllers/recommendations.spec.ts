import { test } from '@japa/runner'
import RecommendationsController from '#controllers/recommendations_controller'
import { recommendationService } from '#services/metadata/recommendation_service'
import type { RecommendationLane } from '#services/metadata/recommendation_service'

test.group('RecommendationsController', (group) => {
  let originalGetMovieLanes: typeof recommendationService.getMovieRecommendationLanes
  let originalGetTvLanes: typeof recommendationService.getTvRecommendationLanes

  group.setup(async () => {
    originalGetMovieLanes =
      recommendationService.getMovieRecommendationLanes.bind(recommendationService)
    originalGetTvLanes =
      recommendationService.getTvRecommendationLanes.bind(recommendationService)

    // Clear recommendation cache to avoid stale data
    recommendationService.clearCache()
  })

  group.teardown(async () => {
    recommendationService.getMovieRecommendationLanes = originalGetMovieLanes
    recommendationService.getTvRecommendationLanes = originalGetTvLanes
    recommendationService.clearCache()
  })

  // ---- movies ----

  test('movies returns enriched recommendation lanes', async ({ assert }) => {
    const mockLanes: RecommendationLane[] = [
      {
        key: 'test-trending',
        label: 'Trending Movies',
        source: 'tmdb',
        items: [
          {
            tmdbId: 99999901,
            title: 'Test Movie One',
            year: 2024,
            overview: 'A test movie',
            posterUrl: '/poster1.jpg',
            rating: 7.5,
            genres: ['Action'],
          },
          {
            tmdbId: 99999902,
            title: 'Test Movie Two',
            year: 2023,
            overview: 'Another test movie',
            posterUrl: '/poster2.jpg',
            rating: 8.0,
            genres: ['Drama'],
          },
        ],
      },
    ]

    recommendationService.getMovieRecommendationLanes = async (_source?: string) => mockLanes

    const controller = new RecommendationsController()
    let result: Record<string, unknown> = {}

    await controller.movies({
      request: {
        qs: () => ({}),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'lanes')
    const lanes = result.lanes as any[]
    assert.equal(lanes.length, 1)
    assert.equal(lanes[0].key, 'test-trending')
    assert.equal(lanes[0].label, 'Trending Movies')
    assert.equal(lanes[0].items.length, 2)

    // Verify enrichment fields are present
    const item = lanes[0].items[0]
    assert.property(item, 'inLibrary')
    assert.property(item, 'hasFile')
    assert.equal(item.tmdbId, 99999901)
    assert.equal(item.title, 'Test Movie One')
    // Items with non-existent tmdbIds should not be in library
    assert.equal(item.inLibrary, false)
    assert.equal(item.hasFile, false)
  })

  test('movies passes source query parameter to service', async ({ assert }) => {
    let capturedSource: string | undefined

    recommendationService.getMovieRecommendationLanes = async (source?: string) => {
      capturedSource = source
      return []
    }

    const controller = new RecommendationsController()

    await controller.movies({
      request: {
        qs: () => ({ source: 'trakt' }),
      },
      response: {
        json() {},
      },
    } as never)

    assert.equal(capturedSource, 'trakt')
  })

  test('movies returns empty lanes when no recommendations', async ({ assert }) => {
    recommendationService.getMovieRecommendationLanes = async () => []

    const controller = new RecommendationsController()
    let result: Record<string, unknown> = {}

    await controller.movies({
      request: {
        qs: () => ({}),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'lanes')
    const lanes = result.lanes as any[]
    assert.equal(lanes.length, 0)
  })

  test('movies returns multiple lanes from different sources', async ({ assert }) => {
    const mockLanes: RecommendationLane[] = [
      {
        key: 'trakt-trending',
        label: 'Trending on Trakt',
        source: 'trakt',
        items: [
          {
            tmdbId: 99999903,
            title: 'Trakt Movie',
            year: 2024,
            overview: '',
            posterUrl: null,
            rating: 6.0,
            genres: [],
          },
        ],
      },
      {
        key: 'justwatch-popular',
        label: 'Popular Streaming',
        source: 'justwatch',
        items: [
          {
            tmdbId: 99999904,
            title: 'Streaming Movie',
            year: 2023,
            overview: '',
            posterUrl: null,
            rating: 7.0,
            genres: [],
          },
        ],
      },
    ]

    recommendationService.getMovieRecommendationLanes = async () => mockLanes

    const controller = new RecommendationsController()
    let result: Record<string, unknown> = {}

    await controller.movies({
      request: {
        qs: () => ({}),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const lanes = result.lanes as any[]
    assert.equal(lanes.length, 2)
    assert.equal(lanes[0].source, 'trakt')
    assert.equal(lanes[1].source, 'justwatch')
  })

  // ---- tv ----

  test('tv returns enriched recommendation lanes', async ({ assert }) => {
    const mockLanes: RecommendationLane[] = [
      {
        key: 'test-trending-tv',
        label: 'Trending TV Shows',
        source: 'tmdb',
        items: [
          {
            tmdbId: 99999905,
            title: 'Test Show One',
            year: 2024,
            overview: 'A test show',
            posterUrl: '/poster3.jpg',
            rating: 8.5,
            genres: ['Sci-Fi'],
          },
        ],
      },
    ]

    recommendationService.getTvRecommendationLanes = async (_source?: string) => mockLanes

    const controller = new RecommendationsController()
    let result: Record<string, unknown> = {}

    await controller.tv({
      request: {
        qs: () => ({}),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'lanes')
    const lanes = result.lanes as any[]
    assert.equal(lanes.length, 1)
    assert.equal(lanes[0].key, 'test-trending-tv')
    assert.equal(lanes[0].items.length, 1)

    // Verify enrichment fields
    const item = lanes[0].items[0]
    assert.property(item, 'inLibrary')
    assert.equal(item.inLibrary, false)
    assert.equal(item.tmdbId, 99999905)
    assert.equal(item.title, 'Test Show One')
  })

  test('tv passes source query parameter to service', async ({ assert }) => {
    let capturedSource: string | undefined

    recommendationService.getTvRecommendationLanes = async (source?: string) => {
      capturedSource = source
      return []
    }

    const controller = new RecommendationsController()

    await controller.tv({
      request: {
        qs: () => ({ source: 'justwatch' }),
      },
      response: {
        json() {},
      },
    } as never)

    assert.equal(capturedSource, 'justwatch')
  })

  test('tv returns empty lanes when no recommendations', async ({ assert }) => {
    recommendationService.getTvRecommendationLanes = async () => []

    const controller = new RecommendationsController()
    let result: Record<string, unknown> = {}

    await controller.tv({
      request: {
        qs: () => ({}),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'lanes')
    const lanes = result.lanes as any[]
    assert.equal(lanes.length, 0)
  })
})
