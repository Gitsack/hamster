import { test } from '@japa/runner'
import { applyPathMap, mapPath } from '#utils/host_mapping'

/**
 * mapPath() reads SERVICE_PATH_MAP from the environment and caches it for the
 * life of the process, so a test that asserts on its substitutions passes or
 * fails depending on the .env of whoever runs it. The substitution logic is
 * therefore tested through applyPathMap(), which takes its rules as an
 * argument; mapPath() is only checked for the cases that hold under any
 * configuration.
 */
test.group('host_mapping | applyPathMap', () => {
  const docker = [{ from: '/downloads', to: '/mnt/nas/download' }]

  test('rewrites a matching prefix', ({ assert }) => {
    assert.equal(applyPathMap('/downloads/complete', docker), '/mnt/nas/download/complete')
  })

  test('rewrites a path equal to the prefix', ({ assert }) => {
    assert.equal(applyPathMap('/downloads', docker), '/mnt/nas/download')
  })

  test('leaves a non-matching path alone', ({ assert }) => {
    assert.equal(
      applyPathMap('/mnt/nas/movies/Inception (2010).mkv', docker),
      '/mnt/nas/movies/Inception (2010).mkv'
    )
  })

  test('only matches on a segment boundary', ({ assert }) => {
    // "/downloadsX" shares a prefix with "/downloads" but is a different directory
    assert.equal(applyPathMap('/downloadsX/complete', docker), '/downloadsX/complete')
    assert.equal(applyPathMap('/downloads-old', docker), '/downloads-old')
  })

  test('the longest matching prefix wins regardless of rule order', ({ assert }) => {
    const rules = [
      { from: '/d', to: '/short' },
      { from: '/downloads', to: '/long' },
    ]
    assert.equal(applyPathMap('/downloads/complete', rules), '/long/complete')
  })

  test('applies the first match only, never chaining rules', ({ assert }) => {
    const rules = [
      { from: '/a', to: '/b' },
      { from: '/b', to: '/c' },
    ]
    assert.equal(applyPathMap('/a/file.mkv', rules), '/b/file.mkv')
  })

  test('is the identity with no rules', ({ assert }) => {
    assert.equal(applyPathMap('/downloads/complete', []), '/downloads/complete')
    assert.equal(applyPathMap('relative/path', []), 'relative/path')
  })

  test('handles null, undefined and empty safely', ({ assert }) => {
    assert.equal(applyPathMap(null, docker), '')
    assert.equal(applyPathMap(undefined, docker), '')
    assert.equal(applyPathMap('', docker), '')
  })
})

test.group('host_mapping | mapPath', () => {
  test('handles null and undefined safely', ({ assert }) => {
    assert.equal(mapPath(null), '')
    assert.equal(mapPath(undefined), '')
    assert.equal(mapPath(''), '')
  })

  test('returns a path no rule could match unchanged', ({ assert }) => {
    // Deliberately implausible as a mapping source, so this holds whatever
    // SERVICE_PATH_MAP is set to on the machine running the suite.
    assert.equal(mapPath('/hamster-test-unmapped/a/b/c'), '/hamster-test-unmapped/a/b/c')
    assert.equal(mapPath('relative/path'), 'relative/path')
  })
})
