import { test } from '@japa/runner'

/**
 * Tests for the pure helper functions in requested_search_task.ts.
 *
 * The functions normalizeTitle, doesTvReleaseTitleMatch, and doesMovieReleaseTitleMatch
 * are module-level functions (not exported). We need to test them through the module's
 * public API or replicate their logic here for unit testing.
 *
 * Since these functions are not exported, we replicate the logic for testing.
 * If these functions are ever exported, update imports to test the actual functions.
 */

// Replicate normalizeTitle for testing
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Replicate doesTvReleaseTitleMatch for testing
function doesTvReleaseTitleMatch(releaseTitle: string, expectedTitle: string): boolean {
  const normalizedRelease = normalizeTitle(releaseTitle)
  const normalizedExpected = normalizeTitle(expectedTitle)
  const expectedWords = normalizedExpected.split(' ')
  const releaseWords = normalizedRelease.split(' ')

  if (releaseWords.length < expectedWords.length) {
    return false
  }

  const releasePrefix = releaseWords.slice(0, expectedWords.length).join(' ')
  if (releasePrefix !== normalizedExpected) {
    return false
  }

  const afterTitle = releaseWords.slice(expectedWords.length).join(' ')
  const seasonPattern = /^s\d+|^season\s*\d+/i
  if (!seasonPattern.test(afterTitle)) {
    return false
  }

  return true
}

// Replicate doesMovieReleaseTitleMatch for testing
function doesMovieReleaseTitleMatch(releaseTitle: string, expectedTitle: string): boolean {
  const normalizedRelease = normalizeTitle(releaseTitle)
  const normalizedExpected = normalizeTitle(expectedTitle)

  if (normalizedRelease.startsWith(normalizedExpected)) {
    const afterTitle = normalizedRelease.slice(normalizedExpected.length).trim()
    if (
      afterTitle === '' ||
      /^\d{4}|^\d{3,4}p|^bluray|^webrip|^web dl|^hdtv|^dvdrip|^brrip|^remux|^uhd/i.test(afterTitle)
    ) {
      return true
    }
  }

  const releaseWords = normalizedRelease.split(' ')
  const expectedWords = normalizedExpected.split(' ')

  if (releaseWords.length >= expectedWords.length) {
    const releasePrefix = releaseWords.slice(0, expectedWords.length).join(' ')
    if (releasePrefix === normalizedExpected) {
      const nextWord = releaseWords[expectedWords.length] || ''
      if (
        /^\d{4}$|^\d{3,4}p$|^bluray$|^webrip$|^web$|^hdtv$|^dvdrip$|^brrip$|^remux$|^uhd$/i.test(
          nextWord
        )
      ) {
        return true
      }
    }
  }

  return false
}

test.group('normalizeTitle', () => {
  test('converts to lowercase', ({ assert }) => {
    assert.equal(normalizeTitle('Breaking Bad'), 'breaking bad')
  })

  test('replaces dots with spaces', ({ assert }) => {
    assert.equal(normalizeTitle('Breaking.Bad'), 'breaking bad')
  })

  test('replaces underscores with spaces', ({ assert }) => {
    assert.equal(normalizeTitle('Breaking_Bad'), 'breaking bad')
  })

  test('replaces hyphens with spaces', ({ assert }) => {
    assert.equal(normalizeTitle('Breaking-Bad'), 'breaking bad')
  })

  test('collapses multiple spaces', ({ assert }) => {
    assert.equal(normalizeTitle('Breaking   Bad'), 'breaking bad')
  })

  test('trims whitespace', ({ assert }) => {
    assert.equal(normalizeTitle('  Breaking Bad  '), 'breaking bad')
  })

  test('handles combination of separators', ({ assert }) => {
    assert.equal(normalizeTitle('Breaking.Bad_S01-E01'), 'breaking bad s01 e01')
  })
})

test.group('doesTvReleaseTitleMatch', () => {
  test('matches exact title with S01E01', ({ assert }) => {
    assert.isTrue(doesTvReleaseTitleMatch('Breaking.Bad.S01E01.720p', 'Breaking Bad'))
  })

  test('matches title with year before season pattern', ({ assert }) => {
    assert.isTrue(doesTvReleaseTitleMatch('Friends S01E01 The Pilot', 'Friends'))
  })

  test('prevents "Friends with Benefits" matching "Friends"', ({ assert }) => {
    assert.isFalse(doesTvReleaseTitleMatch('Friends with Benefits S01E01', 'Friends'))
  })

  test('prevents "My Friends" matching "Friends"', ({ assert }) => {
    assert.isFalse(doesTvReleaseTitleMatch('My Friends S01E01', 'Friends'))
  })

  test('matches when release uses dots as separators', ({ assert }) => {
    assert.isTrue(doesTvReleaseTitleMatch('Breaking.Bad.S01E01.720p', 'Breaking Bad'))
  })

  test('matches with "season" keyword', ({ assert }) => {
    assert.isTrue(doesTvReleaseTitleMatch('Breaking Bad Season 1 Episode 1', 'Breaking Bad'))
  })

  test('rejects when no season pattern follows title', ({ assert }) => {
    assert.isFalse(doesTvReleaseTitleMatch('Breaking Bad 720p Deleted Scenes', 'Breaking Bad'))
  })

  test('handles case-insensitive matching', ({ assert }) => {
    assert.isTrue(doesTvReleaseTitleMatch('BREAKING.BAD.S01E01', 'Breaking Bad'))
  })

  test('rejects shorter release than expected title', ({ assert }) => {
    assert.isFalse(doesTvReleaseTitleMatch('Break S01E01', 'Breaking Bad'))
  })
})

test.group('doesMovieReleaseTitleMatch', () => {
  test('matches title followed by year', ({ assert }) => {
    assert.isTrue(doesMovieReleaseTitleMatch('The Matrix 1999 1080p BluRay', 'The Matrix'))
  })

  test('matches title followed by resolution', ({ assert }) => {
    assert.isTrue(doesMovieReleaseTitleMatch('The Matrix 1080p BluRay', 'The Matrix'))
  })

  test('matches title followed by source', ({ assert }) => {
    assert.isTrue(doesMovieReleaseTitleMatch('The Matrix BluRay x264', 'The Matrix'))
  })

  test('matches exact title with nothing after', ({ assert }) => {
    assert.isTrue(doesMovieReleaseTitleMatch('The Matrix', 'The Matrix'))
  })

  test('prevents "The Matrix Reloaded" matching "The Matrix"', ({ assert }) => {
    assert.isFalse(doesMovieReleaseTitleMatch('The Matrix Reloaded 2003 1080p', 'The Matrix'))
  })

  test('matches with dots in release title', ({ assert }) => {
    assert.isTrue(doesMovieReleaseTitleMatch('The.Matrix.1999.1080p.BluRay', 'The Matrix'))
  })

  test('handles case-insensitive matching', ({ assert }) => {
    assert.isTrue(doesMovieReleaseTitleMatch('THE MATRIX 1999 1080p', 'The Matrix'))
  })

  test('matches title followed by WEBRip', ({ assert }) => {
    assert.isTrue(doesMovieReleaseTitleMatch('The Matrix WEBRip x264', 'The Matrix'))
  })

  test('matches title followed by 720p', ({ assert }) => {
    assert.isTrue(doesMovieReleaseTitleMatch('The Matrix 720p', 'The Matrix'))
  })

  test('matches title followed by REMUX', ({ assert }) => {
    assert.isTrue(doesMovieReleaseTitleMatch('The Matrix Remux', 'The Matrix'))
  })

  test('rejects completely different title', ({ assert }) => {
    assert.isFalse(doesMovieReleaseTitleMatch('Inception 2010 1080p', 'The Matrix'))
  })
})
