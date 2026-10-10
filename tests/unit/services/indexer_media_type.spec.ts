import { test } from '@japa/runner'
import { classifyMediaType } from '#services/indexers/indexer_manager'

test.group('classifyMediaType', () => {
  test('maps Newznab category ranges to media types', ({ assert }) => {
    assert.equal(classifyMediaType(2040), 'movie')
    assert.equal(classifyMediaType(3040), 'music')
    assert.equal(classifyMediaType(4000), 'app')
    assert.equal(classifyMediaType(4070), 'app')
    assert.equal(classifyMediaType(5040), 'tv')
    assert.equal(classifyMediaType(7020), 'book')
    assert.equal(classifyMediaType(8010), 'book')
  })

  test('falls back to other, or nothing without a category', ({ assert }) => {
    assert.equal(classifyMediaType(1000), 'other')
    assert.equal(classifyMediaType(6000), 'other')
    assert.isUndefined(classifyMediaType(undefined))
  })
})
