import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class ResetLibraryData extends BaseCommand {
  static commandName = 'reset:library-data'
  static description = 'Reset all library and download data while preserving settings'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Clearing all library and download data...')

    try {
      await db.rawQuery(`
        TRUNCATE TABLE
          track_files,
          tracks,
          releases,
          albums,
          artists,
          movie_files,
          movies,
          episode_files,
          episodes,
          seasons,
          tv_shows,
          book_files,
          books,
          authors,
          downloads,
          history
        CASCADE
      `)

      this.logger.success('All library and download data cleared.')
      this.logger.info('Settings preserved: app_settings, root_folders, download_clients, indexers, quality_profiles, etc.')
    } catch (error) {
      this.logger.error('Failed to reset library data')
      this.logger.error(error instanceof Error ? error.message : String(error))
    }
  }
}
