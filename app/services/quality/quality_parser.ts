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

import { parseLanguages, type ParsedLanguages } from './language_parser.js'

export type MediaType = 'movies' | 'tv' | 'music' | 'books'

/**
 * Normalised audio codec names. Distinct from the legacy `audio` label, which
 * collapses every Dolby Digital variant into 'DD5.1' and cannot tell a lossless
 * TrueHD track from a 192 kbps AC3 one — the exact distinction that decides
 * whether a release with fine video is still a bad file.
 */
export type AudioCodec =
  | 'Atmos'
  | 'TrueHD'
  | 'DTS-X'
  | 'DTS-HD MA'
  | 'DTS-HD'
  | 'DTS'
  | 'EAC3'
  | 'AC3'
  | 'FLAC'
  | 'PCM'
  | 'AAC'
  | 'Opus'
  | 'Vorbis'
  | 'MP3'

/**
 * Coarse audio ranking used for tie-breaking and for the "is this good enough"
 * check. Ordered worst to best by AUDIO_TIER_RANK below.
 */
export type AudioTier = 'unknown' | 'lossy-sd' | 'lossy-hd' | 'lossless' | 'lossless-object'

export type HdrFormat = 'DV' | 'HDR10+' | 'HDR10' | 'HLG'

export const AUDIO_TIER_RANK: Record<AudioTier, number> = {
  'unknown': 0,
  'lossy-sd': 1,
  'lossy-hd': 2,
  'lossless': 3,
  'lossless-object': 4,
}

const AUDIO_CODEC_TIER: Record<AudioCodec, AudioTier> = {
  'Atmos': 'lossless-object',
  'DTS-X': 'lossless-object',
  'TrueHD': 'lossless',
  'DTS-HD MA': 'lossless',
  'FLAC': 'lossless',
  'PCM': 'lossless',
  'DTS-HD': 'lossy-hd',
  'DTS': 'lossy-hd',
  'EAC3': 'lossy-hd',
  'AC3': 'lossy-sd',
  'AAC': 'lossy-sd',
  'Opus': 'lossy-sd',
  'Vorbis': 'lossy-sd',
  'MP3': 'lossy-sd',
}

export function audioTierFor(codec: AudioCodec | null): AudioTier {
  if (!codec) return 'unknown'
  return AUDIO_CODEC_TIER[codec] ?? 'unknown'
}

export interface ParsedVideoQuality {
  resolution: string | null // '2160p', '1080p', '720p', '480p'
  source: string | null // 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'DVD', 'REMUX', 'CAM'
  codec: string | null // 'x264', 'x265', 'HEVC', 'AV1', 'VP9'
  audio: string | null // legacy label: 'DTS', 'TrueHD', 'Atmos', 'FLAC', 'AAC', 'DD5.1'
  isRemux: boolean
  /** Normalised audio codec — the one to match rules against. */
  audioCodec: AudioCodec | null
  /** Channel count, e.g. 2 for 2.0, 6 for 5.1, 8 for 7.1. */
  audioChannels: number | null
  audioTier: AudioTier
  hdr: HdrFormat | null
  bitDepth: number | null
  isProper: boolean
  isRepack: boolean
  /** Title advertises an upscale ("4K upscaled", "AI upscale") — fake resolution. */
  isUpscaled: boolean
  /** Burned-in subtitles ("HC", "hardsub") — cannot be turned off. */
  hasHardcodedSubs: boolean
  /**
   * Camera/telesync/screener rip. Never an acceptable file at any resolution,
   * and the marker is decisive no matter what else the title claims.
   */
  isJunkSource: boolean
  /** The junk marker that matched, for the rejection message. */
  junkSourceLabel: string | null
  releaseGroup: string | null
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
  /**
   * What the title claims about audio language. Sits beside the quality rather
   * than inside `video` because it is a property of the release, not of the
   * picture — and because a foreign-language dub is the one flaw no amount of
   * resolution makes up for.
   */
  languages: ParsedLanguages
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
 * Camera rips and their relatives, matched on the marker rather than inferred.
 *
 * These are the releases that hurt most: they carry a real resolution tag
 * ("1080p HDTS"), a real codec and a plausible size, so every heuristic that
 * looks at resolution alone happily accepts a filmed-in-a-cinema copy. The
 * marker is decisive — a 2160p TELESYNC is still a TELESYNC.
 */
const JUNK_SOURCE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'CAM', pattern: /\bcam(?:rip)?\b|\bhd[\s._-]?cam\b|\bhq[\s._-]?cam\b/i },
  {
    label: 'TELESYNC',
    pattern: /\bts\b|\bts[\s._-]?rip\b|\bhd[\s._-]?ts\b|\btelesync\b|\bpdvd\b/i,
  },
  { label: 'TELECINE', pattern: /\bhd[\s._-]?tc\b|\btelecine\b/i },
  { label: 'SCREENER', pattern: /\bdvd[\s._-]?scr\b|\bbd[\s._-]?scr\b|\bscreener\b/i },
  { label: 'WORKPRINT', pattern: /\bwork[\s._-]?print\b/i },
  { label: 'R5', pattern: /\br5\b|\br5[\s._-]?line\b/i },
  // Mic-dubbed and line-dubbed copies are cam audio over cam video.
  { label: 'DUBBED CAM', pattern: /\bmic[\s._-]?dubbed\b|\bline[\s._-]?dubbed\b/i },
]

/**
 * Return the junk-source label a title matches, or null.
 */
export function detectJunkSource(rawTitle: string): string | null {
  // Strip the trailing release group first: a group called TS or CAM would
  // otherwise condemn every release it puts out.
  const title = rawTitle.replace(/_/g, '.').replace(/-[A-Za-z0-9_.]{2,20}$/, '')
  for (const { label, pattern } of JUNK_SOURCE_PATTERNS) {
    if (pattern.test(title)) return label
  }
  return null
}

/**
 * Parse a video release title (movie or TV) for quality attributes
 */
export function parseVideoQuality(rawTitle: string): ParsedVideoQuality {
  // Release names separate tokens with dots, spaces, hyphens OR underscores.
  // Underscore is a word character, so \b never matches around it and every
  // \b-anchored pattern below silently fails on underscore-separated titles
  // (a real "..._1080p_HDTS_DD2_..." parsed as an unknown source and scored as
  // acceptable). Normalise to dots once so all patterns see a boundary.
  const title = rawTitle.replace(/_/g, '.')
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

  // Junk sources are checked first: the marker is decisive regardless of what
  // else the title claims, and a 1080p HDTS is still a camera rip. HDTS/HDTC in
  // particular slipped through every branch below and parsed as an unknown
  // source, which scored as acceptable.
  const junk = detectJunkSource(title)
  if (junk) {
    source = 'CAM'
  } else if (/\bblu[\s._-]?ray\b|\bbd[\s._-]?rip\b|\bbdrip\b|\bbrrip\b/i.test(title) || isRemux) {
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
  // Same glued-token caveat as parseAudioCodec: "DTS5.1" has no word boundary
  // after the codec, so \b would miss it.
  let audio: string | null = null
  if (/\batmos(?![a-z])/i.test(title)) {
    audio = 'Atmos'
  } else if (/\btrue[\s._-]?hd(?![a-z])/i.test(title)) {
    audio = 'TrueHD'
  } else if (/\bdts[\s._-]?hd[\s._-]?ma(?![a-z])/i.test(title)) {
    audio = 'DTS-HD MA'
  } else if (/\bdts[\s._-]?hd(?![a-z])/i.test(title)) {
    audio = 'DTS-HD'
  } else if (/\bdts(?![a-z])/i.test(title)) {
    audio = 'DTS'
  } else if (/\bdd[\s._+]?5[\s._]?1\b|\bac[\s._-]?3\b|\bddp?\d/i.test(title)) {
    audio = 'DD5.1'
  } else if (/\bflac(?![a-z])/i.test(title)) {
    audio = 'FLAC'
  } else if (/\baac(?![a-z])/i.test(title)) {
    audio = 'AAC'
  }

  const audioCodec = parseAudioCodec(title)
  const audioChannels = parseAudioChannels(title, audioCodec)

  // HDR: check the most specific marker first. Dolby Vision releases almost
  // always also carry an HDR10 fallback layer and say so in the title, so a
  // plain "HDR10" test would win over "DV" if it ran first.
  let hdr: HdrFormat | null = null
  if (/\bdo?vi\b|\bdolby[\s._-]?vision\b|\bdv\b(?![\s._-]?rip)/i.test(title)) {
    hdr = 'DV'
  } else if (/\bhdr10\+|\bhdr10plus\b|\bhdrplus\b/i.test(title)) {
    hdr = 'HDR10+'
  } else if (/\bhdr10\b|\bhdr\b|\bpq\b/i.test(title)) {
    hdr = 'HDR10'
  } else if (/\bhlg\b/i.test(title)) {
    hdr = 'HLG'
  }

  let bitDepth: number | null = null
  if (/\b(?:10[\s._-]?bits?|hi10p?)\b/i.test(title)) {
    bitDepth = 10
  } else if (/\b12[\s._-]?bits?\b/i.test(title)) {
    bitDepth = 12
  } else if (/\b8[\s._-]?bits?\b/i.test(title)) {
    bitDepth = 8
  }

  return {
    resolution,
    source,
    codec,
    audio,
    isRemux,
    audioCodec,
    audioChannels,
    audioTier: audioTierFor(audioCodec),
    hdr,
    bitDepth,
    isProper: /\bproper\b/i.test(title),
    isRepack: /\brepack\b|\brerip\b/i.test(title),
    isUpscaled: /\bupscal(?:e|ed|ing)\b|\bai[\s._-]?upscal/i.test(title),
    hasHardcodedSubs: /\bhc\b|\bhard[\s._-]?(?:sub|subbed|subs|coded)\b/i.test(title),
    isJunkSource: junk !== null,
    junkSourceLabel: junk,
    releaseGroup: parseReleaseGroup(rawTitle),
  }
}

/**
 * Normalised audio codec. Ordered most specific first: an "TrueHD.Atmos" title
 * is an Atmos release, and "DTS-HD.MA" must not be swallowed by the plain DTS
 * pattern.
 */
export function parseAudioCodec(rawTitle: string): AudioCodec | null {
  const title = rawTitle.replace(/_/g, '.')

  // Codec tokens are routinely glued to a channel layout ("AAC2.0", "DTS5.1"),
  // so a trailing \b never matches — it needs a non-word character after it and
  // a digit is a word character. Guard with "not a letter" instead, which still
  // refuses to match inside a longer word.
  if (/\batmos(?![a-z])/i.test(title)) return 'Atmos'
  if (/\bdts[\s._-]?x(?![a-z])/i.test(title)) return 'DTS-X'
  if (/\btrue[\s._-]?hd(?![a-z])/i.test(title)) return 'TrueHD'
  if (/\bdts[\s._-]?hd[\s._-]?ma(?![a-z])/i.test(title)) return 'DTS-HD MA'
  if (/\bdts[\s._-]?hd(?![a-z])/i.test(title)) return 'DTS-HD'
  if (/\bdts(?![a-z])/i.test(title)) return 'DTS'
  if (/\bflac(?![a-z])/i.test(title)) return 'FLAC'
  if (/\bl?pcm(?![a-z])/i.test(title)) return 'PCM'
  // DD+ / DDP / E-AC3 are all Dolby Digital Plus.
  if (/\bdd[\s._-]?p\b|\bddp\d?|\bdd\+|\be[\s._-]?ac[\s._-]?3\b|\beac3\b/i.test(title)) {
    return 'EAC3'
  }
  if (/\bac[\s._-]?3\b|\bdd\d|\bdd[\s._-]?\d[\s._]\d\b|\bdolby[\s._-]?digital\b/i.test(title)) {
    return 'AC3'
  }
  if (/\baac(?![a-z])/i.test(title)) return 'AAC'
  if (/\bopus(?![a-z])/i.test(title)) return 'Opus'
  if (/\bvorbis(?![a-z])/i.test(title)) return 'Vorbis'
  if (/\bmp3(?![a-z])/i.test(title)) return 'MP3'
  return null
}

/**
 * Channel count from markers like "5.1", "DDP5.1", "7.1", "2.0", "6CH".
 *
 * Codecs are only used as a floor when the title says nothing: Atmos/TrueHD/
 * DTS-X releases are never stereo, but a title that explicitly says 2.0 is
 * believed over the codec.
 */
export function parseAudioChannels(rawTitle: string, codec?: AudioCodec | null): number | null {
  const title = rawTitle.replace(/_/g, '.')

  // "DDP5.1", "DTS-HD.MA.7.1", "AAC2.0", " 5.1 " — the channel pair may be
  // glued to the codec, so no leading boundary is required.
  // The leading class deliberately excludes digits: without it a date or year
  // ("2024.1.15") parses its own digits as a 5-channel marker.
  const explicit = title.match(/(?:^|[\s._-]|[a-z])([1-9])[._]([01])(?![\d])/i)
  if (explicit) {
    const front = Number.parseInt(explicit[1], 10)
    const lfe = Number.parseInt(explicit[2], 10)
    const total = front + lfe
    if (total >= 1 && total <= 10) return total
  }

  const chMatch = title.match(/\b([1-9])[\s._-]?ch\b/i)
  if (chMatch) return Number.parseInt(chMatch[1], 10)

  if (/\bmono\b/i.test(title)) return 1
  if (/\bstereo\b/i.test(title)) return 2

  const resolved = codec === undefined ? parseAudioCodec(rawTitle) : codec
  if (resolved === 'Atmos' || resolved === 'DTS-X' || resolved === 'TrueHD') return 6
  return null
}

/**
 * Trailing release group ("Movie.2024.1080p.BluRay.x264-GROUP"), ignoring a
 * container extension and any bracketed suffix indexers like to append.
 */
export function parseReleaseGroup(rawTitle: string): string | null {
  const cleaned = rawTitle
    .trim()
    .replace(/\.(mkv|mp4|avi|nzb|torrent)$/i, '')
    .replace(/\s*[[(][^\])]*[\])]\s*$/, '')
    .trim()

  const match = cleaned.match(/-([A-Za-z0-9_.]{2,20})$/)
  if (!match) return null
  // "Movie-2024" style suffixes are not groups.
  if (/^\d+$/.test(match[1])) return null
  return match[1]
}

/**
 * Parse a music release title for quality attributes
 */
export function parseMusicQuality(rawTitle: string): ParsedMusicQuality {
  // Release names separate tokens with dots, spaces, hyphens OR underscores.
  // Underscore is a word character, so \b never matches around it and every
  // \b-anchored pattern below silently fails on underscore-separated titles
  // (a real "..._1080p_HDTS_DD2_..." parsed as an unknown source and scored as
  // acceptable). Normalise to dots once so all patterns see a boundary.
  const title = rawTitle.replace(/_/g, '.')
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
export function parseBookQuality(rawTitle: string): ParsedBookQuality {
  // Release names separate tokens with dots, spaces, hyphens OR underscores.
  // Underscore is a word character, so \b never matches around it and every
  // \b-anchored pattern below silently fails on underscore-separated titles
  // (a real "..._1080p_HDTS_DD2_..." parsed as an unknown source and scored as
  // acceptable). Normalise to dots once so all patterns see a boundary.
  const title = rawTitle.replace(/_/g, '.')
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
  const languages = parseLanguages(title)

  switch (mediaType) {
    case 'movies':
    case 'tv': {
      const video = parseVideoQuality(title)
      const { id, name } = mapVideoToQualityId(video)
      return { mediaType, qualityId: id, qualityName: name, languages, video }
    }
    case 'music': {
      const music = parseMusicQuality(title)
      const { id, name } = mapMusicToQualityId(music)
      return { mediaType, qualityId: id, qualityName: name, languages, music }
    }
    case 'books': {
      const book = parseBookQuality(title)
      const { id, name } = mapBookToQualityId(book)
      return { mediaType, qualityId: id, qualityName: name, languages, book }
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
