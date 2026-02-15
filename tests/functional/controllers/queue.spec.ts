import { test } from '@japa/runner'
import Download from '#models/download'
import QueueController from '#controllers/queue_controller'
import { DownloadFactory } from '../../../database/factories/download_factory.js'

test.group('QueueController', (group) => {
  const downloadIds: string[] = []

  group.teardown(async () => {
    if (downloadIds.length > 0) {
      await Download.query().whereIn('id', downloadIds).delete()
    }
    await Download.query().where('title', 'like', 'Queue Test%').delete()
  })

  // ---- history ----

  test('history returns paginated completed and failed downloads', async ({ assert }) => {
    const d1 = await DownloadFactory.create({
      title: 'Queue Test History 1',
      status: 'completed',
    })
    const d2 = await DownloadFactory.create({
      title: 'Queue Test History 2',
      status: 'failed',
      errorMessage: 'Some error',
    })
    downloadIds.push(d1.id, d2.id)

    const controller = new QueueController()
    let result: Record<string, unknown> = {}

    await controller.history({
      request: {
        input: (key: string, defaultVal: unknown) => {
          if (key === 'page') return 1
          if (key === 'limit') return 50
          return defaultVal
        },
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const data = result.data as any[]
    assert.isTrue(data.length >= 2)

    const titles = data.map((d: any) => d.title)
    assert.include(titles, 'Queue Test History 1')
    assert.include(titles, 'Queue Test History 2')

    const meta = result.meta as Record<string, unknown>
    assert.property(meta, 'total')
    assert.property(meta, 'perPage')
    assert.property(meta, 'currentPage')
    assert.property(meta, 'lastPage')
  })

  test('history returns expected download shape', async ({ assert }) => {
    const d = await DownloadFactory.create({
      title: 'Queue Test Shape',
      status: 'completed',
      sizeBytes: 1024000,
    })
    downloadIds.push(d.id)

    const controller = new QueueController()
    let result: Record<string, unknown> = {}

    await controller.history({
      request: {
        input: (key: string, defaultVal: unknown) => {
          if (key === 'page') return 1
          if (key === 'limit') return 50
          return defaultVal
        },
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const data = result.data as any[]
    const download = data.find((d: any) => d.title === 'Queue Test Shape')
    assert.isNotNull(download)
    if (download) {
      assert.property(download, 'id')
      assert.property(download, 'title')
      assert.property(download, 'status')
      assert.property(download, 'size')
      assert.equal(download.status, 'completed')
    }
  })

  // ---- failed ----

  test('failed returns failed downloads', async ({ assert }) => {
    const d = await DownloadFactory.create({
      title: 'Queue Test Failed Entry',
      status: 'failed',
      errorMessage: 'CRC error during extraction',
    })
    downloadIds.push(d.id)

    const controller = new QueueController()
    let result: unknown[] = []

    await controller.failed({
      response: {
        json(data: unknown) {
          result = data as unknown[]
        },
      },
    } as never)

    assert.isArray(result)
    assert.isTrue(result.length >= 1)

    const found = result.find((d: any) => d.title === 'Queue Test Failed Entry') as any
    assert.isNotNull(found)
    if (found) {
      assert.equal(found.status, 'failed')
      assert.equal(found.errorMessage, 'CRC error during extraction')
    }
  })

  // ---- clearFailed ----

  test('clearFailed removes all failed downloads', async ({ assert }) => {
    await DownloadFactory.create({
      title: 'Queue Test ClearFail 1',
      status: 'failed',
      errorMessage: 'error1',
    })
    await DownloadFactory.create({
      title: 'Queue Test ClearFail 2',
      status: 'failed',
      errorMessage: 'error2',
    })

    const controller = new QueueController()
    let result: Record<string, unknown> = {}

    await controller.clearFailed({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'message')
    assert.property(result, 'count')
    assert.isTrue((result.count as number) >= 2)

    // Verify they are gone
    const remaining = await Download.query()
      .where('status', 'failed')
      .where('title', 'like', 'Queue Test ClearFail%')
    assert.equal(remaining.length, 0)
  })

  // ---- grab ----

  test('grab returns badRequest when title is missing', async ({ assert }) => {
    const controller = new QueueController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.grab({
      request: {
        only: () => ({
          title: '',
          downloadUrl: 'http://example.com/nzb',
        }),
      },
      response: {
        created() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Title and download URL are required')
  })

  test('grab returns badRequest when downloadUrl is missing', async ({ assert }) => {
    const controller = new QueueController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.grab({
      request: {
        only: () => ({
          title: 'Some Release',
          downloadUrl: '',
        }),
      },
      response: {
        created() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Title and download URL are required')
  })

  // ---- import ----

  test('import returns notFound for non-existent download', async ({ assert }) => {
    const controller = new QueueController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.import({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Download not found or has no output path')
  })

  test('import returns notFound for download without outputPath', async ({ assert }) => {
    const d = await DownloadFactory.create({
      title: 'Queue Test No Output',
      status: 'completed',
      outputPath: null,
    })
    downloadIds.push(d.id)

    const controller = new QueueController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.import({
      params: { id: d.id },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Download not found or has no output path')
  })

  test('import returns badRequest for download with no media association', async ({ assert }) => {
    const d = await DownloadFactory.create({
      title: 'Queue Test No Media',
      status: 'completed',
      outputPath: '/tmp/some-download',
    })
    downloadIds.push(d.id)

    const controller = new QueueController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.import({
      params: { id: d.id },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Download has no associated media')
  })

  // ---- retryImport ----

  test('retryImport returns notFound for non-existent download', async ({ assert }) => {
    const controller = new QueueController()
    let notFoundResult: Record<string, unknown> = {}

    await controller.retryImport({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      response: {
        json() {},
        notFound(data: unknown) {
          notFoundResult = data as Record<string, unknown>
        },
        badRequest() {},
      },
    } as never)

    assert.equal(notFoundResult.error, 'Download not found or has no output path')
  })

  test('retryImport returns badRequest for non-failed download', async ({ assert }) => {
    const d = await DownloadFactory.create({
      title: 'Queue Test Not Failed',
      status: 'completed',
      outputPath: '/tmp/some-download',
    })
    downloadIds.push(d.id)

    const controller = new QueueController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.retryImport({
      params: { id: d.id },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Only failed downloads can be retried')
  })

  test('retryImport returns badRequest for failed download without media association', async ({
    assert,
  }) => {
    const d = await DownloadFactory.create({
      title: 'Queue Test Retry No Media',
      status: 'failed',
      outputPath: '/tmp/some-download',
      errorMessage: 'previous error',
    })
    downloadIds.push(d.id)

    const controller = new QueueController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.retryImport({
      params: { id: d.id },
      response: {
        json() {},
        notFound() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.equal(badRequestResult.error, 'Download has no associated media')
  })

  // ---- destroy ----

  test('destroy returns badRequest when download manager throws', async ({ assert }) => {
    // downloadManager.cancel will throw because the id doesn't exist in SABnzbd
    // But this depends on external service - we test the error path
    const controller = new QueueController()
    let badRequestResult: Record<string, unknown> = {}

    await controller.destroy({
      params: { id: '00000000-0000-0000-0000-000000000000' },
      request: {
        input: () => false,
      },
      response: {
        noContent() {},
        badRequest(data: unknown) {
          badRequestResult = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(badRequestResult, 'error')
  })
})
