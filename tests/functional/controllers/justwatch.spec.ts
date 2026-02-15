import { test } from '@japa/runner'
import JustWatchController from '#controllers/justwatch_controller'
import AppSetting from '#models/app_setting'
import { justwatchService } from '#services/metadata/justwatch_service'

test.group('JustWatchController', (group) => {
  let originalGetStreamingAvailability: typeof justwatchService.getStreamingAvailability

  group.setup(async () => {
    originalGetStreamingAvailability =
      justwatchService.getStreamingAvailability.bind(justwatchService)
  })

  group.teardown(async () => {
    justwatchService.getStreamingAvailability = originalGetStreamingAvailability
    // Clean up any test settings
    await AppSetting.query().where('key', 'justwatchEnabled').delete()
  })

  // ---- streamingAvailability ----

  test('streamingAvailability returns badRequest when title is missing', async ({ assert }) => {
    const controller = new JustWatchController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.streamingAvailability({
      request: {
        input: (key: string) => {
          if (key === 'year') return '2024'
          if (key === 'contentType') return 'movie'
          return undefined
        },
      },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        json() {},
      },
    } as never)

    assert.equal(badRequestResult.error, 'title, year, and contentType are required')
  })

  test('streamingAvailability returns badRequest when year is missing', async ({ assert }) => {
    const controller = new JustWatchController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.streamingAvailability({
      request: {
        input: (key: string) => {
          if (key === 'title') return 'Inception'
          if (key === 'contentType') return 'movie'
          return undefined
        },
      },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        json() {},
      },
    } as never)

    assert.equal(badRequestResult.error, 'title, year, and contentType are required')
  })

  test('streamingAvailability returns badRequest when contentType is missing', async ({
    assert,
  }) => {
    const controller = new JustWatchController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.streamingAvailability({
      request: {
        input: (key: string) => {
          if (key === 'title') return 'Inception'
          if (key === 'year') return '2010'
          return undefined
        },
      },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        json() {},
      },
    } as never)

    assert.equal(badRequestResult.error, 'title, year, and contentType are required')
  })

  test('streamingAvailability returns empty offers when justwatch is disabled', async ({
    assert,
  }) => {
    // Ensure justwatch is disabled
    await AppSetting.set('justwatchEnabled', false)

    const controller = new JustWatchController()
    let result: Record<string, unknown> = {}

    await controller.streamingAvailability({
      request: {
        input: (key: string) => {
          if (key === 'title') return 'Inception'
          if (key === 'year') return '2010'
          if (key === 'contentType') return 'movie'
          return undefined
        },
      },
      response: {
        badRequest() {},
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'offers')
    assert.deepEqual(result.offers, [])
  })

  test('streamingAvailability returns offers when justwatch is enabled', async ({ assert }) => {
    // Enable justwatch
    await AppSetting.set('justwatchEnabled', true)

    // Mock the service
    justwatchService.getStreamingAvailability = async (
      _title: string,
      _year: number,
      _contentType: 'movie' | 'show'
    ) => [
      {
        monetizationType: 'flatrate' as const,
        providerId: 8,
        providerName: 'Netflix',
        providerIconUrl: 'https://example.com/netflix.png',
        presentationType: 'hd',
        url: 'https://www.netflix.com/title/123',
      },
      {
        monetizationType: 'rent' as const,
        providerId: 2,
        providerName: 'Apple TV',
        providerIconUrl: 'https://example.com/appletv.png',
        presentationType: '4k',
        url: 'https://tv.apple.com/movie/123',
        retailPrice: 3.99,
        currency: 'USD',
      },
    ]

    const controller = new JustWatchController()
    let result: Record<string, unknown> = {}

    await controller.streamingAvailability({
      request: {
        input: (key: string) => {
          if (key === 'title') return 'Inception'
          if (key === 'year') return '2010'
          if (key === 'contentType') return 'movie'
          return undefined
        },
      },
      response: {
        badRequest() {},
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'offers')
    const offers = result.offers as any[]
    assert.equal(offers.length, 2)
    assert.equal(offers[0].providerName, 'Netflix')
    assert.equal(offers[0].monetizationType, 'flatrate')
    assert.equal(offers[1].providerName, 'Apple TV')
    assert.equal(offers[1].retailPrice, 3.99)
  })

  test('streamingAvailability returns empty offers when service returns none', async ({
    assert,
  }) => {
    await AppSetting.set('justwatchEnabled', true)

    // Mock returning empty
    justwatchService.getStreamingAvailability = async () => []

    const controller = new JustWatchController()
    let result: Record<string, unknown> = {}

    await controller.streamingAvailability({
      request: {
        input: (key: string) => {
          if (key === 'title') return 'NonExistent Movie'
          if (key === 'year') return '2099'
          if (key === 'contentType') return 'movie'
          return undefined
        },
      },
      response: {
        badRequest() {},
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'offers')
    assert.deepEqual(result.offers, [])
  })
})
