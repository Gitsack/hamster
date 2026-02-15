import { test } from '@japa/runner'
import PlaybackController from '#controllers/playback_controller'

test.group('PlaybackController', () => {
  // ---- stream ----

  test('stream returns badRequest when id is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.stream({
      params: { id: undefined },
      request: {
        header: () => undefined,
      },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        header() {},
        status() {
          return { stream() {} }
        },
        stream() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('stream returns notFound for non-existent track file', async ({ assert }) => {
    const controller = new PlaybackController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.stream({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        header: () => undefined,
      },
      response: {
        badRequest() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        header() {},
        status() {
          return { stream() {} }
        },
        stream() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- info ----

  test('info returns badRequest when id is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.info({
      params: { id: undefined },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        json() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('info returns notFound for non-existent track file', async ({ assert }) => {
    const controller = new PlaybackController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.info({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        badRequest() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        json() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- artwork ----

  test('artwork returns badRequest when id is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.artwork({
      params: { id: undefined },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        redirect() {},
        header() {},
        stream() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('artwork returns notFound for non-existent album', async ({ assert }) => {
    const controller = new PlaybackController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.artwork({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        badRequest() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        redirect() {},
        header() {},
        stream() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- albumPlaylist ----

  test('albumPlaylist returns badRequest when id is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.albumPlaylist({
      params: { id: undefined },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        json() {},
        internalServerError() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('albumPlaylist returns notFound for non-existent album', async ({ assert }) => {
    const controller = new PlaybackController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.albumPlaylist({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        badRequest() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        json() {},
        internalServerError() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- streamMovie ----

  test('streamMovie returns badRequest when id is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.streamMovie({
      params: { id: undefined },
      request: {
        header: () => undefined,
      },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        header() {},
        status() {
          return { stream() {} }
        },
        stream() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('streamMovie returns notFound for non-existent movie file', async ({ assert }) => {
    const controller = new PlaybackController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.streamMovie({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        header: () => undefined,
      },
      response: {
        badRequest() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        header() {},
        status() {
          return { stream() {} }
        },
        stream() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- streamEpisode ----

  test('streamEpisode returns badRequest when id is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.streamEpisode({
      params: { id: undefined },
      request: {
        header: () => undefined,
      },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        header() {},
        status() {
          return { stream() {} }
        },
        stream() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('streamEpisode returns notFound for non-existent episode file', async ({ assert }) => {
    const controller = new PlaybackController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.streamEpisode({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        header: () => undefined,
      },
      response: {
        badRequest() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        header() {},
        status() {
          return { stream() {} }
        },
        stream() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- moviePlaybackInfo ----

  test('moviePlaybackInfo returns badRequest when id is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.moviePlaybackInfo({
      params: { id: undefined },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        json() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('moviePlaybackInfo returns notFound for non-existent movie file', async ({ assert }) => {
    const controller = new PlaybackController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.moviePlaybackInfo({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        badRequest() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        json() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- episodePlaybackInfo ----

  test('episodePlaybackInfo returns badRequest when id is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.episodePlaybackInfo({
      params: { id: undefined },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        json() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('episodePlaybackInfo returns notFound for non-existent episode file', async ({
    assert,
  }) => {
    const controller = new PlaybackController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.episodePlaybackInfo({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        badRequest() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        json() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- hlsManifest ----

  test('hlsManifest returns badRequest when sessionId is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.hlsManifest({
      params: { sessionId: undefined },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        header() {},
        send() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('hlsManifest returns notFound for non-existent session', async ({ assert }) => {
    const controller = new PlaybackController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.hlsManifest({
      params: { sessionId: 'non-existent-session' },
      response: {
        badRequest() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        header() {},
        send() {},
      },
    } as never)

    assert.property(notFoundResult, 'error')
  })

  // ---- hlsSegment ----

  test('hlsSegment returns badRequest when sessionId is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.hlsSegment({
      params: { sessionId: undefined, index: '0' },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        header() {},
        send() {},
        internalServerError() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('hlsSegment returns badRequest for invalid segment index', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.hlsSegment({
      params: { sessionId: 'some-session', index: 'abc' },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        header() {},
        send() {},
        internalServerError() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('hlsSegment returns badRequest for negative segment index', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.hlsSegment({
      params: { sessionId: 'some-session', index: '-1' },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        notFound() {},
        header() {},
        send() {},
        internalServerError() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  // ---- hlsCleanup ----

  test('hlsCleanup returns badRequest when sessionId is missing', async ({ assert }) => {
    const controller = new PlaybackController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.hlsCleanup({
      params: { sessionId: undefined },
      response: {
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
        json() {},
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })

  test('hlsCleanup returns success false for non-existent session', async ({ assert }) => {
    const controller = new PlaybackController()
    let result: Record<string, unknown> = {}

    await controller.hlsCleanup({
      params: { sessionId: 'non-existent-session' },
      response: {
        badRequest() {},
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(result.success, false)
  })
})
