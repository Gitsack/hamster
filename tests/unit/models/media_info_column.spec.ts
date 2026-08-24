import { test } from '@japa/runner'
import MovieFile from '#models/movie_file'
import EpisodeFile from '#models/episode_file'

/**
 * media_info is a `json` column, so the pg driver returns it already parsed.
 * The consume hook used to call JSON.parse on that object, which stringifies
 * it to "[object Object]" and throws. Because consume runs while hydrating
 * every row, a single file with media info made every query touching the table
 * fail — a full movie library rendered as empty.
 */
test.group('media_info column | consume', () => {
  // The row argument is unused by these hooks; a bare cast keeps the test on
  // the real decorator rather than a copy of its logic.
  const row = {} as never
  const consumers = [
    { name: 'MovieFile', consume: MovieFile.$getColumn('mediaInfo')!.consume! },
    { name: 'EpisodeFile', consume: EpisodeFile.$getColumn('mediaInfo')!.consume! },
  ]

  for (const { name, consume } of consumers) {
    test(`${name} accepts an already-parsed object`, ({ assert }) => {
      const parsed = { codec: 'hevc', audioCodec: 'aac', audioChannels: 2 }
      assert.deepEqual(consume(parsed, 'mediaInfo', row), parsed)
    })

    test(`${name} still parses a JSON string`, ({ assert }) => {
      assert.deepEqual(consume('{"codec":"hevc"}', 'mediaInfo', row), { codec: 'hevc' })
    })

    test(`${name} treats null and empty as no media info`, ({ assert }) => {
      assert.isNull(consume(null, 'mediaInfo', row))
      assert.isNull(consume('', 'mediaInfo', row))
    })

    test(`${name} survives an unparseable value instead of failing the query`, ({ assert }) => {
      assert.isNull(consume('not json', 'mediaInfo', row))
    })
  }
})
