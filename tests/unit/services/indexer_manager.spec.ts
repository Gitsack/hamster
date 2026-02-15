import { test } from '@japa/runner'
import { IndexerManager } from '../../../app/services/indexers/indexer_manager.js'
import type { UnifiedSearchResult } from '../../../app/services/indexers/indexer_manager.js'

// We test the private methods indirectly through the public interface,
// but we can also access private methods by casting to `any` for unit testing
// the pure logic functions (detectQuality, detectVideoQuality, mapNewznabResults, mapProwlarrResults).

function detectQuality(title: string): string | undefined {
  // Access private method via prototype
  const manager = new IndexerManager()
  return (manager as any).detectQuality(title)
}

function detectVideoQuality(title: string): string | undefined {
  const manager = new IndexerManager()
  return (manager as any).detectVideoQuality(title)
}

function mapNewznabResults(results: any[]): UnifiedSearchResult[] {
  const manager = new IndexerManager()
  return (manager as any).mapNewznabResults(results)
}

function mapProwlarrResults(results: any[]): UnifiedSearchResult[] {
  const manager = new IndexerManager()
  return (manager as any).mapProwlarrResults(results)
}

test.group('IndexerManager | detectQuality', () => {
  test('detects FLAC', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album [FLAC]'), 'FLAC')
  })

  test('detects lossless as FLAC', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album (Lossless)'), 'FLAC')
  })

  test('detects FLAC 24bit with 24bit tag', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album FLAC 24bit'), 'FLAC 24bit')
  })

  test('detects FLAC 24bit with 24-bit tag', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album FLAC 24-bit'), 'FLAC 24bit')
  })

  test('detects FLAC 24bit with hi-res tag', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album [FLAC] Hi-Res'), 'FLAC 24bit')
  })

  test('detects ALAC', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album [ALAC]'), 'ALAC')
  })

  test('detects WAV', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album WAV'), 'WAV')
  })

  test('detects MP3 320', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album [320]'), 'MP3 320')
  })

  test('detects MP3 V0', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album V0'), 'MP3 V0')
  })

  test('detects MP3 256', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album 256kbps'), 'MP3 256')
  })

  test('detects MP3 192', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album 192kbps'), 'MP3 192')
  })

  test('detects AAC', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album AAC'), 'AAC')
  })

  test('detects OGG Vorbis', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album OGG'), 'OGG Vorbis')
  })

  test('detects generic MP3', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album MP3'), 'MP3')
  })

  test('returns undefined for unknown quality', ({ assert }) => {
    assert.isUndefined(detectQuality('Artist - Album'))
  })

  test('is case insensitive', ({ assert }) => {
    assert.equal(detectQuality('Artist - Album [flac]'), 'FLAC')
    assert.equal(detectQuality('Artist - Album [FLAC]'), 'FLAC')
  })

  test('FLAC takes precedence over MP3 mentions in title', ({ assert }) => {
    // FLAC check comes first in the function
    assert.equal(detectQuality('Artist - Album FLAC (was mp3)'), 'FLAC')
  })
})

test.group('IndexerManager | detectVideoQuality', () => {
  test('detects 2160p', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.2160p.BluRay'), '2160p')
  })

  test('detects 4K', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.4K.HDR'), '2160p')
  })

  test('detects UHD', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.UHD.BluRay'), '2160p')
  })

  test('detects 1080p', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.1080p.WEB-DL'), '1080p')
  })

  test('detects 720p', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.720p.HDTV'), '720p')
  })

  test('detects 480p', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.480p'), '480p')
  })

  test('detects SD', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.SD'), '480p')
  })

  test('detects BluRay', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.BluRay'), 'BluRay')
  })

  test('detects Blu-ray with hyphen', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.Blu-Ray'), 'BluRay')
  })

  test('detects Remux', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.Remux'), 'Remux')
  })

  test('detects WEB-DL', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.WEB-DL'), 'WEB-DL')
  })

  test('detects WEBDL without hyphen', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.WEBDL'), 'WEB-DL')
  })

  test('detects WEBRip', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.WEBRip'), 'WEBRip')
  })

  test('detects HDTV', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.HDTV'), 'HDTV')
  })

  test('returns undefined for unknown video quality', ({ assert }) => {
    assert.isUndefined(detectVideoQuality('Some Random Title'))
  })

  test('resolution takes precedence over source (2160p over BluRay)', ({ assert }) => {
    // 2160p is checked before BluRay
    assert.equal(detectVideoQuality('Movie.2024.2160p.BluRay'), '2160p')
  })

  test('1080p takes precedence over WEB-DL', ({ assert }) => {
    assert.equal(detectVideoQuality('Movie.2024.1080p.WEB-DL'), '1080p')
  })
})

test.group('IndexerManager | mapNewznabResults', () => {
  test('maps newznab result fields correctly', ({ assert }) => {
    const results = mapNewznabResults([
      {
        guid: 'abc-123',
        title: 'Artist - Album [FLAC]',
        indexer: 'NZBgeek',
        indexerId: 'idx-1',
        size: 500_000_000,
        pubDate: '2024-01-15T12:00:00Z',
        downloadUrl: 'https://example.com/download/abc',
        infoUrl: 'https://example.com/details/abc',
        grabs: 42,
        seeders: undefined,
        peers: undefined,
        artist: 'Some Artist',
        album: 'Some Album',
        year: 2024,
      },
    ])

    assert.equal(results.length, 1)
    const r = results[0]
    assert.equal(r.id, 'abc-123')
    assert.equal(r.title, 'Artist - Album [FLAC]')
    assert.equal(r.indexer, 'NZBgeek')
    assert.equal(r.indexerId, 'idx-1')
    assert.equal(r.size, 500_000_000)
    assert.equal(r.publishDate, '2024-01-15T12:00:00Z')
    assert.equal(r.downloadUrl, 'https://example.com/download/abc')
    assert.equal(r.infoUrl, 'https://example.com/details/abc')
    assert.equal(r.grabs, 42)
    assert.equal(r.protocol, 'usenet')
    assert.equal(r.source, 'direct')
    assert.equal(r.artist, 'Some Artist')
    assert.equal(r.album, 'Some Album')
    assert.equal(r.year, 2024)
    assert.equal(r.quality, 'FLAC')
  })

  test('maps multiple results', ({ assert }) => {
    const results = mapNewznabResults([
      {
        guid: '1',
        title: 'Album MP3',
        indexer: 'Idx',
        indexerId: 'i1',
        size: 100,
        pubDate: '2024-01-01',
        downloadUrl: 'http://dl/1',
      },
      {
        guid: '2',
        title: 'Album FLAC',
        indexer: 'Idx',
        indexerId: 'i1',
        size: 500,
        pubDate: '2024-01-02',
        downloadUrl: 'http://dl/2',
      },
    ])

    assert.equal(results.length, 2)
    assert.equal(results[0].quality, 'MP3')
    assert.equal(results[1].quality, 'FLAC')
  })

  test('handles empty results', ({ assert }) => {
    const results = mapNewznabResults([])
    assert.deepEqual(results, [])
  })
})

test.group('IndexerManager | mapProwlarrResults', () => {
  test('maps prowlarr result fields correctly', ({ assert }) => {
    const results = mapProwlarrResults([
      {
        guid: 'prowl-123',
        title: 'Artist - Album [320]',
        indexer: 'Prowlarr Indexer',
        indexerId: 42,
        size: 200_000_000,
        publishDate: '2024-02-20T08:00:00Z',
        downloadUrl: 'https://prowlarr.local/dl/123',
        infoUrl: 'https://prowlarr.local/info/123',
        grabs: 10,
        seeders: 5,
        leechers: 2,
        protocol: 'torrent' as const,
        artist: 'Artist Name',
        album: 'Album Name',
        year: 2023,
      },
    ])

    assert.equal(results.length, 1)
    const r = results[0]
    assert.equal(r.id, 'prowl-123')
    assert.equal(r.title, 'Artist - Album [320]')
    assert.equal(r.indexer, 'Prowlarr Indexer')
    assert.equal(r.indexerId, '42') // Converted to string
    assert.equal(r.size, 200_000_000)
    assert.equal(r.publishDate, '2024-02-20T08:00:00Z')
    assert.equal(r.downloadUrl, 'https://prowlarr.local/dl/123')
    assert.equal(r.protocol, 'torrent')
    assert.equal(r.source, 'prowlarr')
    assert.equal(r.peers, 2) // leechers mapped to peers
    assert.equal(r.seeders, 5)
    assert.equal(r.quality, 'MP3 320')
  })

  test('converts numeric indexerId to string', ({ assert }) => {
    const results = mapProwlarrResults([
      {
        guid: 'g1',
        title: 'Test',
        indexer: 'Idx',
        indexerId: 99,
        size: 100,
        publishDate: '2024-01-01',
        downloadUrl: 'http://dl',
        protocol: 'usenet' as const,
      },
    ])
    assert.equal(results[0].indexerId, '99')
  })

  test('handles empty results', ({ assert }) => {
    const results = mapProwlarrResults([])
    assert.deepEqual(results, [])
  })
})
