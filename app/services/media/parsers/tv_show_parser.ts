/**
 * TV Show file/folder parser
 *
 * Parses folder and file names to extract TV show information.
 * Supports various naming conventions:
 * - "Show Name (2020)/Season 01/Show Name - S01E01 - Episode Title.mkv"
 * - "Show.Name.S01E01.Episode.Title.1080p.WEB-DL.mkv"
 * - "Show Name/Season 1/1x01 - Episode Title.mkv"
 * - "Show.Name.2020.S01E01.mkv"
 */

export interface ParsedTvShowInfo {
  showTitle: string
  year?: number
  seasonNumber?: number
  episodeNumber?: number
  episodeTitle?: string
  quality?: string
  resolution?: string
  source?: string
  isMultiEpisode?: boolean
  endEpisodeNumber?: number
}

// Quality indicators
const RESOLUTIONS = ['2160p', '4k', '1080p', '720p', '576p', '480p', '360p']
const SOURCES = [
  'bluray',
  'blu-ray',
  'bdrip',
  'brrip',
  'remux',
  'webrip',
  'web-dl',
  'webdl',
  'web',
  'hdtv',
  'hdrip',
  'amzn',
  'nf',
  'netflix',
  'hulu',
  'dsnp',
  'atvp',
  'hmax',
]

export class TvShowParser {
  /**
   * Parse a full relative path to extract all TV show information
   * Expects formats like:
   * - "Show Name (2020)/Season 01/S01E01 - Episode.mkv"
   * - "Show Name/Season 1/1x01 - Episode.mkv"
   * - Single file: "Show.Name.S01E01.Episode.Title.mkv"
   */
  parseFromPath(relativePath: string): ParsedTvShowInfo {
    const parts = relativePath.split('/').filter((p) => p.length > 0)

    if (parts.length >= 3) {
      // Full path structure: Show/Season/Episode
      return this.parseFullStructure(parts)
    } else if (parts.length === 2) {
      // Show/Episode or Season/Episode
      return this.parseTwoPartStructure(parts)
    } else if (parts.length === 1) {
      // Single file with all info encoded in filename
      return this.parseFileName(parts[0])
    }

    return { showTitle: 'Unknown' }
  }

  /**
   * Parse just a file name (for scene release format)
   */
  parseFileName(fileName: string): ParsedTvShowInfo {
    const cleanName = this.removeExtension(fileName)

    // Extract episode info first (S01E01 pattern)
    const episodeInfo = this.extractEpisodeInfo(cleanName)

    // Extract year
    const yearResult = this.extractYear(cleanName)

    // Extract quality
    const quality = this.extractQuality(cleanName)

    // Extract show title (everything before S##E##)
    const showTitle = this.extractShowTitle(cleanName, episodeInfo, yearResult.year)

    // Extract episode title (everything after S##E## and before quality indicators)
    const episodeTitle = this.extractEpisodeTitle(cleanName, episodeInfo, quality)

    return {
      showTitle,
      year: yearResult.year,
      seasonNumber: episodeInfo?.seasonNumber,
      episodeNumber: episodeInfo?.episodeNumber,
      episodeTitle,
      quality: this.formatQuality(quality),
      resolution: quality.resolution,
      source: quality.source,
      isMultiEpisode: episodeInfo?.isMultiEpisode,
      endEpisodeNumber: episodeInfo?.endEpisodeNumber,
    }
  }

  /**
   * Parse a full 3-level structure (Show/Season/Episode)
   */
  private parseFullStructure(parts: string[]): ParsedTvShowInfo {
    const [showFolder, seasonFolder, episodeFile] = parts

    // Parse show folder for title and year
    const showInfo = this.parseShowFolder(showFolder)

    // Parse season folder for season number
    const seasonNumber = this.parseSeasonFolder(seasonFolder)

    // Parse episode file for episode details
    const episodeInfo = this.parseFileName(episodeFile)

    return {
      showTitle: showInfo.title,
      year: showInfo.year || episodeInfo.year,
      seasonNumber: seasonNumber || episodeInfo.seasonNumber,
      episodeNumber: episodeInfo.episodeNumber,
      episodeTitle: episodeInfo.episodeTitle,
      quality: episodeInfo.quality,
      resolution: episodeInfo.resolution,
      source: episodeInfo.source,
      isMultiEpisode: episodeInfo.isMultiEpisode,
      endEpisodeNumber: episodeInfo.endEpisodeNumber,
    }
  }

  /**
   * Parse a 2-level structure
   */
  private parseTwoPartStructure(parts: string[]): ParsedTvShowInfo {
    const [first, second] = parts

    // Check if first part is a season folder
    const seasonNumber = this.parseSeasonFolder(first)
    if (seasonNumber !== undefined) {
      // First part is season, use file name for everything else
      const episodeInfo = this.parseFileName(second)
      return {
        ...episodeInfo,
        seasonNumber: seasonNumber,
      }
    }

    // First part is show name, second is episode
    const showInfo = this.parseShowFolder(first)
    const episodeInfo = this.parseFileName(second)

    return {
      showTitle: showInfo.title,
      year: showInfo.year || episodeInfo.year,
      seasonNumber: episodeInfo.seasonNumber,
      episodeNumber: episodeInfo.episodeNumber,
      episodeTitle: episodeInfo.episodeTitle,
      quality: episodeInfo.quality,
      resolution: episodeInfo.resolution,
      source: episodeInfo.source,
    }
  }

  /**
   * Parse show folder name for title and year
   */
  private parseShowFolder(folderName: string): { title: string; year?: number } {
    const yearResult = this.extractYear(folderName)
    const title = this.cleanShowTitle(yearResult.remaining)
    return { title, year: yearResult.year }
  }

  /**
   * Parse season folder name for season number
   */
  private parseSeasonFolder(folderName: string): number | undefined {
    const patterns = [
      // "Season 01", "Season 1"
      /^season\s*(\d+)$/i,
      // "S01", "S1"
      /^s(\d+)$/i,
      // "Staffel 01" (German)
      /^staffel\s*(\d+)$/i,
      // "Saison 01" (French)
      /^saison\s*(\d+)$/i,
      // Just a number
      /^(\d{1,2})$/,
    ]

    for (const pattern of patterns) {
      const match = folderName.match(pattern)
      if (match) {
        return Number.parseInt(match[1], 10)
      }
    }

    return undefined
  }

  private removeExtension(name: string): string {
    const videoExtensions = [
      '.mkv',
      '.mp4',
      '.avi',
      '.mov',
      '.wmv',
      '.flv',
      '.webm',
      '.m4v',
      '.mpg',
      '.mpeg',
      '.ts',
      '.m2ts',
      '.vob',
      '.ogv',
    ]
    const lowerName = name.toLowerCase()
    for (const ext of videoExtensions) {
      if (lowerName.endsWith(ext)) {
        return name.slice(0, -ext.length)
      }
    }
    return name
  }

  private extractEpisodeInfo(name: string): {
    seasonNumber: number
    episodeNumber: number
    isMultiEpisode?: boolean
    endEpisodeNumber?: number
  } | null {
    const patterns = [
      // "S01E01-E03" or "S01E01-03" (multi-episode)
      /S(\d{1,2})E(\d{1,3})[-E](\d{1,3})/i,
      // "S01E01E02" (multi-episode)
      /S(\d{1,2})E(\d{1,3})E(\d{1,3})/i,
      // "S01E01"
      /S(\d{1,2})E(\d{1,3})/i,
      // "1x01"
      /(\d{1,2})x(\d{2,3})/i,
      // "s01.e01"
      /s(\d{1,2})\.?e(\d{1,3})/i,
    ]

    for (const pattern of patterns) {
      const match = name.match(pattern)
      if (match) {
        const result = {
          seasonNumber: Number.parseInt(match[1], 10),
          episodeNumber: Number.parseInt(match[2], 10),
          isMultiEpisode: false as boolean | undefined,
          endEpisodeNumber: undefined as number | undefined,
        }

        if (match[3]) {
          result.isMultiEpisode = true
          result.endEpisodeNumber = Number.parseInt(match[3], 10)
        }

        return result
      }
    }

    return null
  }

  private extractYear(name: string): { year?: number; remaining: string } {
    // Standard patterns for year in parentheses, brackets, or dots
    const patterns = [/\((\d{4})\)/, /\[(\d{4})\]/, /\.(\d{4})\./]

    for (const pattern of patterns) {
      const match = name.match(pattern)
      if (match) {
        const year = Number.parseInt(match[1], 10)
        if (year >= 1900 && year <= 2099) {
          const remaining = name.replace(match[0], ' ')
          return { year, remaining }
        }
      }
    }

    // Try to match space-separated year before episode pattern (e.g., "Show Name 2023 S01E01")
    const spaceYearMatch = name.match(/\s(\d{4})\s+(?:S\d{1,2}E\d{1,3}|\d{1,2}x\d{2,3})/i)
    if (spaceYearMatch) {
      const year = Number.parseInt(spaceYearMatch[1], 10)
      if (year >= 1900 && year <= 2099) {
        const remaining = name.replace(spaceYearMatch[1], '')
        return { year, remaining }
      }
    }

    return { remaining: name }
  }

  private extractQuality(name: string): { resolution?: string; source?: string } {
    const lowerName = name.toLowerCase()
    const result: { resolution?: string; source?: string } = {}

    for (const res of RESOLUTIONS) {
      if (lowerName.includes(res.toLowerCase())) {
        result.resolution = res
        break
      }
    }

    for (const src of SOURCES) {
      if (lowerName.includes(src.toLowerCase())) {
        result.source = src.toUpperCase()
        break
      }
    }

    return result
  }

  private extractShowTitle(
    name: string,
    episodeInfo: { seasonNumber: number; episodeNumber: number } | null,
    year?: number
  ): string {
    let title = name

    // Remove everything from S##E## onwards
    if (episodeInfo) {
      const sePattern = /[.\s_-]?S\d{1,2}E\d{1,3}.*/i
      const xPattern = /[.\s_-]?\d{1,2}x\d{2,3}.*/i
      title = title.replace(sePattern, '').replace(xPattern, '')
    }

    // Remove year (in parentheses, brackets, dots, or space-separated)
    if (year) {
      title = title.replace(
        new RegExp(`\\(${year}\\)|\\[${year}\\]|\\.${year}|\\s${year}(?=\\s|$)`, 'g'),
        ''
      )
    }

    return this.cleanShowTitle(title)
  }

  private extractEpisodeTitle(
    name: string,
    episodeInfo: { seasonNumber: number; episodeNumber: number } | null,
    _quality: { resolution?: string; source?: string }
  ): string | undefined {
    if (!episodeInfo) return undefined

    // Find the episode pattern and extract what comes after
    const patterns = [/S\d{1,2}E\d{1,3}(?:[-E]\d{1,3})?\s*[-.]?\s*/i, /\d{1,2}x\d{2,3}\s*[-.]?\s*/i]

    for (const pattern of patterns) {
      const match = name.match(pattern)
      if (match) {
        const afterEpisode = name.substring(match.index! + match[0].length)

        // Clean up the episode title
        let episodeTitle = afterEpisode

        // Remove quality indicators
        const qualityTerms = [...RESOLUTIONS, ...SOURCES]
        for (const term of qualityTerms) {
          const regex = new RegExp(`[.\\s_-]?${term}.*$`, 'gi')
          episodeTitle = episodeTitle.replace(regex, '')
        }

        // Replace dots/underscores with spaces
        episodeTitle = episodeTitle.replace(/[._]/g, ' ').trim()

        // Remove trailing dashes
        episodeTitle = episodeTitle.replace(/\s*-\s*$/, '')

        if (episodeTitle.length > 0) {
          return episodeTitle
        }
      }
    }

    return undefined
  }

  private cleanShowTitle(title: string): string {
    // Replace dots and underscores with spaces
    title = title.replace(/[._]/g, ' ')

    // Collapse multiple spaces
    title = title.replace(/\s+/g, ' ')

    // Remove trailing dashes and spaces
    title = title.replace(/\s*-\s*$/, '')

    return title.trim() || 'Unknown'
  }

  private formatQuality(quality: { resolution?: string; source?: string }): string | undefined {
    const parts: string[] = []
    if (quality.resolution) parts.push(quality.resolution)
    if (quality.source) parts.push(quality.source)
    return parts.length > 0 ? parts.join(' ') : undefined
  }
}

export const tvShowParser = new TvShowParser()
