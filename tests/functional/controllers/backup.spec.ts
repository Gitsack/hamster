import { test } from '@japa/runner'
import BackupController from '#controllers/backup_controller'

/**
 * BackupController delegates all work to backupService.
 * We mock the backupService methods via dynamic import interception
 * to avoid real filesystem and pg_dump operations.
 */

// Store original module for restoration
let originalBackupService: typeof import('#services/backup/backup_service')

const mockBackups = [
  {
    name: 'hamster_2026-01-15_10-00-00.sql.gz',
    path: '/config/backups/hamster_2026-01-15_10-00-00.sql.gz',
    size: 1024000,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    name: 'hamster_2026-01-14_10-00-00.sql.gz',
    path: '/config/backups/hamster_2026-01-14_10-00-00.sql.gz',
    size: 512000,
    createdAt: '2026-01-14T10:00:00.000Z',
  },
]

test.group('BackupController', (group) => {
  group.setup(async () => {
    originalBackupService = await import('#services/backup/backup_service')
  })

  // ---- index ----

  test('index returns list of backups', async ({ assert }) => {
    const controller = new BackupController()
    let result: Record<string, unknown> = {}

    // Override the backupService.list on the imported module
    const mod = await import('#services/backup/backup_service')
    const originalList = mod.backupService.list.bind(mod.backupService)
    mod.backupService.list = async () => mockBackups

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    assert.property(result, 'backups')
    const backups = result.backups as typeof mockBackups
    assert.equal(backups.length, 2)
    assert.equal(backups[0].name, 'hamster_2026-01-15_10-00-00.sql.gz')
    assert.equal(backups[1].name, 'hamster_2026-01-14_10-00-00.sql.gz')

    // Restore original
    mod.backupService.list = originalList
  })

  test('index returns empty list when no backups exist', async ({ assert }) => {
    const controller = new BackupController()
    let result: Record<string, unknown> = {}

    const mod = await import('#services/backup/backup_service')
    const originalList = mod.backupService.list.bind(mod.backupService)
    mod.backupService.list = async () => []

    await controller.index({
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
      },
    } as never)

    const backups = result.backups as unknown[]
    assert.isArray(backups)
    assert.equal(backups.length, 0)

    mod.backupService.list = originalList
  })

  // ---- create ----

  test('create returns 201 with backup info on success', async ({ assert }) => {
    const controller = new BackupController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    const mod = await import('#services/backup/backup_service')
    const originalCreate = mod.backupService.create.bind(mod.backupService)
    mod.backupService.create = async () => mockBackups[0]

    await controller.create({
      response: {
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
      },
    } as never)

    assert.equal(statusCode, 201)
    assert.property(result, 'backup')
    const backup = result.backup as typeof mockBackups[0]
    assert.equal(backup.name, 'hamster_2026-01-15_10-00-00.sql.gz')
    assert.equal(backup.size, 1024000)

    mod.backupService.create = originalCreate
  })

  test('create returns 500 when backup fails', async ({ assert }) => {
    const controller = new BackupController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    const mod = await import('#services/backup/backup_service')
    const originalCreate = mod.backupService.create.bind(mod.backupService)
    mod.backupService.create = async () => {
      throw new Error('pg_dump not found')
    }

    await controller.create({
      response: {
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
      },
    } as never)

    assert.equal(statusCode, 500)
    const error = result.error as Record<string, string>
    assert.equal(error.code, 'BACKUP_FAILED')
    assert.equal(error.message, 'pg_dump not found')

    mod.backupService.create = originalCreate
  })

  // ---- download ----

  test('download calls response.download with backup path', async ({ assert }) => {
    const controller = new BackupController()
    let downloadPath = ''

    const mod = await import('#services/backup/backup_service')
    const originalGetPath = mod.backupService.getBackupPath.bind(mod.backupService)
    mod.backupService.getBackupPath = async (_name: string) =>
      '/config/backups/hamster_2026-01-15_10-00-00.sql.gz'

    await controller.download({
      params: { name: 'hamster_2026-01-15_10-00-00.sql.gz' },
      response: {
        download(path: string) {
          downloadPath = path
        },
        status() {
          return { json() {} }
        },
      },
    } as never)

    assert.equal(downloadPath, '/config/backups/hamster_2026-01-15_10-00-00.sql.gz')

    mod.backupService.getBackupPath = originalGetPath
  })

  test('download returns 404 when backup not found', async ({ assert }) => {
    const controller = new BackupController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    const mod = await import('#services/backup/backup_service')
    const originalGetPath = mod.backupService.getBackupPath.bind(mod.backupService)
    mod.backupService.getBackupPath = async (_name: string) => {
      throw new Error('Backup file not found: nonexistent.sql.gz')
    }

    await controller.download({
      params: { name: 'nonexistent.sql.gz' },
      response: {
        download() {},
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
      },
    } as never)

    assert.equal(statusCode, 404)
    const error = result.error as Record<string, string>
    assert.equal(error.code, 'BACKUP_NOT_FOUND')

    mod.backupService.getBackupPath = originalGetPath
  })

  // ---- restore ----

  test('restore returns success message on completion', async ({ assert }) => {
    const controller = new BackupController()
    let result: Record<string, unknown> = {}

    const mod = await import('#services/backup/backup_service')
    const originalRestore = mod.backupService.restore.bind(mod.backupService)
    mod.backupService.restore = async (_name: string) => {}

    await controller.restore({
      params: { name: 'hamster_2026-01-15_10-00-00.sql.gz' },
      response: {
        json(data: unknown) {
          result = data as Record<string, unknown>
        },
        status() {
          return { json() {} }
        },
      },
    } as never)

    assert.equal(result.message, 'Restore completed successfully')

    mod.backupService.restore = originalRestore
  })

  test('restore returns 500 when restore fails', async ({ assert }) => {
    const controller = new BackupController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    const mod = await import('#services/backup/backup_service')
    const originalRestore = mod.backupService.restore.bind(mod.backupService)
    mod.backupService.restore = async (_name: string) => {
      throw new Error('psql failed')
    }

    await controller.restore({
      params: { name: 'hamster_2026-01-15_10-00-00.sql.gz' },
      response: {
        json() {},
        status(code: number) {
          statusCode = code
          return {
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
      },
    } as never)

    assert.equal(statusCode, 500)
    const error = result.error as Record<string, string>
    assert.equal(error.code, 'RESTORE_FAILED')
    assert.equal(error.message, 'psql failed')

    mod.backupService.restore = originalRestore
  })

  // ---- destroy ----

  test('destroy returns 204 on successful deletion', async ({ assert }) => {
    const controller = new BackupController()
    let statusCode = 0
    let sendCalled = false

    const mod = await import('#services/backup/backup_service')
    const originalDelete = mod.backupService.delete.bind(mod.backupService)
    mod.backupService.delete = async (_name: string) => {}

    await controller.destroy({
      params: { name: 'hamster_2026-01-15_10-00-00.sql.gz' },
      response: {
        status(code: number) {
          statusCode = code
          return {
            send(_body: string) {
              sendCalled = true
            },
            json() {},
          }
        },
      },
    } as never)

    assert.equal(statusCode, 204)
    assert.isTrue(sendCalled)

    mod.backupService.delete = originalDelete
  })

  test('destroy returns 404 when backup not found', async ({ assert }) => {
    const controller = new BackupController()
    let result: Record<string, unknown> = {}
    let statusCode = 0

    const mod = await import('#services/backup/backup_service')
    const originalDelete = mod.backupService.delete.bind(mod.backupService)
    mod.backupService.delete = async (_name: string) => {
      throw new Error('Backup file not found: nonexistent.sql.gz')
    }

    await controller.destroy({
      params: { name: 'nonexistent.sql.gz' },
      response: {
        status(code: number) {
          statusCode = code
          return {
            send() {},
            json(data: unknown) {
              result = data as Record<string, unknown>
            },
          }
        },
      },
    } as never)

    assert.equal(statusCode, 404)
    const error = result.error as Record<string, string>
    assert.equal(error.code, 'BACKUP_NOT_FOUND')

    mod.backupService.delete = originalDelete
  })
})
