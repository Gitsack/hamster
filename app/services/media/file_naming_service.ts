import Artist from '#models/artist'
import Album from '#models/album'
import Track from '#models/track'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Author from '#models/author'
import Book from '#models/book'
import AppSetting from '#models/app_setting'
import {
  namingTemplateService,
  defaultNamingPatterns,
  type NamingPatterns,
} from './naming_template_service.js'

interface TrackNamingData {
  track: Track
  album: Album
  artist: Artist
  quality?: string
  format?: string
}

interface AlbumFolderData {
  album: Album
  artist: Artist
}

interface ArtistFolderData {
  artist: Artist
}

interface MovieNamingData {
  movie: Movie
  quality?: string
}

interface TvShowFolderData {
  tvShow: TvShow
}

interface EpisodeNamingData {
  episode: Episode
  tvShow: TvShow
  quality?: string
}

interface AuthorFolderData {
  author: Author
}

interface BookNamingData {
  book: Book
  author: Author
  format?: string
}

/**
 * Service for generating file names and folder structures following Jellyfin-compatible naming conventions.
 *
 * Default structure:
 * /music/
 * ├── Artist Name/
 * │   ├── folder.jpg
 * │   ├── [2020] Album Name/
 * │   │   ├── folder.jpg
 * │   │   ├── 01 - Track Title.flac
 * │   │   └── 02 - Track Title.flac
 */
export class FileNamingService {
  private readonly illegalChars = /[<>:"/\\|?*\x00-\x1f]/g
  private readonly reservedNames = [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ]

  private patternsCache: NamingPatterns | null = null
  private patternsCacheTime: number = 0
  private readonly cacheMaxAge = 60000 // 1 minute cache

  /**
   * Get naming patterns from database or defaults
   */
  async getPatterns(): Promise<NamingPatterns> {
    const now = Date.now()
    if (this.patternsCache && now - this.patternsCacheTime < this.cacheMaxAge) {
      return this.patternsCache
    }

    const stored = await AppSetting.get<Partial<NamingPatterns>>('namingPatterns')
    this.patternsCache = {
      music: { ...defaultNamingPatterns.music, ...stored?.music },
      movies: { ...defaultNamingPatterns.movies, ...stored?.movies },
      tv: { ...defaultNamingPatterns.tv, ...stored?.tv },
      books: { ...defaultNamingPatterns.books, ...stored?.books },
    }
    this.patternsCacheTime = now

    return this.patternsCache
  }

  /**
   * Clear the patterns cache (call after updating patterns)
   */
  clearCache(): void {
    this.patternsCache = null
    this.patternsCacheTime = 0
  }

  /**
   * Sanitize a string for use in file/folder names
   */
  sanitize(name: string): string {
    if (!name) return 'Unknown'

    // Replace illegal characters with space
    let sanitized = name.replace(this.illegalChars, ' ')

    // Collapse multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim()

    // Remove trailing dots and spaces (Windows issue)
    sanitized = sanitized.replace(/[. ]+$/, '')

    // Handle reserved names (Windows)
    const upperName = sanitized.toUpperCase()
    if (this.reservedNames.includes(upperName)) {
      sanitized = `_${sanitized}`
    }

    // Ensure name is not empty
    if (!sanitized) {
      sanitized = 'Unknown'
    }

    // Limit length (255 chars minus some buffer for file extension)
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200).trim()
    }

    return sanitized
  }

  /**
   * Generate artist folder name using configurable pattern
   */
  async getArtistFolderName(data: ArtistFolderData): Promise<string> {
    const patterns = await this.getPatterns()
    const result = namingTemplateService.parseTemplate(patterns.music.artistFolder, {
      artist_name: data.artist.name,
    })
    return this.sanitize(result)
  }

  /**
   * Generate album folder name using configurable pattern
   */
  async getAlbumFolderName(data: AlbumFolderData): Promise<string> {
    const patterns = await this.getPatterns()
    const year = data.album.releaseDate
      ? new Date(data.album.releaseDate.toString()).getFullYear()
      : null
    const validYear = year && year > 1900 && year < 2100 ? String(year) : ''

    const result = namingTemplateService.parseTemplate(patterns.music.albumFolder, {
      album_title: data.album.title,
      year: validYear,
    })
    return this.sanitize(result)
  }

  /**
   * Generate full album path relative to root folder
   */
  async getAlbumPath(data: AlbumFolderData): Promise<string> {
    const artistFolder = await this.getArtistFolderName({ artist: data.artist })
    const albumFolder = await this.getAlbumFolderName(data)
    return `${artistFolder}/${albumFolder}`
  }

  /**
   * Generate track file name (without extension) using configurable pattern
   */
  async getTrackFileName(data: TrackNamingData): Promise<string> {
    const patterns = await this.getPatterns()
    const trackNumber = String(data.track.trackNumber || 1).padStart(2, '0')
    const discNumber = data.track.discNumber || 1

    const result = namingTemplateService.parseTemplate(patterns.music.trackFile, {
      track_number: trackNumber,
      track_title: data.track.title,
      disc_number: String(discNumber),
    })
    return this.sanitize(result)
  }

  /**
   * Generate full track path relative to root folder
   */
  async getTrackPath(data: TrackNamingData, extension: string): Promise<string> {
    const albumPath = await this.getAlbumPath({ album: data.album, artist: data.artist })
    const trackFileName = await this.getTrackFileName(data)
    const ext = extension.startsWith('.') ? extension : `.${extension}`
    return `${albumPath}/${trackFileName}${ext}`
  }

  /**
   * Get the cover art filename for albums
   */
  getAlbumCoverFileName(): string {
    return 'folder.jpg'
  }

  /**
   * Get the cover art filename for artists
   */
  getArtistCoverFileName(): string {
    return 'folder.jpg'
  }

  /**
   * Parse an existing filename to extract track info
   */
  parseTrackFileName(fileName: string): {
    discNumber?: number
    trackNumber?: number
    title?: string
    extension?: string
  } | null {
    // Remove extension
    const lastDot = fileName.lastIndexOf('.')
    const name = lastDot > 0 ? fileName.substring(0, lastDot) : fileName
    const extension = lastDot > 0 ? fileName.substring(lastDot + 1) : undefined

    // Try to match: "01 - Track Title" or "01 Track Title" or "1-01 - Track Title"
    const patterns = [
      // "1-01 - Track Title" (multi-disc)
      /^(\d+)-(\d+)\s*-\s*(.+)$/,
      // "01 - Track Title"
      /^(\d+)\s*-\s*(.+)$/,
      // "01. Track Title"
      /^(\d+)\.\s*(.+)$/,
      // "01 Track Title"
      /^(\d+)\s+(.+)$/,
    ]

    for (const pattern of patterns) {
      const match = name.match(pattern)
      if (match) {
        if (match.length === 4) {
          // Multi-disc pattern
          return {
            discNumber: Number.parseInt(match[1], 10),
            trackNumber: Number.parseInt(match[2], 10),
            title: match[3].trim(),
            extension,
          }
        } else if (match.length === 3) {
          return {
            trackNumber: Number.parseInt(match[1], 10),
            title: match[2].trim(),
            extension,
          }
        }
      }
    }

    return null
  }

  /**
   * Get supported audio extensions
   */
  getSupportedAudioExtensions(): string[] {
    return [
      '.flac',
      '.mp3',
      '.m4a',
      '.aac',
      '.ogg',
      '.opus',
      '.wav',
      '.wma',
      '.alac',
      '.ape',
      '.wv',
      '.dsf',
      '.dff',
    ]
  }

  /**
   * Get supported image extensions
   */
  getSupportedImageExtensions(): string[] {
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
  }

  /**
   * Check if file is an audio file
   */
  isAudioFile(fileName: string): boolean {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return this.getSupportedAudioExtensions().includes(ext)
  }

  /**
   * Check if file is an image file
   */
  isImageFile(fileName: string): boolean {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return this.getSupportedImageExtensions().includes(ext)
  }

  // =====================
  // Movie naming methods
  // =====================

  /**
   * Generate movie folder name using configurable pattern
   */
  async getMovieFolderName(data: MovieNamingData): Promise<string> {
    const patterns = await this.getPatterns()
    const year = data.movie.year
    const validYear = year && year > 1900 && year < 2100 ? String(year) : ''

    const result = namingTemplateService.parseTemplate(patterns.movies.movieFolder, {
      movie_title: data.movie.title,
      year: validYear,
    })
    return this.sanitize(result)
  }

  /**
   * Generate movie file name (without extension) using configurable pattern
   */
  async getMovieFileName(data: MovieNamingData): Promise<string> {
    const patterns = await this.getPatterns()
    const year = data.movie.year
    const validYear = year && year > 1900 && year < 2100 ? String(year) : ''

    const result = namingTemplateService.parseTemplate(patterns.movies.movieFile, {
      movie_title: data.movie.title,
      year: validYear,
      quality: data.quality || '',
    })
    return this.sanitize(result)
  }

  /**
   * Generate full movie path relative to root folder
   */
  async getMoviePath(data: MovieNamingData, extension: string): Promise<string> {
    const folderName = await this.getMovieFolderName(data)
    const fileName = await this.getMovieFileName(data)
    const ext = extension.startsWith('.') ? extension : `.${extension}`
    return `${folderName}/${fileName}${ext}`
  }

  /**
   * Check if file is a video file
   */
  isVideoFile(fileName: string): boolean {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return this.getSupportedVideoExtensions().includes(ext)
  }

  /**
   * Get supported video extensions
   */
  getSupportedVideoExtensions(): string[] {
    return [
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
  }

  // =====================
  // TV Show naming methods
  // =====================

  /**
   * Generate TV show folder name using configurable pattern
   */
  async getTvShowFolderName(data: TvShowFolderData): Promise<string> {
    const patterns = await this.getPatterns()
    const year = data.tvShow.year
    const validYear = year && year > 1900 && year < 2100 ? String(year) : ''

    const result = namingTemplateService.parseTemplate(patterns.tv.showFolder, {
      show_title: data.tvShow.title,
      year: validYear,
    })
    return this.sanitize(result)
  }

  /**
   * Generate season folder name using configurable pattern
   */
  async getSeasonFolderName(seasonNumber: number): Promise<string> {
    const patterns = await this.getPatterns()
    const result = namingTemplateService.parseTemplate(patterns.tv.seasonFolder, {
      season_number: String(seasonNumber).padStart(2, '0'),
    })
    return this.sanitize(result)
  }

  /**
   * Generate episode file name (without extension) using configurable pattern
   */
  async getEpisodeFileName(data: EpisodeNamingData): Promise<string> {
    const patterns = await this.getPatterns()
    const seasonNum = String(data.episode.seasonNumber).padStart(2, '0')
    const episodeNum = String(data.episode.episodeNumber).padStart(2, '0')

    const result = namingTemplateService.parseTemplate(patterns.tv.episodeFile, {
      show_title: data.tvShow.title,
      season_number: seasonNum,
      episode_number: episodeNum,
      episode_title: data.episode.title || '',
    })
    return this.sanitize(result)
  }

  /**
   * Generate full episode path relative to root folder
   */
  async getEpisodePath(data: EpisodeNamingData, extension: string): Promise<string> {
    const showFolder = await this.getTvShowFolderName({ tvShow: data.tvShow })
    const seasonFolder = await this.getSeasonFolderName(data.episode.seasonNumber)
    const fileName = await this.getEpisodeFileName(data)
    const ext = extension.startsWith('.') ? extension : `.${extension}`
    return `${showFolder}/${seasonFolder}/${fileName}${ext}`
  }

  /**
   * Parse episode info from filename
   * Handles common patterns like "S01E01", "1x01", etc.
   */
  parseEpisodeFileName(fileName: string): {
    seasonNumber?: number
    episodeNumber?: number
    title?: string
    extension?: string
  } | null {
    // Remove extension
    const lastDot = fileName.lastIndexOf('.')
    const name = lastDot > 0 ? fileName.substring(0, lastDot) : fileName
    const extension = lastDot > 0 ? fileName.substring(lastDot + 1) : undefined

    // Patterns to try
    const patterns = [
      // "Show Name - S01E01 - Episode Title"
      /^.+?\s*-\s*S(\d{1,2})E(\d{1,2})\s*-\s*(.+)$/i,
      // "Show Name - S01E01"
      /^.+?\s*-\s*S(\d{1,2})E(\d{1,2})$/i,
      // "S01E01 - Episode Title"
      /^S(\d{1,2})E(\d{1,2})\s*-\s*(.+)$/i,
      // "S01E01"
      /^.*S(\d{1,2})E(\d{1,2}).*$/i,
      // "1x01"
      /^.*(\d{1,2})x(\d{2}).*$/i,
    ]

    for (const pattern of patterns) {
      const match = name.match(pattern)
      if (match) {
        return {
          seasonNumber: Number.parseInt(match[1], 10),
          episodeNumber: Number.parseInt(match[2], 10),
          title: match[3]?.trim(),
          extension,
        }
      }
    }

    return null
  }

  // =====================
  // Book naming methods
  // =====================

  /**
   * Generate author folder name using configurable pattern
   */
  async getAuthorFolderName(data: AuthorFolderData): Promise<string> {
    const patterns = await this.getPatterns()
    const result = namingTemplateService.parseTemplate(patterns.books.authorFolder, {
      author_name: data.author.name,
    })
    return this.sanitize(result)
  }

  /**
   * Generate book file name (without extension) using configurable pattern
   */
  async getBookFileName(data: BookNamingData): Promise<string> {
    const patterns = await this.getPatterns()
    const year = data.book.releaseDate
      ? new Date(data.book.releaseDate.toString()).getFullYear()
      : null
    const validYear = year && year > 1900 && year < 2100 ? String(year) : ''

    const result = namingTemplateService.parseTemplate(patterns.books.bookFile, {
      book_title: data.book.title,
      year: validYear,
    })
    return this.sanitize(result)
  }

  /**
   * Generate full book path relative to root folder
   */
  async getBookPath(data: BookNamingData, extension: string): Promise<string> {
    const authorFolder = await this.getAuthorFolderName({ author: data.author })
    const fileName = await this.getBookFileName(data)
    const ext = extension.startsWith('.') ? extension : `.${extension}`
    return `${authorFolder}/${fileName}${ext}`
  }

  /**
   * Check if file is an ebook file
   */
  isBookFile(fileName: string): boolean {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return this.getSupportedBookExtensions().includes(ext)
  }

  /**
   * Get supported ebook extensions
   */
  getSupportedBookExtensions(): string[] {
    return ['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.fb2', '.djvu', '.cbz', '.cbr']
  }

  /**
   * Get book format from extension
   */
  getBookFormat(fileName: string): string {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1)
    const formatMap: Record<string, string> = {
      epub: 'EPUB',
      pdf: 'PDF',
      mobi: 'MOBI',
      azw: 'AZW',
      azw3: 'AZW3',
      fb2: 'FB2',
      djvu: 'DJVU',
      cbz: 'CBZ',
      cbr: 'CBR',
    }
    return formatMap[ext] || ext.toUpperCase()
  }
}

export const fileNamingService = new FileNamingService()
