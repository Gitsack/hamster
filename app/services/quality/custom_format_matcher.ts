import CustomFormat from '#models/custom_format'
import type { CustomFormatSpecification } from '#models/custom_format'
import db from '@adonisjs/lucid/services/db'

export interface CustomFormatMatch {
  customFormatId: string
  name: string
  score: number
}

export interface CustomFormatScoreResult {
  matches: CustomFormatMatch[]
  totalScore: number
  rejected: boolean
}

/**
 * Matches release titles against custom format specifications
 * and calculates scores based on quality profile assignments.
 */
export class CustomFormatMatcher {
  /**
   * Test a single specification against a release title
   */
  testSpecification(spec: CustomFormatSpecification, releaseTitle: string): boolean {
    const title = releaseTitle.toLowerCase()
    const value = spec.value.toLowerCase()
    let result: boolean

    switch (spec.implementation) {
      case 'contains': {
        try {
          const regex = new RegExp(spec.value, 'i')
          result = regex.test(releaseTitle)
        } catch {
          result = title.includes(value)
        }
        break
      }

      case 'notContains': {
        try {
          const regex = new RegExp(spec.value, 'i')
          result = !regex.test(releaseTitle)
        } catch {
          result = !title.includes(value)
        }
        break
      }

      case 'resolution': {
        const resolutionPatterns: Record<string, RegExp> = {
          '2160p': /(?:2160p|4k|uhd)/i,
          '1080p': /1080[pi]/i,
          '720p': /720p/i,
          '480p': /(?:480p|sd)/i,
        }
        const pattern = resolutionPatterns[value] || resolutionPatterns[spec.value]
        result = pattern ? pattern.test(releaseTitle) : false
        break
      }

      case 'source': {
        const sourcePatterns: Record<string, RegExp> = {
          bluray: /(?:blu[\s.-]?ray|bdremux|bdrip|brrip)/i,
          web: /(?:web[\s.-]?dl|webrip|web[\s.-]?cap|amzn|nf|dsnp|hmax|atvp)/i,
          hdtv: /hdtv/i,
          dvd: /(?:dvd(?:rip|scr)?|r5)/i,
          cam: /(?:cam(?:rip)?|ts|telesync|tc|telecine)/i,
          remux: /remux/i,
        }
        const pattern = sourcePatterns[value]
        result = pattern ? pattern.test(releaseTitle) : false
        break
      }

      case 'codec': {
        const codecPatterns: Record<string, RegExp> = {
          x264: /(?:x\.?264|h\.?264|avc)/i,
          x265: /(?:x\.?265|h\.?265|hevc)/i,
          av1: /\bav1\b/i,
          vp9: /\bvp9\b/i,
          xvid: /\bxvid\b/i,
          divx: /\bdivx\b/i,
        }
        const pattern = codecPatterns[value]
        result = pattern ? pattern.test(releaseTitle) : false
        break
      }

      case 'releaseGroup': {
        try {
          const regex = new RegExp(`-${spec.value}$`, 'i')
          result = regex.test(releaseTitle)
        } catch {
          result = title.endsWith(`-${value}`)
        }
        break
      }

      default:
        result = false
    }

    return spec.negate ? !result : result
  }

  /**
   * Test if a release title matches a custom format
   * A format matches when:
   * - All 'required' specs pass
   * - At least one non-required spec passes (if any exist)
   */
  matchesFormat(format: CustomFormat, releaseTitle: string): boolean {
    const specs = format.specifications
    if (!specs || specs.length === 0) return false

    const requiredSpecs = specs.filter((s) => s.required)
    const optionalSpecs = specs.filter((s) => !s.required)

    // All required specs must pass
    for (const spec of requiredSpecs) {
      if (!this.testSpecification(spec, releaseTitle)) {
        return false
      }
    }

    // If there are optional specs, at least one must pass
    if (optionalSpecs.length > 0) {
      const anyOptionalMatches = optionalSpecs.some((spec) =>
        this.testSpecification(spec, releaseTitle)
      )
      if (!anyOptionalMatches) {
        return false
      }
    }

    return true
  }

  /**
   * Score a release against all custom formats for a quality profile
   */
  async scoreRelease(
    releaseTitle: string,
    qualityProfileId: string
  ): Promise<CustomFormatScoreResult> {
    // Get all custom formats assigned to this quality profile with their scores
    const assignments = await db
      .from('quality_profile_custom_formats')
      .join(
        'custom_formats',
        'custom_formats.id',
        'quality_profile_custom_formats.custom_format_id'
      )
      .where('quality_profile_custom_formats.quality_profile_id', qualityProfileId)
      .select(
        'custom_formats.id',
        'custom_formats.name',
        'custom_formats.specifications',
        'quality_profile_custom_formats.score'
      )

    const matches: CustomFormatMatch[] = []
    let totalScore = 0

    for (const row of assignments) {
      const specs =
        typeof row.specifications === 'string' ? JSON.parse(row.specifications) : row.specifications

      const format = {
        id: row.id,
        name: row.name,
        specifications: specs,
        includeWhenRenaming: false,
      } as CustomFormat

      if (this.matchesFormat(format, releaseTitle)) {
        matches.push({
          customFormatId: row.id,
          name: row.name,
          score: row.score,
        })
        totalScore += row.score
      }
    }

    return {
      matches,
      totalScore,
      rejected: totalScore < -100,
    }
  }

  /**
   * Score a release against explicitly provided custom formats (no DB lookup)
   */
  scoreReleaseWithFormats(
    releaseTitle: string,
    formats: { format: CustomFormat; score: number }[]
  ): CustomFormatScoreResult {
    const matches: CustomFormatMatch[] = []
    let totalScore = 0

    for (const { format, score } of formats) {
      if (this.matchesFormat(format, releaseTitle)) {
        matches.push({
          customFormatId: format.id,
          name: format.name,
          score,
        })
        totalScore += score
      }
    }

    return {
      matches,
      totalScore,
      rejected: totalScore < -100,
    }
  }
}

export const customFormatMatcher = new CustomFormatMatcher()
