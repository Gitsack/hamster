import { test } from '@japa/runner'
import AppSetting from '#models/app_setting'
import AppSettingsController from '#controllers/app_settings_controller'

test.group('AppSettingsController', (group) => {
  const testKeys = [
    'enabledMediaTypes',
    'tmdbApiKey',
    'traktClientId',
    'recommendationSettings',
    'justwatchEnabled',
    'justwatchLocale',
    'selectedStreamingProviders',
    'namingPatterns',
  ]

  group.teardown(async () => {
    // Clean up test settings we may have created
    await AppSetting.query().whereIn('key', testKeys).delete()
  })

  // ---- index ----

  test('index returns app settings with expected shape', async ({ assert }) => {
    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'enabledMediaTypes')
    assert.property(result, 'tmdbApiKey')
    assert.property(result, 'hasTmdbApiKey')
    assert.property(result, 'hasTraktClientId')
    assert.property(result, 'recommendationSettings')
    assert.property(result, 'justwatchEnabled')
    assert.property(result, 'justwatchLocale')
    assert.property(result, 'selectedStreamingProviders')
    assert.isArray(result.enabledMediaTypes)
    assert.isBoolean(result.hasTmdbApiKey)
    assert.isBoolean(result.hasTraktClientId)
  })

  test('index masks tmdbApiKey when set', async ({ assert }) => {
    await AppSetting.set('tmdbApiKey', 'my-secret-api-key-12345')

    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.tmdbApiKey, '********')
    assert.isTrue(result.hasTmdbApiKey as boolean)

    // Cleanup
    await AppSetting.query().where('key', 'tmdbApiKey').delete()
  })

  test('index returns empty string for tmdbApiKey when not set', async ({ assert }) => {
    await AppSetting.query().where('key', 'tmdbApiKey').delete()

    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.tmdbApiKey, '')
    assert.isFalse(result.hasTmdbApiKey as boolean)
  })

  // ---- update ----

  test('update sets enabledMediaTypes', async ({ assert }) => {
    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        only: () => ({
          enabledMediaTypes: ['movies', 'music'],
          tmdbApiKey: undefined,
          traktClientId: undefined,
          recommendationSettings: undefined,
          justwatchEnabled: undefined,
          justwatchLocale: undefined,
          selectedStreamingProviders: undefined,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const types = result.enabledMediaTypes as string[]
    assert.includeMembers(types, ['movies', 'music'])
  })

  test('update does not overwrite tmdbApiKey when value is masked', async ({ assert }) => {
    await AppSetting.set('tmdbApiKey', 'original-secret-key')

    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        only: () => ({
          enabledMediaTypes: undefined,
          tmdbApiKey: '********',
          traktClientId: undefined,
          recommendationSettings: undefined,
          justwatchEnabled: undefined,
          justwatchLocale: undefined,
          selectedStreamingProviders: undefined,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    // The key should still be masked (meaning original was preserved)
    assert.equal(result.tmdbApiKey, '********')
    assert.isTrue(result.hasTmdbApiKey as boolean)

    // Verify in DB that original key was not overwritten
    const stored = await AppSetting.get<string>('tmdbApiKey', '')
    assert.equal(stored, 'original-secret-key')

    // Cleanup
    await AppSetting.query().where('key', 'tmdbApiKey').delete()
  })

  test('update sets justwatchEnabled', async ({ assert }) => {
    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        only: () => ({
          enabledMediaTypes: undefined,
          tmdbApiKey: undefined,
          traktClientId: undefined,
          recommendationSettings: undefined,
          justwatchEnabled: true,
          justwatchLocale: undefined,
          selectedStreamingProviders: undefined,
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.isTrue(result.justwatchEnabled as boolean)
  })

  test('update sets selectedStreamingProviders', async ({ assert }) => {
    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        only: () => ({
          enabledMediaTypes: undefined,
          tmdbApiKey: undefined,
          traktClientId: undefined,
          recommendationSettings: undefined,
          justwatchEnabled: undefined,
          justwatchLocale: undefined,
          selectedStreamingProviders: [8, 9, 337],
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const providers = result.selectedStreamingProviders as number[]
    assert.deepEqual(providers, [8, 9, 337])
  })

  // ---- toggleMediaType ----

  test('toggleMediaType enables a media type', async ({ assert }) => {
    await AppSetting.set('enabledMediaTypes', ['movies'])

    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.toggleMediaType({
      request: {
        only: () => ({ mediaType: 'music', enabled: true }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    const types = result.enabledMediaTypes as string[]
    assert.include(types, 'movies')
    assert.include(types, 'music')
  })

  test('toggleMediaType disables a media type', async ({ assert }) => {
    await AppSetting.set('enabledMediaTypes', ['movies', 'music'])

    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.toggleMediaType({
      request: {
        only: () => ({ mediaType: 'music', enabled: false }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    const types = result.enabledMediaTypes as string[]
    assert.include(types, 'movies')
    assert.notInclude(types, 'music')
  })

  test('toggleMediaType returns badRequest for invalid media type', async ({ assert }) => {
    const controller = new AppSettingsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.toggleMediaType({
      request: {
        only: () => ({ mediaType: 'invalid', enabled: true }),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Invalid media type')
  })

  test('toggleMediaType does not duplicate already enabled type', async ({ assert }) => {
    await AppSetting.set('enabledMediaTypes', ['movies', 'music'])

    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.toggleMediaType({
      request: {
        only: () => ({ mediaType: 'movies', enabled: true }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    const types = result.enabledMediaTypes as string[]
    const movieCount = types.filter((t) => t === 'movies').length
    assert.equal(movieCount, 1)
  })

  // ---- getNamingPatterns ----

  test('getNamingPatterns returns patterns with variables and examples', async ({ assert }) => {
    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.getNamingPatterns({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'patterns')
    assert.property(result, 'variables')
    assert.property(result, 'examples')

    const patterns = result.patterns as Record<string, Record<string, string>>
    assert.property(patterns, 'music')
    assert.property(patterns, 'movies')
    assert.property(patterns, 'tv')
    assert.property(patterns, 'books')

    // Verify movies patterns have expected fields
    assert.property(patterns.movies, 'movieFolder')
    assert.property(patterns.movies, 'movieFile')

    // Verify examples are generated
    const examples = result.examples as Record<string, Record<string, string>>
    assert.property(examples, 'movies')
    assert.isString(examples.movies.movieFolder)
  })

  // ---- updateNamingPatterns ----

  test('updateNamingPatterns updates patterns for a media type', async ({ assert }) => {
    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.updateNamingPatterns({
      request: {
        only: () => ({
          mediaType: 'movies',
          patterns: { movieFolder: '{movie_title} [{year}]' },
        }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    const patterns = result.patterns as Record<string, string>
    assert.equal(patterns.movieFolder, '{movie_title} [{year}]')
    assert.property(result, 'examples')
  })

  test('updateNamingPatterns returns badRequest for invalid media type', async ({ assert }) => {
    const controller = new AppSettingsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.updateNamingPatterns({
      request: {
        only: () => ({
          mediaType: 'invalid',
          patterns: { movieFolder: '{movie_title}' },
        }),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Invalid media type')
  })

  test('updateNamingPatterns returns badRequest for invalid patterns object', async ({ assert }) => {
    const controller = new AppSettingsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.updateNamingPatterns({
      request: {
        only: () => ({
          mediaType: 'movies',
          patterns: null,
        }),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Invalid patterns')
  })

  test('updateNamingPatterns returns badRequest for unknown template variables', async ({ assert }) => {
    const controller = new AppSettingsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.updateNamingPatterns({
      request: {
        only: () => ({
          mediaType: 'movies',
          patterns: { movieFolder: '{movie_title} {unknown_var}' },
        }),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Invalid patterns')
    assert.property(badRequestResult, 'details')
    const details = badRequestResult.details as Record<string, string[]>
    assert.property(details, 'movieFolder')
  })

  test('updateNamingPatterns returns badRequest for invalid field name', async ({ assert }) => {
    const controller = new AppSettingsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.updateNamingPatterns({
      request: {
        only: () => ({
          mediaType: 'movies',
          patterns: { nonExistentField: '{movie_title}' },
        }),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Invalid patterns')
    const details = badRequestResult.details as Record<string, string[]>
    assert.property(details, 'nonExistentField')
  })

  // ---- batchWatchProviders ----

  test('batchWatchProviders returns badRequest for missing tmdbIds', async ({ assert }) => {
    const controller = new AppSettingsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.batchWatchProviders({
      request: {
        only: () => ({ tmdbIds: [], type: 'movie' }),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.isString(badRequestResult.error)
  })

  test('batchWatchProviders returns badRequest for invalid type', async ({ assert }) => {
    const controller = new AppSettingsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.batchWatchProviders({
      request: {
        only: () => ({ tmdbIds: [123], type: 'invalid' }),
      },
      response: {
        json() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.isString(badRequestResult.error)
  })

  test('batchWatchProviders returns empty providers when no streaming providers selected', async ({ assert }) => {
    await AppSetting.set('selectedStreamingProviders', [])

    const controller = new AppSettingsController()
    let result: Record<string, unknown> = {}

    await controller.batchWatchProviders({
      request: {
        only: () => ({ tmdbIds: [550, 551], type: 'movie' }),
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.deepEqual(result.providers, {})
  })
})
