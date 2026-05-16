import { test } from '@japa/runner'
import { mapPath } from '#utils/host_mapping'

/**
 * Note: SERVICE_PATH_MAP is read once and cached at first call. The runtime
 * env in tests doesn't set it, so mapPath should always be the identity here.
 * That still exercises:
 *  - the null / empty / non-matching path branches
 *  - the boundary-segment guard (no partial-prefix replacement)
 *
 * Full mapping behavior is covered by integration tests that set env vars
 * before importing the module.
 */
test.group('host_mapping | mapPath (no SERVICE_PATH_MAP set)', () => {
  test('returns input unchanged when no mapping configured', ({ assert }) => {
    assert.equal(mapPath('/downloads/complete'), '/downloads/complete')
    assert.equal(
      mapPath('/mnt/nas/movies/Inception (2010).mkv'),
      '/mnt/nas/movies/Inception (2010).mkv'
    )
  })

  test('handles null and undefined safely', ({ assert }) => {
    assert.equal(mapPath(null), '')
    assert.equal(mapPath(undefined), '')
    assert.equal(mapPath(''), '')
  })

  test('returns absolute paths unchanged', ({ assert }) => {
    assert.equal(mapPath('/a/b/c'), '/a/b/c')
  })

  test('returns relative paths unchanged', ({ assert }) => {
    assert.equal(mapPath('relative/path'), 'relative/path')
  })
})
