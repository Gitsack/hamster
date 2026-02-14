/**
 * Quality Parser
 *
 * Parses release titles to extract quality attributes (resolution, source, codec, audio)
 * and maps them to quality profile item IDs.
 *
 * Quality IDs match the frontend definitions in media-management.tsx:
 *
 * Movies/TV:
 *   1: Bluray 2160p, 2: Bluray 1080p, 3: Bluray 720p,
 *   4: Web 2160p, 5: Web 1080p, 6: Web 720p,
 *   7: HDTV 1080p, 8: HDTV 720p, 9: DVD
 *
 * Music:
 *   1: FLAC, 2: ALAC, 3: WAV, 4: MP3 320, 5: MP3 V0,
 *   6: MP3 256, 7: MP3 192, 8: AAC 256, 9: OGG Vorbis
 *
 * Books:
 *   1: EPUB, 2: PDF, 3: MOBI, 4: AZW3, 5: CBZ, 6: CBR
 */

export type MediaType = 'movies' | 'tv' | 'music' | 'books'

export interface ParsedVideoQuality {
  resolution: string | null // '2160p', '1080p', '720p', '480p'
  source: string | null // 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'DVD', 'REMUX', 'CAM'
  codec: string | null // 'x264', 'x265', 'HEVC', 'AV1', 'VP9'
  audio: string | null // 'DTS', 'TrueHD', 'Atmos', 'FLAC', 'AAC', 'DD5.1'
  isRemux: boolean
}

export interface ParsedMusicQuality {
  format: string | null // 'FLAC', 'ALAC', 'WAV', 'MP3', 'AAC', 'OGG'
  bitrate: string | null // '320', 'V0', 'V2', 'lossless', '256', '192'
  isHiRes: boolean // 24-bit or hi-res
}

export interface ParsedBookQuality {
  format: string | null // 'EPUB', 'PDF', 'MOBI', 'AZW3', 'CBZ', 'CBR'
}

export interface ParsedQuality {
  mediaType: MediaType
  qualityId: number | null // ID matching the quality profile item
  qualityName: string | null // Human-readable name
  video?: ParsedVideoQuality
  music?: ParsedMusicQuality
  book?: ParsedBookQuality
}

// Video quality definitions mapping (source + resolution) to quality IDs
const VIDEO_QUALITY_MAP: { source: string; resolution: string; id: number; name: string }[] = [
  { source: 'BluRay', resolution: '2160p', id: 1, name: 'Bluray 2160p' },
  { source: 'BluRay', resolution: '1080p', id: 2, name: 'Bluray 1080p' },
  { source: 'BluRay', resolution: '720p', id: 3, name: 'Bluray 720p' },
  { source: 'WEB', resolution: '2160p', id: 4, name: 'Web 2160p' },
  { source: 'WEB', resolution: '1080p', id: 5, name: 'Web 1080p' },
  { source: 'WEB', resolution: '720p', id: 6, name: 'Web 720p' },
  { source: 'HDTV', resolution: '1080p', id: 7, name: 'HDTV 1080p' },
  { source: 'HDTV', resolution: '720p', id: 8, name: 'HDTV 720p' },
  { source: 'DVD', resolution: '', id: 9, name: 'DVD' },
]

// Music quality definitions
const MUSIC_QUALITY_MAP: { format: string; bitrate: string | null; id: number; name: string }[] = [
  { format: 'FLAC', bitrate: null, id: 1, name: 'FLAC' },
  { format: 'ALAC', bitrate: null, id: 2, name: 'ALAC' },
  { format: 'WAV', bitrate: null, id: 3, name: 'WAV' },
  { format: 'MP3', bitrate: '320', id: 4, name: 'MP3 320' },
  { format: 'MP3', bitrate: 'V0', id: 5, name: 'MP3 V0' },
  { format: 'MP3', bitrate: '256', id: 6, name: 'MP3 256' },
  { format: 'MP3', bitrate: '192', id: 7, name: 'MP3 192' },
  { format: 'AAC', bitrate: '256', id: 8, name: 'AAC 256' },
  { format: 'OGG', bitrate: null, id: 9, name: 'OGG Vorbis' },
]

// Book quality definitions
const BOOK_QUALITY_MAP: { format: string; id: number; name: string }[] = [
  { format: 'EPUB', id: 1, name: 'EPUB' },
  { format: 'PDF', id: 2, name: 'PDF' },
  { format: 'MOBI', id: 3, name: 'MOBI' },
  { format: 'AZW3', id: 4, name: 'AZW3' },
  { format: 'CBZ', id: 5, name: 'CBZ' },
  { format: 'CBR', id: 6, name: 'CBR' },
]

/**
 * Parse a video release title (movie or TV) for quality attributes
 */
export function parseVideoQuality(title: string): ParsedVideoQuality {
  const lower = title.toLowerCase()

  // Parse resolution
  let resolution: string | null = null
  if (/2160p|4k|uhd/i.test(title)) {
    resolution = '2160p'
  } else if (/1080p/i.test(title)) {
    resolution = '1080p'
  } else if (/720p/i.test(title)) {
    resolution = '720p'
  } else if (/480p|sd/i.test(title)) {
    resolution = '480p'
  }

  // Parse source
  let source: string | null = null
  const isRemux = /\bremux\b/i.test(title)

  if (/\bblu[\s._-]?ray\b|\bbd[\s._-]?rip\b|\bbdrip\b|\bbrrip\b/i.test(title) || isRemux) {
    source = 'BluRay'
  } else if (/\bweb[\s._-]?dl\b/i.test(title)) {
    source = 'WEB'
  } else if (/\bwebrip\b/i.test(title)) {
    source = 'WEB'
  } else if (/\bweb\b/i.test(title) && !lower.includes('webm')) {
    source = 'WEB'
  } else if (/\bhdtv\b|\bpdtv\b/i.test(title)) {
    source = 'HDTV'
  } else if (/\bdvd\b|\bdvdrip\b/i.test(title)) {
    source = 'DVD'
  } else if (/\bcam\b|\bts\b|\btelesync\b|\bhd[\s._-]?cam\b/i.test(title)) {
    source = 'CAM'
  }

  // Parse codec
  let codec: string | null = null
  if (/\bx264\b|\bh[\s._]?264\b|\bavc\b/i.test(title)) {
    codec = 'x264'
  } else if (/\bx265\b|\bh[\s._]?265\b|\bhevc\b/i.test(title)) {
    codec = 'x265'
  } else if (/\bav1\b/i.test(title)) {
    codec = 'AV1'
  } else if (/\bvp9\b/i.test(title)) {
    codec = 'VP9'
  } else if (/\bxvid\b|\bdivx\b/i.test(title)) {
    codec = 'XviD'
  }

  // Parse audio
  let audio: string | null = null
  if (/\batmos\b/i.test(title)) {
    audio = 'Atmos'
  } else if (/\btrue[\s._-]?hd\b/i.test(title)) {
    audio = 'TrueHD'
  } else if (/\bdts[\s._-]?hd[\s._-]?ma\b/i.test(title)) {
    audio = 'DTS-HD MA'
  } else if (/\bdts[\s._-]?hd\b/i.test(title)) {
    audio = 'DTS-HD'
  } else if (/\bdts\b/i.test(title)) {
    audio = 'DTS'
  } else if (/\bdd[\s._+]?5[\s._]?1\b|\bac[\s._-]?3\b|\bddp?\d/i.test(title)) {
    audio = 'DD5.1'
  } else if (/\bflac\b/i.test(title)) {
    audio = 'FLAC'
  } else if (/\baac\b/i.test(title)) {
    audio = 'AAC'
  }

  return { resolution, source, codec, audio, isRemux }
}

/**
 * Parse a music release title for quality attributes
 */
export function parseMusicQuality(title: string): ParsedMusicQuality {
  const lower = title.toLowerCase()

  let format: string | null = null
  let bitrate: string | null = null
  const isHiRes =
    /24[\s._-]?bit|hi[\s._-]?res/i.test(title) || /(?:flac|alac|wav).*24bit/i.test(title)

  // Parse format
  if (/\bflac\b|\blossless\b/i.test(title)) {
    format = 'FLAC'
    bitrate = 'lossless'
  } else if (/\balac\b/i.test(title)) {
    format = 'ALAC'
    bitrate = 'lossless'
  } else if (/\bwav\b/i.test(title) && !lower.includes('wave')) {
    format = 'WAV'
    bitrate = 'lossless'
  } else if (/\bogg\b|\bvorbis\b/i.test(title)) {
    format = 'OGG'
  } else if (/\baac\b/i.test(title)) {
    format = 'AAC'
    // Try to detect AAC bitrate
    if (/256/i.test(title)) {
      bitrate = '256'
    }
  } else if (/\bmp3\b/i.test(title) || /\b320\b|\bv0\b|\b256\b|\b192\b|\b128\b/i.test(title)) {
    format = 'MP3'
  }

  // Parse MP3 bitrate if format is MP3 (or not detected but has bitrate indicators)
  if (format === 'MP3' || format === null) {
    if (/\b320\b/i.test(title)) {
      format = format || 'MP3'
      bitrate = '320'
    } else if (/\bv0\b|vbr[\s._-]?0/i.test(title)) {
      format = format || 'MP3'
      bitrate = 'V0'
    } else if (/\bv2\b|vbr[\s._-]?2/i.test(title)) {
      format = format || 'MP3'
      bitrate = 'V2'
    } else if (/\b256\b/i.test(title) && format === 'MP3') {
      bitrate = '256'
    } else if (/\b192\b/i.test(title) && format === 'MP3') {
      bitrate = '192'
    }
  }

  return { format, bitrate, isHiRes }
}

/**
 * Parse a book release title for quality/format
 */
export function parseBookQuality(title: string): ParsedBookQuality {
  let format: string | null = null

  if (/\bepub\b/i.test(title)) {
    format = 'EPUB'
  } else if (/\bmobi\b/i.test(title)) {
    format = 'MOBI'
  } else if (/\bazw3\b/i.test(title)) {
    format = 'AZW3'
  } else if (/\bcbz\b/i.test(title)) {
    format = 'CBZ'
  } else if (/\bcbr\b/i.test(title)) {
    format = 'CBR'
  } else if (/\bpdf\b/i.test(title)) {
    format = 'PDF'
  }

  return { format }
}

/**
 * Map parsed video quality to a quality ID
 */
function mapVideoToQualityId(parsed: ParsedVideoQuality): {
  id: number | null
  name: string | null
} {
  const { resolution, source } = parsed

  // DVD source maps directly regardless of resolution
  if (source === 'DVD') {
    return { id: 9, name: 'DVD' }
  }

  // CAM sources are not in our quality list - return null (rejected)
  if (source === 'CAM') {
    return { id: null, name: null }
  }

  // Map source to the quality map source name
  let mappedSource: string | null = null
  if (source === 'BluRay') mappedSource = 'BluRay'
  else if (source === 'WEB') mappedSource = 'WEB'
  else if (source === 'HDTV') mappedSource = 'HDTV'

  // If we have both source and resolution, find exact match
  if (mappedSource && resolution) {
    const match = VIDEO_QUALITY_MAP.find(
      (q) => q.source === mappedSource && q.resolution === resolution
    )
    if (match) return { id: match.id, name: match.name }
  }

  // If we only have resolution, infer source: default to WEB for high res, HDTV for lower
  if (resolution && !mappedSource) {
    const inferredSource = resolution === '2160p' || resolution === '1080p' ? 'WEB' : 'HDTV'
    const match = VIDEO_QUALITY_MAP.find(
      (q) => q.source === inferredSource && q.resolution === resolution
    )
    if (match) return { id: match.id, name: match.name }
  }

  // If we only have source but no resolution, default to 1080p for BluRay/WEB, 720p for HDTV
  if (mappedSource && !resolution) {
    const inferredResolution = mappedSource === 'HDTV' ? '720p' : '1080p'
    const match = VIDEO_QUALITY_MAP.find(
      (q) => q.source === mappedSource && q.resolution === inferredResolution
    )
    if (match) return { id: match.id, name: match.name }
  }

  return { id: null, name: null }
}

/**
 * Map parsed music quality to a quality ID
 */
function mapMusicToQualityId(parsed: ParsedMusicQuality): {
  id: number | null
  name: string | null
} {
  const { format, bitrate } = parsed

  if (!format) return { id: null, name: null }

  // Exact match by format + bitrate
  if (format === 'MP3' && bitrate) {
    const match = MUSIC_QUALITY_MAP.find((q) => q.format === 'MP3' && q.bitrate === bitrate)
    if (match) return { id: match.id, name: match.name }
  }

  // For AAC, try bitrate match
  if (format === 'AAC') {
    const match = MUSIC_QUALITY_MAP.find((q) => q.format === 'AAC')
    if (match) return { id: match.id, name: match.name }
  }

  // For lossless formats, match by format name
  if (format === 'FLAC' || format === 'ALAC' || format === 'WAV' || format === 'OGG') {
    const match = MUSIC_QUALITY_MAP.find((q) => q.format === format)
    if (match) return { id: match.id, name: match.name }
  }

  // Fallback: MP3 without specific bitrate defaults to MP3 320
  if (format === 'MP3') {
    return { id: 4, name: 'MP3 320' }
  }

  return { id: null, name: null }
}

/**
 * Map parsed book quality to a quality ID
 */
function mapBookToQualityId(parsed: ParsedBookQuality): {
  id: number | null
  name: string | null
} {
  if (!parsed.format) return { id: null, name: null }

  const match = BOOK_QUALITY_MAP.find((q) => q.format === parsed.format)
  if (match) return { id: match.id, name: match.name }

  return { id: null, name: null }
}

/**
 * Parse a release title and determine quality for a given media type
 */
export function parseQuality(title: string, mediaType: MediaType): ParsedQuality {
  switch (mediaType) {
    case 'movies':
    case 'tv': {
      const video = parseVideoQuality(title)
      const { id, name } = mapVideoToQualityId(video)
      return { mediaType, qualityId: id, qualityName: name, video }
    }
    case 'music': {
      const music = parseMusicQuality(title)
      const { id, name } = mapMusicToQualityId(music)
      return { mediaType, qualityId: id, qualityName: name, music }
    }
    case 'books': {
      const book = parseBookQuality(title)
      const { id, name } = mapBookToQualityId(book)
      return { mediaType, qualityId: id, qualityName: name, book }
    }
  }
}

/**
 * Map a quality string (as stored on file models) back to a quality ID
 * for a given media type. Used when checking current file quality for upgrades.
 */
export function qualityNameToId(qualityName: string, mediaType: MediaType): number | null {
  switch (mediaType) {
    case 'movies':
    case 'tv': {
      const match = VIDEO_QUALITY_MAP.find(
        (q) => q.name.toLowerCase() === qualityName.toLowerCase()
      )
      return match?.id ?? null
    }
    case 'music': {
      const match = MUSIC_QUALITY_MAP.find(
        (q) => q.name.toLowerCase() === qualityName.toLowerCase()
      )
      return match?.id ?? null
    }
    case 'books': {
      const match = BOOK_QUALITY_MAP.find((q) => q.name.toLowerCase() === qualityName.toLowerCase())
      return match?.id ?? null
    }
  }
}
