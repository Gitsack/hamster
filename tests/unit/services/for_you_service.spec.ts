import { test } from '@japa/runner'
import {
  cleanSubjects,
  freshness,
  isClassicDate,
  weightedRating,
  isWorthSuggestingBook,
  drawDeck,
} from '#services/recommendations/for_you_service'

test.group('for_you_service book filter', () => {
  const owned = ['The Subtle Art of Not Giving a F*ck', 'Everything Is F*cked']

  test('suggests a genuinely different book by the same author', ({ assert }) => {
    assert.isTrue(isWorthSuggestingBook('Models', owned))
    assert.isTrue(isWorthSuggestingBook('Love Is Not Enough', owned))
  })

  test('skips other editions of books already owned', ({ assert }) => {
    assert.isFalse(isWorthSuggestingBook('The Subtle Art Of Not Giving A F*ck', owned))
    assert.isFalse(isWorthSuggestingBook('Everything Is F*cked (Hardcover)', owned))
  })

  test('skips retailer bundles and multi-work volumes', ({ assert }) => {
    assert.isFalse(
      isWorthSuggestingBook('Everything Is Fcked, Unfck Yourself 3 Books Collection Set', owned)
    )
    assert.isFalse(isWorthSuggestingBook('Box Set: The Complete Works', owned))
    assert.isFalse(isWorthSuggestingBook('Models / Everything is fcked', owned))
  })

  test('skips translations when the author is owned in another language', ({ assert }) => {
    assert.isFalse(isWorthSuggestingBook('Тонкое искусство пофигизма', owned))
    assert.isFalse(isWorthSuggestingBook('Todo está jodido', owned))
    assert.isFalse(isWorthSuggestingBook("Le charme discret de l'intestin", ['Gut']))
  })

  test('keeps foreign-language titles when that is what the user reads', ({ assert }) => {
    assert.isTrue(isWorthSuggestingBook('Der Prozess', ['Die Verwandlung']))
  })
})

test.group('for_you_service freshness', () => {
  const now = new Date('2026-09-27T12:00:00Z').getTime()

  test('boosts recent releases, most when newest, and tags them new early on', ({ assert }) => {
    const lastWeek = freshness('2026-09-20', 'movie', now)
    const tenMonths = freshness('2025-11-27', 'movie', now)
    assert.isTrue(lastWeek.isNew)
    assert.isFalse(tenMonths.isNew)
    assert.isAbove(lastWeek.boost, tenMonths.boost)
    assert.isAbove(tenMonths.boost, 0)
  })

  test('gives nothing to old, unreleased or undated titles', ({ assert }) => {
    assert.deepEqual(freshness('2019-05-01', 'movie', now), { boost: 0, isNew: false })
    assert.deepEqual(freshness('2027-01-01', 'movie', now), { boost: 0, isNew: false })
    assert.deepEqual(freshness(null, 'book', now), { boost: 0, isNew: false })
  })

  test('albums count as new for longer than films', ({ assert }) => {
    assert.equal(freshness('2025-06-01', 'movie', now).boost, 0)
    assert.isAbove(freshness('2025-06-01', 'album', now).boost, 0)
  })
})

test.group('for_you_service subjects', () => {
  test('keeps short readable subjects and drops machine tags and noise', ({ assert }) => {
    assert.deepEqual(
      cleanSubjects([
        'nyt:combined-print-and-e-book-fiction=2020-10-18',
        'New York Times bestseller',
        'Fiction',
        'fiction',
        'Science fiction',
        'Popular works',
        'Fiction, science fiction, general and other very long subject lines',
      ]),
      ['Fiction', 'Science fiction']
    )
    assert.deepEqual(cleanSubjects(null), [])
  })
})

test.group('for_you_service modes', () => {
  test('a high average on few votes does not beat a solid one on many', ({ assert }) => {
    const fewVotes = weightedRating(9.0, 12, 1500)
    const manyVotes = weightedRating(8.6, 20000, 1500)
    assert.isBelow(fewVotes, 7)
    assert.isAbove(manyVotes, 8.4)
    assert.isAbove(manyVotes, fewVotes)
    assert.equal(weightedRating(9, 0, 1500), 6.8)
  })

  test('classics are old enough for their kind', ({ assert }) => {
    const now = new Date('2026-09-27').getTime()
    assert.isTrue(isClassicDate('1994-09-23', 'movie', now))
    assert.isFalse(isClassicDate('2012-01-01', 'movie', now))
    assert.isTrue(isClassicDate('2005-03-24', 'tv', now))
    assert.isFalse(isClassicDate('2010-01-01', 'book', now))
    assert.isFalse(isClassicDate(null, 'album', now))
  })
})

test.group('for_you_service drawDeck', () => {
  /** A small seeded generator, so the draws are the same every run. */
  const seeded = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const cards = (n: number, score: (i: number) => number, untried = (_i: number) => false) =>
    Array.from({ length: n }, (_, i) => ({ id: i, score: score(i), untried: untried(i) }))

  test('higher scores are drawn more often, but not only them', ({ assert }) => {
    const pool = cards(100, (i) => (i < 20 ? 2 : 0))
    const random = seeded(1)
    let favourites = 0
    let others = 0
    for (let run = 0; run < 50; run++) {
      for (const c of drawDeck(pool, 20, { random })) c.id < 20 ? favourites++ : others++
    }
    assert.isAbove(favourites, others)
    assert.isAbove(others, 0)
  })

  test('keeps a share of the deck for untried genres', ({ assert }) => {
    const pool = cards(
      100,
      (i) => (i < 50 ? 3 : 0),
      (i) => i >= 50
    )
    const deck = drawDeck(pool, 20, {
      random: seeded(2),
      exploreShare: 0.15,
      isUntried: (c) => c.untried,
    })
    assert.lengthOf(deck, 20)
    assert.isAtLeast(deck.filter((c) => c.untried).length, 3)
    assert.lengthOf(new Set(deck.map((c) => c.id)), 20)
  })

  test('draws everything when there are fewer cards than slots', ({ assert }) => {
    const deck = drawDeck(
      cards(5, (i) => i),
      20,
      { random: seeded(3) }
    )
    assert.lengthOf(deck, 5)
  })
})
