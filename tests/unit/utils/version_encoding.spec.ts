import { test } from '@japa/runner'
import {
  buildVersionEncodeArgs,
  encodeStoppedAtFlush,
  parseSidecarName,
  selectAudioTracks,
  targetDimensions,
  unsupportedSourceReason,
  type VersionEncodeInput,
} from '../../../app/utils/version_encoding.js'
import { versionRelativePath } from '../../../app/services/media/media_version_service.js'
import type { MediaAnalysis } from '../../../app/utils/ffmpeg_utils.js'

function analysis(overrides: Partial<MediaAnalysis> = {}): MediaAnalysis {
  return {
    duration: 7200,
    container: 'matroska,webm',
    videoCodec: 'h264',
    videoWidth: 1920,
    videoHeight: 1080,
    videoBitrate: null,
    audioCodec: 'dts',
    audioChannels: 6,
    audioBitrate: null,
    audioSampleRate: 48000,
    audioProfile: null,
    audioChannelLayout: '5.1(side)',
    audioTracks: [
      {
        index: 1,
        codec: 'dts',
        channels: 6,
        channelLayout: '5.1(side)',
        language: 'en',
        title: null,
        isDefault: true,
        profile: null,
      },
    ],
    subtitleTracks: [],
    videoPixFmt: 'yuv420p',
    videoColorTransfer: 'bt709',
    videoColorPrimaries: 'bt709',
    videoColorSpace: 'bt709',
    dolbyVisionProfile: null,
    ...overrides,
  }
}

function input(overrides: Partial<VersionEncodeInput> = {}): VersionEncodeInput {
  return {
    sourcePath: '/in.mkv',
    outputPath: '/out.mkv',
    analysis: analysis(),
    profile: { maxHeight: 1080, quality: 'balanced', audio: 'stereo', subtitles: true },
    encoder: 'vaapi',
    subtitleIndices: [],
    ...overrides,
  }
}

/** The value that follows `flag` in an argument list. */
function after(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}

test.group('version_encoding | targetDimensions', () => {
  test('never upscales', ({ assert }) => {
    assert.deepEqual(targetDimensions(1280, 720, 1080), { width: 1280, height: 720, scaled: false })
  })

  test('fits 4K 16:9 into 1080p', ({ assert }) => {
    assert.deepEqual(targetDimensions(3840, 2160, 1080), {
      width: 1920,
      height: 1080,
      scaled: true,
    })
  })

  test('scales a scope film by width, not height', ({ assert }) => {
    // 3840x1600 limited to 1080 in height alone would come out 2592 wide
    assert.deepEqual(targetDimensions(3840, 1600, 1080), { width: 1920, height: 800, scaled: true })
  })

  test('keeps both sides even', ({ assert }) => {
    const { width, height } = targetDimensions(1920, 818, 720)
    assert.equal(width % 2, 0)
    assert.equal(height % 2, 0)
  })
})

test.group('version_encoding | unsupportedSourceReason', () => {
  test('refuses Dolby Vision profile 5', ({ assert }) => {
    assert.match(unsupportedSourceReason(analysis({ dolbyVisionProfile: 5 }))!, /profile 5/)
  })

  test('accepts Dolby Vision profiles with an HDR10 base layer', ({ assert }) => {
    assert.isNull(unsupportedSourceReason(analysis({ dolbyVisionProfile: 7 })))
    assert.isNull(unsupportedSourceReason(analysis({ dolbyVisionProfile: 8 })))
  })
})

test.group('version_encoding | selectAudioTracks', () => {
  const track = (index: number, title: string | null) => ({
    index,
    codec: 'ac3',
    channels: 2,
    channelLayout: 'stereo',
    language: 'en' as const,
    title,
    isDefault: false,
    profile: null,
  })

  test('drops commentary', ({ assert }) => {
    const a = analysis({ audioTracks: [track(1, null), track(2, 'Director Commentary')] })
    assert.deepEqual(selectAudioTracks(a), [1])
  })

  test('keeps one track per language, the one with the most channels', ({ assert }) => {
    const a = analysis({
      audioTracks: [
        { ...track(1, 'E-AC-3 5.1'), channels: 6 },
        { ...track(2, 'TrueHD Atmos 7.1'), channels: 8 },
        { ...track(3, null), language: 'de' as const },
      ],
    })
    assert.deepEqual(selectAudioTracks(a), [2, 3])
  })

  test('keeps commentary when it is all there is', ({ assert }) => {
    const a = analysis({ audioTracks: [track(1, 'Commentary')] })
    assert.deepEqual(selectAudioTracks(a), [1])
  })
})

test.group('version_encoding | buildVersionEncodeArgs', () => {
  test('GPU path decodes and encodes on the device', ({ assert }) => {
    const args = buildVersionEncodeArgs(input({ encoder: 'vaapi' }))
    assert.equal(after(args, '-hwaccel'), 'vaapi')
    assert.equal(after(args, '-c:v'), 'hevc_vaapi')
    assert.equal(after(args, '-rc_mode'), 'ICQ')
    assert.equal(after(args, '-profile:v'), 'main')
    assert.equal(after(args, '-vf'), 'scale_vaapi=format=nv12')
  })

  test('resizes a 1080p source on the CPU, avoiding the GPU scaler flush bug', ({ assert }) => {
    const args = buildVersionEncodeArgs(
      input({ profile: { maxHeight: 720, quality: 'balanced', audio: 'stereo', subtitles: true } })
    )
    assert.equal(after(args, '-hwaccel'), 'vaapi')
    assert.notInclude(args, '-hwaccel_output_format')
    assert.equal(after(args, '-filter_hw_device'), 'va')
    assert.equal(after(args, '-vf'), 'scale=1280:720:flags=bicubic,format=nv12,hwupload')
  })

  test('Quick Sync decodes through VAAPI and encodes with look-ahead', ({ assert }) => {
    const args = buildVersionEncodeArgs(input({ encoder: 'qsv' }))
    assert.equal(after(args, '-hwaccel'), 'vaapi')
    assert.equal(after(args, '-filter_hw_device'), 'qs')
    assert.include(args, 'qsv=qs@va')
    assert.equal(after(args, '-vf'), 'hwmap=derive_device=qsv,format=qsv,vpp_qsv=format=nv12')
    assert.equal(after(args, '-c:v'), 'hevc_qsv')
    assert.equal(after(args, '-global_quality'), '25')
    assert.equal(after(args, '-look_ahead_depth'), '40')
    assert.equal(after(args, '-extbrc'), '1')
  })

  test('Quick Sync scales 4K HDR on the GPU and stays 10-bit', ({ assert }) => {
    const args = buildVersionEncodeArgs(
      input({
        encoder: 'qsv',
        analysis: analysis({
          videoWidth: 3840,
          videoHeight: 2160,
          videoPixFmt: 'yuv420p10le',
          videoColorTransfer: 'smpte2084',
        }),
      })
    )
    assert.equal(
      after(args, '-vf'),
      'hwmap=derive_device=qsv,format=qsv,vpp_qsv=w=1920:h=1080:format=p010'
    )
    assert.equal(after(args, '-profile:v'), 'main10')
  })

  test('falls back to constant QP where the driver has no ICQ', ({ assert }) => {
    const args = buildVersionEncodeArgs(input({ vaapiRateControl: 'CQP' }))
    assert.equal(after(args, '-rc_mode'), 'CQP')
    assert.equal(after(args, '-qp'), '25')
    assert.notInclude(args, '-global_quality')
  })

  test('HDR stays 10-bit and keeps its colour tags', ({ assert }) => {
    const args = buildVersionEncodeArgs(
      input({
        analysis: analysis({
          videoWidth: 3840,
          videoHeight: 2160,
          videoPixFmt: 'yuv420p10le',
          videoColorTransfer: 'smpte2084',
          videoColorPrimaries: 'bt2020',
          videoColorSpace: 'bt2020nc',
        }),
      })
    )
    assert.equal(after(args, '-profile:v'), 'main10')
    assert.equal(after(args, '-vf'), 'scale_vaapi=w=1920:h=1080:format=p010')
    assert.equal(after(args, '-color_trc'), 'smpte2084')
    assert.equal(after(args, '-color_primaries'), 'bt2020')
  })

  test('x265 path tags HDR10 in the bitstream', ({ assert }) => {
    const args = buildVersionEncodeArgs(
      input({
        encoder: 'x265',
        analysis: analysis({ videoPixFmt: 'yuv420p10le', videoColorTransfer: 'smpte2084' }),
      })
    )
    assert.equal(after(args, '-c:v'), 'libx265')
    assert.include(after(args, '-x265-params')!, 'hdr10=1')
    assert.include(after(args, '-vf')!, 'yuv420p10le')
    assert.notInclude(args, '-hwaccel')
  })

  test('stereo profile downmixes to AAC', ({ assert }) => {
    const args = buildVersionEncodeArgs(input())
    assert.equal(after(args, '-c:a:0'), 'aac')
    assert.equal(after(args, '-ac:a:0'), '2')
  })

  test('surround profile keeps 5.1 as E-AC-3', ({ assert }) => {
    const args = buildVersionEncodeArgs(
      input({
        profile: { maxHeight: 1080, quality: 'balanced', audio: 'surround', subtitles: true },
      })
    )
    assert.equal(after(args, '-c:a:0'), 'eac3')
    assert.equal(after(args, '-ac:a:0'), '6')
  })

  test('embeds sidecar subtitles with their language', ({ assert }) => {
    const args = buildVersionEncodeArgs(
      input({
        sidecars: [
          { path: '/m/Movie.de.srt', language: 'de', forced: false, hearingImpaired: false },
        ],
      })
    )
    assert.include(args, '/m/Movie.de.srt')
    assert.include(args, '1:0')
    assert.equal(after(args, '-metadata:s:s:0'), 'language=de')
  })

  test('converts mov_text and skips subtitle formats Matroska cannot hold', ({ assert }) => {
    const sub = (index: number, codec: string) => ({
      index,
      codec,
      language: 'en' as const,
      title: null,
      isDefault: false,
      isForced: false,
      isHearingImpaired: false,
    })
    const args = buildVersionEncodeArgs(
      input({
        analysis: analysis({ subtitleTracks: [sub(2, 'mov_text'), sub(3, 'eia_608')] }),
        subtitleIndices: [2, 3],
      })
    )
    assert.include(args, '0:2')
    assert.notInclude(args, '0:3')
    assert.equal(after(args, '-c:s:0'), 'srt')
  })

  test('no subtitles when the profile says so', ({ assert }) => {
    const args = buildVersionEncodeArgs(
      input({
        profile: { maxHeight: 1080, quality: 'balanced', audio: 'stereo', subtitles: false },
        subtitleIndices: [2],
        sidecars: [{ path: '/x.srt', language: 'en', forced: false, hearingImpaired: false }],
      })
    )
    assert.notInclude(args, '/x.srt')
    assert.notInclude(args, '0:2')
  })
})

test.group('version_encoding | parseSidecarName', () => {
  test('reads language and flags', ({ assert }) => {
    assert.deepEqual(parseSidecarName('Movie (2020).en.forced.srt', 'Movie (2020)'), {
      language: 'en',
      forced: true,
      hearingImpaired: false,
    })
    assert.deepEqual(parseSidecarName('Movie (2020).de.sdh.default.3.ass', 'Movie (2020)'), {
      language: 'de',
      forced: false,
      hearingImpaired: true,
    })
  })

  test('ignores other videos and non-subtitles', ({ assert }) => {
    assert.isNull(parseSidecarName('Movie (2020) - Mobile.mkv', 'Movie (2020)'))
    assert.isNull(parseSidecarName('Movie (2020).nfo', 'Movie (2020)'))
    assert.isNull(parseSidecarName('Other (1999).en.srt', 'Movie (2020)'))
  })

  test('und means unknown', ({ assert }) => {
    assert.isNull(parseSidecarName('Movie.und.srt', 'Movie')!.language)
  })
})

test.group('movie_version_service | versionRelativePath', () => {
  test('names the copy the way Jellyfin groups versions', ({ assert }) => {
    assert.equal(
      versionRelativePath('Movie (2020)/Movie (2020).mp4', 'Mobile'),
      'Movie (2020)/Movie (2020) - Mobile.mkv'
    )
  })
})

test.group('version_encoding | encodeStoppedAtFlush', () => {
  test('accepts the scaler flush failure in either wording, at the very end only', ({ assert }) => {
    assert.isTrue(encodeStoppedAtFlush('Error while filtering: Out of memory', 99.5))
    assert.isTrue(encodeStoppedAtFlush('Error while filtering: Cannot allocate memory', 98.3))
    assert.isFalse(encodeStoppedAtFlush('Error while filtering: Cannot allocate memory', 60))
    assert.isFalse(encodeStoppedAtFlush('Invalid argument', 99.9))
  })
})
