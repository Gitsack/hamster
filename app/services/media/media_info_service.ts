import * as musicMetadata from 'music-metadata'
import path from 'node:path'
import fs from 'node:fs/promises'

export interface MediaInfo {
  duration: number // seconds
  codec: string
  bitrate?: number
  sampleRate?: number
  channels?: number
  bitDepth?: number
  title?: string
  artist?: string
  album?: string
  trackNumber?: number
  discNumber?: number
  year?: number
  genre?: string[]
  hasCover: boolean
}

export interface CoverArt {
  data: Buffer
  format: string
  type?: string
}

/**
 * Service for extracting metadata from audio files using music-metadata library.
 */
export class MediaInfoService {
  /**
   * Get media info from an audio file
   */
  async getMediaInfo(filePath: string): Promise<MediaInfo | null> {
    try {
      const metadata = await musicMetadata.parseFile(filePath)

      return {
        duration: metadata.format.duration || 0,
        codec: metadata.format.codec || this.getCodecFromFormat(filePath),
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        channels: metadata.format.numberOfChannels,
        bitDepth: metadata.format.bitsPerSample,
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        trackNumber: this.parseTrackNumber(metadata.common.track),
        discNumber: this.parseTrackNumber(metadata.common.disk),
        year: metadata.common.year,
        genre: metadata.common.genre,
        hasCover: (metadata.common.picture?.length || 0) > 0,
      }
    } catch (error) {
      console.error(`Failed to parse media info for ${filePath}:`, error)
      return null
    }
  }

  /**
   * Extract embedded cover art from audio file
   */
  async getCoverArt(filePath: string): Promise<CoverArt | null> {
    try {
      const metadata = await musicMetadata.parseFile(filePath)
      const picture = metadata.common.picture?.[0]

      if (!picture) return null

      return {
        data: Buffer.from(picture.data),
        format: picture.format,
        type: picture.type,
      }
    } catch (error) {
      console.error(`Failed to extract cover art from ${filePath}:`, error)
      return null
    }
  }

  /**
   * Save cover art to a file
   */
  async saveCoverArt(filePath: string, outputPath: string): Promise<boolean> {
    try {
      const cover = await this.getCoverArt(filePath)
      if (!cover) return false

      await fs.writeFile(outputPath, cover.data)
      return true
    } catch (error) {
      console.error(`Failed to save cover art:`, error)
      return false
    }
  }

  /**
   * Get the duration of an audio file in seconds
   */
  async getDuration(filePath: string): Promise<number> {
    try {
      const metadata = await musicMetadata.parseFile(filePath)
      return metadata.format.duration || 0
    } catch {
      return 0
    }
  }

  /**
   * Get basic format info without parsing full metadata
   */
  async getFormat(filePath: string): Promise<{
    codec: string
    bitrate?: number
    sampleRate?: number
    lossless: boolean
  } | null> {
    try {
      const metadata = await musicMetadata.parseFile(filePath)
      const codec = metadata.format.codec || this.getCodecFromFormat(filePath)

      return {
        codec,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        lossless: this.isLossless(codec),
      }
    } catch {
      return null
    }
  }

  /**
   * Check if an audio file is lossless
   */
  private isLossless(codec: string): boolean {
    const losslessCodecs = ['flac', 'alac', 'wav', 'ape', 'wv', 'pcm', 'dsd', 'dsf', 'dff']
    return losslessCodecs.some((c) => codec.toLowerCase().includes(c))
  }

  /**
   * Get codec from file extension
   */
  private getCodecFromFormat(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const codecMap: Record<string, string> = {
      mp3: 'MP3',
      flac: 'FLAC',
      m4a: 'AAC',
      aac: 'AAC',
      ogg: 'Vorbis',
      opus: 'Opus',
      wav: 'PCM',
      wma: 'WMA',
      ape: 'APE',
      wv: 'WavPack',
      dsf: 'DSD',
      dff: 'DSD',
    }
    return codecMap[ext] || ext.toUpperCase()
  }

  /**
   * Parse track/disc number from various formats
   */
  private parseTrackNumber(trackInfo?: {
    no: number | null
    of: number | null
  }): number | undefined {
    if (!trackInfo || trackInfo.no === null) return undefined
    return trackInfo.no
  }

  /**
   * Calculate audio quality score (higher is better)
   */
  getQualityScore(info: MediaInfo): number {
    let score = 0

    // Lossless bonus
    if (this.isLossless(info.codec)) {
      score += 100

      // Hi-res bonus
      if ((info.bitDepth && info.bitDepth > 16) || (info.sampleRate && info.sampleRate > 48000)) {
        score += 50
      }
    } else {
      // Lossy scoring based on bitrate
      if (info.bitrate) {
        score += Math.min(info.bitrate / 10000, 50) // Max 50 points for 500kbps
      }
    }

    return Math.round(score)
  }

  /**
   * Get a human-readable quality description
   */
  getQualityDescription(info: MediaInfo): string {
    if (this.isLossless(info.codec)) {
      if ((info.bitDepth && info.bitDepth > 16) || (info.sampleRate && info.sampleRate > 48000)) {
        const depth = info.bitDepth || 16
        const rate = info.sampleRate ? Math.round(info.sampleRate / 1000) : 44.1
        return `Hi-Res ${depth}bit/${rate}kHz`
      }
      return 'Lossless'
    }

    if (info.bitrate) {
      return `${Math.round(info.bitrate / 1000)}kbps`
    }

    return 'Unknown'
  }
}

export const mediaInfoService = new MediaInfoService()
