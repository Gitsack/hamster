import { test } from '@japa/runner'
import {
  needsTranscoding,
  generateHlsManifest,
  getSegmentTranscodeArgs,
  getHlsTranscodeArgs,
  selectSubtitleTracksToKeep,
  getSubtitlePruneArgs,
  defaultSubtitlePruningOptions,
  type SubtitleTrackInfo,
  type SubtitlePruningOptions,
} from '../../../app/utils/ffmpeg_utils.js'

test.group('ffmpeg_utils | needsTranscoding', () => {
  // Browser-compatible codecs (should NOT need transcoding)
  test('aac does not need transcoding', ({ assert }) => {
    const result = needsTranscoding('aac')
    assert.isFalse(result.needsTranscode)
    assert.isNull(result.reason)
    assert.equal(result.audioCodec, 'aac')
  })

  test('mp3 does not need transcoding', ({ assert }) => {
    const result = needsTranscoding('mp3')
    assert.isFalse(result.needsTranscode)
  })

  test('opus does not need transcoding', ({ assert }) => {
    const result = needsTranscoding('opus')
    assert.isFalse(result.needsTranscode)
  })

  test('flac does not need transcoding', ({ assert }) => {
    const result = needsTranscoding('flac')
    assert.isFalse(result.needsTranscode)
  })

  test('vorbis does not need transcoding', ({ assert }) => {
    const result = needsTranscoding('vorbis')
    assert.isFalse(result.needsTranscode)
  })

  test('pcm_s16le does not need transcoding', ({ assert }) => {
    const result = needsTranscoding('pcm_s16le')
    assert.isFalse(result.needsTranscode)
  })

  // Codecs that need transcoding
  test('ac3 needs transcoding', ({ assert }) => {
    const result = needsTranscoding('ac3')
    assert.isTrue(result.needsTranscode)
    assert.isNotNull(result.reason)
    assert.equal(result.audioCodec, 'ac3')
  })

  test('eac3 needs transcoding', ({ assert }) => {
    const result = needsTranscoding('eac3')
    assert.isTrue(result.needsTranscode)
  })

  test('dts needs transcoding', ({ assert }) => {
    const result = needsTranscoding('dts')
    assert.isTrue(result.needsTranscode)
  })

  test('truehd needs transcoding', ({ assert }) => {
    const result = needsTranscoding('truehd')
    assert.isTrue(result.needsTranscode)
  })

  test('dca (DTS variant) needs transcoding', ({ assert }) => {
    const result = needsTranscoding('dca')
    assert.isTrue(result.needsTranscode)
  })

  test('mlp needs transcoding', ({ assert }) => {
    const result = needsTranscoding('mlp')
    assert.isTrue(result.needsTranscode)
  })

  // Edge cases
  test('null codec returns no transcode needed', ({ assert }) => {
    const result = needsTranscoding(null)
    assert.isFalse(result.needsTranscode)
    assert.isNull(result.audioCodec)
  })

  test('undefined codec returns no transcode needed', ({ assert }) => {
    const result = needsTranscoding(undefined)
    assert.isFalse(result.needsTranscode)
  })

  test('unknown codec assumes transcoding needed', ({ assert }) => {
    const result = needsTranscoding('some_unknown_codec')
    assert.isTrue(result.needsTranscode)
    assert.include(result.reason!, 'Unknown audio codec')
  })

  test('handles uppercase codec names', ({ assert }) => {
    const result = needsTranscoding('AAC')
    assert.isFalse(result.needsTranscode)
  })
})

test.group('ffmpeg_utils | generateHlsManifest', () => {
  test('generates valid HLS manifest header', ({ assert }) => {
    const manifest = generateHlsManifest('test-session', 60)
    assert.include(manifest, '#EXTM3U')
    assert.include(manifest, '#EXT-X-VERSION:3')
    assert.include(manifest, '#EXT-X-PLAYLIST-TYPE:VOD')
    assert.include(manifest, '#EXT-X-ENDLIST')
  })

  test('generates correct number of segments', ({ assert }) => {
    const manifest = generateHlsManifest('session-1', 18, 6)
    const segmentLines = manifest.split('\n').filter((l) => l.endsWith('.ts'))
    assert.equal(segmentLines.length, 3) // 18 / 6 = 3 segments
  })

  test('uses sessionId in segment URLs', ({ assert }) => {
    const manifest = generateHlsManifest('my-session', 12, 6)
    assert.include(manifest, '/api/v1/playback/hls/my-session/0.ts')
    assert.include(manifest, '/api/v1/playback/hls/my-session/1.ts')
  })

  test('sets correct target duration', ({ assert }) => {
    const manifest = generateHlsManifest('session', 60, 10)
    assert.include(manifest, '#EXT-X-TARGETDURATION:10')
  })

  test('handles last segment with shorter duration', ({ assert }) => {
    // 10 seconds total with 6 second segments: segment 0 = 6s, segment 1 = 4s
    const manifest = generateHlsManifest('session', 10, 6)
    assert.include(manifest, '#EXTINF:4.000,')
  })

  test('handles single segment for short video', ({ assert }) => {
    const manifest = generateHlsManifest('session', 3, 6)
    const segmentLines = manifest.split('\n').filter((l) => l.endsWith('.ts'))
    assert.equal(segmentLines.length, 1)
  })

  test('uses default segment duration of 6', ({ assert }) => {
    const manifest = generateHlsManifest('session', 12)
    assert.include(manifest, '#EXT-X-TARGETDURATION:6')
    const segmentLines = manifest.split('\n').filter((l) => l.endsWith('.ts'))
    assert.equal(segmentLines.length, 2)
  })
})

test.group('ffmpeg_utils | getSegmentTranscodeArgs', () => {
  test('returns correct arguments array', ({ assert }) => {
    const args = getSegmentTranscodeArgs('/path/to/file.mkv', 12, 6)
    assert.include(args, '-ss')
    assert.include(args, '12')
    assert.include(args, '-i')
    assert.include(args, '/path/to/file.mkv')
    assert.include(args, '-t')
    assert.include(args, '6')
    assert.include(args, '-c:a')
    assert.include(args, 'aac')
    assert.include(args, 'pipe:1')
  })
})

test.group('ffmpeg_utils | getHlsTranscodeArgs', () => {
  test('returns correct arguments for HLS output', ({ assert }) => {
    const args = getHlsTranscodeArgs('/path/to/file.mkv', '/output/dir', 6)
    assert.include(args, '-i')
    assert.include(args, '/path/to/file.mkv')
    assert.include(args, '-f')
    assert.include(args, 'hls')
    assert.include(args, '-hls_time')
    assert.include(args, '6')
    assert.include(args, '/output/dir/segment-%d.ts')
    assert.include(args, '/output/dir/master.m3u8')
  })

  test('uses default segment duration of 6', ({ assert }) => {
    const args = getHlsTranscodeArgs('/input.mkv', '/out')
    assert.include(args, '6')
  })
})

function subtitle(
  index: number,
  language: string | null,
  extra: Partial<SubtitleTrackInfo> = {}
): SubtitleTrackInfo {
  return {
    index,
    codec: 'subrip',
    language,
    title: null,
    isDefault: false,
    isForced: false,
    ...extra,
  }
}

/** A 36-track release, the shape that started all this. */
function manyTracks(): SubtitleTrackInfo[] {
  const languages = [
    'en',
    'en',
    'bg',
    'cs',
    'da',
    'de',
    'el',
    'es',
    'es',
    'et',
    'fi',
    'fr',
    'he',
    'hr',
    'hu',
    'id',
    'is',
    'it',
    'lt',
    'lv',
    'mk',
    'mn',
    'ms',
    'nb',
    'nl',
    'pl',
    'pt',
    'pt',
    'ro',
    'sk',
    'sl',
    'sr',
    'sv',
    'th',
    'tr',
    'vi',
  ]
  return languages.map((language, order) => subtitle(order + 2, language))
}

test.group('ffmpeg_utils | selectSubtitleTracksToKeep', () => {
  const options = (overrides: Partial<SubtitlePruningOptions> = {}): SubtitlePruningOptions => ({
    ...defaultSubtitlePruningOptions,
    ...overrides,
  })

  test('disabled policy never touches a file', ({ assert }) => {
    const result = selectSubtitleTracksToKeep(manyTracks(), options({ enabled: false }))
    assert.isTrue(result.unchanged)
    assert.lengthOf(result.keep, 36)
  })

  test('a file within the limit is left alone', ({ assert }) => {
    const tracks = [subtitle(2, 'en'), subtitle(3, 'de')]
    const result = selectSubtitleTracksToKeep(tracks, options({ enabled: true, maxTracks: 20 }))
    assert.isTrue(result.unchanged)
    assert.deepEqual(result.keep, [2, 3])
  })

  test('a file exactly at the limit is left alone', ({ assert }) => {
    const tracks = manyTracks().slice(0, 20)
    const result = selectSubtitleTracksToKeep(tracks, options({ enabled: true, maxTracks: 20 }))
    assert.isTrue(result.unchanged)
    assert.lengthOf(result.keep, 20)
  })

  test('keeps only the wanted languages once over the limit', ({ assert }) => {
    const result = selectSubtitleTracksToKeep(
      manyTracks(),
      options({ enabled: true, maxTracks: 20, keepLanguages: ['en', 'de'] })
    )
    assert.isFalse(result.unchanged)
    // two English tracks at indices 2 and 3, German at index 7
    assert.deepEqual(result.keep, [2, 3, 7])
  })

  test('keeps untagged tracks, which are usually forced signs', ({ assert }) => {
    const tracks = [...manyTracks(), subtitle(38, null, { isForced: true })]
    const result = selectSubtitleTracksToKeep(
      tracks,
      options({ enabled: true, maxTracks: 20, keepLanguages: ['en'] })
    )
    assert.include(result.keep, 38)
  })

  test('falls back to file order rather than stripping every track', ({ assert }) => {
    const result = selectSubtitleTracksToKeep(
      manyTracks(),
      options({ enabled: true, maxTracks: 5, keepLanguages: ['ja'] })
    )
    assert.isFalse(result.unchanged)
    assert.lengthOf(result.keep, 5)
    assert.deepEqual(result.keep, [2, 3, 4, 5, 6])
  })

  test('truncates when even the wanted languages exceed the limit', ({ assert }) => {
    const tracks = Array.from({ length: 30 }, (_, order) => subtitle(order + 2, 'en'))
    const result = selectSubtitleTracksToKeep(
      tracks,
      options({ enabled: true, maxTracks: 10, keepLanguages: ['en'] })
    )
    assert.lengthOf(result.keep, 10)
  })

  test('a file with no subtitles at all is left alone', ({ assert }) => {
    const result = selectSubtitleTracksToKeep([], options({ enabled: true, maxTracks: 20 }))
    assert.isTrue(result.unchanged)
    assert.isEmpty(result.keep)
  })
})

test.group('ffmpeg_utils | getSubtitlePruneArgs', () => {
  test('copies every stream and maps only the kept subtitles', ({ assert }) => {
    const args = getSubtitlePruneArgs('/in.mkv', '/out.mkv', [2, 3, 7])
    assert.deepEqual(args, [
      '-nostdin',
      '-v',
      'error',
      '-y',
      '-i',
      '/in.mkv',
      '-map',
      '0:v',
      '-map',
      '0:a',
      '-map',
      '0:2',
      '-map',
      '0:3',
      '-map',
      '0:7',
      '-c',
      'copy',
      '/out.mkv',
    ])
  })

  test('never re-encodes', ({ assert }) => {
    const args = getSubtitlePruneArgs('/in.mkv', '/out.mkv', [2])
    assert.include(args.join(' '), '-c copy')
    assert.notInclude(args.join(' '), 'libx264')
  })
})
