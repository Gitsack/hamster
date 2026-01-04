import fs from 'node:fs/promises'
import path from 'node:path'
import { DateTime } from 'luxon'
import { fileNamingService } from './file_naming_service.js'
import { movieParser, type ParsedMovieInfo } from './parsers/movie_parser.js'
import { tmdbService, type TmdbMovie } from '../metadata/tmdb_service.js'
import RootFolder from '#models/root_folder'
import Movie from '#models/movie'
import MovieFile from '#models/movie_file'
import UnmatchedFile from '#models/unmatched_file'

export interface ScanProgress {
  phase: 'discovering' | 'parsing' | 'metadata' | 'importing' | 'complete'
  total: number
  current: number
  currentItem?: string
}

export interface ScanResult {
  filesFound: number
  moviesCreated: number
  moviesUpdated: number
  unmatchedFiles: number
  errors: string[]
}

type ProgressCallback = (progress: ScanProgress) => void

interface ScannedMovie {
  filePath: string
  relativePath: string
  folderPath: string
  parsed: ParsedMovieInfo
  fileSize: number
}

/**
 * Service for scanning movie directories and creating library entries.
 */
export class MovieScannerService {
  /**
   * Scan a root folder for movies
   */
  async scanRootFolder(rootFolderId: string, onProgress?: ProgressCallback): Promise<ScanResult> {
    const rootFolder = await RootFolder.find(rootFolderId)
    if (!rootFolder) {
      return {
        filesFound: 0,
        moviesCreated: 0,
        moviesUpdated: 0,
        unmatchedFiles: 0,
        errors: ['Root folder not found'],
      }
    }

    if (rootFolder.mediaType !== 'movies') {
      return {
        filesFound: 0,
        moviesCreated: 0,
        moviesUpdated: 0,
        unmatchedFiles: 0,
        errors: ['Root folder is not configured for movies'],
      }
    }

    return this.scanDirectory(rootFolder.path, rootFolder, onProgress)
  }

  /**
   * Scan a directory for movie files
   */
  async scanDirectory(
    directory: string,
    rootFolder: RootFolder,
    onProgress?: ProgressCallback
  ): Promise<ScanResult> {
    const result: ScanResult = {
      filesFound: 0,
      moviesCreated: 0,
      moviesUpdated: 0,
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

      // Phase 2: Parse folder/file names and group by movie folder
      onProgress?.({ phase: 'parsing', total: videoFiles.length, current: 0 })
      const scannedMovies = await this.parseMovieFiles(videoFiles, rootFolder, onProgress)

      // Phase 3: Look up metadata and create/update entries
      onProgress?.({ phase: 'metadata', total: scannedMovies.length, current: 0 })

      for (let i = 0; i < scannedMovies.length; i++) {
        const scanned = scannedMovies[i]
        onProgress?.({
          phase: 'importing',
          total: scannedMovies.length,
          current: i + 1,
          currentItem: scanned.parsed.title,
        })

        try {
          const processed = await this.processMovie(scanned, rootFolder)
          if (processed.created) result.moviesCreated++
          else if (processed.updated) result.moviesUpdated++
          else if (processed.unmatched) result.unmatchedFiles++
        } catch (error) {
          result.errors.push(
            `${scanned.parsed.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
          result.unmatchedFiles++
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
          // Skip common non-movie folders
          if (this.shouldSkipFolder(entry.name)) continue
          const subFiles = await this.findVideoFiles(fullPath)
          results.push(...subFiles)
        } else if (entry.isFile() && fileNamingService.isVideoFile(entry.name)) {
          // Skip sample files
          if (this.isSampleFile(entry.name)) continue
          results.push(fullPath)
        }
      }
    } catch {
      // Ignore permission errors
    }

    return results
  }

  /**
   * Check if folder should be skipped
   */
  private shouldSkipFolder(name: string): boolean {
    const skipPatterns = [
      /^\./, // Hidden folders
      /^sample$/i,
      /^subs?$/i,
      /^subtitles?$/i,
      /^extras?$/i,
      /^featurettes?$/i,
      /^behind.?the.?scenes?$/i,
      /^deleted.?scenes?$/i,
    ]
    return skipPatterns.some((p) => p.test(name))
  }

  /**
   * Check if file is a sample
   */
  private isSampleFile(name: string): boolean {
    const lowerName = name.toLowerCase()
    return lowerName.includes('sample') || lowerName.includes('-sample.')
  }

  /**
   * Parse movie files and group by movie folder
   */
  private async parseMovieFiles(
    files: string[],
    rootFolder: RootFolder,
    onProgress?: ProgressCallback
  ): Promise<ScannedMovie[]> {
    const movieMap = new Map<string, ScannedMovie>()

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      onProgress?.({
        phase: 'parsing',
        total: files.length,
        current: i + 1,
        currentItem: path.basename(filePath),
      })

      const relativePath = path.relative(rootFolder.path, filePath)
      const folderPath = path.dirname(relativePath)

      // Use folder path as key to group files in same movie folder
      // Pick the largest file as the main movie file
      const stats = await fs.stat(filePath)

      const existing = movieMap.get(folderPath)
      if (!existing || stats.size > existing.fileSize) {
        const parsed = movieParser.parseFromPath(relativePath)
        movieMap.set(folderPath, {
          filePath,
          relativePath,
          folderPath,
          parsed,
          fileSize: stats.size,
        })
      }
    }

    return Array.from(movieMap.values())
  }

  /**
   * Process a single scanned movie
   */
  private async processMovie(
    scanned: ScannedMovie,
    rootFolder: RootFolder
  ): Promise<{ created: boolean; updated: boolean; unmatched: boolean }> {
    const { parsed, relativePath, fileSize } = scanned

    // Check if this file already exists in the database
    const existingFile = await MovieFile.query().where('relativePath', relativePath).first()

    if (existingFile) {
      // File already imported - check if size changed
      if (existingFile.sizeBytes === fileSize) {
        return { created: false, updated: false, unmatched: false }
      }
      // Update file size
      existingFile.sizeBytes = fileSize
      await existingFile.save()
      return { created: false, updated: true, unmatched: false }
    }

    // Try to find existing movie by title/year
    let movie = await this.findExistingMovie(parsed, rootFolder.id)

    // If not found, try TMDB lookup
    let needsReview = false
    if (!movie) {
      const tmdbResult = await this.lookupTmdb(parsed)

      if (tmdbResult) {
        // Check if movie with this TMDB ID already exists
        movie = await Movie.query().where('tmdbId', String(tmdbResult.id)).first()

        if (!movie) {
          // Create new movie from TMDB data
          movie = await this.createMovieFromTmdb(tmdbResult, rootFolder.id)
        }
      } else {
        // No TMDB match - create with parsed info and mark for review
        movie = await this.createMovieFromParsed(parsed, rootFolder.id)
        needsReview = true
      }
    }

    // Create movie file record
    await MovieFile.create({
      movieId: movie.id,
      relativePath,
      sizeBytes: fileSize,
      quality: parsed.quality || 'Unknown',
      dateAdded: DateTime.now(),
    })

    // Update movie status
    movie.hasFile = true
    movie.needsReview = needsReview
    await movie.save()

    return { created: true, updated: false, unmatched: false }
  }

  /**
   * Find existing movie by title and year
   */
  private async findExistingMovie(
    parsed: ParsedMovieInfo,
    rootFolderId: string
  ): Promise<Movie | null> {
    const query = Movie.query().where('rootFolderId', rootFolderId)

    if (parsed.year) {
      query.where('year', parsed.year)
    }

    // Try exact title match first
    let movie = await query.clone().whereILike('title', parsed.title).first()
    if (movie) return movie

    // Try fuzzy match - normalize titles
    const normalizedTitle = this.normalizeTitle(parsed.title)
    const candidates = await query.clone().exec()

    for (const candidate of candidates) {
      if (this.normalizeTitle(candidate.title) === normalizedTitle) {
        return candidate
      }
    }

    return null
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim()
  }

  /**
   * Look up movie in TMDB
   */
  private async lookupTmdb(parsed: ParsedMovieInfo): Promise<TmdbMovie | null> {
    try {
      const results = await tmdbService.searchMovies(parsed.title, parsed.year)

      if (results.length === 0) {
        // Try without year
        const resultsNoYear = await tmdbService.searchMovies(parsed.title)
        if (resultsNoYear.length > 0) {
          // If we have a year, prefer matches with that year
          if (parsed.year) {
            const yearMatch = resultsNoYear.find((m) => m.year === parsed.year)
            if (yearMatch) return yearMatch
          }
          return resultsNoYear[0]
        }
        return null
      }

      // Return best match
      return results[0]
    } catch {
      // TMDB lookup failed - continue without metadata
      return null
    }
  }

  /**
   * Create movie from TMDB data
   */
  private async createMovieFromTmdb(tmdb: TmdbMovie, rootFolderId: string): Promise<Movie> {
    return Movie.create({
      tmdbId: String(tmdb.id),
      imdbId: tmdb.imdbId,
      title: tmdb.title,
      originalTitle: tmdb.originalTitle,
      sortTitle: this.generateSortTitle(tmdb.title),
      overview: tmdb.overview,
      releaseDate: tmdb.releaseDate ? DateTime.fromISO(tmdb.releaseDate) : null,
      year: tmdb.year,
      runtime: tmdb.runtime,
      status: tmdb.status,
      posterUrl: tmdb.posterPath,
      backdropUrl: tmdb.backdropPath,
      rating: tmdb.voteAverage,
      votes: tmdb.voteCount,
      genres: tmdb.genres,
      requested: false,
      hasFile: false, // Will be set to true after file is linked
      needsReview: false,
      rootFolderId,
      addedAt: DateTime.now(),
    })
  }

  /**
   * Create movie from parsed info (when TMDB lookup fails)
   */
  private async createMovieFromParsed(
    parsed: ParsedMovieInfo,
    rootFolderId: string
  ): Promise<Movie> {
    return Movie.create({
      title: parsed.title,
      sortTitle: this.generateSortTitle(parsed.title),
      year: parsed.year,
      requested: false,
      hasFile: false,
      needsReview: true,
      rootFolderId,
      addedAt: DateTime.now(),
      genres: [],
    })
  }

  /**
   * Generate sort title (remove leading articles)
   */
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
   * Create unmatched file record
   */
  async createUnmatchedFile(
    rootFolderId: string,
    relativePath: string,
    parsed: ParsedMovieInfo,
    fileSize: number
  ): Promise<void> {
    await UnmatchedFile.create({
      rootFolderId,
      relativePath,
      fileName: path.basename(relativePath),
      mediaType: 'movies',
      fileSizeBytes: fileSize,
      parsedInfo: {
        title: parsed.title,
        year: parsed.year,
        quality: parsed.quality,
      },
      status: 'pending',
    })
  }
}

export const movieScannerService = new MovieScannerService()
