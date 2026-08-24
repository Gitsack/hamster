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
import type CustomFormat from '#models/custom_format'
import { customFormatMatcher } from './custom_format_matcher.js'
import {
  DEFAULT_QUALITY_REQUIREMENTS,
  evaluateReleaseAttributes,
  normalizeRequirements,
  type QualityRequirements,
} from './quality_requirements.js'

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

/* ------------------------------------------------------------------------- *
 * Full release evaluation
 *
 * scoreRelease above answers "is this bucket allowed"; that alone is what let a
 * 1080p BluRay with a 96 kbps stereo track win over a 1080p WEB-DL with TrueHD
 * 5.1 — same bucket, and size was the only tiebreaker. evaluateRelease adds the
 * attribute rules and custom-format scores on top, and reports why anything was
 * rejected so the UI can say more than "no results".
 * ------------------------------------------------------------------------- */

export interface ProfileContext {
  items: QualityItem[]
  cutoff: number
  requirements: QualityRequirements
  /** Preloaded so a search over 100 releases does one DB round trip, not 100. */
  customFormats: { format: CustomFormat; score: number }[]
  minSizeBytes?: number
  maxSizeBytes?: number
  upgradeAllowed: boolean
  profileName: string
}

export interface ReleaseEvaluation {
  allowed: boolean
  /** Human-readable reasons the release was refused. Empty when allowed. */
  rejections: string[]
  quality: QualityScore
  attributeBonus: number
  customFormatScore: number
  customFormatMatches: { name: string; score: number }[]
  /** Ranking key. Bucket dominates; attributes and custom formats break ties. */
  totalScore: number
}

/** Bucket rank is multiplied so a better bucket always beats a better tie-break. */
const BUCKET_WEIGHT = 1000

/**
 * Stand-in item list for media with no quality profile. The ids are the same
 * across every media type, so one list covers all of them.
 */
const ALL_QUALITY_ITEMS: QualityItem[] = Array.from({ length: 9 }, (_, index) => ({
  id: index + 1,
  name: `Quality ${index + 1}`,
  allowed: true,
}))

/**
 * Build the scoring context for a profile, loading its custom formats once.
 */
export async function buildProfileContext(profile: {
  id: string
  name: string
  items: QualityItem[]
  cutoff: number
  upgradeAllowed: boolean
  minSizeMb: number | null
  maxSizeMb: number | null
  requirements: Partial<QualityRequirements> | null
}): Promise<ProfileContext> {
  const customFormats = await customFormatMatcher
    .loadFormatsForProfile(profile.id)
    .catch(() => [] as { format: CustomFormat; score: number }[])

  return {
    items: profile.items ?? [],
    cutoff: profile.cutoff,
    requirements: normalizeRequirements(profile.requirements),
    customFormats,
    minSizeBytes:
      profile.minSizeMb !== null && profile.minSizeMb !== undefined
        ? profile.minSizeMb * 1024 * 1024
        : undefined,
    maxSizeBytes:
      profile.maxSizeMb !== null && profile.maxSizeMb !== undefined
        ? profile.maxSizeMb * 1024 * 1024
        : undefined,
    upgradeAllowed: profile.upgradeAllowed,
    profileName: profile.name,
  }
}

/**
 * A context for callers with no profile: every known quality is acceptable and
 * nothing is blocked, but attribute ranking still applies so the better release
 * of two equals wins.
 */
export function permissiveContext(items?: QualityItem[]): ProfileContext {
  return {
    // Every bucket id we know about, all allowed. An empty item list would make
    // scoreRelease report "not in profile" for everything, which is the exact
    // opposite of permissive.
    items: items ?? ALL_QUALITY_ITEMS,
    cutoff: 0,
    requirements: { ...DEFAULT_QUALITY_REQUIREMENTS, blockUnknownQuality: false },
    customFormats: [],
    upgradeAllowed: true,
    profileName: 'None',
  }
}

export function evaluateRelease(
  releaseTitle: string,
  sizeBytes: number | null,
  mediaType: MediaType,
  context: ProfileContext
): ReleaseEvaluation {
  const rejections: string[] = []
  const quality = scoreRelease(releaseTitle, mediaType, context.items, context.cutoff)

  const isJunk = quality.parsed.video?.isJunkSource === true

  if (quality.qualityId === null) {
    // Junk sources also map to a null bucket, but "could not be determined" is
    // the wrong thing to tell someone about a TELESYNC — the attribute check
    // below reports it precisely.
    if (context.requirements.blockUnknownQuality && !isJunk) {
      rejections.push('Quality could not be determined from the release name')
    }
  } else if (!quality.allowed) {
    rejections.push(
      `${quality.qualityName ?? 'Quality'} is not allowed by profile "${context.profileName}"`
    )
  }

  if (sizeBytes !== null && sizeBytes > 0) {
    if (context.minSizeBytes && sizeBytes < context.minSizeBytes) {
      rejections.push(`Below the profile's minimum size (${formatMb(context.minSizeBytes)})`)
    }
    if (context.maxSizeBytes && sizeBytes > context.maxSizeBytes) {
      rejections.push(`Above the profile's maximum size (${formatMb(context.maxSizeBytes)})`)
    }
  }

  const attributes = evaluateReleaseAttributes(quality.parsed, context.requirements)
  rejections.push(...attributes.rejections)

  const cf =
    context.customFormats.length > 0
      ? customFormatMatcher.scoreReleaseWithFormats(releaseTitle, context.customFormats)
      : { matches: [], totalScore: 0, rejected: false }

  if (cf.totalScore < context.requirements.minCustomFormatScore) {
    rejections.push(
      `Custom format score ${cf.totalScore} is below the profile minimum of ${context.requirements.minCustomFormatScore}`
    )
  }

  return {
    allowed: rejections.length === 0,
    rejections,
    quality,
    attributeBonus: attributes.bonus,
    customFormatScore: cf.totalScore,
    customFormatMatches: cf.matches.map((m) => ({ name: m.name, score: m.score })),
    totalScore: quality.score * BUCKET_WEIGHT + attributes.bonus + cf.totalScore,
  }
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

export interface EvaluatedRelease<T> {
  release: T
  evaluation: ReleaseEvaluation
}

/**
 * Evaluate every release, keeping the rejected ones so callers can explain the
 * outcome. Accepted releases come first, best-ranked first.
 */
export function evaluateReleases<T extends { title: string; size: number }>(
  releases: T[],
  mediaType: MediaType,
  context: ProfileContext
): { accepted: EvaluatedRelease<T>[]; rejected: EvaluatedRelease<T>[] } {
  const evaluated = releases.map((release) => ({
    release,
    evaluation: evaluateRelease(release.title, release.size ?? null, mediaType, context),
  }))

  const accepted = evaluated.filter((e) => e.evaluation.allowed)
  const rejected = evaluated.filter((e) => !e.evaluation.allowed)

  accepted.sort((a, b) => {
    if (b.evaluation.totalScore !== a.evaluation.totalScore) {
      return b.evaluation.totalScore - a.evaluation.totalScore
    }
    return (b.release.size ?? 0) - (a.release.size ?? 0)
  })

  return { accepted, rejected }
}

/**
 * Whether a candidate release beats what is already on disk, judged on the same
 * combined score used for ranking rather than the bucket alone. A same-bucket
 * release with materially better audio counts as an upgrade; an identical one
 * does not.
 */
export function isBetterThanCurrent(
  currentTitleOrQuality: string | null,
  currentEvaluationScore: number | null,
  candidateTitle: string,
  mediaType: MediaType,
  context: ProfileContext
): boolean {
  const candidate = evaluateRelease(candidateTitle, null, mediaType, context)
  if (!candidate.allowed) return false

  if (currentEvaluationScore !== null) {
    return candidate.totalScore > currentEvaluationScore
  }

  if (!currentTitleOrQuality) return true

  const current = evaluateRelease(currentTitleOrQuality, null, mediaType, context)
  return candidate.totalScore > current.totalScore
}
