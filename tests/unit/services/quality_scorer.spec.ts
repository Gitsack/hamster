import { test } from '@japa/runner'
import {
  scoreRelease,
  scoreAndRankReleases,
  isUpgrade,
  isCutoffUnmet,
} from '../../../app/services/quality/quality_scorer.js'
import type { QualityItem } from '../../../app/models/quality_profile.js'

// Standard movie quality profile for testing
// Items in order of quality: Bluray 2160p (best) -> DVD (worst)
const movieProfileItems: QualityItem[] = [
  { id: 1, name: 'Bluray 2160p', allowed: true },
  { id: 2, name: 'Bluray 1080p', allowed: true },
  { id: 5, name: 'Web 1080p', allowed: true },
  { id: 6, name: 'Web 720p', allowed: true },
  { id: 8, name: 'HDTV 720p', allowed: true },
  { id: 9, name: 'DVD', allowed: false }, // DVD not allowed
]

// Cutoff at Bluray 1080p (id: 2)
const movieCutoff = 2

test.group('quality_scorer | scoreRelease', () => {
  test('scores an allowed quality with positive score', ({ assert }) => {
    const result = scoreRelease(
      'Movie.2024.1080p.BluRay.x264',
      'movies',
      movieProfileItems,
      movieCutoff
    )
    assert.isTrue(result.allowed)
    assert.isAbove(result.score, 0)
    assert.equal(result.qualityId, 2) // Bluray 1080p
    assert.equal(result.qualityName, 'Bluray 1080p')
  })

  test('highest quality gets highest score', ({ assert }) => {
    const score2160 = scoreRelease(
      'Movie.2024.2160p.BluRay',
      'movies',
      movieProfileItems,
      movieCutoff
    )
    const score1080 = scoreRelease(
      'Movie.2024.1080p.BluRay',
      'movies',
      movieProfileItems,
      movieCutoff
    )
    assert.isAbove(score2160.score, score1080.score)
  })

  test('disallowed quality has score 0 and allowed=false', ({ assert }) => {
    const result = scoreRelease('Movie.2024.DVDRip', 'movies', movieProfileItems, movieCutoff)
    assert.isFalse(result.allowed)
    assert.equal(result.score, 0)
  })

  test('unknown quality returns null qualityId', ({ assert }) => {
    const result = scoreRelease('SomeRandomRelease', 'movies', movieProfileItems, movieCutoff)
    assert.isFalse(result.allowed)
    assert.equal(result.score, 0)
    assert.isNull(result.qualityId)
  })

  test('meetsCustomCutoff is true when quality meets cutoff', ({ assert }) => {
    // Cutoff is Bluray 1080p (id 2), Bluray 2160p should meet it
    const result = scoreRelease('Movie.2024.2160p.BluRay', 'movies', movieProfileItems, movieCutoff)
    assert.isTrue(result.meetsCustomCutoff)
  })

  test('meetsCustomCutoff is true when quality equals cutoff', ({ assert }) => {
    const result = scoreRelease('Movie.2024.1080p.BluRay', 'movies', movieProfileItems, movieCutoff)
    assert.isTrue(result.meetsCustomCutoff)
  })

  test('meetsCustomCutoff is false when quality is below cutoff', ({ assert }) => {
    const result = scoreRelease('Movie.2024.720p.HDTV', 'movies', movieProfileItems, movieCutoff)
    assert.isFalse(result.meetsCustomCutoff)
  })

  test('quality not in profile returns allowed=false', ({ assert }) => {
    // Bluray 720p (id 3) is not in our profile items at all
    const result = scoreRelease('Movie.2024.720p.BluRay', 'movies', movieProfileItems, movieCutoff)
    assert.isFalse(result.allowed)
  })

  test('includes parsed quality in result', ({ assert }) => {
    const result = scoreRelease(
      'Movie.2024.1080p.BluRay.x264',
      'movies',
      movieProfileItems,
      movieCutoff
    )
    assert.isDefined(result.parsed)
    assert.equal(result.parsed.mediaType, 'movies')
    assert.isDefined(result.parsed.video)
  })
})

test.group('quality_scorer | scoreAndRankReleases', () => {
  const releases = [
    { title: 'Movie.2024.720p.HDTV', size: 500 },
    { title: 'Movie.2024.1080p.BluRay.x264', size: 8000 },
    { title: 'Movie.2024.1080p.WEB-DL', size: 4000 },
    { title: 'Movie.2024.DVDRip', size: 700 }, // Not allowed
    { title: 'RandomNonsense', size: 100 }, // Unknown quality
  ]

  test('filters out disallowed releases', ({ assert }) => {
    const ranked = scoreAndRankReleases(releases, 'movies', movieProfileItems, movieCutoff)
    const titles = ranked.map((r) => r.release.title)
    assert.notInclude(titles, 'Movie.2024.DVDRip')
    assert.notInclude(titles, 'RandomNonsense')
  })

  test('ranks by quality score descending', ({ assert }) => {
    const ranked = scoreAndRankReleases(releases, 'movies', movieProfileItems, movieCutoff)
    assert.isAbove(ranked.length, 1)
    // First should be Bluray 1080p (higher score than Web 1080p)
    assert.equal(ranked[0].release.title, 'Movie.2024.1080p.BluRay.x264')
  })

  test('uses size as tiebreaker for same quality', ({ assert }) => {
    const sameQualityReleases = [
      { title: 'Movie.2024.1080p.WEB-DL.x264-A', size: 3000 },
      { title: 'Movie.2024.1080p.WEB-DL.x264-B', size: 5000 },
    ]
    const ranked = scoreAndRankReleases(
      sameQualityReleases,
      'movies',
      movieProfileItems,
      movieCutoff
    )
    assert.equal(ranked.length, 2)
    // Larger file should come first for tiebreaker
    assert.equal(ranked[0].release.size, 5000)
  })

  test('returns empty array when no releases are allowed', ({ assert }) => {
    const badReleases = [
      { title: 'Movie.DVDRip', size: 700 },
      { title: 'SomeGarbage', size: 100 },
    ]
    const ranked = scoreAndRankReleases(badReleases, 'movies', movieProfileItems, movieCutoff)
    assert.isEmpty(ranked)
  })
})

test.group('quality_scorer | isUpgrade', () => {
  test('returns false when upgrades not allowed', ({ assert }) => {
    const result = isUpgrade(
      'HDTV 720p',
      'Movie.2024.1080p.BluRay',
      'movies',
      movieProfileItems,
      movieCutoff,
      false
    )
    assert.isFalse(result)
  })

  test('returns true when no current quality and new is allowed', ({ assert }) => {
    const result = isUpgrade(
      null,
      'Movie.2024.1080p.BluRay',
      'movies',
      movieProfileItems,
      movieCutoff,
      true
    )
    assert.isTrue(result)
  })

  test('returns true when new quality is better than current', ({ assert }) => {
    const result = isUpgrade(
      'Web 1080p',
      'Movie.2024.1080p.BluRay',
      'movies',
      movieProfileItems,
      movieCutoff,
      true
    )
    assert.isTrue(result)
  })

  test('returns false when current already meets cutoff', ({ assert }) => {
    // Current is Bluray 1080p which equals cutoff, no upgrade needed
    const result = isUpgrade(
      'Bluray 1080p',
      'Movie.2024.2160p.BluRay',
      'movies',
      movieProfileItems,
      movieCutoff,
      true
    )
    assert.isFalse(result)
  })

  test('returns false when new quality is not allowed', ({ assert }) => {
    const result = isUpgrade(
      'HDTV 720p',
      'Movie.2024.DVDRip',
      'movies',
      movieProfileItems,
      movieCutoff,
      true
    )
    assert.isFalse(result)
  })

  test('returns true when current quality is unknown', ({ assert }) => {
    const result = isUpgrade(
      'Unknown Format',
      'Movie.2024.1080p.BluRay',
      'movies',
      movieProfileItems,
      movieCutoff,
      true
    )
    assert.isTrue(result)
  })

  test('returns false when new quality is worse', ({ assert }) => {
    const result = isUpgrade(
      'Web 1080p',
      'Movie.2024.720p.HDTV',
      'movies',
      movieProfileItems,
      movieCutoff,
      true
    )
    assert.isFalse(result)
  })
})

test.group('quality_scorer | isCutoffUnmet', () => {
  test('returns true when no current quality', ({ assert }) => {
    assert.isTrue(isCutoffUnmet(null, 'movies', movieProfileItems, movieCutoff))
  })

  test('returns true when current quality is below cutoff', ({ assert }) => {
    assert.isTrue(isCutoffUnmet('HDTV 720p', 'movies', movieProfileItems, movieCutoff))
  })

  test('returns false when current quality meets cutoff', ({ assert }) => {
    assert.isFalse(isCutoffUnmet('Bluray 1080p', 'movies', movieProfileItems, movieCutoff))
  })

  test('returns false when current quality exceeds cutoff', ({ assert }) => {
    assert.isFalse(isCutoffUnmet('Bluray 2160p', 'movies', movieProfileItems, movieCutoff))
  })

  test('returns true when current quality name is unrecognized', ({ assert }) => {
    assert.isTrue(isCutoffUnmet('UnknownFormat', 'movies', movieProfileItems, movieCutoff))
  })

  test('Web 1080p is below Bluray 1080p cutoff', ({ assert }) => {
    assert.isTrue(isCutoffUnmet('Web 1080p', 'movies', movieProfileItems, movieCutoff))
  })
})
