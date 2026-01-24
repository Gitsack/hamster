/**
 * Movie file/folder parser
 *
 * Parses folder and file names to extract movie information.
 * Supports various naming conventions:
 * - "Movie Title (2020)"
 * - "Movie.Title.2020.1080p.BluRay.x264"
 * - "Movie Title [2020]"
 * - "Movie Title 2020"
 */

export interface ParsedMovieInfo {
  title: string
  year?: number
  quality?: string
  resolution?: string
  source?: string
  codec?: string
  releaseGroup?: string
}

// Quality indicators in order of preference
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
  'dvdrip',
  'dvd',
  'hdcam',
  'cam',
  'ts',
  'telesync',
  'screener',
]
const CODECS = ['x264', 'x265', 'h264', 'h265', 'hevc', 'avc', 'xvid', 'divx', 'av1']

export class MovieParser {
  /**
   * Parse a movie folder or file name
   */
  parse(name: string): ParsedMovieInfo {
    // Remove file extension if present
    const cleanName = this.removeExtension(name)

    // Extract year first
    const yearResult = this.extractYear(cleanName)
    const year = yearResult.year
    let remaining = yearResult.remaining

    // Extract quality info
    const quality = this.extractQuality(remaining)

    // Extract release group (usually at the end after a dash)
    const releaseGroup = this.extractReleaseGroup(remaining)

    // Clean up the title
    const title = this.cleanTitle(remaining, year, quality, releaseGroup)

    return {
      title,
      year,
      quality: this.formatQuality(quality),
      resolution: quality.resolution,
      source: quality.source,
      codec: quality.codec,
      releaseGroup,
    }
  }

  /**
   * Parse a folder path to extract movie info
   * Expects format like: "Movie Title (2020)/Movie Title (2020).mkv"
   */
  parseFromPath(relativePath: string): ParsedMovieInfo {
    const parts = relativePath.split('/')
    // Prefer parsing the folder name (first part) over the file name
    // as folder names are typically cleaner
    const folderName = parts[0]
    return this.parse(folderName)
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

  private extractYear(name: string): { year?: number; remaining: string } {
    // Try patterns in order of specificity
    const patterns = [
      // "(2020)" - most common for organized libraries
      /\((\d{4})\)/,
      // "[2020]"
      /\[(\d{4})\]/,
      // ".2020." - scene releases
      /\.(\d{4})\./,
      // " 2020 " - with spaces
      /\s(\d{4})\s/,
      // ".2020" at end or before quality info
      /\.(\d{4})(?:\.|$)/,
    ]

    for (const pattern of patterns) {
      const match = name.match(pattern)
      if (match) {
        const year = parseInt(match[1], 10)
        // Validate year is reasonable (1900-2099)
        if (year >= 1900 && year <= 2099) {
          const remaining = name.replace(match[0], ' ')
          return { year, remaining }
        }
      }
    }

    return { remaining: name }
  }

  private extractQuality(name: string): {
    resolution?: string
    source?: string
    codec?: string
  } {
    const lowerName = name.toLowerCase()
    const result: { resolution?: string; source?: string; codec?: string } = {}

    // Find resolution
    for (const res of RESOLUTIONS) {
      if (lowerName.includes(res.toLowerCase())) {
        result.resolution = res
        break
      }
    }

    // Find source
    for (const src of SOURCES) {
      if (lowerName.includes(src.toLowerCase())) {
        result.source = src.toUpperCase()
        break
      }
    }

    // Find codec
    for (const codec of CODECS) {
      if (lowerName.includes(codec.toLowerCase())) {
        result.codec = codec.toUpperCase()
        break
      }
    }

    return result
  }

  private extractReleaseGroup(name: string): string | undefined {
    // Release group is typically after the last dash
    // e.g., "Movie.Title.2020.1080p.BluRay.x264-GROUP"
    const match = name.match(/-([A-Za-z0-9]+)(?:\.[a-z]{2,4})?$/)
    if (match) {
      const group = match[1]
      // Filter out common false positives
      const falsePositives = ['dl', 'rip', 'cam', 'ts', 'hd', 'sd']
      if (!falsePositives.includes(group.toLowerCase())) {
        return group
      }
    }
    return undefined
  }

  private cleanTitle(
    name: string,
    year?: number,
    _quality?: { resolution?: string; source?: string; codec?: string },
    releaseGroup?: string
  ): string {
    let title = name

    // Remove year patterns
    if (year) {
      title = title.replace(
        new RegExp(`\\(${year}\\)|\\[${year}\\]|\\.${year}\\.|\\s${year}\\s`, 'g'),
        ' '
      )
    }

    // Remove quality indicators
    const qualityTerms = [...RESOLUTIONS, ...SOURCES, ...CODECS]
    for (const term of qualityTerms) {
      const regex = new RegExp(`[.\\s_-]?${term}[.\\s_-]?`, 'gi')
      title = title.replace(regex, ' ')
    }

    // Remove release group
    if (releaseGroup) {
      title = title.replace(new RegExp(`-${releaseGroup}$`, 'i'), '')
    }

    // Remove common noise words at the end
    const noisePatterns = [
      /[-.]?(proper|repack|internal|extended|unrated|theatrical|directors\.?cut)/gi,
      /[-.]?(multi|dual|french|german|spanish|italian)/gi,
      /[-.]?(dts|aac|ac3|dd5\.?1|7\.?1|atmos)/gi,
      /[-.]?(hdr|hdr10|dolby\.?vision|dv)/gi,
    ]

    for (const pattern of noisePatterns) {
      title = title.replace(pattern, ' ')
    }

    // Replace dots and underscores with spaces
    title = title.replace(/[._]/g, ' ')

    // Collapse multiple spaces and dashes
    title = title.replace(/\s+/g, ' ')
    title = title.replace(/-+/g, '-')
    title = title.replace(/^\s*-\s*|\s*-\s*$/g, '')

    // Trim and capitalize properly
    title = title.trim()

    // If title is empty, return "Unknown"
    if (!title) {
      return 'Unknown'
    }

    return title
  }

  private formatQuality(quality: {
    resolution?: string
    source?: string
    codec?: string
  }): string | undefined {
    const parts: string[] = []

    if (quality.resolution) {
      parts.push(quality.resolution)
    }
    if (quality.source) {
      parts.push(quality.source)
    }

    return parts.length > 0 ? parts.join(' ') : undefined
  }
}

export const movieParser = new MovieParser()
