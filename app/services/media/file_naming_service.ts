import Artist from '#models/artist'
import Album from '#models/album'
import Track from '#models/track'

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
}

export const fileNamingService = new FileNamingService()
