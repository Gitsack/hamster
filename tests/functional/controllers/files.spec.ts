import { test } from '@japa/runner'
import FilesController from '#controllers/files_controller'

test.group('FilesController', () => {
  // ---- downloadMovie ----

  test('downloadMovie returns notFound when movie file does not exist', async ({ assert }) => {
    const controller = new FilesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.downloadMovie({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        header() {},
        download() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Movie file not found')
  })

  // ---- downloadEpisode ----

  test('downloadEpisode returns notFound when episode file does not exist', async ({ assert }) => {
    const controller = new FilesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.downloadEpisode({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        header() {},
        download() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Episode file not found')
  })

  // ---- downloadBook ----

  test('downloadBook returns notFound when book file does not exist', async ({ assert }) => {
    const controller = new FilesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.downloadBook({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        header() {},
        download() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Book file not found')
  })

  // ---- downloadTrack ----

  test('downloadTrack returns notFound when track file does not exist', async ({ assert }) => {
    const controller = new FilesController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.downloadTrack({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        header() {},
        download() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Track file not found')
  })

  // ---- syncFileStatus ----

  test('syncFileStatus returns success with results shape', async ({ assert }) => {
    const controller = new FilesController()
    let result: Record<string, unknown> = {}

    await controller.syncFileStatus({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.isTrue(result.success as boolean)
    assert.equal(result.message, 'File status synced')
    assert.property(result, 'results')

    const results = result.results as Record<string, { updated: number }>
    assert.property(results, 'movies')
    assert.property(results, 'episodes')
    assert.property(results, 'books')
    assert.property(results, 'tracks')
    assert.isNumber(results.movies.updated)
    assert.isNumber(results.episodes.updated)
    assert.isNumber(results.books.updated)
    assert.isNumber(results.tracks.updated)
  })
})
