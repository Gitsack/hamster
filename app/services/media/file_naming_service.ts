import Artist from '#models/artist'
import Album from '#models/album'
import Track from '#models/track'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Author from '#models/author'
import Book from '#models/book'

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
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
  ]

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
   * Generate artist folder name
   * Format: "Artist Name"
   */
  getArtistFolderName(data: ArtistFolderData): string {
    const artistName = this.sanitize(data.artist.name)
    return artistName
  }

  /**
   * Generate album folder name
   * Format: "[Year] Album Name" or "Album Name" if no year
   */
  getAlbumFolderName(data: AlbumFolderData): string {
    const albumName = this.sanitize(data.album.title)
    const year = data.album.releaseDate
      ? new Date(data.album.releaseDate.toString()).getFullYear()
      : null

    if (year && year > 1900 && year < 2100) {
      return `[${year}] ${albumName}`
    }

    return albumName
  }

  /**
   * Generate full album path relative to root folder
   * Format: "Artist Name/[Year] Album Name"
   */
  getAlbumPath(data: AlbumFolderData): string {
    const artistFolder = this.getArtistFolderName({ artist: data.artist })
    const albumFolder = this.getAlbumFolderName(data)
    return `${artistFolder}/${albumFolder}`
  }

  /**
   * Generate track file name (without extension)
   * Format: "01 - Track Title" or "01 Track Title" depending on settings
   */
  getTrackFileName(data: TrackNamingData): string {
    const trackNumber = String(data.track.trackNumber || 1).padStart(2, '0')
    const trackTitle = this.sanitize(data.track.title)

    // If multi-disc album (disc number > 1), include disc number in filename
    const discNumber = data.track.discNumber || 1
    if (discNumber > 1) {
      return `${discNumber}-${trackNumber} - ${trackTitle}`
    }

    return `${trackNumber} - ${trackTitle}`
  }

  /**
   * Generate full track path relative to root folder
   * Format: "Artist Name/[Year] Album Name/01 - Track Title.flac"
   */
  getTrackPath(data: TrackNamingData, extension: string): string {
    const albumPath = this.getAlbumPath({ album: data.album, artist: data.artist })
    const trackFileName = this.getTrackFileName(data)
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
            discNumber: parseInt(match[1], 10),
            trackNumber: parseInt(match[2], 10),
            title: match[3].trim(),
            extension,
          }
        } else if (match.length === 3) {
          return {
            trackNumber: parseInt(match[1], 10),
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
      '.flac', '.mp3', '.m4a', '.aac', '.ogg', '.opus',
      '.wav', '.wma', '.alac', '.ape', '.wv', '.dsf', '.dff',
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
   * Generate movie folder name
   * Format: "Movie Name (Year)" following Jellyfin conventions
   */
  getMovieFolderName(data: MovieNamingData): string {
    const movieName = this.sanitize(data.movie.title)
    const year = data.movie.year

    if (year && year > 1900 && year < 2100) {
      return `${movieName} (${year})`
    }

    return movieName
  }

  /**
   * Generate movie file name (without extension)
   * Format: "Movie Name (Year)" or "Movie Name (Year) - Quality"
   */
  getMovieFileName(data: MovieNamingData): string {
    const baseName = this.getMovieFolderName(data)

    if (data.quality) {
      return `${baseName} - ${data.quality}`
    }

    return baseName
  }

  /**
   * Generate full movie path relative to root folder
   * Format: "Movie Name (Year)/Movie Name (Year).mkv"
   */
  getMoviePath(data: MovieNamingData, extension: string): string {
    const folderName = this.getMovieFolderName(data)
    const fileName = this.getMovieFileName(data)
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
      '.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
      '.m4v', '.mpg', '.mpeg', '.ts', '.m2ts', '.vob', '.ogv',
    ]
  }

  // =====================
  // TV Show naming methods
  // =====================

  /**
   * Generate TV show folder name
   * Format: "Show Name (Year)" following Jellyfin conventions
   */
  getTvShowFolderName(data: TvShowFolderData): string {
    const showName = this.sanitize(data.tvShow.title)
    const year = data.tvShow.year

    if (year && year > 1900 && year < 2100) {
      return `${showName} (${year})`
    }

    return showName
  }

  /**
   * Generate season folder name
   * Format: "Season 01"
   */
  getSeasonFolderName(seasonNumber: number): string {
    return `Season ${String(seasonNumber).padStart(2, '0')}`
  }

  /**
   * Generate episode file name (without extension)
   * Format: "Show Name - S01E01 - Episode Title" or "Show Name - S01E01"
   */
  getEpisodeFileName(data: EpisodeNamingData): string {
    const showName = this.sanitize(data.tvShow.title)
    const seasonNum = String(data.episode.seasonNumber).padStart(2, '0')
    const episodeNum = String(data.episode.episodeNumber).padStart(2, '0')
    const episodeCode = `S${seasonNum}E${episodeNum}`

    if (data.episode.title) {
      const episodeTitle = this.sanitize(data.episode.title)
      return `${showName} - ${episodeCode} - ${episodeTitle}`
    }

    return `${showName} - ${episodeCode}`
  }

  /**
   * Generate full episode path relative to root folder
   * Format: "Show Name (Year)/Season 01/Show Name - S01E01 - Episode Title.mkv"
   */
  getEpisodePath(data: EpisodeNamingData, extension: string): string {
    const showFolder = this.getTvShowFolderName({ tvShow: data.tvShow })
    const seasonFolder = this.getSeasonFolderName(data.episode.seasonNumber)
    const fileName = this.getEpisodeFileName(data)
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
          seasonNumber: parseInt(match[1], 10),
          episodeNumber: parseInt(match[2], 10),
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
   * Generate author folder name
   * Format: "Author Name"
   */
  getAuthorFolderName(data: AuthorFolderData): string {
    return this.sanitize(data.author.name)
  }

  /**
   * Generate book file name (without extension)
   * Format: "Book Title" or "Book Title (Year)"
   */
  getBookFileName(data: BookNamingData): string {
    const bookTitle = this.sanitize(data.book.title)
    const year = data.book.releaseDate
      ? new Date(data.book.releaseDate.toString()).getFullYear()
      : null

    if (year && year > 1900 && year < 2100) {
      return `${bookTitle} (${year})`
    }

    return bookTitle
  }

  /**
   * Generate full book path relative to root folder
   * Format: "Author Name/Book Title.epub"
   */
  getBookPath(data: BookNamingData, extension: string): string {
    const authorFolder = this.getAuthorFolderName({ author: data.author })
    const fileName = this.getBookFileName(data)
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
