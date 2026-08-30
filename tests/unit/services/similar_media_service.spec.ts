import { test } from '@japa/runner'
import {
  blendSimilar,
  type SimilarCandidate,
  type SimilarSource,
} from '../../../app/services/metadata/similar_media_service.js'

function candidate(
  tmdbId: number,
  source: SimilarSource,
  overrides: Partial<SimilarCandidate> = {}
): SimilarCandidate {
  return {
    tmdbId,
    title: `Title ${tmdbId}`,
    year: 2020,
    posterUrl: `/poster-${tmdbId}.jpg`,
    rating: 7,
    votes: 1000,
    genres: ['Drama'],
    source,
    rank: 0,
    reason: `From ${source}`,
    ...overrides,
  }
}

test.group('similar_media_service | blendSimilar', () => {
  test('never suggests the title being viewed', ({ assert }) => {
    const results = blendSimilar([candidate(42, 'recommendations')], { excludeTmdbId: 42 })
    assert.lengthOf(results, 0)
  })

  test('drops candidates without a poster', ({ assert }) => {
    const results = blendSimilar([candidate(1, 'recommendations', { posterUrl: null })], {
      excludeTmdbId: 99,
    })
    assert.lengthOf(results, 0)
  })

  test('drops candidates below the vote floor', ({ assert }) => {
    const results = blendSimilar([candidate(1, 'similar', { votes: 3 })], {
      excludeTmdbId: 99,
      minVotes: 40,
    })
    assert.lengthOf(results, 0)
  })

  test('keeps franchise entries even with no votes yet', ({ assert }) => {
    const results = blendSimilar([candidate(1, 'collection', { votes: 0 })], { excludeTmdbId: 99 })
    assert.lengthOf(results, 1)
    assert.equal(results[0].tmdbId, 1)
  })

  test('ranks a title confirmed by several sources above any single list leader', ({ assert }) => {
    const results = blendSimilar(
      [
        // Top of the strongest single list.
        candidate(1, 'recommendations', { rank: 0 }),
        // Further down two weaker lists — but on both of them.
        candidate(2, 'cast', { rank: 4 }),
        candidate(2, 'keywords', { rank: 4 }),
        candidate(2, 'director', { rank: 6 }),
      ],
      { excludeTmdbId: 99 }
    )

    assert.equal(results[0].tmdbId, 2)
    assert.lengthOf(results[0].reasons, 3)
  })

  test('reports the strongest source as the headline reason', ({ assert }) => {
    const results = blendSimilar(
      [
        candidate(1, 'similar', { rank: 0, reason: 'Similar genre mix' }),
        candidate(1, 'director', { rank: 0, reason: 'Directed by Denis Villeneuve' }),
      ],
      { excludeTmdbId: 99 }
    )

    assert.equal(results[0].reason, 'Directed by Denis Villeneuve')
    assert.deepEqual(results[0].reasons, ['Directed by Denis Villeneuve', 'Similar genre mix'])
  })

  test('a franchise entry outranks a bare genre match', ({ assert }) => {
    const results = blendSimilar(
      [candidate(1, 'similar', { rank: 0 }), candidate(2, 'collection', { rank: 0 })],
      { excludeTmdbId: 99 }
    )

    assert.equal(results[0].tmdbId, 2)
  })

  test('respects list position within a source', ({ assert }) => {
    const results = blendSimilar(
      [candidate(1, 'recommendations', { rank: 0 }), candidate(2, 'recommendations', { rank: 15 })],
      { excludeTmdbId: 99 }
    )

    assert.equal(results[0].tmdbId, 1)
  })

  test('counts a source once, at its best position', ({ assert }) => {
    const twice = blendSimilar(
      [candidate(1, 'cast', { rank: 8 }), candidate(1, 'cast', { rank: 0 })],
      { excludeTmdbId: 99 }
    )
    const once = blendSimilar([candidate(1, 'cast', { rank: 0 })], { excludeTmdbId: 99 })

    assert.equal(twice[0].score, once[0].score)
    assert.lengthOf(twice[0].reasons, 1)
  })

  test('rewards genre overlap with the title being viewed', ({ assert }) => {
    const results = blendSimilar(
      [
        candidate(1, 'recommendations', { genres: ['Comedy'] }),
        candidate(2, 'recommendations', { genres: ['Sci-Fi', 'Thriller'] }),
      ],
      { excludeTmdbId: 99, sourceGenres: ['Sci-Fi', 'Thriller'] }
    )

    assert.equal(results[0].tmdbId, 2)
  })

  test('prefers the better-rated of two otherwise equal candidates', ({ assert }) => {
    const results = blendSimilar(
      [
        candidate(1, 'recommendations', { rating: 5.1 }),
        candidate(2, 'recommendations', { rating: 8.3 }),
      ],
      { excludeTmdbId: 99 }
    )

    assert.equal(results[0].tmdbId, 2)
  })

  test('honours the limit', ({ assert }) => {
    const many = Array.from({ length: 30 }, (_, i) => candidate(i + 1, 'recommendations'))
    const results = blendSimilar(many, { excludeTmdbId: 99, limit: 8 })

    assert.lengthOf(results, 8)
  })
})
