import { test } from '@japa/runner'
import {
  describeLanguages,
  languageName,
  normalizeLanguageTag,
  parseLanguages,
} from '../../../app/services/quality/language_parser.js'
import { parseQuality } from '../../../app/services/quality/quality_parser.js'

test.group('language_parser | release titles', () => {
  test('reads the language the scene actually writes', ({ assert }) => {
    assert.deepEqual(parseLanguages('Movie.2024.German.1080p.BluRay.x264-GRP').audio, ['de'])
    assert.deepEqual(parseLanguages('Movie.2024.1080p.WEB-DL.ITA.ENG.x265').audio, ['en', 'it'])
    assert.deepEqual(parseLanguages('Movie.2024.TRUEFRENCH.1080p.BluRay').audio, ['fr'])
  })

  test('does not read a language out of the film title', ({ assert }) => {
    // The three that break every naive matcher.
    assert.isEmpty(parseLanguages('The.Italian.Job.2003.1080p.BluRay.x264-GRP').audio)
    assert.isEmpty(parseLanguages('The.French.Connection.1971.2160p.UHD.BluRay').audio)
    assert.isEmpty(parseLanguages('Dan.In.Real.Life.2007.1080p.WEB-DL').audio)
  })

  test('keeps the token the German scene puts before the year', ({ assert }) => {
    const parsed = parseLanguages('Der.Untergang.German.2004.1080p.BluRay.x264-GRP')
    assert.deepEqual(parsed.audio, ['de'])
  })

  test('treats GERMAN.DL as German plus an unnamed original', ({ assert }) => {
    const parsed = parseLanguages('Movie.2024.German.DL.1080p.BluRay.x264-GRP')
    assert.deepEqual(parsed.audio, ['de'])
    assert.isTrue(parsed.isMulti)
  })

  test('flags MULTi and DUAL as several unnamed tracks', ({ assert }) => {
    assert.isTrue(parseLanguages('Movie.2024.MULTi.1080p.BluRay.x264').isMulti)
    assert.isTrue(parseLanguages('Show.S01E01.Dual.Audio.1080p.WEB-DL').isMulti)
  })

  test('does not mistake subtitles for audio', ({ assert }) => {
    // VOSTFR is the original audio with French subtitles — the exact opposite
    // of a French release.
    const vostfr = parseLanguages('Movie.2024.VOSTFR.1080p.WEB-DL.x264')
    assert.isEmpty(vostfr.audio)
    assert.deepEqual(vostfr.subtitles, ['fr'])

    const engsub = parseLanguages('Movie.2024.KOREAN.ENGSUB.1080p.WEB-DL')
    assert.deepEqual(engsub.audio, ['ko'])
    assert.deepEqual(engsub.subtitles, ['en'])
  })

  test('says nothing when the title says nothing', ({ assert }) => {
    const parsed = parseLanguages('Movie.2024.1080p.BluRay.x264-GRP')
    assert.isEmpty(parsed.audio)
    assert.isFalse(parsed.isMulti)
  })

  test('survives underscore-separated titles', ({ assert }) => {
    assert.deepEqual(parseLanguages('Movie_2024_GERMAN_1080p_BluRay_x264').audio, ['de'])
  })

  test('rides along with parseQuality for every media type', ({ assert }) => {
    const movie = parseQuality('Movie.2024.German.1080p.BluRay.x264-GRP', 'movies')
    assert.deepEqual(movie.languages.audio, ['de'])

    const book = parseQuality('Author - Title (2024) [EPUB] [GERMAN]', 'books')
    assert.deepEqual(book.languages.audio, ['de'])
  })
})

test.group('language_parser | ffprobe tags', () => {
  test('accepts every spelling a muxer might have written', ({ assert }) => {
    assert.equal(normalizeLanguageTag('ger'), 'de')
    assert.equal(normalizeLanguageTag('deu'), 'de')
    assert.equal(normalizeLanguageTag('de'), 'de')
    assert.equal(normalizeLanguageTag('de-DE'), 'de')
    assert.equal(normalizeLanguageTag('ENG'), 'en')
  })

  test('reads the untagged placeholders as unknown, not as a language', ({ assert }) => {
    assert.isNull(normalizeLanguageTag('und'))
    assert.isNull(normalizeLanguageTag(''))
    assert.isNull(normalizeLanguageTag(null))
    assert.isNull(normalizeLanguageTag('qqq'))
  })
})

test.group('language_parser | naming', () => {
  test('spells a list out the way a sentence would', ({ assert }) => {
    assert.equal(describeLanguages(['de']), 'German')
    assert.equal(describeLanguages(['de', 'en']), 'German and English')
    assert.equal(describeLanguages(['de', 'en', 'fr']), 'German, English and French')
    assert.equal(describeLanguages([]), 'none')
  })

  test('falls back to the code for anything it does not know', ({ assert }) => {
    assert.equal(languageName('xx'), 'XX')
  })
})
