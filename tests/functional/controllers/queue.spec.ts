import { test } from '@japa/runner'
import Download from '#models/download'
import QueueController from '#controllers/queue_controller'
import UnmatchedFile from '#models/unmatched_file'
import RootFolder from '#models/root_folder'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { DownloadFactory } from '../../../database/factories/download_factory.js'

test.group('QueueController', (group) => {
  const downloadIds: string[] = []

  group.teardown(async () => {
    if (downloadIds.length > 0) {
      await Download.query().whereIn('id', downloadIds).delete()
    }
    await Download.query().where('title', 'like', 'Queue Test%').delete()
    await UnmatchedFile.query().where('fileName', 'like', 'queue-test-%').delete()
    await RootFolder.query().where('name', 'Queue Test Root').delete()
  })

  async function readCounts() {
    const controller = new QueueController()
    let result: Record<string, number> = {}
    await controller.counts({
      response: {
        json(data: unknown) {
          result = data as Record<string, number>
        },
      },
    } as never)
    return result
  }

  async function readHistory(status: string) {
    const controller = new QueueController()
    let result: Record<string, unknown> = {}
    await controller.history({
      request: {
        input: (key: string, defaultVal: unknown) => {
          if (key === 'page') return 1
          if (key === 'limit') return 200
          if (key === 'status') return status
          return defaultVal
        },
      },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)
    return result.data as any[]
  }

  /** Age a download past the stuck-import threshold, bypassing the model's autoUpdate. */
  async function age(id: string, minutes: number) {
    const then = DateTime.now().minus({ minutes }).toSQL()
    await db.from('downloads').where('id', id).update({ updated_at: then, completed_at: then })
  }

  // ---- counts ----

  test('counts reports active, failed, importing, stuck and unmatched totals', async ({
    assert,
  }) => {
    const before = await readCounts()

    const created = await Promise.all([
      DownloadFactory.create({ title: 'Queue Test Count Active 1', status: 'downloading' }),
      DownloadFactory.create({ title: 'Queue Test Count Active 2', status: 'queued' }),
      DownloadFactory.create({ title: 'Queue Test Count Active 3', status: 'paused' }),
      DownloadFactory.create({ title: 'Queue Test Count Failed', status: 'failed' }),
      DownloadFactory.create({ title: 'Queue Test Count Importing', status: 'importing' }),
      DownloadFactory.create({ title: 'Queue Test Count Stuck', status: 'importing' }),
      DownloadFactory.create({ title: 'Queue Test Count Done', status: 'completed' }),
    ])
    downloadIds.push(...created.map((d) => d.id))
    await age(created[5].id, 60)

    const rootFolder = await RootFolder.create({
      name: 'Queue Test Root',
      path: `/tmp/queue-test-root-${Date.now()}`,
      mediaType: 'movies',
      accessible: true,
      scanStatus: 'idle',
    })
    await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'queue-test-pending.mkv',
      fileName: 'queue-test-pending.mkv',
      mediaType: 'movies',
      status: 'pending',
    })
    await UnmatchedFile.create({
      rootFolderId: rootFolder.id,
      relativePath: 'queue-test-ignored.mkv',
      fileName: 'queue-test-ignored.mkv',
      mediaType: 'movies',
      status: 'ignored',
    })

    const after = await readCounts()

    assert.equal(after.active - before.active, 3)
    assert.equal(after.failed - before.failed, 1)
    assert.equal(after.importing - before.importing, 2)
    assert.equal(after.stuckImporting - before.stuckImporting, 1)
    assert.equal(after.unmatchedPending - before.unmatchedPending, 1)
  })

  test('history filters to importing rows and flags the stuck ones', async ({ assert }) => {
    const fresh = await DownloadFactory.create({
      title: 'Queue Test Importing Fresh',
      status: 'importing',
    })
    const stuck = await DownloadFactory.create({
      title: 'Queue Test Importing Stuck',
      status: 'importing',
    })
    downloadIds.push(fresh.id, stuck.id)
    await age(stuck.id, 30)

    const rows = await readHistory('importing')
    assert.isTrue(rows.every((row) => row.status === 'importing'))

    const freshRow = rows.find((row) => row.id === fresh.id)
    const stuckRow = rows.find((row) => row.id === stuck.id)
    assert.isDefined(freshRow)
    assert.isDefined(stuckRow)
    assert.isFalse(freshRow.stuck)
    assert.isTrue(stuckRow.stuck)
    assert.property(stuckRow, 'mediaType')
    assert.property(stuckRow, 'movieId')
    assert.property(stuckRow, 'episodeId')
  })

  test('history ignores an unknown status filter', async ({ assert }) => {
    const rows = await readHistory('downloading')
    assert.isTrue(rows.every((row) => row.status === 'completed' || row.status === 'failed'))
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
    const download = data.find((item: any) => item.title === 'Queue Test Shape')
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

    const found = result.find((item: any) => item.title === 'Queue Test Failed Entry') as any
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

    assert.equal(badRequestResult.error, 'Only failed or stuck imports can be retried')
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
