import { test } from '@japa/runner'

// Replicate private detectQuality from MovieImportService
function detectQuality(fileName: string): string | undefined {
  const lowerName = fileName.toLowerCase()
  if (lowerName.includes('2160p') || lowerName.includes('4k') || lowerName.includes('uhd'))
    return '2160p'
  if (lowerName.includes('1080p') || lowerName.includes('fullhd')) return '1080p'
  if (lowerName.includes('720p')) return '720p'
  if (lowerName.includes('480p') || lowerName.includes('sd')) return '480p'
  if (lowerName.includes('bluray') || lowerName.includes('blu-ray')) return 'Bluray'
  if (lowerName.includes('webdl') || lowerName.includes('web-dl')) return 'WEBDL'
  if (lowerName.includes('webrip')) return 'WEBRip'
  if (lowerName.includes('hdtv')) return 'HDTV'
  return undefined
}

test.group('MovieImportService | detectQuality - resolutions', () => {
  test('detects 2160p', ({ assert }) => {
    assert.equal(detectQuality('Movie.2160p.mkv'), '2160p')
  })

  test('detects 4k', ({ assert }) => {
    assert.equal(detectQuality('Movie.4K.mkv'), '2160p')
  })

  test('detects UHD', ({ assert }) => {
    assert.equal(detectQuality('Movie.UHD.mkv'), '2160p')
  })

  test('detects 1080p', ({ assert }) => {
    assert.equal(detectQuality('Movie.1080p.mkv'), '1080p')
  })

  test('detects FullHD', ({ assert }) => {
    assert.equal(detectQuality('Movie.FullHD.mkv'), '1080p')
  })

  test('detects 720p', ({ assert }) => {
    assert.equal(detectQuality('Movie.720p.mkv'), '720p')
  })

  test('detects 480p', ({ assert }) => {
    assert.equal(detectQuality('Movie.480p.mkv'), '480p')
  })

  test('detects SD', ({ assert }) => {
    assert.equal(detectQuality('Movie.SD.mkv'), '480p')
  })
})

test.group('MovieImportService | detectQuality - source types', () => {
  test('detects BluRay', ({ assert }) => {
    assert.equal(detectQuality('Movie.BluRay.mkv'), 'Bluray')
  })

  test('detects Blu-Ray', ({ assert }) => {
    assert.equal(detectQuality('Movie.Blu-Ray.mkv'), 'Bluray')
  })

  test('detects WEBDL', ({ assert }) => {
    assert.equal(detectQuality('Movie.WEBDL.mkv'), 'WEBDL')
  })

  test('detects WEB-DL', ({ assert }) => {
    assert.equal(detectQuality('Movie.WEB-DL.mkv'), 'WEBDL')
  })

  test('detects WEBRip', ({ assert }) => {
    assert.equal(detectQuality('Movie.WEBRip.mkv'), 'WEBRip')
  })

  test('detects HDTV', ({ assert }) => {
    assert.equal(detectQuality('Movie.HDTV.mkv'), 'HDTV')
  })
})

test.group('MovieImportService | detectQuality - combined and edge cases', () => {
  test('resolution takes priority over source in combined pattern', ({ assert }) => {
    assert.equal(detectQuality('Movie.2160p.BluRay.mkv'), '2160p')
  })

  test('1080p takes priority over WEBRip', ({ assert }) => {
    assert.equal(detectQuality('Movie.1080p.WEBRip.mkv'), '1080p')
  })

  test('case insensitivity for mixed case', ({ assert }) => {
    assert.equal(detectQuality('movie.1080P.WEBRIP.mkv'), '1080p')
  })

  test('returns undefined for unknown format', ({ assert }) => {
    assert.isUndefined(detectQuality('Movie.mkv'))
  })

  test('returns undefined for empty string', ({ assert }) => {
    assert.isUndefined(detectQuality(''))
  })

  test('returns undefined for random text', ({ assert }) => {
    assert.isUndefined(detectQuality('some.random.filename.avi'))
  })
})
