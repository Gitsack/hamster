import {
  formatSizeBand,
  normalizeSettings,
  profileSummary,
  renderPattern,
  renderPatternPath,
  typeFromUrl,
} from './library_catalog'
import { NAMING_FIXTURE, PROFILES_FIXTURE } from './library_fixtures'

describe('formatSizeBand', () => {
  it('shares the unit when both ends use it', () => {
    expect(formatSizeBand(2048, 15360)).toBe('2–15 GB')
    expect(formatSizeBand(700, 4096)).toBe('700 MB–4 GB')
  })

  it('says which end is open', () => {
    expect(formatSizeBand(700, null)).toBe('≥ 700 MB')
    expect(formatSizeBand(null, 1536)).toBe('≤ 1.5 GB')
    expect(formatSizeBand(null, null)).toBeNull()
    expect(formatSizeBand(0, 0)).toBeNull()
  })
})

describe('profileSummary', () => {
  it('reads a profile as one dense line', () => {
    expect(profileSummary(PROFILES_FIXTURE[0])).toEqual([
      '4 of 9 qualities',
      'cutoff Bluray 1080p',
      'upgrades on',
      '2–15 GB',
    ])
  })

  it('drops the cutoff when upgrades are off, and shows a custom format minimum', () => {
    const profile = {
      ...PROFILES_FIXTURE[1],
      requirements: { minCustomFormatScore: 10 } as any,
    }
    expect(profileSummary(profile)).toEqual(['9 of 9 qualities', 'upgrades off', 'min CF 10'])
  })
})

describe('renderPattern', () => {
  it('fills variables and tidies what empty ones leave behind', () => {
    const vars = NAMING_FIXTURE.variables.movies.movieFile
    expect(renderPattern(vars, '{title} ({year}) - {quality}')).toBe(
      'Arrival (2016) - Bluray-1080p'
    )
    expect(renderPattern([], 'Movie ()  [] name')).toBe('Movie name')
  })

  it('joins a type’s fields into the path they write', () => {
    expect(renderPatternPath(NAMING_FIXTURE, 'tv', NAMING_FIXTURE.patterns.tv)).toBe(
      'Severance (2022)/Season 02/Severance - S02E03 - Who Is Alive?'
    )
  })
})

describe('typeFromUrl', () => {
  it('reads ?type= and ignores anything else', () => {
    expect(typeFromUrl('/settings/quality?type=tv')).toBe('tv')
    expect(typeFromUrl('/settings/quality?type=tv#formats')).toBe('tv')
    expect(typeFromUrl('/settings/quality?type=podcasts')).toBeNull()
    expect(typeFromUrl('/settings/quality')).toBeNull()
  })
})

describe('normalizeSettings', () => {
  it('fills what an older install leaves out', () => {
    const settings = normalizeSettings({ enabledMediaTypes: ['movies', 'games' as any] })
    expect(settings.enabledMediaTypes).toEqual(['movies'])
    expect(settings.recommendationSettings.maxPersonalizedLanes).toBe(3)
    expect(settings.justwatchLocale).toBe('en_US')
    expect(settings.accounts).toEqual([])
  })
})
