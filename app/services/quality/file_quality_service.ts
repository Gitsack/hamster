/**
 * File quality service
 *
 * Everything the release title claimed is a guess until the file is on disk.
 * This service does the second pass: probe what actually landed, store it, and
 * compare it to the profile. That is what turns "the download succeeded" into
 * "the download succeeded but the audio is stereo AAC and your profile asks for
 * 5.1" — and gives the UI something concrete to offer a replacement for.
 */

import path from 'node:path'
import logger from '@adonisjs/core/services/logger'
import type { VideoMediaInfo } from '#models/movie_file'
import type QualityProfile from '#models/quality_profile'
import { checkFfmpegAvailable, probeFile, type MediaAnalysis } from '#utils/ffmpeg_utils'
import {
  evaluateFileQuality,
  normalizeProbedAudioCodec,
  normalizeRequirements,
  type FileQualityFacts,
  type FileQualityIssue,
} from './quality_requirements.js'
import { qualityNameToId, type MediaType } from './quality_parser.js'
import type { QualityItem } from '#models/quality_profile'

/** Minimum height implied by each video quality bucket id. */
const QUALITY_MIN_HEIGHT: Record<number, number> = {
  1: 2160, // Bluray 2160p
  2: 1080, // Bluray 1080p
  3: 720, // Bluray 720p
  4: 2160, // Web 2160p
  5: 1080, // Web 1080p
  6: 720, // Web 720p
  7: 1080, // HDTV 1080p
  8: 720, // HDTV 720p
  9: 480, // DVD
}

/**
 * Convert an ffprobe result into the media info we persist on file records.
 */
export function analysisToMediaInfo(analysis: MediaAnalysis): VideoMediaInfo {
  return {
    codec: analysis.videoCodec ?? undefined,
    resolution: analysis.videoHeight ? `${analysis.videoHeight}p` : undefined,
    width: analysis.videoWidth ?? undefined,
    height: analysis.videoHeight ?? undefined,
    bitrate: analysis.videoBitrate ?? undefined,
    videoBitrate: analysis.videoBitrate ?? undefined,
    audioCodec: analysis.audioCodec ?? undefined,
    audioChannels: analysis.audioChannels ?? undefined,
    audioBitrate: analysis.audioBitrate ?? undefined,
    audioProfile: analysis.audioProfile ?? undefined,
    audioChannelLayout: analysis.audioChannelLayout ?? undefined,
    container: analysis.container,
    duration: analysis.duration || undefined,
  }
}

/**
 * Probe a video file, returning null when ffprobe is unavailable or the file
 * cannot be read. Callers treat null as "no information", never as "bad file" —
 * a missing ffprobe must not start flagging a whole library.
 */
export async function probeVideoFile(absolutePath: string): Promise<VideoMediaInfo | null> {
  const { ffprobe } = await checkFfmpegAvailable()
  if (!ffprobe) return null

  try {
    const analysis = await probeFile(absolutePath)
    return analysisToMediaInfo(analysis)
  } catch (error) {
    logger.debug({ err: error, path: absolutePath }, 'FileQuality: probe failed')
    return null
  }
}

export function factsFromMediaInfo(info: VideoMediaInfo | null): FileQualityFacts {
  if (!info) {
    return {
      width: null,
      height: null,
      videoCodec: null,
      videoBitrateKbps: null,
      audioCodec: null,
      audioChannels: null,
      audioBitrateKbps: null,
    }
  }

  const height = info.height ?? parseHeight(info.resolution)

  return {
    width: info.width ?? null,
    height,
    videoCodec: info.codec ?? null,
    videoBitrateKbps: toKbps(info.videoBitrate ?? info.bitrate),
    audioCodec: normalizeProbedAudioCodec(info.audioCodec, info.audioProfile),
    audioChannels: info.audioChannels ?? null,
    audioBitrateKbps: toKbps(info.audioBitrate),
  }
}

function parseHeight(resolution: string | undefined): number | null {
  if (!resolution) return null
  const match = resolution.match(/(\d{3,4})/)
  return match ? Number.parseInt(match[1], 10) : null
}

function toKbps(bitsPerSecond: number | undefined | null): number | null {
  if (!bitsPerSecond || bitsPerSecond <= 0) return null
  // ffprobe reports bits per second; anything under 10000 is already kbps from
  // an older record we wrote ourselves.
  return bitsPerSecond > 10000 ? Math.round(bitsPerSecond / 1000) : Math.round(bitsPerSecond)
}

/**
 * The height the profile's *lowest allowed* bucket implies. A file below it is
 * worse than anything the profile would have grabbed.
 */
export function minHeightForProfile(items: QualityItem[]): number | null {
  const heights = items
    .filter((item) => item.allowed)
    .map((item) => QUALITY_MIN_HEIGHT[item.id])
    .filter((h): h is number => typeof h === 'number')

  if (heights.length === 0) return null
  return Math.min(...heights)
}

export interface FileQualityAssessment {
  /** Nothing about the file falls short of the profile. */
  meetsProfile: boolean
  issues: FileQualityIssue[]
  /** True when the stored quality bucket is below the profile's cutoff. */
  belowCutoff: boolean
  mediaInfo: VideoMediaInfo | null
}

/**
 * Judge a stored file against its profile. Returns an empty assessment when
 * there is no profile — no profile means no expectations to fall short of.
 */
export function assessFile(
  mediaInfo: VideoMediaInfo | null,
  storedQuality: string | null,
  profile: QualityProfile | null,
  mediaType: MediaType
): FileQualityAssessment {
  if (!profile) {
    return { meetsProfile: true, issues: [], belowCutoff: false, mediaInfo }
  }

  const requirements = normalizeRequirements(profile.requirements)
  const facts = factsFromMediaInfo(mediaInfo)
  const issues = evaluateFileQuality(facts, requirements, {
    minHeight: minHeightForProfile(profile.items ?? []),
  })

  let belowCutoff = false
  if (storedQuality) {
    const currentId = qualityNameToId(storedQuality, mediaType)
    const allowed = (profile.items ?? []).filter((item) => item.allowed)
    const currentPos = currentId === null ? -1 : allowed.findIndex((i) => i.id === currentId)
    const cutoffPos = allowed.findIndex((i) => i.id === profile.cutoff)
    if (currentPos !== -1 && cutoffPos !== -1) {
      // Items are ordered best-first, so a larger index is a worse quality.
      belowCutoff = currentPos > cutoffPos
    }
  }

  return {
    meetsProfile: issues.length === 0 && !belowCutoff,
    issues,
    belowCutoff,
    mediaInfo,
  }
}

/**
 * A file's actual audio and video, split the way a detail page wants to label it:
 * "1080p h264" under Video, "TrueHD 5.1" under Audio. The joined summary below is
 * the same facts run together, for rows too dense to carry labels.
 */
export interface MediaInfoParts {
  video: string | null
  audio: string | null
}

export function describeMediaInfoParts(info: VideoMediaInfo | null): MediaInfoParts {
  if (!info) return { video: null, audio: null }
  const { resolution, codec, audio } = mediaInfoFacts(info)
  return { video: join([resolution, codec], ' '), audio }
}

/**
 * Short human summary of a file's actual audio/video, for list rows and the
 * replace dialog: "1080p · x265 · TrueHD 5.1".
 */
export function describeMediaInfo(info: VideoMediaInfo | null): string | null {
  if (!info) return null
  const { resolution, codec, audio } = mediaInfoFacts(info)
  return join([resolution, codec, audio], ' · ')
}

function mediaInfoFacts(info: VideoMediaInfo) {
  const audioCodec =
    normalizeProbedAudioCodec(info.audioCodec, info.audioProfile) ?? info.audioCodec
  const channels = info.audioChannels
  const channelLabel =
    channels === 6 ? '5.1' : channels === 8 ? '7.1' : channels === 2 ? '2.0' : null

  return {
    resolution: info.height ? `${info.height}p` : (info.resolution ?? null),
    codec: info.codec ?? null,
    audio: join([audioCodec, channelLabel], ' '),
  }
}

function join(parts: (string | null | undefined)[], separator: string): string | null {
  const kept = parts.filter(Boolean)
  return kept.length > 0 ? kept.join(separator) : null
}

/**
 * Backfill media info for a file imported before we started probing, or scanned
 * in from an existing library. Probes once and persists, so the cost is paid on
 * first view and never again.
 *
 * Returns the existing info untouched when there is nothing to do. Failure is
 * silent by design: a library on a disconnected mount should render, not error.
 */
export async function ensureMediaInfo<
  T extends { mediaInfo: VideoMediaInfo | null; relativePath: string; save(): Promise<unknown> },
>(file: T, rootFolderPath: string | null | undefined): Promise<VideoMediaInfo | null> {
  if (file.mediaInfo && file.mediaInfo.audioCodec) return file.mediaInfo
  if (!rootFolderPath) return file.mediaInfo

  const info = await probeVideoFile(path.join(rootFolderPath, file.relativePath))
  if (!info) return file.mediaInfo

  file.mediaInfo = info
  await file.save().catch((err: unknown) => {
    logger.debug({ err }, 'FileQuality: failed to persist backfilled media info')
  })
  return info
}
