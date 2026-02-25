/**
 * Quality Scorer
 *
 * Scores releases against quality profiles and determines whether upgrades
 * are warranted based on profile cutoff settings.
 */

import type { QualityItem } from '#models/quality_profile'
import {
  parseQuality,
  qualityNameToId,
  type MediaType,
  type ParsedQuality,
} from './quality_parser.js'

export interface QualityScore {
  allowed: boolean
  score: number
  meetsCustomCutoff: boolean
  qualityName: string | null
  qualityId: number | null
  parsed: ParsedQuality
}

export interface ScoredRelease<T> {
  release: T
  score: QualityScore
}

/**
 * Score a single release against a quality profile.
 *
 * The score is derived from the position in the profile's items array:
 * - Items earlier in the array (lower index) have higher quality
 * - Only allowed items get a positive score
 * - Unknown quality gets score 0 and is not allowed
 */
export function scoreRelease(
  releaseTitle: string,
  mediaType: MediaType,
  profileItems: QualityItem[],
  cutoff: number
): QualityScore {
  const parsed = parseQuality(releaseTitle, mediaType)

  // If we couldn't determine quality, mark as not allowed
  if (parsed.qualityId === null) {
    return {
      allowed: false,
      score: 0,
      meetsCustomCutoff: false,
      qualityName: parsed.qualityName,
      qualityId: null,
      parsed,
    }
  }

  // Find the quality in the profile's items
  const profileItem = profileItems.find((item) => item.id === parsed.qualityId)

  if (!profileItem) {
    // Quality not in profile at all
    return {
      allowed: false,
      score: 0,
      meetsCustomCutoff: false,
      qualityName: parsed.qualityName,
      qualityId: parsed.qualityId,
      parsed,
    }
  }

  // Check if the quality is allowed in the profile
  const allowed = profileItem.allowed

  // Calculate score: find position among allowed items
  // Higher position (earlier in allowed list) = higher score
  const allowedItems = profileItems.filter((item) => item.allowed)
  const positionInAllowed = allowedItems.findIndex((item) => item.id === parsed.qualityId)

  // Score is based on reverse position (first allowed item gets highest score)
  // +1 so that allowed items always have score >= 1
  const score = allowed && positionInAllowed !== -1 ? allowedItems.length - positionInAllowed : 0

  // Check if quality meets or exceeds cutoff
  // The cutoff is a quality item ID. A quality meets cutoff if its score is >= the cutoff item's score.
  const cutoffPosition = allowedItems.findIndex((item) => item.id === cutoff)
  const cutoffScore =
    cutoffPosition !== -1 ? allowedItems.length - cutoffPosition : allowedItems.length
  const meetsCustomCutoff = score >= cutoffScore

  return {
    allowed,
    score,
    meetsCustomCutoff,
    qualityName: parsed.qualityName,
    qualityId: parsed.qualityId,
    parsed,
  }
}

/**
 * Score and rank an array of releases against a quality profile.
 * Returns only allowed releases, sorted by score descending, then by size descending as tiebreaker.
 * Optionally filters by min/max size in bytes.
 */
export function scoreAndRankReleases<T extends { title: string; size: number }>(
  releases: T[],
  mediaType: MediaType,
  profileItems: QualityItem[],
  cutoff: number,
  options?: { minSizeBytes?: number; maxSizeBytes?: number }
): ScoredRelease<T>[] {
  const scored = releases.map((release) => ({
    release,
    score: scoreRelease(release.title, mediaType, profileItems, cutoff),
  }))

  // Filter to only allowed releases
  let allowed = scored.filter((s) => s.score.allowed)

  // Filter by size limits
  if (options?.minSizeBytes) {
    const min = options.minSizeBytes
    allowed = allowed.filter((s) => s.release.size >= min)
  }
  if (options?.maxSizeBytes) {
    const max = options.maxSizeBytes
    allowed = allowed.filter((s) => s.release.size <= max)
  }

  // Sort: highest score first, then largest size as tiebreaker
  allowed.sort((a, b) => {
    if (b.score.score !== a.score.score) {
      return b.score.score - a.score.score
    }
    return b.release.size - a.release.size
  })

  return allowed
}

/**
 * Determine if a new release represents a quality upgrade over an existing file.
 *
 * @param currentQualityName - The quality string stored on the current file (e.g. "1080p", "FLAC")
 * @param newReleaseTitle - The title of the new release to evaluate
 * @param mediaType - The media type
 * @param profileItems - The quality profile items
 * @param cutoff - The quality profile cutoff ID
 * @param upgradeAllowed - Whether the profile allows upgrades
 * @returns Whether the new release is a valid upgrade
 */
export function isUpgrade(
  currentQualityName: string | null,
  newReleaseTitle: string,
  mediaType: MediaType,
  profileItems: QualityItem[],
  cutoff: number,
  upgradeAllowed: boolean
): boolean {
  // If upgrades are not allowed, never upgrade
  if (!upgradeAllowed) {
    return false
  }

  // Score the new release
  const newScore = scoreRelease(newReleaseTitle, mediaType, profileItems, cutoff)

  // New release must be allowed
  if (!newScore.allowed) {
    return false
  }

  // If no current quality info, any allowed release is an upgrade
  if (!currentQualityName) {
    return true
  }

  // Get current quality score
  const currentQualityId = qualityNameToId(currentQualityName, mediaType)
  if (currentQualityId === null) {
    // Can't determine current quality -- allow upgrade to any known allowed quality
    return true
  }

  // Find current quality position in allowed items
  const allowedItems = profileItems.filter((item) => item.allowed)
  const currentPosition = allowedItems.findIndex((item) => item.id === currentQualityId)
  const currentScore = currentPosition !== -1 ? allowedItems.length - currentPosition : 0

  // Check if current quality already meets cutoff
  const cutoffPosition = allowedItems.findIndex((item) => item.id === cutoff)
  const cutoffScore =
    cutoffPosition !== -1 ? allowedItems.length - cutoffPosition : allowedItems.length
  const currentMeetsCutoff = currentScore >= cutoffScore

  // If current already meets cutoff, no upgrade needed
  if (currentMeetsCutoff) {
    return false
  }

  // New release must be better quality than current
  return newScore.score > currentScore
}

/**
 * Check if a media item's current file quality is below the profile cutoff.
 * Used for "cutoff unmet" queries.
 */
export function isCutoffUnmet(
  currentQualityName: string | null,
  mediaType: MediaType,
  profileItems: QualityItem[],
  cutoff: number
): boolean {
  if (!currentQualityName) {
    // No file quality info -- consider cutoff unmet
    return true
  }

  const currentQualityId = qualityNameToId(currentQualityName, mediaType)
  if (currentQualityId === null) {
    return true
  }

  const allowedItems = profileItems.filter((item) => item.allowed)
  const currentPosition = allowedItems.findIndex((item) => item.id === currentQualityId)
  const currentScore = currentPosition !== -1 ? allowedItems.length - currentPosition : 0

  const cutoffPosition = allowedItems.findIndex((item) => item.id === cutoff)
  const cutoffScore =
    cutoffPosition !== -1 ? allowedItems.length - cutoffPosition : allowedItems.length

  return currentScore < cutoffScore
}
