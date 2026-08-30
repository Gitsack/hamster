import { test } from '@japa/runner'
import {
  parseVideoQuality,
  parseAudioChannels,
  parseAudioCodec,
  parseReleaseGroup,
  detectJunkSource,
} from '../../../app/services/quality/quality_parser.js'
import {
  DEFAULT_QUALITY_REQUIREMENTS,
  evaluateLanguageClaims,
  evaluateReleaseAttributes,
  evaluateFileQuality,
  normalizeProbedAudioCodec,
  normalizeRequirements,
  type QualityRequirements,
} from '../../../app/services/quality/quality_requirements.js'
import { parseQuality } from '../../../app/services/quality/quality_parser.js'
import { parseLanguages } from '../../../app/services/quality/language_parser.js'
import {
  evaluateReleases,
  type ProfileContext,
} from '../../../app/services/quality/quality_scorer.js'

function requirements(overrides: Partial<QualityRequirements> = {}): QualityRequirements {
  return { ...DEFAULT_QUALITY_REQUIREMENTS, ...overrides }
}

test.group('quality_parser | junk sources', () => {
  test('flags a telesync even when it claims a real resolution', ({ assert }) => {
    const parsed = parseVideoQuality('Some.Movie.2024.1080p.HDTS.x264-GRP')
    assert.isTrue(parsed.isJunkSource)
    assert.equal(parsed.junkSourceLabel, 'TELESYNC')
  })

  test('flags CAM, screener, workprint and R5', ({ assert }) => {
    assert.equal(detectJunkSource('Movie.2024.HDCAM.x264'), 'CAM')
    assert.equal(detectJunkSource('Movie.2024.DVDScr.XviD'), 'SCREENER')
    assert.equal(detectJunkSource('Movie.2024.WORKPRINT.720p'), 'WORKPRINT')
    assert.equal(detectJunkSource('Movie.2024.R5.LiNE.XviD'), 'R5')
  })

  test('does not condemn a release for its group name', ({ assert }) => {
    assert.isNull(detectJunkSource('Movie.2024.1080p.BluRay.x264-TS'))
  })

  test('a junk release maps to no quality bucket', ({ assert }) => {
    const parsed = parseQuality('Movie.2024.1080p.HDTS.x264', 'movies')
    assert.isNull(parsed.qualityId)
  })
})

test.group('quality_parser | audio', () => {
  test('reads channel counts glued to the codec', ({ assert }) => {
    assert.equal(parseAudioChannels('Movie.2024.1080p.WEB-DL.DDP5.1.x264'), 6)
    assert.equal(parseAudioChannels('Movie.2024.1080p.BluRay.DTS-HD.MA.7.1'), 8)
    assert.equal(parseAudioChannels('Movie.2024.1080p.WEB.AAC2.0.H264'), 2)
  })

  test('does not read a year or a date as a channel layout', ({ assert }) => {
    assert.isNull(parseAudioChannels('Movie.2024.1080p.WEB.x264'))
    assert.isNull(parseAudioChannels('Show.2024.1.15.720p.WEB.x264'))
  })

  test('separates Dolby Digital from Dolby Digital Plus', ({ assert }) => {
    assert.equal(parseAudioCodec('Movie.2024.1080p.WEB-DL.DDP5.1'), 'EAC3')
    assert.equal(parseAudioCodec('Movie.2024.1080p.BluRay.DD5.1'), 'AC3')
    assert.equal(parseAudioCodec('Movie.2024.2160p.BluRay.TrueHD.Atmos.7.1'), 'Atmos')
    assert.equal(parseAudioCodec('Movie.2024.2160p.BluRay.DTS-HD.MA.5.1'), 'DTS-HD MA')
  })

  test('ranks lossless above lossy', ({ assert }) => {
    assert.equal(parseVideoQuality('Movie.2024.1080p.BluRay.TrueHD.5.1').audioTier, 'lossless')
    assert.equal(parseVideoQuality('Movie.2024.1080p.WEB.AAC2.0').audioTier, 'lossy-sd')
  })
})

test.group('quality_parser | attributes', () => {
  test('reads HDR, bit depth, repack and group', ({ assert }) => {
    const parsed = parseVideoQuality('Movie.2024.2160p.WEB-DL.DV.HDR10.10bit.REPACK.x265-GROUP')
    assert.equal(parsed.hdr, 'DV')
    assert.equal(parsed.bitDepth, 10)
    assert.isTrue(parsed.isRepack)
    assert.equal(parsed.releaseGroup, 'GROUP')
  })

  test('reads an upscale claim', ({ assert }) => {
    assert.isTrue(parseVideoQuality('Movie.2024.2160p.AI.Upscaled.WEB.x265').isUpscaled)
  })

  test('ignores a trailing year as a release group', ({ assert }) => {
    assert.isNull(parseReleaseGroup('Movie-2024'))
  })
})

test.group('quality_requirements | release attributes', () => {
  test('rejects a junk source no matter what the profile allows', ({ assert }) => {
    const parsed = parseQuality('Movie.2024.1080p.HDTS.x264', 'movies')
    const result = evaluateReleaseAttributes(parsed, requirements())
    assert.isNotEmpty(result.rejections)
    assert.match(result.rejections[0], /TELESYNC/)
  })

  test('rejects stereo when the profile asks for surround', ({ assert }) => {
    const parsed = parseQuality('Movie.2024.1080p.WEB-DL.AAC2.0.x264', 'movies')
    const result = evaluateReleaseAttributes(parsed, requirements({ minAudioChannels: 6 }))
    assert.isNotEmpty(result.rejections)
  })

  test('does not reject a release that simply says nothing about audio', ({ assert }) => {
    const parsed = parseQuality('Movie.2024.1080p.WEB-DL.x264', 'movies')
    const result = evaluateReleaseAttributes(parsed, requirements({ minAudioChannels: 6 }))
    assert.isEmpty(result.rejections)
  })

  test('ranks better audio above worse audio in the same bucket', ({ assert }) => {
    const good = evaluateReleaseAttributes(
      parseQuality('Movie.2024.1080p.BluRay.TrueHD.7.1.x264', 'movies'),
      requirements()
    )
    const bad = evaluateReleaseAttributes(
      parseQuality('Movie.2024.1080p.BluRay.AAC2.0.x264', 'movies'),
      requirements()
    )
    assert.isAbove(good.bonus, bad.bonus)
  })

  test('rejects a blocked audio codec', ({ assert }) => {
    const parsed = parseQuality('Movie.2024.1080p.WEB-DL.AAC5.1.x264', 'movies')
    const result = evaluateReleaseAttributes(parsed, requirements({ blockedAudioCodecs: ['AAC'] }))
    assert.isNotEmpty(result.rejections)
  })

  test('only requires HDR at 2160p', ({ assert }) => {
    const uhd = evaluateReleaseAttributes(
      parseQuality('Movie.2024.2160p.WEB-DL.x265', 'movies'),
      requirements({ requireHdr: true })
    )
    const hd = evaluateReleaseAttributes(
      parseQuality('Movie.2024.1080p.WEB-DL.x264', 'movies'),
      requirements({ requireHdr: true })
    )
    assert.isNotEmpty(uhd.rejections)
    assert.isEmpty(hd.rejections)
  })
})

test.group('quality_requirements | file checks', () => {
  test('recognises Atmos hidden behind a TrueHD codec name', ({ assert }) => {
    assert.equal(normalizeProbedAudioCodec('truehd', 'Dolby TrueHD + Dolby Atmos'), 'Atmos')
    assert.equal(normalizeProbedAudioCodec('dts', 'DTS-HD MA'), 'DTS-HD MA')
    assert.equal(normalizeProbedAudioCodec('pcm_s24le'), 'PCM')
  })

  test('flags stereo audio in an otherwise fine file', ({ assert }) => {
    const issues = evaluateFileQuality(
      {
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        videoBitrateKbps: 8000,
        audioCodec: 'AAC',
        audioChannels: 2,
        audioBitrateKbps: 128,
        audioLanguages: [],
      },
      requirements({ minAudioChannels: 6 })
    )
    assert.isNotEmpty(issues)
    assert.equal(issues[0].code, 'audio-channels')
  })

  test('flags a file below the profile resolution', ({ assert }) => {
    const issues = evaluateFileQuality(
      {
        width: 1280,
        height: 720,
        videoCodec: 'h264',
        videoBitrateKbps: null,
        audioCodec: null,
        audioChannels: null,
        audioBitrateKbps: null,
        audioLanguages: [],
      },
      requirements(),
      { minHeight: 1080 }
    )
    assert.isNotEmpty(issues)
    assert.equal(issues[0].code, 'resolution')
  })

  test('says nothing about attributes ffprobe could not read', ({ assert }) => {
    const issues = evaluateFileQuality(
      {
        width: null,
        height: null,
        videoCodec: null,
        videoBitrateKbps: null,
        audioCodec: null,
        audioChannels: null,
        audioBitrateKbps: null,
        audioLanguages: [],
      },
      requirements({ minAudioChannels: 6, minAudioBitrateKbps: 384, minVideoBitrateKbps: 5000 })
    )
    assert.isEmpty(issues)
  })
})

test.group('quality_requirements | normalisation', () => {
  test('fills in fields a stored profile predates', ({ assert }) => {
    const normalized = normalizeRequirements({ minAudioChannels: 6 })
    assert.equal(normalized.minAudioChannels, 6)
    assert.isTrue(normalized.blockUnknownQuality)
    assert.deepEqual(normalized.blockedAudioCodecs, [])
  })

  test('treats a missing requirements column as the defaults', ({ assert }) => {
    assert.deepEqual(normalizeRequirements(null), DEFAULT_QUALITY_REQUIREMENTS)
  })
})

test.group('quality_scorer | evaluateReleases', () => {
  const profileItems = [
    { id: 1, name: 'Bluray 2160p', allowed: true },
    { id: 2, name: 'Bluray 1080p', allowed: true },
    { id: 5, name: 'Web 1080p', allowed: true },
    { id: 8, name: 'HDTV 720p', allowed: false },
  ]

  function context(overrides: Partial<QualityRequirements> = {}): ProfileContext {
    return {
      items: profileItems,
      cutoff: 2,
      requirements: requirements(overrides),
      customFormats: [],
      upgradeAllowed: true,
      profileName: 'Test',
    }
  }

  test('prefers the better audio when the video quality is identical', ({ assert }) => {
    const { accepted } = evaluateReleases(
      [
        { title: 'Movie.2024.1080p.BluRay.AAC2.0.x264-A', size: 12_000_000_000 },
        { title: 'Movie.2024.1080p.BluRay.TrueHD.5.1.x264-B', size: 8_000_000_000 },
      ],
      'movies',
      context()
    )

    // The bigger file used to win by default; size is now only a tiebreaker.
    assert.equal(accepted[0].release.title, 'Movie.2024.1080p.BluRay.TrueHD.5.1.x264-B')
  })

  test('never accepts a cinema rip, however large', ({ assert }) => {
    const { accepted, rejected } = evaluateReleases(
      [{ title: 'Movie.2024.1080p.HDTS.x264-GRP', size: 20_000_000_000 }],
      'movies',
      context()
    )
    assert.isEmpty(accepted)
    assert.match(rejected[0].evaluation.rejections[0], /TELESYNC/)
  })

  test('explains a rejection in terms of the rule that fired', ({ assert }) => {
    const { rejected } = evaluateReleases(
      [{ title: 'Movie.2024.1080p.WEB-DL.AAC2.0.x264', size: 4_000_000_000 }],
      'movies',
      context({ minAudioChannels: 6 })
    )
    assert.match(rejected[0].evaluation.rejections[0], /stereo/)
  })

  test('rejects a quality the profile disallows', ({ assert }) => {
    const { accepted, rejected } = evaluateReleases(
      [{ title: 'Show.2024.720p.HDTV.x264', size: 1_000_000_000 }],
      'movies',
      context()
    )
    assert.isEmpty(accepted)
    assert.match(rejected[0].evaluation.rejections[0], /not allowed/)
  })

  test('keeps the size band as a hard filter', ({ assert }) => {
    const ctx = { ...context(), maxSizeBytes: 5_000_000_000 }
    const { accepted, rejected } = evaluateReleases(
      [{ title: 'Movie.2024.1080p.BluRay.TrueHD.5.1.x264', size: 9_000_000_000 }],
      'movies',
      ctx
    )
    assert.isEmpty(accepted)
    assert.match(rejected[0].evaluation.rejections[0], /maximum size/)
  })
})

test.group('quality_requirements | audio languages', () => {
  const claims = (title: string, overrides: Partial<QualityRequirements> = {}) =>
    evaluateLanguageClaims(parseLanguages(title), requirements(overrides))

  test('rejects a release that states only the wrong language', ({ assert }) => {
    const result = claims('Movie.2024.ITA.1080p.BluRay.x264-GRP', {
      requiredAudioLanguages: ['de'],
    })
    assert.isNotEmpty(result.rejections)
    assert.include(result.rejections[0], 'German')
  })

  test('never rejects a release that states nothing', ({ assert }) => {
    const result = claims('Movie.2024.1080p.BluRay.x264-GRP', {
      requiredAudioLanguages: ['de'],
    })
    assert.isEmpty(result.rejections)
    // Ranked below one that says the right thing, which is the whole mechanism.
    assert.isBelow(result.bonus, 0)
  })

  test('never rejects MULTi for a language it does not name', ({ assert }) => {
    const result = claims('Movie.2024.MULTi.1080p.BluRay.x264-GRP', {
      requiredAudioLanguages: ['de'],
    })
    assert.isEmpty(result.rejections)
  })

  test('accepts a dual-language release under an all-of rule', ({ assert }) => {
    const dual = claims('Movie.2024.German.DL.1080p.BluRay.x264-GRP', {
      requiredAudioLanguages: ['de', 'en'],
      requireAllAudioLanguages: true,
    })
    assert.isEmpty(dual.rejections)

    const germanOnly = claims('Movie.2024.German.1080p.BluRay.x264-GRP', {
      requiredAudioLanguages: ['de', 'en'],
      requireAllAudioLanguages: true,
    })
    assert.isNotEmpty(germanOnly.rejections)
    assert.include(germanOnly.rejections[0], 'missing English')
  })

  test('takes any one language when not asked for all of them', ({ assert }) => {
    const result = claims('Movie.2024.German.1080p.BluRay.x264-GRP', {
      requiredAudioLanguages: ['de', 'en'],
    })
    assert.isEmpty(result.rejections)
  })

  test('blocks a language only when it is the whole release', ({ assert }) => {
    const only = claims('Movie.2024.ITA.1080p.BluRay.x264-GRP', {
      blockedAudioLanguages: ['it'],
    })
    assert.isNotEmpty(only.rejections)

    // An extra Italian track is not a reason to refuse an English release.
    const alongside = claims('Movie.2024.ITA.ENG.1080p.BluRay.x264-GRP', {
      blockedAudioLanguages: ['it'],
    })
    assert.isEmpty(alongside.rejections)
  })

  test('ranks the right language above the ones that merely might be', ({ assert }) => {
    const options = { requiredAudioLanguages: ['de'] }
    const stated = claims('Movie.2024.German.1080p.BluRay.x264-GRP', options)
    const multi = claims('Movie.2024.MULTi.1080p.BluRay.x264-GRP', options)
    const silent = claims('Movie.2024.1080p.BluRay.x264-GRP', options)

    assert.isAbove(stated.bonus, multi.bonus)
    assert.isAbove(multi.bonus, silent.bonus)
  })

  test('carries the rule through the full release evaluation', ({ assert }) => {
    const parsed = parseQuality('Movie.2024.ITA.1080p.BluRay.x264-GRP', 'movies')
    const result = evaluateReleaseAttributes(
      parsed,
      requirements({ requiredAudioLanguages: ['de'] })
    )
    assert.isNotEmpty(result.rejections)
  })
})

test.group('quality_requirements | audio languages on disk', () => {
  const facts = (audioLanguages: string[]) => ({
    width: 1920,
    height: 1080,
    videoCodec: 'h264',
    videoBitrateKbps: 8000,
    audioCodec: 'EAC3' as const,
    audioChannels: 6,
    audioBitrateKbps: 640,
    audioLanguages,
  })

  test('flags an imported file whose tracks are the wrong language', ({ assert }) => {
    const issues = evaluateFileQuality(
      facts(['it']),
      requirements({ requiredAudioLanguages: ['de'] })
    )
    assert.lengthOf(issues, 1)
    assert.equal(issues[0].code, 'audio-language')
  })

  test('says nothing about a file with no language tags at all', ({ assert }) => {
    const issues = evaluateFileQuality(facts([]), requirements({ requiredAudioLanguages: ['de'] }))
    assert.isEmpty(issues)
  })

  test('names what is missing under an all-of rule', ({ assert }) => {
    const issues = evaluateFileQuality(
      facts(['de']),
      requirements({ requiredAudioLanguages: ['de', 'en'], requireAllAudioLanguages: true })
    )
    assert.lengthOf(issues, 1)
    assert.include(issues[0].message, 'English')
  })
})
