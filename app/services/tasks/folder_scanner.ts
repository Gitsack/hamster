import fs from 'node:fs/promises'
import path from 'node:path'
import DownloadClient from '#models/download_client'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Album from '#models/album'
import Book from '#models/book'
import Download from '#models/download'
import { movieImportService } from '#services/media/movie_import_service'
import { episodeImportService } from '#services/media/episode_import_service'
import { downloadImportService } from '#services/media/download_import_service'
import { bookImportService } from '#services/media/book_import_service'
import { DateTime } from 'luxon'

/**
 * Service that directly scans download folders on the filesystem
 * for completed downloads, independent of download client APIs.
 *
 * This is more resilient than API-based scanning because:
 * - Works even if download client is offline
 * - Catches manually added files
 * - Works if download client history was cleared
 */
class FolderScanner {
  private isRunning = false

  /**
   * Scan all configured download client folders for importable media
   */
  async scan(): Promise<{ processed: number; imported: number; errors: string[] }> {
    if (this.isRunning) {
      console.log('[FolderScanner] Already running, skipping...')
      return { processed: 0, imported: 0, errors: [] }
    }

    this.isRunning = true
    const results = { processed: 0, imported: 0, errors: [] as string[] }

    try {
      console.log('[FolderScanner] Scanning download folders...')

      // Get all download clients to find their complete directories
      const clients = await DownloadClient.query().where('enabled', true)

      for (const client of clients) {
        try {
          const clientResults = await this.scanClientFolder(client)
          results.processed += clientResults.processed
          results.imported += clientResults.imported
          results.errors.push(...clientResults.errors)
        } catch (error) {
          const msg = `Failed to scan folder for ${client.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`[FolderScanner] ${msg}`)
          results.errors.push(msg)
        }
      }

      console.log(
        `[FolderScanner] Scan complete: ${results.processed} folders processed, ${results.imported} imported`
      )
    } finally {
      this.isRunning = false
    }

    return results
  }

  /**
   * Scan a specific download client's complete folder
   */
  private async scanClientFolder(
    client: DownloadClient
  ): Promise<{ processed: number; imported: number; errors: string[] }> {
    const results = { processed: 0, imported: 0, errors: [] as string[] }

    // Get the local path for the complete folder
    const localPath = client.settings?.localPath
    if (!localPath) {
      console.log(`[FolderScanner] No local path configured for ${client.name}, skipping`)
      return results
    }

    // Check if folder exists
    try {
      await fs.access(localPath)
    } catch {
      console.log(`[FolderScanner] Local path not accessible: ${localPath}`)
      return results
    }

    // List all folders in the complete directory
    const entries = await fs.readdir(localPath, { withFileTypes: true })
    const folders = entries.filter((e) => e.isDirectory())

    console.log(`[FolderScanner] Found ${folders.length} folders in ${localPath}`)

    for (const folder of folders) {
      results.processed++
      const folderPath = path.join(localPath, folder.name)

      try {
        // Check if this folder was already imported
        const existingDownload = await Download.query()
          .where('outputPath', folderPath)
          .where('status', 'completed')
          .first()

        if (existingDownload) {
          // Already imported, skip
          continue
        }

        // Try to match to a library item
        const match = await this.matchToLibrary(folder.name)

        if (!match) {
          // Can't match, skip silently
          continue
        }

        // Check if library item already has files
        const hasFile = await this.checkIfAlreadyHasFile(match)
        if (hasFile) {
          // Already has file, skip
          continue
        }

        console.log(
          `[FolderScanner] Found importable folder: ${folder.name} -> ${match.type} (${match.title})`
        )

        // Create a download record and import
        const importResult = await this.importFolder(folderPath, match, client)

        if (importResult.success) {
          results.imported++
          console.log(`[FolderScanner] Successfully imported: ${folder.name}`)
        } else if (importResult.error) {
          results.errors.push(`${folder.name}: ${importResult.error}`)
        }
      } catch (error) {
        results.errors.push(
          `${folder.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return results
  }

  /**
   * Check if a library item already has files
   */
  private async checkIfAlreadyHasFile(match: { type: string; id: string }): Promise<boolean> {
    switch (match.type) {
      case 'movie': {
        const movie = await Movie.find(match.id)
        return movie?.hasFile ?? false
      }
      case 'episode': {
        const episode = await Episode.find(match.id)
        return episode?.hasFile ?? false
      }
      case 'album': {
        const album = await Album.query().where('id', match.id).preload('trackFiles').first()
        return (album?.trackFiles?.length ?? 0) > 0
      }
      case 'book': {
        const book = await Book.find(match.id)
        return book?.hasFile ?? false
      }
      default:
        return false
    }
  }

  /**
   * Import a folder
   */
  private async importFolder(
    folderPath: string,
    match: { type: string; id: string; title: string; tvShowId?: string },
    client: DownloadClient
  ): Promise<{ success: boolean; error?: string }> {
    // Create a download record
    const download = await Download.create({
      downloadClientId: client.id,
      title: path.basename(folderPath),
      status: 'importing',
      progress: 100,
      outputPath: folderPath,
      completedAt: DateTime.now(),
      startedAt: DateTime.now(),
      movieId: match.type === 'movie' ? match.id : null,
      tvShowId: match.type === 'episode' ? match.tvShowId : null,
      episodeId: match.type === 'episode' ? match.id : null,
      albumId: match.type === 'album' ? match.id : null,
      bookId: match.type === 'book' ? match.id : null,
    })

    try {
      let result: { success: boolean; filesImported: number; errors: string[] }

      if (download.movieId) {
        result = await movieImportService.importDownload(download)
      } else if (download.tvShowId || download.episodeId) {
        result = await episodeImportService.importDownload(download)
      } else if (download.albumId) {
        result = await downloadImportService.importDownload(download)
      } else if (download.bookId) {
        result = await bookImportService.importDownload(download)
      } else {
        download.status = 'failed'
        download.errorMessage = 'Unknown media type'
        await download.save()
        return { success: false, error: 'Unknown media type' }
      }

      if (result.success) {
        download.status = 'completed'
        await download.save()
        return { success: true }
      } else {
        download.status = 'failed'
        download.errorMessage = result.errors.join('; ')
        await download.save()
        return { success: false, error: result.errors.join('; ') }
      }
    } catch (error) {
      download.status = 'failed'
      download.errorMessage = error instanceof Error ? error.message : 'Import failed'
      await download.save()
      return { success: false, error: download.errorMessage }
    }
  }

  /**
   * Try to match a folder name to a library item
   * Uses a smarter approach: try ALL library types and pick the best match
   */
  private async matchToLibrary(
    folderName: string
  ): Promise<{
    type: 'movie' | 'episode' | 'album' | 'book'
    id: string
    title: string
    tvShowId?: string
  } | null> {
    // Normalize folder name for matching
    const normalized = this.normalizeFolderName(folderName)
    console.log(`[FolderScanner] Matching folder: "${folderName}" -> normalized: "${normalized}"`)

    // Try all media types and collect matches with confidence scores
    const matches: Array<{
      type: 'movie' | 'episode' | 'album' | 'book'
      id: string
      title: string
      tvShowId?: string
      confidence: number
    }> = []

    // Try matching albums (music) - check this first since "Artist - Album" pattern is distinctive
    const albumMatch = await this.matchAlbumFuzzy(folderName, normalized)
    if (albumMatch) {
      matches.push({ ...albumMatch, type: 'album' })
    }

    // Try matching movies
    const movieMatch = await this.matchMovieFuzzy(folderName, normalized)
    if (movieMatch) {
      matches.push({ ...movieMatch, type: 'movie' })
    }

    // Try matching TV episodes
    const episodeMatch = await this.matchEpisodeFuzzy(folderName, normalized)
    if (episodeMatch) {
      matches.push({ ...episodeMatch, type: 'episode' })
    }

    // Try matching books
    const bookMatch = await this.matchBookFuzzy(folderName, normalized)
    if (bookMatch) {
      matches.push({ ...bookMatch, type: 'book' })
    }

    // Pick the match with highest confidence
    if (matches.length === 0) {
      console.log(`[FolderScanner] No match found for: "${folderName}"`)
      return null
    }

    matches.sort((a, b) => b.confidence - a.confidence)
    const best = matches[0]
    console.log(
      `[FolderScanner] Best match: ${best.type} "${best.title}" (confidence: ${best.confidence.toFixed(2)})`
    )

    return {
      type: best.type,
      id: best.id,
      title: best.title,
      tvShowId: best.tvShowId,
    }
  }

  /**
   * Normalize folder name for matching
   */
  private normalizeFolderName(folderName: string): string {
    return folderName
      .toLowerCase()
      .replace(/-xpost$/i, '')
      .replace(/\./g, ' ')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Match against albums with fuzzy matching
   */
  private async matchAlbumFuzzy(
    original: string,
    normalized: string
  ): Promise<{ id: string; title: string; confidence: number } | null> {
    // Music indicators in folder name
    const musicIndicators =
      /\b(flac|mp3|aac|ogg|wav|alac|dsd|cd|lp|ep|vinyl|320|v0|v2|web|album|discography|\dcd)\b/i
    const hasMusicIndicator = musicIndicators.test(original)

    // Check for "Artist - Album" pattern (with hyphen)
    const hasArtistAlbumPattern = /^[^-]+-[^-]+/.test(original.replace(/\./g, '-'))

    // Albums don't have hasFile - check requested or monitored
    const albums = await Album.query()
      .where((q) => q.where('requested', true).orWhere('monitored', true))
      .preload('artist')

    let bestMatch: { id: string; title: string; confidence: number } | null = null

    for (const album of albums) {
      const artistName = album.artist?.name || ''
      const albumTitle = album.title

      // Normalize for comparison
      const artistNorm = artistName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const albumNorm = albumTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
      const folderNorm = normalized.replace(/[^a-z0-9]/g, '')

      // Check if folder contains both artist and album
      const hasArtist = folderNorm.includes(artistNorm) || this.isSimilar(folderNorm, artistNorm)
      const hasAlbum = folderNorm.includes(albumNorm) || this.isSimilar(folderNorm, albumNorm)

      if (hasArtist && hasAlbum) {
        // Calculate confidence
        let confidence = 0.5 // Base confidence for matching both

        // Boost if has music indicators
        if (hasMusicIndicator) confidence += 0.3

        // Boost if has "Artist - Album" pattern
        if (hasArtistAlbumPattern) confidence += 0.15

        // Boost based on how much of the folder name is covered
        const coverage = (artistNorm.length + albumNorm.length) / folderNorm.length
        confidence += Math.min(coverage * 0.2, 0.2)

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            id: album.id,
            title: `${artistName} - ${albumTitle}`,
            confidence,
          }
        }
      }
    }

    return bestMatch
  }

  /**
   * Match against movies with fuzzy matching
   */
  private async matchMovieFuzzy(
    original: string,
    normalized: string
  ): Promise<{ id: string; title: string; confidence: number } | null> {
    // Extract year from folder name
    const yearMatch = original.match(/\b(19\d{2}|20\d{2})\b/)
    const folderYear = yearMatch ? parseInt(yearMatch[1]) : null

    // Movie indicators
    const movieIndicators =
      /\b(bluray|bdrip|dvdrip|webrip|web-dl|hdtv|remux|2160p|1080p|720p|480p|4k|uhd|hdrip|x264|x265|hevc|remastered|extended|directors|theatrical|uncut)\b/i
    const hasMovieIndicator = movieIndicators.test(original)

    // Check it's NOT music (no "Artist - Album" with music indicators)
    const musicIndicators = /\b(flac|mp3|cd|lp|vinyl|320|v0|album|\dcd)\b/i
    const hasMusicIndicator = musicIndicators.test(original)

    const movies = await Movie.query().where((q) =>
      q.where('requested', true).orWhere('hasFile', false)
    )

    let bestMatch: { id: string; title: string; confidence: number } | null = null

    for (const movie of movies) {
      const movieNorm = movie.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      const folderNorm = normalized.replace(/[^a-z0-9]/g, '')

      if (this.isSimilar(folderNorm, movieNorm) || folderNorm.includes(movieNorm)) {
        let confidence = 0.4 // Base confidence

        // Boost if year matches
        if (folderYear && movie.year) {
          if (folderYear === movie.year) {
            confidence += 0.3
          } else if (Math.abs(folderYear - movie.year) <= 1) {
            confidence += 0.15
          }
        }

        // Boost if has movie indicators
        if (hasMovieIndicator) confidence += 0.2

        // Penalize if has music indicators
        if (hasMusicIndicator) confidence -= 0.3

        // Boost based on title coverage
        const coverage = movieNorm.length / folderNorm.length
        confidence += Math.min(coverage * 0.15, 0.15)

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            id: movie.id,
            title: movie.title,
            confidence,
          }
        }
      }
    }

    return bestMatch
  }

  /**
   * Match against TV episodes with fuzzy matching
   */
  private async matchEpisodeFuzzy(
    original: string,
    normalized: string
  ): Promise<{ id: string; title: string; tvShowId: string; confidence: number } | null> {
    // TV pattern (S01E01 or 1x01)
    const tvPattern = /S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2})/i
    const tvMatch = original.match(tvPattern)

    if (!tvMatch) {
      return null // Must have episode pattern for TV
    }

    const season = parseInt(tvMatch[1] || tvMatch[3])
    const episode = parseInt(tvMatch[2] || tvMatch[4])

    // TvShow doesn't have hasFile - it's at episode level
    const shows = await TvShow.query().where('requested', true)

    for (const show of shows) {
      const showNorm = show.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      const folderNorm = normalized.replace(/[^a-z0-9]/g, '')

      if (this.isSimilar(folderNorm, showNorm) || folderNorm.includes(showNorm)) {
        // Found show, now find episode
        const ep = await Episode.query()
          .where('tvShowId', show.id)
          .where('seasonNumber', season)
          .where('episodeNumber', episode)
          .first()

        if (ep) {
          return {
            id: ep.id,
            title: `${show.title} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`,
            tvShowId: show.id,
            confidence: 0.9, // High confidence when episode pattern matches
          }
        }
      }
    }

    return null
  }

  /**
   * Match against books with fuzzy matching
   */
  private async matchBookFuzzy(
    original: string,
    normalized: string
  ): Promise<{ id: string; title: string; confidence: number } | null> {
    // Book indicators
    const bookIndicators = /\b(epub|mobi|azw3?|pdf|ebook|audiobook|retail|scan)\b/i
    const hasBookIndicator = bookIndicators.test(original)

    if (!hasBookIndicator) {
      return null // Require book indicator for book matching
    }

    const books = await Book.query()
      .where((q) => q.where('requested', true).orWhere('hasFile', false))
      .preload('author')

    let bestMatch: { id: string; title: string; confidence: number } | null = null

    for (const book of books) {
      const authorName = book.author?.name || ''
      const bookTitle = book.title

      const authorNorm = authorName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const titleNorm = bookTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
      const folderNorm = normalized.replace(/[^a-z0-9]/g, '')

      const hasAuthor = folderNorm.includes(authorNorm) || this.isSimilar(folderNorm, authorNorm)
      const hasTitle = folderNorm.includes(titleNorm) || this.isSimilar(folderNorm, titleNorm)

      if (hasTitle && (hasAuthor || authorNorm.length < 3)) {
        let confidence = 0.5

        if (hasAuthor) confidence += 0.2
        if (hasBookIndicator) confidence += 0.2

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            id: book.id,
            title: `${authorName} - ${bookTitle}`,
            confidence,
          }
        }
      }
    }

    return bestMatch
  }

  private isSimilar(a: string, b: string): boolean {
    if (a.includes(b) || b.includes(a)) {
      return true
    }

    if (a.length < 20 && b.length < 20) {
      const distance = this.levenshteinDistance(a, b)
      const maxLength = Math.max(a.length, b.length)
      return distance / maxLength < 0.3
    }

    return false
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[b.length][a.length]
  }
}

export const folderScanner = new FolderScanner()
