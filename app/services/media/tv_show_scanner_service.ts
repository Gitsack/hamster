import fs from 'node:fs/promises'
import path from 'node:path'
import { DateTime } from 'luxon'
import { fileNamingService } from './file_naming_service.js'
import { tvShowParser, type ParsedTvShowInfo } from './parsers/tv_show_parser.js'
import { tmdbService, type TmdbTvShow } from '../metadata/tmdb_service.js'
import RootFolder from '#models/root_folder'
import TvShow from '#models/tv_show'
import Season from '#models/season'
import Episode from '#models/episode'
import EpisodeFile from '#models/episode_file'

export interface ScanProgress {
  phase: 'discovering' | 'parsing' | 'metadata' | 'importing' | 'complete'
  total: number
  current: number
  currentItem?: string
}

export interface ScanResult {
  filesFound: number
  showsCreated: number
  episodesCreated: number
  episodesUpdated: number
  unmatchedFiles: number
  errors: string[]
}

type ProgressCallback = (progress: ScanProgress) => void

interface ScannedEpisode {
  filePath: string
  relativePath: string
  parsed: ParsedTvShowInfo
  fileSize: number
}

interface GroupedShow {
  showTitle: string
  year?: number
  episodes: ScannedEpisode[]
}

/**
 * Service for scanning TV show directories and creating library entries.
 */
export class TvShowScannerService {
  /**
   * Scan a root folder for TV shows
   */
  async scanRootFolder(rootFolderId: string, onProgress?: ProgressCallback): Promise<ScanResult> {
    const rootFolder = await RootFolder.find(rootFolderId)
    if (!rootFolder) {
      return {
        filesFound: 0,
        showsCreated: 0,
        episodesCreated: 0,
        episodesUpdated: 0,
        unmatchedFiles: 0,
        errors: ['Root folder not found'],
      }
    }

    if (rootFolder.mediaType !== 'tv') {
      return {
        filesFound: 0,
        showsCreated: 0,
        episodesCreated: 0,
        episodesUpdated: 0,
        unmatchedFiles: 0,
        errors: ['Root folder is not configured for TV shows'],
      }
    }

    return this.scanDirectory(rootFolder.path, rootFolder, onProgress)
  }

  /**
   * Scan a directory for TV show files
   */
  async scanDirectory(
    directory: string,
    rootFolder: RootFolder,
    onProgress?: ProgressCallback
  ): Promise<ScanResult> {
    const result: ScanResult = {
      filesFound: 0,
      showsCreated: 0,
      episodesCreated: 0,
      episodesUpdated: 0,
      unmatchedFiles: 0,
      errors: [],
    }

    try {
      // Phase 1: Discover video files
      onProgress?.({ phase: 'discovering', total: 0, current: 0 })
      const videoFiles = await this.findVideoFiles(directory)
      result.filesFound = videoFiles.length

      if (videoFiles.length === 0) {
        onProgress?.({ phase: 'complete', total: 0, current: 0 })
        return result
      }

      // Phase 2: Parse and group by show
      onProgress?.({ phase: 'parsing', total: videoFiles.length, current: 0 })
      const groupedShows = await this.parseAndGroupEpisodes(videoFiles, rootFolder, onProgress)

      // Phase 3: Process each show
      const showCount = groupedShows.size
      let showIndex = 0

      for (const [_showKey, showData] of groupedShows) {
        showIndex++
        onProgress?.({
          phase: 'metadata',
          total: showCount,
          current: showIndex,
          currentItem: showData.showTitle,
        })

        try {
          const showResult = await this.processShow(showData, rootFolder)
          if (showResult.showCreated) result.showsCreated++
          result.episodesCreated += showResult.episodesCreated
          result.episodesUpdated += showResult.episodesUpdated
          result.unmatchedFiles += showResult.unmatchedFiles
        } catch (error) {
          result.errors.push(
            `${showData.showTitle}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      onProgress?.({ phase: 'complete', total: result.filesFound, current: result.filesFound })
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Scan failed')
    }

    return result
  }

  /**
   * Find all video files recursively
   */
  private async findVideoFiles(dir: string): Promise<string[]> {
    const results: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (this.shouldSkipFolder(entry.name)) continue
          const subFiles = await this.findVideoFiles(fullPath)
          results.push(...subFiles)
        } else if (entry.isFile() && fileNamingService.isVideoFile(entry.name)) {
          if (this.isSampleFile(entry.name)) continue
          results.push(fullPath)
        }
      }
    } catch {
      // Ignore permission errors
    }

    return results
  }

  private shouldSkipFolder(name: string): boolean {
    const skipPatterns = [
      /^\./, // Hidden folders
      /^sample$/i,
      /^subs?$/i,
      /^subtitles?$/i,
      /^extras?$/i,
      /^featurettes?$/i,
    ]
    return skipPatterns.some((p) => p.test(name))
  }

  private isSampleFile(name: string): boolean {
    const lowerName = name.toLowerCase()
    return lowerName.includes('sample') || lowerName.includes('-sample.')
  }

  /**
   * Parse files and group by show
   */
  private async parseAndGroupEpisodes(
    files: string[],
    rootFolder: RootFolder,
    onProgress?: ProgressCallback
  ): Promise<Map<string, GroupedShow>> {
    const showMap = new Map<string, GroupedShow>()

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      onProgress?.({
        phase: 'parsing',
        total: files.length,
        current: i + 1,
        currentItem: path.basename(filePath),
      })

      const relativePath = path.relative(rootFolder.path, filePath)
      const parsed = tvShowParser.parseFromPath(relativePath)

      // Skip files without episode info
      if (!parsed.seasonNumber || !parsed.episodeNumber) {
        continue
      }

      const stats = await fs.stat(filePath)

      // Group by normalized show title + year
      const showKey = this.normalizeTitle(parsed.showTitle) + (parsed.year || '')

      if (!showMap.has(showKey)) {
        showMap.set(showKey, {
          showTitle: parsed.showTitle,
          year: parsed.year,
          episodes: [],
        })
      }

      showMap.get(showKey)!.episodes.push({
        filePath,
        relativePath,
        parsed,
        fileSize: stats.size,
      })
    }

    return showMap
  }

  /**
   * Process a single show with all its episodes
   */
  private async processShow(
    showData: GroupedShow,
    rootFolder: RootFolder
  ): Promise<{
    showCreated: boolean
    episodesCreated: number
    episodesUpdated: number
    unmatchedFiles: number
  }> {
    let showCreated = false
    let episodesCreated = 0
    let episodesUpdated = 0
    let unmatchedFiles = 0

    // Find or create the TV show
    let tvShow = await this.findExistingShow(showData.showTitle, showData.year, rootFolder.id)

    if (!tvShow) {
      // Try TMDB lookup
      const tmdbResult = await this.lookupTmdb(showData.showTitle, showData.year)

      if (tmdbResult) {
        // Check if show with this TMDB ID exists
        tvShow = await TvShow.query().where('tmdbId', String(tmdbResult.id)).first()

        if (!tvShow) {
          tvShow = await this.createShowFromTmdb(tmdbResult, rootFolder.id)
          showCreated = true
        }
      } else {
        // Create from parsed info
        tvShow = await this.createShowFromParsed(showData, rootFolder.id)
        showCreated = true
      }
    }

    // Process each episode
    for (const episode of showData.episodes) {
      try {
        const result = await this.processEpisode(episode, tvShow, rootFolder)
        if (result.created) episodesCreated++
        else if (result.updated) episodesUpdated++
        else if (result.unmatched) unmatchedFiles++
      } catch {
        unmatchedFiles++
      }
    }

    // Update show statistics
    await this.updateShowStats(tvShow)

    return { showCreated, episodesCreated, episodesUpdated, unmatchedFiles }
  }

  /**
   * Process a single episode
   */
  private async processEpisode(
    scanned: ScannedEpisode,
    tvShow: TvShow,
    _rootFolder: RootFolder
  ): Promise<{ created: boolean; updated: boolean; unmatched: boolean }> {
    const { parsed, relativePath, fileSize } = scanned

    // Check if file already exists
    const existingFile = await EpisodeFile.query().where('relativePath', relativePath).first()

    if (existingFile) {
      if (existingFile.sizeBytes === fileSize) {
        return { created: false, updated: false, unmatched: false }
      }
      existingFile.sizeBytes = fileSize
      await existingFile.save()
      return { created: false, updated: true, unmatched: false }
    }

    // Find or create season
    let season = await Season.query()
      .where('tvShowId', tvShow.id)
      .where('seasonNumber', parsed.seasonNumber!)
      .first()

    if (!season) {
      season = await Season.create({
        tvShowId: tvShow.id,
        seasonNumber: parsed.seasonNumber!,
      })
    }

    // Find or create episode
    let episode = await Episode.query()
      .where('tvShowId', tvShow.id)
      .where('seasonNumber', parsed.seasonNumber!)
      .where('episodeNumber', parsed.episodeNumber!)
      .first()

    if (!episode) {
      episode = await Episode.create({
        tvShowId: tvShow.id,
        seasonId: season.id,
        seasonNumber: parsed.seasonNumber!,
        episodeNumber: parsed.episodeNumber!,
        title: parsed.episodeTitle || `Episode ${parsed.episodeNumber}`,
        hasFile: false,
      })
    }

    // Create episode file
    await EpisodeFile.create({
      episodeId: episode.id,
      tvShowId: tvShow.id,
      relativePath,
      sizeBytes: fileSize,
      quality: parsed.quality || 'Unknown',
      dateAdded: DateTime.now(),
    })

    // Update episode status
    episode.hasFile = true
    await episode.save()

    return { created: true, updated: false, unmatched: false }
  }

  /**
   * Find existing show
   */
  private async findExistingShow(
    title: string,
    year: number | undefined,
    rootFolderId: string
  ): Promise<TvShow | null> {
    const query = TvShow.query().where('rootFolderId', rootFolderId)

    if (year) {
      query.where('year', year)
    }

    // Try exact match
    let show = await query.clone().whereILike('title', title).first()
    if (show) return show

    // Try normalized match
    const normalizedTitle = this.normalizeTitle(title)
    const candidates = await query.clone().exec()

    for (const candidate of candidates) {
      if (this.normalizeTitle(candidate.title) === normalizedTitle) {
        return candidate
      }
    }

    return null
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim()
  }

  /**
   * TMDB lookup
   */
  private async lookupTmdb(title: string, year?: number): Promise<TmdbTvShow | null> {
    try {
      const results = await tmdbService.searchTvShows(title, year)

      if (results.length === 0) {
        const resultsNoYear = await tmdbService.searchTvShows(title)
        if (resultsNoYear.length > 0) {
          if (year) {
            const yearMatch = resultsNoYear.find((s) => s.year === year)
            if (yearMatch) return yearMatch
          }
          return resultsNoYear[0]
        }
        return null
      }

      return results[0]
    } catch {
      return null
    }
  }

  /**
   * Create show from TMDB data
   */
  private async createShowFromTmdb(tmdb: TmdbTvShow, rootFolderId: string): Promise<TvShow> {
    // Fetch alternate titles and detect series type
    const alternateTitles = await tmdbService
      .getTvShowAlternateTitles(tmdb.id)
      .catch(() => [] as string[])
    const seriesType = tmdbService.detectSeriesType(tmdb)

    return TvShow.create({
      tmdbId: String(tmdb.id),
      title: tmdb.name,
      originalTitle: tmdb.originalName,
      sortTitle: this.generateSortTitle(tmdb.name),
      overview: tmdb.overview,
      firstAired: tmdb.firstAirDate ? DateTime.fromISO(tmdb.firstAirDate) : null,
      year: tmdb.year,
      status: this.mapTmdbStatus(tmdb.status),
      network: tmdb.networks[0] || null,
      posterUrl: tmdb.posterPath,
      backdropUrl: tmdb.backdropPath,
      rating: tmdb.voteAverage,
      votes: tmdb.voteCount,
      genres: tmdb.genres,
      seasonCount: tmdb.numberOfSeasons,
      episodeCount: tmdb.numberOfEpisodes,
      imdbId: tmdb.imdbId,
      tvdbId: tmdb.tvdbId,
      requested: false,
      needsReview: false,
      rootFolderId,
      addedAt: DateTime.now(),
      alternateTitles,
      seriesType,
    })
  }

  /**
   * Create show from parsed info
   */
  private async createShowFromParsed(showData: GroupedShow, rootFolderId: string): Promise<TvShow> {
    return TvShow.create({
      title: showData.showTitle,
      sortTitle: this.generateSortTitle(showData.showTitle),
      year: showData.year,
      status: 'unknown',
      seasonCount: 0,
      episodeCount: 0,
      requested: false,
      needsReview: true,
      rootFolderId,
      addedAt: DateTime.now(),
      genres: [],
    })
  }

  private mapTmdbStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'Returning Series': 'continuing',
      'In Production': 'continuing',
      'Planned': 'upcoming',
      'Ended': 'ended',
      'Canceled': 'ended',
      'Pilot': 'upcoming',
    }
    return statusMap[status] || 'unknown'
  }

  private generateSortTitle(title: string): string {
    const articles = ['the ', 'a ', 'an ']
    const lowerTitle = title.toLowerCase()

    for (const article of articles) {
      if (lowerTitle.startsWith(article)) {
        return title.substring(article.length)
      }
    }

    return title
  }

  /**
   * Update show statistics
   */
  private async updateShowStats(tvShow: TvShow): Promise<void> {
    // Update each season's episode count
    const seasons = await Season.query().where('tvShowId', tvShow.id)
    for (const season of seasons) {
      const episodeCountResult = await Episode.query()
        .where('seasonId', season.id)
        .count('* as total')
      season.episodeCount = Number(episodeCountResult[0].$extras.total) || 0
      await season.save()
    }

    // Update show's total counts
    const seasonCount = await Season.query().where('tvShowId', tvShow.id).count('* as total')
    const episodeCount = await Episode.query().where('tvShowId', tvShow.id).count('* as total')

    tvShow.seasonCount = Number(seasonCount[0].$extras.total) || 0
    tvShow.episodeCount = Number(episodeCount[0].$extras.total) || 0
    await tvShow.save()
  }
}

export const tvShowScannerService = new TvShowScannerService()
