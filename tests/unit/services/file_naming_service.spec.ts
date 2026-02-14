import { test } from '@japa/runner'
import { FileNamingService } from '../../../app/services/media/file_naming_service.js'

const service = new FileNamingService()

test.group('FileNamingService | sanitize', () => {
  test('returns the same name when no illegal chars', ({ assert }) => {
    assert.equal(service.sanitize('Normal Name'), 'Normal Name')
  })

  test('replaces angle brackets', ({ assert }) => {
    assert.equal(service.sanitize('Name <with> brackets'), 'Name with brackets')
  })

  test('replaces colons', ({ assert }) => {
    assert.equal(service.sanitize('Movie: The Sequel'), 'Movie The Sequel')
  })

  test('replaces double quotes', ({ assert }) => {
    assert.equal(service.sanitize('Movie "Title"'), 'Movie Title')
  })

  test('replaces forward and back slashes', ({ assert }) => {
    const result = service.sanitize('AC/DC\\Greatest')
    assert.equal(result, 'AC DC Greatest')
  })

  test('replaces pipe character', ({ assert }) => {
    assert.equal(service.sanitize('Name | Alt'), 'Name Alt')
  })

  test('replaces question mark', ({ assert }) => {
    assert.equal(service.sanitize('What?'), 'What')
  })

  test('replaces asterisk', ({ assert }) => {
    assert.equal(service.sanitize('Name*'), 'Name')
  })

  test('collapses multiple spaces', ({ assert }) => {
    assert.equal(service.sanitize('Name    with    spaces'), 'Name with spaces')
  })

  test('removes trailing dots', ({ assert }) => {
    assert.equal(service.sanitize('Name...'), 'Name')
  })

  test('removes trailing spaces', ({ assert }) => {
    assert.equal(service.sanitize('Name   '), 'Name')
  })

  test('prefixes Windows reserved name CON', ({ assert }) => {
    assert.equal(service.sanitize('CON'), '_CON')
  })

  test('prefixes Windows reserved name PRN', ({ assert }) => {
    assert.equal(service.sanitize('PRN'), '_PRN')
  })

  test('prefixes Windows reserved name AUX', ({ assert }) => {
    assert.equal(service.sanitize('AUX'), '_AUX')
  })

  test('prefixes Windows reserved name NUL', ({ assert }) => {
    assert.equal(service.sanitize('NUL'), '_NUL')
  })

  test('prefixes Windows reserved name COM1', ({ assert }) => {
    assert.equal(service.sanitize('COM1'), '_COM1')
  })

  test('prefixes Windows reserved name LPT1', ({ assert }) => {
    assert.equal(service.sanitize('LPT1'), '_LPT1')
  })

  test('handles reserved names case-insensitively', ({ assert }) => {
    assert.equal(service.sanitize('con'), '_con')
  })

  test('returns Unknown for empty string', ({ assert }) => {
    assert.equal(service.sanitize(''), 'Unknown')
  })

  test('returns Unknown for string of only illegal chars', ({ assert }) => {
    assert.equal(service.sanitize('***'), 'Unknown')
  })

  test('truncates names longer than 200 chars', ({ assert }) => {
    const longName = 'A'.repeat(250)
    const result = service.sanitize(longName)
    assert.isAtMost(result.length, 200)
  })

  test('handles null-like falsy input', ({ assert }) => {
    assert.equal(service.sanitize(''), 'Unknown')
  })

  test('replaces control characters', ({ assert }) => {
    const result = service.sanitize('Name\x00\x01\x1fEnd')
    assert.equal(result, 'Name End')
  })
})

test.group('FileNamingService | isAudioFile', () => {
  test('recognizes .flac', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.flac'))
  })

  test('recognizes .mp3', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.mp3'))
  })

  test('recognizes .m4a', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.m4a'))
  })

  test('recognizes .ogg', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.ogg'))
  })

  test('recognizes .opus', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.opus'))
  })

  test('recognizes .wav', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.wav'))
  })

  test('recognizes .wma', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.wma'))
  })

  test('recognizes .aac', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.aac'))
  })

  test('recognizes .dsf', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.dsf'))
  })

  test('rejects .mkv', ({ assert }) => {
    assert.isFalse(service.isAudioFile('video.mkv'))
  })

  test('rejects .txt', ({ assert }) => {
    assert.isFalse(service.isAudioFile('file.txt'))
  })

  test('is case-insensitive', ({ assert }) => {
    assert.isTrue(service.isAudioFile('track.FLAC'))
  })
})

test.group('FileNamingService | isVideoFile', () => {
  test('recognizes .mkv', ({ assert }) => {
    assert.isTrue(service.isVideoFile('movie.mkv'))
  })

  test('recognizes .mp4', ({ assert }) => {
    assert.isTrue(service.isVideoFile('movie.mp4'))
  })

  test('recognizes .avi', ({ assert }) => {
    assert.isTrue(service.isVideoFile('movie.avi'))
  })

  test('recognizes .webm', ({ assert }) => {
    assert.isTrue(service.isVideoFile('movie.webm'))
  })

  test('recognizes .m2ts', ({ assert }) => {
    assert.isTrue(service.isVideoFile('movie.m2ts'))
  })

  test('recognizes .ts', ({ assert }) => {
    assert.isTrue(service.isVideoFile('movie.ts'))
  })

  test('rejects .flac', ({ assert }) => {
    assert.isFalse(service.isVideoFile('track.flac'))
  })

  test('rejects .epub', ({ assert }) => {
    assert.isFalse(service.isVideoFile('book.epub'))
  })

  test('is case-insensitive', ({ assert }) => {
    assert.isTrue(service.isVideoFile('movie.MKV'))
  })
})

test.group('FileNamingService | isBookFile', () => {
  test('recognizes .epub', ({ assert }) => {
    assert.isTrue(service.isBookFile('book.epub'))
  })

  test('recognizes .pdf', ({ assert }) => {
    assert.isTrue(service.isBookFile('book.pdf'))
  })

  test('recognizes .mobi', ({ assert }) => {
    assert.isTrue(service.isBookFile('book.mobi'))
  })

  test('recognizes .azw3', ({ assert }) => {
    assert.isTrue(service.isBookFile('book.azw3'))
  })

  test('recognizes .cbz', ({ assert }) => {
    assert.isTrue(service.isBookFile('book.cbz'))
  })

  test('recognizes .cbr', ({ assert }) => {
    assert.isTrue(service.isBookFile('book.cbr'))
  })

  test('recognizes .fb2', ({ assert }) => {
    assert.isTrue(service.isBookFile('book.fb2'))
  })

  test('rejects .mp3', ({ assert }) => {
    assert.isFalse(service.isBookFile('track.mp3'))
  })

  test('is case-insensitive', ({ assert }) => {
    assert.isTrue(service.isBookFile('book.EPUB'))
  })
})

test.group('FileNamingService | getBookFormat', () => {
  test('returns EPUB for .epub', ({ assert }) => {
    assert.equal(service.getBookFormat('book.epub'), 'EPUB')
  })

  test('returns PDF for .pdf', ({ assert }) => {
    assert.equal(service.getBookFormat('book.pdf'), 'PDF')
  })

  test('returns MOBI for .mobi', ({ assert }) => {
    assert.equal(service.getBookFormat('book.mobi'), 'MOBI')
  })

  test('returns uppercase unknown extension', ({ assert }) => {
    assert.equal(service.getBookFormat('file.xyz'), 'XYZ')
  })
})

test.group('FileNamingService | parseTrackFileName', () => {
  test('parses "01 - Track Title.flac"', ({ assert }) => {
    const result = service.parseTrackFileName('01 - Track Title.flac')
    assert.isNotNull(result)
    assert.equal(result!.trackNumber, 1)
    assert.equal(result!.title, 'Track Title')
    assert.equal(result!.extension, 'flac')
  })

  test('parses "1-01 - Track Title.mp3" (multi-disc)', ({ assert }) => {
    const result = service.parseTrackFileName('1-01 - Track Title.mp3')
    assert.isNotNull(result)
    assert.equal(result!.discNumber, 1)
    assert.equal(result!.trackNumber, 1)
    assert.equal(result!.title, 'Track Title')
  })

  test('parses "03. Track Title.flac"', ({ assert }) => {
    const result = service.parseTrackFileName('03. Track Title.flac')
    assert.isNotNull(result)
    assert.equal(result!.trackNumber, 3)
    assert.equal(result!.title, 'Track Title')
  })

  test('parses "05 Track Title.flac"', ({ assert }) => {
    const result = service.parseTrackFileName('05 Track Title.flac')
    assert.isNotNull(result)
    assert.equal(result!.trackNumber, 5)
  })

  test('returns null for unparseable filename', ({ assert }) => {
    const result = service.parseTrackFileName('random-name.flac')
    assert.isNull(result)
  })
})

test.group('FileNamingService | parseEpisodeFileName', () => {
  test('parses "Show Name - S01E01 - Episode Title.mkv"', ({ assert }) => {
    const result = service.parseEpisodeFileName('Show Name - S01E01 - Episode Title.mkv')
    assert.isNotNull(result)
    assert.equal(result!.seasonNumber, 1)
    assert.equal(result!.episodeNumber, 1)
    assert.equal(result!.title, 'Episode Title')
    assert.equal(result!.extension, 'mkv')
  })

  test('parses "S01E01 - Episode Title.mkv"', ({ assert }) => {
    const result = service.parseEpisodeFileName('S01E01 - Episode Title.mkv')
    assert.isNotNull(result)
    assert.equal(result!.seasonNumber, 1)
    assert.equal(result!.episodeNumber, 1)
    assert.equal(result!.title, 'Episode Title')
  })

  test('parses "Show.Name.S03E12.mkv"', ({ assert }) => {
    const result = service.parseEpisodeFileName('Show.Name.S03E12.mkv')
    assert.isNotNull(result)
    assert.equal(result!.seasonNumber, 3)
    assert.equal(result!.episodeNumber, 12)
  })

  test('parses 1x01 format', ({ assert }) => {
    const result = service.parseEpisodeFileName('Show Name 1x01.mkv')
    assert.isNotNull(result)
    assert.equal(result!.seasonNumber, 1)
    assert.equal(result!.episodeNumber, 1)
  })

  test('returns null for non-episode file', ({ assert }) => {
    const result = service.parseEpisodeFileName('random-file.mkv')
    assert.isNull(result)
  })
})

test.group('FileNamingService | isImageFile', () => {
  test('recognizes .jpg', ({ assert }) => {
    assert.isTrue(service.isImageFile('cover.jpg'))
  })

  test('recognizes .png', ({ assert }) => {
    assert.isTrue(service.isImageFile('cover.png'))
  })

  test('recognizes .webp', ({ assert }) => {
    assert.isTrue(service.isImageFile('cover.webp'))
  })

  test('rejects .mp3', ({ assert }) => {
    assert.isFalse(service.isImageFile('file.mp3'))
  })
})
