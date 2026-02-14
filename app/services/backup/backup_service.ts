import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createGzip, createGunzip } from 'node:zlib'
import AppSetting from '#models/app_setting'
import env from '#start/env'

const execFileAsync = promisify(execFile)

export interface BackupInfo {
  name: string
  path: string
  size: number
  createdAt: string
}

const DEFAULT_BACKUP_DIR = '/config/backups'
const DEFAULT_RETENTION = 5

class BackupService {
  private isRunning = false

  /**
   * Get the configured backup directory
   */
  private async getBackupDir(): Promise<string> {
    const dir = await AppSetting.get<string>('backupDirectory', DEFAULT_BACKUP_DIR)
    return dir || DEFAULT_BACKUP_DIR
  }

  /**
   * Get the retention count
   */
  private async getRetention(): Promise<number> {
    const retention = await AppSetting.get<number>('backupRetention', DEFAULT_RETENTION)
    return retention || DEFAULT_RETENTION
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDir(): Promise<string> {
    const dir = await this.getBackupDir()
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  /**
   * Start method (no-op, TaskScheduler handles scheduling)
   */
  start(_interval?: number) {}

  /**
   * Stop method (no-op, TaskScheduler handles scheduling)
   */
  stop() {}

  /**
   * Run a backup (used by TaskScheduler)
   */
  async run(): Promise<void> {
    await this.create()
  }

  /**
   * Create a new database backup
   */
  async create(): Promise<BackupInfo> {
    if (this.isRunning) {
      throw new Error('Backup is already in progress')
    }

    this.isRunning = true

    try {
      const backupDir = await this.ensureBackupDir()
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19)
      const dumpFile = path.join(backupDir, `hamster_${timestamp}.sql`)
      const gzipFile = `${dumpFile}.gz`

      console.log(`[Backup] Creating backup: ${gzipFile}`)

      // Get database connection info from environment
      const dbHost = env.get('DB_HOST', 'localhost')
      const dbPort = env.get('DB_PORT', '5432')
      const dbName = env.get('DB_DATABASE', 'hamster')
      const dbUser = env.get('DB_USER', 'postgres')
      const dbPassword = env.get('DB_PASSWORD', '')

      // Run pg_dump
      const pgDumpArgs = [
        '-h',
        String(dbHost),
        '-p',
        String(dbPort),
        '-U',
        String(dbUser),
        '-d',
        String(dbName),
        '--no-owner',
        '--no-acl',
        '-f',
        dumpFile,
      ]

      await execFileAsync('pg_dump', pgDumpArgs, {
        env: {
          ...process.env,
          PGPASSWORD: String(dbPassword),
        },
        timeout: 120000, // 2 minute timeout
      })

      // Compress with gzip
      const source = createReadStream(dumpFile)
      const destination = createWriteStream(gzipFile)
      const gzip = createGzip({ level: 6 })

      await pipeline(source, gzip, destination)

      // Remove uncompressed file
      await fs.unlink(dumpFile)

      // Get file stats
      const stats = await fs.stat(gzipFile)

      console.log(`[Backup] Backup created: ${gzipFile} (${this.formatSize(stats.size)})`)

      // Apply retention policy
      await this.applyRetention()

      return {
        name: path.basename(gzipFile),
        path: gzipFile,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
      }
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Restore from a backup file
   */
  async restore(backupName: string): Promise<void> {
    const backupDir = await this.getBackupDir()
    const backupPath = path.join(backupDir, backupName)

    // Validate the backup file exists
    try {
      await fs.access(backupPath)
    } catch {
      throw new Error(`Backup file not found: ${backupName}`)
    }

    // Validate the filename to prevent path traversal
    if (backupName.includes('..') || backupName.includes('/')) {
      throw new Error('Invalid backup filename')
    }

    console.log(`[Backup] Restoring from: ${backupPath}`)

    const dbHost = env.get('DB_HOST', 'localhost')
    const dbPort = env.get('DB_PORT', '5432')
    const dbName = env.get('DB_DATABASE', 'hamster')
    const dbUser = env.get('DB_USER', 'postgres')
    const dbPassword = env.get('DB_PASSWORD', '')

    // Decompress the backup
    const sqlFile = backupPath.replace('.gz', '')

    if (backupPath.endsWith('.gz')) {
      const source = createReadStream(backupPath)
      const destination = createWriteStream(sqlFile)
      const gunzip = createGunzip()

      await pipeline(source, gunzip, destination)
    }

    try {
      // Restore using psql
      await execFileAsync(
        'psql',
        [
          '-h',
          String(dbHost),
          '-p',
          String(dbPort),
          '-U',
          String(dbUser),
          '-d',
          String(dbName),
          '-f',
          sqlFile,
        ],
        {
          env: {
            ...process.env,
            PGPASSWORD: String(dbPassword),
          },
          timeout: 300000, // 5 minute timeout
        }
      )

      console.log(`[Backup] Restore completed from: ${backupName}`)
    } finally {
      // Clean up decompressed file if we created one
      if (backupPath.endsWith('.gz')) {
        try {
          await fs.unlink(sqlFile)
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * List available backups
   */
  async list(): Promise<BackupInfo[]> {
    const backupDir = await this.getBackupDir()

    try {
      await fs.access(backupDir)
    } catch {
      return []
    }

    const entries = await fs.readdir(backupDir, { withFileTypes: true })
    const backups: BackupInfo[] = []

    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.startsWith('hamster_') || !entry.name.endsWith('.sql.gz')) continue

      const filePath = path.join(backupDir, entry.name)
      const stats = await fs.stat(filePath)

      backups.push({
        name: entry.name,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
      })
    }

    // Sort by creation date, newest first
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return backups
  }

  /**
   * Delete a backup file
   */
  async delete(backupName: string): Promise<void> {
    const backupDir = await this.getBackupDir()

    // Validate the filename to prevent path traversal
    if (backupName.includes('..') || backupName.includes('/')) {
      throw new Error('Invalid backup filename')
    }

    const backupPath = path.join(backupDir, backupName)

    try {
      await fs.access(backupPath)
    } catch {
      throw new Error(`Backup file not found: ${backupName}`)
    }

    await fs.unlink(backupPath)
    console.log(`[Backup] Deleted backup: ${backupName}`)
  }

  /**
   * Get the full path for a backup file (for downloads)
   */
  async getBackupPath(backupName: string): Promise<string> {
    const backupDir = await this.getBackupDir()

    if (backupName.includes('..') || backupName.includes('/')) {
      throw new Error('Invalid backup filename')
    }

    const backupPath = path.join(backupDir, backupName)

    try {
      await fs.access(backupPath)
    } catch {
      throw new Error(`Backup file not found: ${backupName}`)
    }

    return backupPath
  }

  /**
   * Apply retention policy - keep only the last N backups
   */
  private async applyRetention(): Promise<void> {
    const retention = await this.getRetention()
    const backups = await this.list()

    if (backups.length <= retention) return

    const toDelete = backups.slice(retention)
    for (const backup of toDelete) {
      try {
        await fs.unlink(backup.path)
        console.log(`[Backup] Retention: deleted old backup ${backup.name}`)
      } catch (error) {
        console.error(`[Backup] Failed to delete old backup ${backup.name}:`, error)
      }
    }
  }

  /**
   * Format file size for logging
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  get running() {
    return this.isRunning
  }
}

export const backupService = new BackupService()
