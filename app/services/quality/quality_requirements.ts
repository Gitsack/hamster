/**
 * Quality requirements
 *
 * The quality profile's `items` list answers one question: which resolution/
 * source buckets may we take. That is not enough to tell a good file from a bad
 * one — "Bluray 1080p" covers both a 25 GB remux with a TrueHD 7.1 track and a
 * 1.2 GB rip with 96 kbps stereo AAC, and both parse into the same bucket.
 *
 * Requirements add the rest of the picture: audio codec/channels, HDR, video
 * codec, upscales and burned-in subtitles, plus custom-format score. They are
 * applied twice:
 *
 *  1. Against a *release title*, before grabbing. Titles are incomplete, so a
 *     missing attribute is never a rejection here — it is a ranking penalty.
 *     Only attributes the title states, and states as bad, block a grab.
 *  2. Against the *imported file*, via ffprobe. There nothing is unknown, so
 *     the same rules become a verdict on what actually landed on disk, which is
 *     what surfaces "good video, bad audio" and offers a replacement.
 */

import type { AudioCodec, AudioTier, ParsedQuality } from './quality_parser.js'
import { AUDIO_TIER_RANK, audioTierFor } from './quality_parser.js'

export interface QualityRequirements {
  /** Reject/flag audio with fewer channels than this (2 = stereo, 6 = 5.1, 8 = 7.1). */
  minAudioChannels: number | null
  /** Reject/flag audio below this tier. */
  minAudioTier: AudioTier | null
  /** Never accept these audio codecs. */
  blockedAudioCodecs: AudioCodec[]
  /** Rank these audio codecs above others of the same video quality. */
  preferredAudioCodecs: AudioCodec[]
  /** Require an HDR/Dolby Vision release. */
  requireHdr: boolean
  /** Never accept these video codecs ('x264', 'x265', 'AV1', 'VP9', 'XviD'). */
  blockedVideoCodecs: string[]
  /** Reject releases advertising an upscale — the resolution is a lie. */
  blockUpscaled: boolean
  /** Reject releases with burned-in subtitles. */
  blockHardcodedSubs: boolean
  /** Reject releases whose quality bucket could not be determined at all. */
  blockUnknownQuality: boolean
  /** Reject releases whose total custom-format score is below this. */
  minCustomFormatScore: number
  /** File-verification floors. Release titles almost never carry bitrates. */
  minVideoBitrateKbps: number | null
  minAudioBitrateKbps: number | null
}

export const DEFAULT_QUALITY_REQUIREMENTS: QualityRequirements = {
  minAudioChannels: null,
  minAudioTier: null,
  blockedAudioCodecs: [],
  preferredAudioCodecs: [],
  requireHdr: false,
  blockedVideoCodecs: [],
  blockUpscaled: true,
  blockHardcodedSubs: false,
  // Matches the behaviour profiles had before requirements existed: a release
  // we cannot classify is not grabbed.
  blockUnknownQuality: true,
  minCustomFormatScore: 0,
  minVideoBitrateKbps: null,
  minAudioBitrateKbps: null,
}

/**
 * Fill in any field a stored profile predates, so callers never have to guard.
 */
export function normalizeRequirements(
  value: Partial<QualityRequirements> | null | undefined
): QualityRequirements {
  return { ...DEFAULT_QUALITY_REQUIREMENTS, ...(value ?? {}) }
}

export interface AttributeEvaluation {
  /** Non-empty means the release must not be grabbed. */
  rejections: string[]
  /** Ranking bonus among releases in the same quality bucket. */
  bonus: number
}

const CHANNEL_LABELS: Record<number, string> = {
  1: 'mono',
  2: 'stereo',
  6: '5.1',
  8: '7.1',
}

export function describeChannels(channels: number | null): string {
  if (channels === null) return 'unknown'
  return CHANNEL_LABELS[channels] ?? `${channels} channel`
}

const AUDIO_TIER_LABELS: Record<AudioTier, string> = {
  'unknown': 'unknown',
  'lossy-sd': 'basic lossy',
  'lossy-hd': 'high-bitrate lossy',
  'lossless': 'lossless',
  'lossless-object': 'lossless object-based',
}

export function describeAudioTier(tier: AudioTier): string {
  return AUDIO_TIER_LABELS[tier]
}

/**
 * Apply requirements to a parsed release title.
 *
 * Unknown attributes are penalised, not rejected — see the module comment.
 */
export function evaluateReleaseAttributes(
  parsed: ParsedQuality,
  requirements: QualityRequirements
): AttributeEvaluation {
  const rejections: string[] = []
  let bonus = 0

  const video = parsed.video
  if (!video) {
    // Music and books have their own bucket list and no video attributes.
    return { rejections, bonus }
  }

  // Junk sources are refused unconditionally — there is no profile setting that
  // makes a cinema recording an acceptable file, and they are the releases most
  // likely to look fine on a resolution check alone.
  if (video.isJunkSource) {
    rejections.push(`Release is a ${video.junkSourceLabel ?? 'CAM'} rip`)
  }

  if (requirements.blockUpscaled && video.isUpscaled) {
    rejections.push('Release is an upscale')
  }

  if (requirements.blockHardcodedSubs && video.hasHardcodedSubs) {
    rejections.push('Release has burned-in subtitles')
  }

  if (video.codec && requirements.blockedVideoCodecs.includes(video.codec)) {
    rejections.push(`Video codec ${video.codec} is blocked`)
  }

  if (video.audioCodec && requirements.blockedAudioCodecs.includes(video.audioCodec)) {
    rejections.push(`Audio codec ${video.audioCodec} is blocked`)
  }

  if (requirements.minAudioTier && video.audioCodec) {
    const required = AUDIO_TIER_RANK[requirements.minAudioTier]
    if (AUDIO_TIER_RANK[video.audioTier] < required) {
      rejections.push(
        `Audio is ${describeAudioTier(video.audioTier)}, profile needs at least ${describeAudioTier(requirements.minAudioTier)}`
      )
    }
  }

  if (requirements.minAudioChannels !== null && video.audioChannels !== null) {
    if (video.audioChannels < requirements.minAudioChannels) {
      rejections.push(
        `Audio is ${describeChannels(video.audioChannels)}, profile needs at least ${describeChannels(requirements.minAudioChannels)}`
      )
    }
  }

  if (requirements.requireHdr && video.hdr === null && video.resolution === '2160p') {
    // Only enforced at 2160p: HDR effectively does not exist below it, and a
    // blanket rule would reject every 1080p release the profile still allows.
    rejections.push('Release is not HDR')
  }

  // --- ranking ---

  bonus += AUDIO_TIER_RANK[video.audioTier] * 6
  if (video.audioCodec === null) {
    // A title that says nothing about audio is a gamble next to one that does.
    bonus -= 5
  }
  if (video.audioChannels !== null) {
    bonus += Math.min(Math.max(video.audioChannels - 2, 0), 6) * 3
  }
  if (video.audioCodec && requirements.preferredAudioCodecs.includes(video.audioCodec)) {
    bonus += 15
  }
  if (video.hdr === 'DV' || video.hdr === 'HDR10+') {
    bonus += 8
  } else if (video.hdr !== null) {
    bonus += 5
  }
  if (video.bitDepth !== null && video.bitDepth >= 10) {
    bonus += 2
  }
  if (video.isRemux) {
    bonus += 8
  }
  if (video.isRepack || video.isProper) {
    // A repack exists because the first release was broken. Prefer it.
    bonus += 8
  }
  if (video.isUpscaled) {
    bonus -= 30
  }
  if (video.isJunkSource) {
    bonus -= 1000
  }
  if (video.hasHardcodedSubs) {
    bonus -= 20
  }

  return { rejections, bonus }
}

/**
 * What ffprobe actually found in an imported file.
 */
export interface FileQualityFacts {
  width: number | null
  height: number | null
  videoCodec: string | null
  videoBitrateKbps: number | null
  audioCodec: AudioCodec | null
  audioChannels: number | null
  audioBitrateKbps: number | null
}

const FFPROBE_AUDIO_CODECS: Record<string, AudioCodec> = {
  truehd: 'TrueHD',
  mlp: 'TrueHD',
  eac3: 'EAC3',
  ac3: 'AC3',
  dts: 'DTS',
  dca: 'DTS',
  aac: 'AAC',
  aac_latm: 'AAC',
  flac: 'FLAC',
  alac: 'FLAC',
  mp3: 'MP3',
  mp2: 'MP3',
  opus: 'Opus',
  vorbis: 'Vorbis',
}

/**
 * Map an ffprobe codec name to our normalised set.
 *
 * `profile` carries the distinction ffprobe folds into a single codec name:
 * TrueHD/E-AC3 with Atmos, and DTS with its HD-MA or DTS:X extensions.
 */
export function normalizeProbedAudioCodec(
  codecName: string | null | undefined,
  profile?: string | null
): AudioCodec | null {
  if (!codecName) return null
  const key = codecName.toLowerCase()
  const base = FFPROBE_AUDIO_CODECS[key] ?? (key.startsWith('pcm_') ? 'PCM' : null)
  if (!base) return null

  const p = (profile ?? '').toLowerCase()
  if (p.includes('atmos')) return 'Atmos'
  if (base === 'DTS') {
    if (p.includes('dts-x') || p.includes('dts:x')) return 'DTS-X'
    if (p.includes('ma')) return 'DTS-HD MA'
    if (p.includes('hd')) return 'DTS-HD'
  }
  return base
}

export interface FileQualityIssue {
  /** Stable key so the UI can group and the API can filter. */
  code:
    | 'resolution'
    | 'audio-codec'
    | 'audio-channels'
    | 'audio-bitrate'
    | 'video-bitrate'
    | 'video-codec'
  message: string
}

/**
 * Judge an imported file against the profile. Unlike the title check, silence
 * here is not the file's excuse: if ffprobe could not read an attribute we skip
 * it, but everything it did read is held to the rule.
 */
export function evaluateFileQuality(
  facts: FileQualityFacts,
  requirements: QualityRequirements,
  options?: { minHeight?: number | null }
): FileQualityIssue[] {
  const issues: FileQualityIssue[] = []

  if (options?.minHeight && facts.height !== null && facts.height + 20 < options.minHeight) {
    issues.push({
      code: 'resolution',
      message: `File is ${facts.height}p, profile expects at least ${options.minHeight}p`,
    })
  }

  if (facts.videoCodec && requirements.blockedVideoCodecs.length > 0) {
    const normalized = normalizeProbedVideoCodec(facts.videoCodec)
    if (normalized && requirements.blockedVideoCodecs.includes(normalized)) {
      issues.push({ code: 'video-codec', message: `Video codec ${normalized} is blocked` })
    }
  }

  if (facts.audioCodec) {
    if (requirements.blockedAudioCodecs.includes(facts.audioCodec)) {
      issues.push({ code: 'audio-codec', message: `Audio codec ${facts.audioCodec} is blocked` })
    }
    if (requirements.minAudioTier) {
      const tier = audioTierFor(facts.audioCodec)
      if (AUDIO_TIER_RANK[tier] < AUDIO_TIER_RANK[requirements.minAudioTier]) {
        issues.push({
          code: 'audio-codec',
          message: `Audio is ${facts.audioCodec} (${describeAudioTier(tier)}), profile needs at least ${describeAudioTier(requirements.minAudioTier)}`,
        })
      }
    }
  }

  if (
    requirements.minAudioChannels !== null &&
    facts.audioChannels !== null &&
    facts.audioChannels < requirements.minAudioChannels
  ) {
    issues.push({
      code: 'audio-channels',
      message: `Audio is ${describeChannels(facts.audioChannels)}, profile needs at least ${describeChannels(requirements.minAudioChannels)}`,
    })
  }

  if (
    requirements.minAudioBitrateKbps !== null &&
    facts.audioBitrateKbps !== null &&
    facts.audioBitrateKbps < requirements.minAudioBitrateKbps
  ) {
    issues.push({
      code: 'audio-bitrate',
      message: `Audio bitrate is ${facts.audioBitrateKbps} kbps, profile needs ${requirements.minAudioBitrateKbps} kbps`,
    })
  }

  if (
    requirements.minVideoBitrateKbps !== null &&
    facts.videoBitrateKbps !== null &&
    facts.videoBitrateKbps < requirements.minVideoBitrateKbps
  ) {
    issues.push({
      code: 'video-bitrate',
      message: `Video bitrate is ${facts.videoBitrateKbps} kbps, profile needs ${requirements.minVideoBitrateKbps} kbps`,
    })
  }

  return issues
}

const FFPROBE_VIDEO_CODECS: Record<string, string> = {
  h264: 'x264',
  avc: 'x264',
  hevc: 'x265',
  h265: 'x265',
  av1: 'AV1',
  vp9: 'VP9',
  mpeg4: 'XviD',
  msmpeg4v3: 'XviD',
}

export function normalizeProbedVideoCodec(codecName: string | null | undefined): string | null {
  if (!codecName) return null
  return FFPROBE_VIDEO_CODECS[codecName.toLowerCase()] ?? null
}
