import { test } from '@japa/runner'
import {
  parseVideoQuality,
  parseMusicQuality,
  parseBookQuality,
  parseQuality,
  qualityNameToId,
} from '../../../app/services/quality/quality_parser.js'

test.group('quality_parser | parseVideoQuality - resolution', () => {
  test('detects 2160p resolution', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.2160p.BluRay.x265')
    assert.equal(result.resolution, '2160p')
  })

  test('detects 4k as 2160p', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.4K.WEB-DL')
    assert.equal(result.resolution, '2160p')
  })

  test('detects UHD as 2160p', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.UHD.BluRay')
    assert.equal(result.resolution, '2160p')
  })

  test('detects 1080p resolution', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p.WEB-DL')
    assert.equal(result.resolution, '1080p')
  })

  test('detects 720p resolution', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.720p.HDTV')
    assert.equal(result.resolution, '720p')
  })

  test('detects 480p resolution', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.480p.DVDRip')
    assert.equal(result.resolution, '480p')
  })

  test('detects SD as 480p', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.SD.DVDRip')
    assert.equal(result.resolution, '480p')
  })

  test('returns null for unknown resolution', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024')
    assert.isNull(result.resolution)
  })
})

test.group('quality_parser | parseVideoQuality - source', () => {
  test('detects BluRay source', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p.BluRay')
    assert.equal(result.source, 'BluRay')
  })

  test('detects Blu-Ray with hyphen', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p.Blu-Ray')
    assert.equal(result.source, 'BluRay')
  })

  test('detects BDRip as BluRay', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p.BDRip')
    assert.equal(result.source, 'BluRay')
  })

  test('detects BRRip as BluRay', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p.BRRip')
    assert.equal(result.source, 'BluRay')
  })

  test('detects REMUX as BluRay', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p.REMUX')
    assert.equal(result.source, 'BluRay')
    assert.isTrue(result.isRemux)
  })

  test('detects WEB-DL as WEB', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p.WEB-DL')
    assert.equal(result.source, 'WEB')
  })

  test('detects WEBRip as WEB', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p.WEBRip')
    assert.equal(result.source, 'WEB')
  })

  test('detects standalone WEB as WEB', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p.WEB.x264')
    assert.equal(result.source, 'WEB')
  })

  test('detects HDTV source', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.HDTV.720p')
    assert.equal(result.source, 'HDTV')
  })

  test('detects PDTV as HDTV', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.PDTV.720p')
    assert.equal(result.source, 'HDTV')
  })

  test('detects DVD source', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.DVDRip')
    assert.equal(result.source, 'DVD')
  })

  test('detects CAM source', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.CAM')
    assert.equal(result.source, 'CAM')
  })

  test('detects TeleSync as CAM', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.TS')
    assert.equal(result.source, 'CAM')
  })

  test('returns null for unknown source', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2024.1080p')
    assert.isNull(result.source)
  })
})

test.group('quality_parser | parseVideoQuality - codec', () => {
  test('detects x264', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.BluRay.x264')
    assert.equal(result.codec, 'x264')
  })

  test('detects H.264 as x264', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.H.264')
    assert.equal(result.codec, 'x264')
  })

  test('detects AVC as x264', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.AVC')
    assert.equal(result.codec, 'x264')
  })

  test('detects x265', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2160p.BluRay.x265')
    assert.equal(result.codec, 'x265')
  })

  test('detects HEVC as x265', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2160p.HEVC')
    assert.equal(result.codec, 'x265')
  })

  test('detects AV1', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.WEB.AV1')
    assert.equal(result.codec, 'AV1')
  })

  test('detects VP9', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.VP9')
    assert.equal(result.codec, 'VP9')
  })

  test('detects XviD', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.DVDRip.XviD')
    assert.equal(result.codec, 'XviD')
  })
})

test.group('quality_parser | parseVideoQuality - audio', () => {
  test('detects Atmos audio', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2160p.BluRay.Atmos')
    assert.equal(result.audio, 'Atmos')
  })

  test('detects TrueHD audio', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.2160p.BluRay.TrueHD')
    assert.equal(result.audio, 'TrueHD')
  })

  test('detects DTS-HD MA audio', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.BluRay.DTS-HD.MA')
    assert.equal(result.audio, 'DTS-HD MA')
  })

  test('detects DTS-HD audio', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.BluRay.DTS-HD')
    assert.equal(result.audio, 'DTS-HD')
  })

  test('detects DTS audio', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.BluRay.DTS')
    assert.equal(result.audio, 'DTS')
  })

  test('detects DD5.1 audio', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.DD5.1')
    assert.equal(result.audio, 'DD5.1')
  })

  test('detects AC3 as DD5.1', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.AC3')
    assert.equal(result.audio, 'DD5.1')
  })

  test('detects FLAC audio', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.FLAC')
    assert.equal(result.audio, 'FLAC')
  })

  test('detects AAC audio', ({ assert }) => {
    const result = parseVideoQuality('Movie.Title.1080p.AAC')
    assert.equal(result.audio, 'AAC')
  })
})

test.group('quality_parser | parseMusicQuality', () => {
  test('detects FLAC format', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album (2024) [FLAC]')
    assert.equal(result.format, 'FLAC')
    assert.equal(result.bitrate, 'lossless')
  })

  test('detects lossless keyword as FLAC', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album Lossless')
    assert.equal(result.format, 'FLAC')
  })

  test('detects ALAC format', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [ALAC]')
    assert.equal(result.format, 'ALAC')
    assert.equal(result.bitrate, 'lossless')
  })

  test('detects WAV format', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [WAV]')
    assert.equal(result.format, 'WAV')
    assert.equal(result.bitrate, 'lossless')
  })

  test('does not match "wave" as WAV', ({ assert }) => {
    const result = parseMusicQuality('New Wave Album')
    assert.isNull(result.format)
  })

  test('detects OGG format', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [OGG]')
    assert.equal(result.format, 'OGG')
  })

  test('detects Vorbis as OGG', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [Vorbis]')
    assert.equal(result.format, 'OGG')
  })

  test('detects AAC 256 format', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [AAC] [256]')
    assert.equal(result.format, 'AAC')
    assert.equal(result.bitrate, '256')
  })

  test('detects MP3 320', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [MP3] [320]')
    assert.equal(result.format, 'MP3')
    assert.equal(result.bitrate, '320')
  })

  test('detects standalone 320 as MP3 320', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album 320')
    assert.equal(result.format, 'MP3')
    assert.equal(result.bitrate, '320')
  })

  test('detects MP3 V0', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [MP3] [V0]')
    assert.equal(result.format, 'MP3')
    assert.equal(result.bitrate, 'V0')
  })

  test('detects MP3 V2', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [MP3] [V2]')
    assert.equal(result.format, 'MP3')
    assert.equal(result.bitrate, 'V2')
  })

  test('detects MP3 256', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [MP3] [256]')
    assert.equal(result.format, 'MP3')
    assert.equal(result.bitrate, '256')
  })

  test('detects MP3 192', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [MP3] [192]')
    assert.equal(result.format, 'MP3')
    assert.equal(result.bitrate, '192')
  })

  test('detects 24-bit as hi-res', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [FLAC 24bit]')
    assert.isTrue(result.isHiRes)
  })

  test('detects hi-res keyword', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [Hi-Res FLAC]')
    assert.isTrue(result.isHiRes)
  })

  test('returns null for unrecognized format', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album 2024')
    assert.isNull(result.format)
  })

  test('defaults MP3 without bitrate to 320 in quality mapping', ({ assert }) => {
    const result = parseMusicQuality('Artist - Album [MP3]')
    assert.equal(result.format, 'MP3')
  })
})

test.group('quality_parser | parseBookQuality', () => {
  test('detects EPUB format', ({ assert }) => {
    const result = parseBookQuality('Book.Title.EPUB')
    assert.equal(result.format, 'EPUB')
  })

  test('detects PDF format', ({ assert }) => {
    const result = parseBookQuality('Book.Title.PDF')
    assert.equal(result.format, 'PDF')
  })

  test('detects MOBI format', ({ assert }) => {
    const result = parseBookQuality('Book.Title.MOBI')
    assert.equal(result.format, 'MOBI')
  })

  test('detects AZW3 format', ({ assert }) => {
    const result = parseBookQuality('Book.Title.AZW3')
    assert.equal(result.format, 'AZW3')
  })

  test('detects CBZ format', ({ assert }) => {
    const result = parseBookQuality('Book.Title.CBZ')
    assert.equal(result.format, 'CBZ')
  })

  test('detects CBR format', ({ assert }) => {
    const result = parseBookQuality('Book.Title.CBR')
    assert.equal(result.format, 'CBR')
  })

  test('returns null for unknown format', ({ assert }) => {
    const result = parseBookQuality('Book.Title')
    assert.isNull(result.format)
  })

  test('is case-insensitive', ({ assert }) => {
    const result = parseBookQuality('book.title.epub')
    assert.equal(result.format, 'EPUB')
  })
})

test.group('quality_parser | parseQuality (integrated)', () => {
  test('returns video quality for movies', ({ assert }) => {
    const result = parseQuality('Movie.2024.1080p.BluRay.x264', 'movies')
    assert.equal(result.mediaType, 'movies')
    assert.equal(result.qualityId, 2) // Bluray 1080p
    assert.equal(result.qualityName, 'Bluray 1080p')
    assert.isDefined(result.video)
  })

  test('returns video quality for tv', ({ assert }) => {
    const result = parseQuality('Show.S01E01.720p.HDTV', 'tv')
    assert.equal(result.mediaType, 'tv')
    assert.equal(result.qualityId, 8) // HDTV 720p
    assert.equal(result.qualityName, 'HDTV 720p')
  })

  test('returns music quality for music', ({ assert }) => {
    const result = parseQuality('Artist - Album [FLAC]', 'music')
    assert.equal(result.mediaType, 'music')
    assert.equal(result.qualityId, 1) // FLAC
    assert.equal(result.qualityName, 'FLAC')
    assert.isDefined(result.music)
  })

  test('returns book quality for books', ({ assert }) => {
    const result = parseQuality('Book Title EPUB', 'books')
    assert.equal(result.mediaType, 'books')
    assert.equal(result.qualityId, 1) // EPUB
    assert.equal(result.qualityName, 'EPUB')
    assert.isDefined(result.book)
  })

  test('maps DVD source directly to DVD quality', ({ assert }) => {
    const result = parseQuality('Movie.DVDRip.x264', 'movies')
    assert.equal(result.qualityId, 9) // DVD
    assert.equal(result.qualityName, 'DVD')
  })

  test('returns null qualityId for CAM source', ({ assert }) => {
    const result = parseQuality('Movie.2024.CAM', 'movies')
    assert.isNull(result.qualityId)
  })

  test('infers WEB source for 1080p with no explicit source', ({ assert }) => {
    const result = parseQuality('Movie.2024.1080p', 'movies')
    assert.equal(result.qualityId, 5) // Web 1080p
  })

  test('infers HDTV source for 720p with no explicit source', ({ assert }) => {
    const result = parseQuality('Movie.2024.720p', 'movies')
    assert.equal(result.qualityId, 8) // HDTV 720p
  })

  test('infers 1080p for BluRay with no resolution', ({ assert }) => {
    const result = parseQuality('Movie.2024.BluRay.x264', 'movies')
    assert.equal(result.qualityId, 2) // Bluray 1080p
  })

  test('infers 720p for HDTV with no resolution', ({ assert }) => {
    const result = parseQuality('Movie.2024.HDTV', 'movies')
    assert.equal(result.qualityId, 8) // HDTV 720p
  })

  test('returns null for unknown video quality', ({ assert }) => {
    const result = parseQuality('SomeRandomTitle', 'movies')
    assert.isNull(result.qualityId)
  })

  test('defaults MP3 without bitrate to MP3 320', ({ assert }) => {
    const result = parseQuality('Artist - Album [MP3]', 'music')
    assert.equal(result.qualityId, 4) // MP3 320
  })
})

test.group('quality_parser | qualityNameToId', () => {
  test('maps Bluray 1080p for movies', ({ assert }) => {
    assert.equal(qualityNameToId('Bluray 1080p', 'movies'), 2)
  })

  test('maps HDTV 720p for tv', ({ assert }) => {
    assert.equal(qualityNameToId('HDTV 720p', 'tv'), 8)
  })

  test('maps FLAC for music', ({ assert }) => {
    assert.equal(qualityNameToId('FLAC', 'music'), 1)
  })

  test('maps EPUB for books', ({ assert }) => {
    assert.equal(qualityNameToId('EPUB', 'books'), 1)
  })

  test('is case-insensitive', ({ assert }) => {
    assert.equal(qualityNameToId('bluray 1080p', 'movies'), 2)
  })

  test('returns null for unknown quality name', ({ assert }) => {
    assert.isNull(qualityNameToId('Unknown Quality', 'movies'))
  })

  test('maps DVD for movies', ({ assert }) => {
    assert.equal(qualityNameToId('DVD', 'movies'), 9)
  })

  test('maps MP3 320 for music', ({ assert }) => {
    assert.equal(qualityNameToId('MP3 320', 'music'), 4)
  })

  test('maps OGG Vorbis for music', ({ assert }) => {
    assert.equal(qualityNameToId('OGG Vorbis', 'music'), 9)
  })
})
