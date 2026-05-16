import { test } from '@japa/runner'
import {
  stuckImportRecoveryTask,
  STUCK_IMPORTING_THRESHOLD_MINUTES,
  FAILED_RETRY_DELAY_MINUTES,
} from '#services/tasks/stuck_import_recovery_task'
import { DownloadFactory } from '../../../database/factories/download_factory.js'
import Download from '#models/download'
import { DateTime } from 'luxon'

const TEST_PREFIX = 'StuckRecoveryTest__'

async function setDownloadTimestamps(
  id: string,
  ts: { completedAt?: DateTime; updatedAt?: DateTime }
) {
  // updatedAt is auto-managed by Lucid; bypass via raw query.
  const set: Record<string, string> = {}
  if (ts.completedAt) set.completed_at = ts.completedAt.toSQL()!
  if (ts.updatedAt) set.updated_at = ts.updatedAt.toSQL()!
  if (Object.keys(set).length === 0) return
  const cols = Object.entries(set)
    .map(([k]) => `"${k}" = ?`)
    .join(', ')
  const values = Object.values(set)
  const dbModule = await import('@adonisjs/lucid/services/db')
  const db = dbModule.default
  await db.rawQuery(`UPDATE downloads SET ${cols} WHERE id = ?`, [...values, id])
}

test.group('StuckImportRecoveryTask | isTransientError', () => {
  test('detects path-not-accessible errors as transient', ({ assert }) => {
    assert.isTrue(
      stuckImportRecoveryTask.isTransientError(
        'Download path not accessible: "/mnt/nfs/downloads/foo"'
      )
    )
  })

  test('detects timeout errors as transient', ({ assert }) => {
    assert.isTrue(stuckImportRecoveryTask.isTransientError('Path check timeout'))
    assert.isTrue(stuckImportRecoveryTask.isTransientError('Operation timed out'))
  })

  test('detects ENOENT/file-not-found as transient', ({ assert }) => {
    assert.isTrue(stuckImportRecoveryTask.isTransientError('ENOENT: no such file or directory'))
    assert.isTrue(
      stuckImportRecoveryTask.isTransientError('File not found: "Severance.S02E03.mkv"')
    )
  })

  test('detects network errors as transient', ({ assert }) => {
    assert.isTrue(stuckImportRecoveryTask.isTransientError('ECONNRESET'))
    assert.isTrue(stuckImportRecoveryTask.isTransientError('EHOSTUNREACH'))
  })

  test('detects not-mounted/not-responding as transient', ({ assert }) => {
    assert.isTrue(
      stuckImportRecoveryTask.isTransientError(
        'The network storage may not be mounted or is unresponsive.'
      )
    )
  })

  test('treats unknown media type as permanent', ({ assert }) => {
    assert.isFalse(stuckImportRecoveryTask.isTransientError('Unknown media type'))
  })

  test('treats quality-rejection as permanent', ({ assert }) => {
    assert.isFalse(
      stuckImportRecoveryTask.isTransientError('Quality lower than existing file, skipped')
    )
  })

  test('treats null/empty message as not retryable', ({ assert }) => {
    assert.isFalse(stuckImportRecoveryTask.isTransientError(null))
    assert.isFalse(stuckImportRecoveryTask.isTransientError(undefined))
    assert.isFalse(stuckImportRecoveryTask.isTransientError(''))
  })
})

test.group('StuckImportRecoveryTask | findStuckImporting', (group) => {
  const ids: string[] = []

  group.teardown(async () => {
    await Download.query().whereIn('id', ids).delete()
  })

  test('finds downloads stuck in importing past threshold', async ({ assert }) => {
    const ancient = await DownloadFactory.create({
      title: `${TEST_PREFIX}old-stuck`,
      status: 'importing',
      outputPath: '/tmp/never-existed-stuck-test',
    })
    ids.push(ancient.id)
    await setDownloadTimestamps(ancient.id, {
      completedAt: DateTime.now().minus({ minutes: STUCK_IMPORTING_THRESHOLD_MINUTES + 5 }),
      updatedAt: DateTime.now().minus({ minutes: STUCK_IMPORTING_THRESHOLD_MINUTES + 5 }),
    })

    const fresh = await DownloadFactory.create({
      title: `${TEST_PREFIX}fresh-importing`,
      status: 'importing',
      outputPath: '/tmp/fresh',
    })
    ids.push(fresh.id)

    const stuck = await stuckImportRecoveryTask.findStuckImporting()
    const stuckIds = stuck.map((d) => d.id)
    assert.include(stuckIds, ancient.id, 'old importing row should be flagged')
    assert.notInclude(stuckIds, fresh.id, 'fresh importing row should not be flagged')
  })

  test('does not flag completed or failed downloads', async ({ assert }) => {
    const completed = await DownloadFactory.create({
      title: `${TEST_PREFIX}completed`,
      status: 'completed',
      outputPath: '/tmp/completed',
    })
    ids.push(completed.id)
    await setDownloadTimestamps(completed.id, {
      completedAt: DateTime.now().minus({ hours: 1 }),
      updatedAt: DateTime.now().minus({ hours: 1 }),
    })

    const stuck = await stuckImportRecoveryTask.findStuckImporting()
    assert.notInclude(
      stuck.map((d) => d.id),
      completed.id
    )
  })
})

test.group('StuckImportRecoveryTask | findRetryableFailures', (group) => {
  const ids: string[] = []

  group.teardown(async () => {
    await Download.query().whereIn('id', ids).delete()
  })

  test('finds failed downloads with transient errors', async ({ assert }) => {
    const transient = await DownloadFactory.create({
      title: `${TEST_PREFIX}transient-fail`,
      status: 'failed',
      outputPath: '/tmp/transient-fail',
      errorMessage:
        'Download path not accessible: "/mnt/nfs/downloads/foo". This usually means the network storage is not mounted.',
    })
    ids.push(transient.id)
    await setDownloadTimestamps(transient.id, {
      updatedAt: DateTime.now().minus({ minutes: FAILED_RETRY_DELAY_MINUTES + 1 }),
    })

    const permanent = await DownloadFactory.create({
      title: `${TEST_PREFIX}permanent-fail`,
      status: 'failed',
      outputPath: '/tmp/permanent-fail',
      errorMessage: 'Unknown media type - cannot determine import service',
    })
    ids.push(permanent.id)
    await setDownloadTimestamps(permanent.id, {
      updatedAt: DateTime.now().minus({ minutes: FAILED_RETRY_DELAY_MINUTES + 1 }),
    })

    const retryable = await stuckImportRecoveryTask.findRetryableFailures()
    const retryableIds = retryable.map((d) => d.id)
    assert.include(retryableIds, transient.id)
    assert.notInclude(retryableIds, permanent.id)
  })

  test('skips recently-failed rows to avoid racing with the failing worker', async ({ assert }) => {
    const justFailed = await DownloadFactory.create({
      title: `${TEST_PREFIX}just-failed`,
      status: 'failed',
      outputPath: '/tmp/just-failed',
      errorMessage: 'Download path not accessible',
    })
    ids.push(justFailed.id)
    // Note: updatedAt is auto-set to now() by Lucid on create

    const retryable = await stuckImportRecoveryTask.findRetryableFailures()
    assert.notInclude(
      retryable.map((d) => d.id),
      justFailed.id
    )
  })

  test('skips rows with no outputPath (nothing to retry on)', async ({ assert }) => {
    const noPath = await DownloadFactory.create({
      title: `${TEST_PREFIX}no-path`,
      status: 'failed',
      outputPath: null,
      errorMessage: 'Download path not accessible',
    })
    ids.push(noPath.id)
    await setDownloadTimestamps(noPath.id, {
      updatedAt: DateTime.now().minus({ minutes: FAILED_RETRY_DELAY_MINUTES + 1 }),
    })

    const retryable = await stuckImportRecoveryTask.findRetryableFailures()
    assert.notInclude(
      retryable.map((d) => d.id),
      noPath.id
    )
  })
})

test.group('StuckImportRecoveryTask | run', (group) => {
  const ids: string[] = []

  group.teardown(async () => {
    await Download.query().whereIn('id', ids).delete()
  })

  test('reports zero work when nothing is stuck', async ({ assert }) => {
    const result = await stuckImportRecoveryTask.run()
    assert.equal(result.stuckFound, 0)
    assert.equal(result.retried, 0)
  })

  test('does not retry when output path is unreachable', async ({ assert }) => {
    // Create a stuck import with a path that doesn't exist on disk — recovery
    // should refrain from triggering a retry (no point spinning import attempts
    // when the file isn't even there yet).
    const stuck = await DownloadFactory.create({
      title: `${TEST_PREFIX}unreachable`,
      status: 'importing',
      outputPath: '/nonexistent/path/never/created/here',
    })
    ids.push(stuck.id)
    await setDownloadTimestamps(stuck.id, {
      completedAt: DateTime.now().minus({ minutes: STUCK_IMPORTING_THRESHOLD_MINUTES + 5 }),
      updatedAt: DateTime.now().minus({ minutes: STUCK_IMPORTING_THRESHOLD_MINUTES + 5 }),
    })

    const result = await stuckImportRecoveryTask.run()
    assert.isAtLeast(result.stuckFound, 1)
    // retried counts the items we actually fired imports for. Unreachable
    // paths should NOT count.
    const fresh = await Download.find(stuck.id)
    assert.equal(fresh?.status, 'importing', 'still importing — retry was correctly deferred')
  })
})
