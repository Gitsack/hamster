import { test } from '@japa/runner'
import { NamingTemplateService } from '../../../app/services/media/naming_template_service.js'

const service = new NamingTemplateService()

test.group('NamingTemplateService | parseTemplate', () => {
  test('replaces single variable', ({ assert }) => {
    const result = service.parseTemplate('{artist_name}', { artist_name: 'Michael Jackson' })
    assert.equal(result, 'Michael Jackson')
  })

  test('replaces multiple variables', ({ assert }) => {
    const result = service.parseTemplate('{track_number} - {track_title}', {
      track_number: '01',
      track_title: 'Beat It',
    })
    assert.equal(result, '01 - Beat It')
  })

  test('replaces variable with number value', ({ assert }) => {
    const result = service.parseTemplate('Season {season_number}', { season_number: 1 })
    assert.equal(result, 'Season 1')
  })

  test('removes empty parentheses when value is missing', ({ assert }) => {
    const result = service.parseTemplate('{movie_title} ({year})', {
      movie_title: 'No Year Movie',
      year: '',
    })
    assert.equal(result, 'No Year Movie')
  })

  test('removes empty brackets when value is missing', ({ assert }) => {
    const result = service.parseTemplate('[{year}] {album_title}', {
      year: '',
      album_title: 'Album Name',
    })
    assert.equal(result, 'Album Name')
  })

  test('handles undefined variable value', ({ assert }) => {
    const result = service.parseTemplate('{movie_title} ({year})', {
      movie_title: 'The Movie',
      year: undefined,
    })
    assert.equal(result, 'The Movie')
  })

  test('collapses multiple spaces', ({ assert }) => {
    const result = service.parseTemplate('{a}  {b}  {c}', {
      a: 'one',
      b: '',
      c: 'three',
    })
    assert.equal(result, 'one three')
  })

  test('trims leading and trailing whitespace', ({ assert }) => {
    const result = service.parseTemplate(' {name} ', { name: 'Test' })
    assert.equal(result, 'Test')
  })

  test('handles pattern with no variables', ({ assert }) => {
    const result = service.parseTemplate('Static Text', {})
    assert.equal(result, 'Static Text')
  })

  test('handles completely empty result', ({ assert }) => {
    const result = service.parseTemplate('{a}', { a: '' })
    assert.equal(result, '')
  })

  test('replaces all occurrences of same variable', ({ assert }) => {
    const result = service.parseTemplate('{name} and {name}', { name: 'Bob' })
    assert.equal(result, 'Bob and Bob')
  })
})

test.group('NamingTemplateService | validatePattern', () => {
  test('validates correct music albumFolder pattern', ({ assert }) => {
    const result = service.validatePattern('music', 'albumFolder', '[{year}] {album_title}')
    assert.isTrue(result.valid)
    assert.isEmpty(result.invalidVars)
  })

  test('detects invalid variable in pattern', ({ assert }) => {
    const result = service.validatePattern('music', 'albumFolder', '{invalid_var}')
    assert.isFalse(result.valid)
    assert.include(result.invalidVars, 'invalid_var')
  })

  test('validates pattern with no variables', ({ assert }) => {
    const result = service.validatePattern('music', 'albumFolder', 'Static Name')
    assert.isTrue(result.valid)
  })
})

test.group('NamingTemplateService | generateExample', () => {
  test('generates example for music albumFolder', ({ assert }) => {
    const result = service.generateExample('music', 'albumFolder', '[{year}] {album_title}')
    assert.equal(result, '[1982] Thriller')
  })

  test('generates example for movies movieFolder', ({ assert }) => {
    const result = service.generateExample('movies', 'movieFolder', '{movie_title} ({year})')
    assert.equal(result, 'The Matrix (1999)')
  })

  test('generates example for tv episodeFile', ({ assert }) => {
    const result = service.generateExample(
      'tv',
      'episodeFile',
      '{show_title} - S{season_number}E{episode_number} - {episode_title}'
    )
    assert.equal(result, 'Breaking Bad - S01E01 - Pilot')
  })
})
