import { test } from '@japa/runner'
import PlaybackSettingsController from '#controllers/playback_settings_controller'
import AppSetting from '#models/app_setting'

test.group('PlaybackSettingsController', (group) => {
  group.teardown(async () => {
    // Clean up test settings
    await AppSetting.query().where('key', 'transcodingSettings').delete()
  })

  // ---- index ----

  test('index returns playback settings with expected shape', async ({ assert }) => {
    const controller = new PlaybackSettingsController()
    let result: Record<string, unknown> = {}

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'transcoding')
    assert.property(result, 'availableHardwareAccel')
    assert.isArray(result.availableHardwareAccel)
  })

  test('index returns transcoding settings with expected fields', async ({ assert }) => {
    const controller = new PlaybackSettingsController()
    let result: Record<string, unknown> = {}

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const transcoding = result.transcoding as Record<string, unknown>
    assert.isNotNull(transcoding)
    assert.isObject(transcoding)
  })

  test('index returns valid hardware accel types', async ({ assert }) => {
    const controller = new PlaybackSettingsController()
    let result: Record<string, unknown> = {}

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const validTypes = ['videotoolbox', 'cuda', 'qsv', 'vaapi']
    const available = result.availableHardwareAccel as string[]
    for (const hwType of available) {
      assert.include(validTypes, hwType)
    }
  })

  // ---- update ----

  test('update returns badRequest for invalid hardware acceleration type', async ({ assert }) => {
    const controller = new PlaybackSettingsController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.update({
      request: {
        only: () => ({
          transcoding: { hardwareAccelType: 'invalid_type' },
        }),
      },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        json() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('update accepts valid hardware acceleration type', async ({ assert }) => {
    const controller = new PlaybackSettingsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        only: () => ({
          transcoding: { hardwareAccelType: 'none' },
        }),
      },
      response: {
        badRequest() {},
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'transcoding')
    assert.property(result, 'availableHardwareAccel')
  })

  test('update persists settings to database', async ({ assert }) => {
    const controller = new PlaybackSettingsController()

    await controller.update({
      request: {
        only: () => ({
          transcoding: { hardwareAccelType: 'auto' },
        }),
      },
      response: {
        badRequest() {},
        json() {},
      },
    } as never)

    const stored = await AppSetting.get<Record<string, unknown>>('transcodingSettings')
    assert.isNotNull(stored)
  })

  test('update without transcoding still returns settings', async ({ assert }) => {
    const controller = new PlaybackSettingsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        only: () => ({ transcoding: undefined }),
      },
      response: {
        badRequest() {},
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'transcoding')
    assert.property(result, 'availableHardwareAccel')
  })

  test('update accepts videotoolbox hardware acceleration', async ({ assert }) => {
    const controller = new PlaybackSettingsController()
    let result: Record<string, unknown> = {}

    await controller.update({
      request: {
        only: () => ({
          transcoding: { hardwareAccelType: 'videotoolbox' },
        }),
      },
      response: {
        badRequest() {},
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'transcoding')
    const transcoding = result.transcoding as Record<string, unknown>
    assert.equal(transcoding.hardwareAccelType, 'videotoolbox')
  })
})
