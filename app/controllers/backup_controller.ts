import type { HttpContext } from '@adonisjs/core/http'
import { backupService } from '#services/backup/backup_service'

export default class BackupController {
  /**
   * List available backups
   */
  async index({ response }: HttpContext) {
    const backups = await backupService.list()
    return response.json({ backups })
  }

  /**
   * Create a new backup
   */
  async create({ response }: HttpContext) {
    try {
      const backup = await backupService.create()
      return response.status(201).json({ backup })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup failed'
      return response.status(500).json({
        error: { code: 'BACKUP_FAILED', message },
      })
    }
  }

  /**
   * Download a backup file
   */
  async download({ params, response }: HttpContext) {
    try {
      const backupPath = await backupService.getBackupPath(params.name)
      return response.download(backupPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup not found'
      return response.status(404).json({
        error: { code: 'BACKUP_NOT_FOUND', message },
      })
    }
  }

  /**
   * Restore from a backup
   */
  async restore({ params, response }: HttpContext) {
    try {
      await backupService.restore(params.name)
      return response.json({ message: 'Restore completed successfully' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore failed'
      return response.status(500).json({
        error: { code: 'RESTORE_FAILED', message },
      })
    }
  }

  /**
   * Delete a backup
   */
  async destroy({ params, response }: HttpContext) {
    try {
      await backupService.delete(params.name)
      return response.status(204).send('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed'
      return response.status(404).json({
        error: { code: 'BACKUP_NOT_FOUND', message },
      })
    }
  }
}
