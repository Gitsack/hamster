/**
 * Release annotator
 *
 * The release list is where a bad grab is prevented or made. A row that reads
 * "Movie.2024.1080p.HDTS.x264-GRP" truncated to "Movie.2024.1080p.HD…" looks
 * like a perfectly good 1080p release, and that is exactly the one that hurts.
 *
 * So the API hands the UI the parsed facts rather than the raw string: what the
 * quality is, whether it is a cinema rip, what the audio is, and whether the
 * profile would accept it. One parser, one verdict, shared by the automatic
 * grab path and the manual picker.
 */

import type { UnifiedSearchResult } from '#services/indexers/indexer_manager'
import type QualityProfile from '#models/quality_profile'
import type { MediaType } from './quality_parser.js'
import { buildProfileContext, evaluateRelease, permissiveContext } from './quality_scorer.js'

export interface AnnotatedRelease {
  // Everything the raw search result carried, untouched.
  [key: string]: unknown
  quality: {
    name: string | null
    resolution: string | null
    source: string | null
    codec: string | null
    audioCodec: string | null
    audioChannels: number | null
    audioTier: string | null
    hdr: string | null
    bitDepth: number | null
    isRemux: boolean
    isProper: boolean
    isRepack: boolean
    isUpscaled: boolean
    hasHardcodedSubs: boolean
    isJunkSource: boolean
    junkSourceLabel: string | null
    releaseGroup: string | null
  }
  /** True when the profile would accept this release for an automatic grab. */
  accepted: boolean
  rejections: string[]
  customFormats: { name: string; score: number }[]
  score: number
}

/**
 * Annotate a list of search results against a profile (or without one).
 *
 * Rejected releases are annotated too, never dropped: the manual picker exists
 * precisely so a person can override the profile, and they can only do that if
 * they can see what they are overriding.
 */
export async function annotateReleases(
  results: UnifiedSearchResult[],
  mediaType: MediaType,
  profile: QualityProfile | null
): Promise<AnnotatedRelease[]> {
  const context = profile ? await buildProfileContext(profile) : permissiveContext()

  return results.map((result) => {
    const evaluation = evaluateRelease(result.title, result.size ?? null, mediaType, context)
    const video = evaluation.quality.parsed.video
    const music = evaluation.quality.parsed.music
    const book = evaluation.quality.parsed.book

    return {
      ...result,
      quality: {
        name: evaluation.quality.qualityName ?? music?.format ?? book?.format ?? null,
        resolution: video?.resolution ?? null,
        source: video?.source ?? null,
        codec: video?.codec ?? null,
        audioCodec: video?.audioCodec ?? null,
        audioChannels: video?.audioChannels ?? null,
        audioTier: video?.audioTier ?? null,
        hdr: video?.hdr ?? null,
        bitDepth: video?.bitDepth ?? null,
        isRemux: video?.isRemux ?? false,
        isProper: video?.isProper ?? false,
        isRepack: video?.isRepack ?? false,
        isUpscaled: video?.isUpscaled ?? false,
        hasHardcodedSubs: video?.hasHardcodedSubs ?? false,
        isJunkSource: video?.isJunkSource ?? false,
        junkSourceLabel: video?.junkSourceLabel ?? null,
        releaseGroup: video?.releaseGroup ?? null,
      },
      accepted: evaluation.allowed,
      rejections: evaluation.rejections,
      customFormats: evaluation.customFormatMatches,
      score: evaluation.totalScore,
    }
  })
}

/**
 * Sort annotated releases the way the picker should present them: everything
 * the profile accepts first, best first, then the rejects so they are visible
 * but never at the top of the list.
 */
export function sortAnnotated(releases: AnnotatedRelease[]): AnnotatedRelease[] {
  return [...releases].sort((a, b) => {
    if (a.accepted !== b.accepted) return a.accepted ? -1 : 1
    return b.score - a.score
  })
}
