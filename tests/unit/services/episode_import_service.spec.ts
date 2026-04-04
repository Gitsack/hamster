import { test } from '@japa/runner'

// Replicate private detectQuality from EpisodeImportService
function detectQuality(fileName: string): string | undefined {
  const lowerName = fileName.toLowerCase()
  if (lowerName.includes('2160p') || lowerName.includes('4k') || lowerName.includes('uhd'))
    return '2160p'
  if (lowerName.includes('1080p') || lowerName.includes('fullhd')) return '1080p'
  if (lowerName.includes('720p')) return '720p'
  if (lowerName.includes('480p') || lowerName.includes('sd')) return '480p'
  if (lowerName.includes('webdl') || lowerName.includes('web-dl')) return 'WEBDL'
  if (lowerName.includes('webrip')) return 'WEBRip'
  if (lowerName.includes('hdtv')) return 'HDTV'
  return undefined
}

test.group('EpisodeImportService | detectQuality - resolutions', () => {
  test('detects 2160p', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.2160p.mkv'), '2160p')
  })

  test('detects 4k', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.4K.mkv'), '2160p')
  })

  test('detects UHD', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.UHD.mkv'), '2160p')
  })

  test('detects 1080p', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.1080p.mkv'), '1080p')
  })

  test('detects FullHD', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.FullHD.mkv'), '1080p')
  })

  test('detects 720p', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.720p.mkv'), '720p')
  })

  test('detects 480p', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.480p.mkv'), '480p')
  })

  test('detects SD', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.SD.mkv'), '480p')
  })
})

test.group('EpisodeImportService | detectQuality - source types', () => {
  test('detects WEBDL', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.WEBDL.mkv'), 'WEBDL')
  })

  test('detects WEB-DL', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.WEB-DL.mkv'), 'WEBDL')
  })

  test('detects WEBRip', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.WEBRip.mkv'), 'WEBRip')
  })

  test('detects HDTV', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.HDTV.mkv'), 'HDTV')
  })
})

test.group('EpisodeImportService | detectQuality - combined and edge cases', () => {
  test('1080p WEBRip combined pattern', ({ assert }) => {
    assert.equal(detectQuality('Show.S01E01.1080p.WEBRip.mkv'), '1080p')
  })

  test('720p HDTV combined pattern', ({ assert }) => {
    assert.equal(detectQuality('Show.S02E05.720p.HDTV.mkv'), '720p')
  })

  test('case insensitivity', ({ assert }) => {
    assert.equal(detectQuality('SHOW.S01E01.1080P.WEBDL.MKV'), '1080p')
  })

  test('returns undefined for unknown format', ({ assert }) => {
    assert.isUndefined(detectQuality('Show.S01E01.mkv'))
  })

  test('returns undefined for empty string', ({ assert }) => {
    assert.isUndefined(detectQuality(''))
  })
})
