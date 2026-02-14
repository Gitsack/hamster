import { test } from '@japa/runner'
import { CustomFormatMatcher } from '../../../app/services/quality/custom_format_matcher.js'
import type { CustomFormatSpecification } from '../../../app/models/custom_format.js'
import type CustomFormat from '../../../app/models/custom_format.js'

const matcher = new CustomFormatMatcher()

// Helper to create a minimal CustomFormat-like object
function createFormat(id: string, name: string, specs: CustomFormatSpecification[]): CustomFormat {
  return {
    id,
    name,
    specifications: specs,
    includeWhenRenaming: false,
  } as CustomFormat
}

test.group('CustomFormatMatcher | testSpecification - contains', () => {
  test('matches when release contains the value', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'Has REMUX',
      implementation: 'contains',
      negate: false,
      required: false,
      value: 'remux',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.REMUX.1080p'))
  })

  test('does not match when release lacks the value', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'Has REMUX',
      implementation: 'contains',
      negate: false,
      required: false,
      value: 'remux',
    }
    assert.isFalse(matcher.testSpecification(spec, 'Movie.2024.BluRay.1080p'))
  })

  test('supports regex patterns', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'Has x26x codec',
      implementation: 'contains',
      negate: false,
      required: false,
      value: 'x26[45]',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.1080p.x264'))
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.1080p.x265'))
  })

  test('negation inverts the result', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'Not REMUX',
      implementation: 'contains',
      negate: true,
      required: false,
      value: 'remux',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.BluRay'))
    assert.isFalse(matcher.testSpecification(spec, 'Movie.2024.REMUX'))
  })
})

test.group('CustomFormatMatcher | testSpecification - notContains', () => {
  test('matches when release does not contain value', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'No CAM',
      implementation: 'notContains',
      negate: false,
      required: false,
      value: 'cam',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.1080p.BluRay'))
  })

  test('does not match when release contains value', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'No CAM',
      implementation: 'notContains',
      negate: false,
      required: false,
      value: 'cam',
    }
    assert.isFalse(matcher.testSpecification(spec, 'Movie.2024.CAMRip'))
  })
})

test.group('CustomFormatMatcher | testSpecification - resolution', () => {
  test('matches 2160p resolution', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: '4K',
      implementation: 'resolution',
      negate: false,
      required: false,
      value: '2160p',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.2160p.BluRay'))
  })

  test('matches 4k keyword for 2160p', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: '4K',
      implementation: 'resolution',
      negate: false,
      required: false,
      value: '2160p',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.4K.WEB'))
  })

  test('matches 1080p resolution', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: '1080p',
      implementation: 'resolution',
      negate: false,
      required: false,
      value: '1080p',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.1080p.BluRay'))
  })

  test('does not match wrong resolution', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: '1080p',
      implementation: 'resolution',
      negate: false,
      required: false,
      value: '1080p',
    }
    assert.isFalse(matcher.testSpecification(spec, 'Movie.2024.720p.BluRay'))
  })
})

test.group('CustomFormatMatcher | testSpecification - source', () => {
  test('matches bluray source', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'BluRay',
      implementation: 'source',
      negate: false,
      required: false,
      value: 'bluray',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.1080p.BluRay'))
  })

  test('matches web source', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'WEB',
      implementation: 'source',
      negate: false,
      required: false,
      value: 'web',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.1080p.WEB-DL'))
  })

  test('matches AMZN as web source', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'WEB',
      implementation: 'source',
      negate: false,
      required: false,
      value: 'web',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.1080p.AMZN.WEBRip'))
  })

  test('matches remux source', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'Remux',
      implementation: 'source',
      negate: false,
      required: false,
      value: 'remux',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.1080p.REMUX'))
  })
})

test.group('CustomFormatMatcher | testSpecification - codec', () => {
  test('matches x264 codec', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'x264',
      implementation: 'codec',
      negate: false,
      required: false,
      value: 'x264',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.1080p.x264'))
  })

  test('matches H.264 as x264', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'x264',
      implementation: 'codec',
      negate: false,
      required: false,
      value: 'x264',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.1080p.H.264'))
  })

  test('matches AV1 codec', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'AV1',
      implementation: 'codec',
      negate: false,
      required: false,
      value: 'av1',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.1080p.AV1'))
  })
})

test.group('CustomFormatMatcher | testSpecification - releaseGroup', () => {
  test('matches release group at end of title', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'Group',
      implementation: 'releaseGroup',
      negate: false,
      required: false,
      value: 'SPARKS',
    }
    assert.isTrue(matcher.testSpecification(spec, 'Movie.2024.1080p.BluRay-SPARKS'))
  })

  test('does not match release group in the middle', ({ assert }) => {
    const spec: CustomFormatSpecification = {
      name: 'Group',
      implementation: 'releaseGroup',
      negate: false,
      required: false,
      value: 'SPARKS',
    }
    assert.isFalse(matcher.testSpecification(spec, 'SPARKS-Movie.2024.1080p'))
  })
})

test.group('CustomFormatMatcher | matchesFormat', () => {
  test('matches when all required specs pass', ({ assert }) => {
    const format = createFormat('1', 'BluRay 1080p', [
      { name: 'Source', implementation: 'source', negate: false, required: true, value: 'bluray' },
      { name: 'Res', implementation: 'resolution', negate: false, required: true, value: '1080p' },
    ])
    assert.isTrue(matcher.matchesFormat(format, 'Movie.1080p.BluRay.x264'))
  })

  test('does not match when a required spec fails', ({ assert }) => {
    const format = createFormat('1', 'BluRay 1080p', [
      { name: 'Source', implementation: 'source', negate: false, required: true, value: 'bluray' },
      { name: 'Res', implementation: 'resolution', negate: false, required: true, value: '2160p' },
    ])
    assert.isFalse(matcher.matchesFormat(format, 'Movie.1080p.BluRay.x264'))
  })

  test('matches when at least one optional spec passes', ({ assert }) => {
    const format = createFormat('1', 'Good Codecs', [
      { name: 'x264', implementation: 'codec', negate: false, required: false, value: 'x264' },
      { name: 'x265', implementation: 'codec', negate: false, required: false, value: 'x265' },
    ])
    assert.isTrue(matcher.matchesFormat(format, 'Movie.1080p.x264'))
  })

  test('does not match when no optional specs pass', ({ assert }) => {
    const format = createFormat('1', 'Good Codecs', [
      { name: 'x264', implementation: 'codec', negate: false, required: false, value: 'x264' },
      { name: 'x265', implementation: 'codec', negate: false, required: false, value: 'x265' },
    ])
    assert.isFalse(matcher.matchesFormat(format, 'Movie.1080p.XviD'))
  })

  test('matches with mix of required and optional', ({ assert }) => {
    const format = createFormat('1', 'BluRay Good Codec', [
      { name: 'Source', implementation: 'source', negate: false, required: true, value: 'bluray' },
      { name: 'x264', implementation: 'codec', negate: false, required: false, value: 'x264' },
      { name: 'x265', implementation: 'codec', negate: false, required: false, value: 'x265' },
    ])
    assert.isTrue(matcher.matchesFormat(format, 'Movie.BluRay.x265'))
    assert.isFalse(matcher.matchesFormat(format, 'Movie.WEB.x265'))
  })

  test('returns false for empty specifications', ({ assert }) => {
    const format = createFormat('1', 'Empty', [])
    assert.isFalse(matcher.matchesFormat(format, 'Movie.1080p'))
  })
})

test.group('CustomFormatMatcher | scoreReleaseWithFormats', () => {
  test('accumulates scores from matching formats', ({ assert }) => {
    const formats = [
      {
        format: createFormat('1', 'x265', [
          { name: 'x265', implementation: 'codec', negate: false, required: true, value: 'x265' },
        ]),
        score: 10,
      },
      {
        format: createFormat('2', '1080p', [
          {
            name: '1080p',
            implementation: 'resolution',
            negate: false,
            required: true,
            value: '1080p',
          },
        ]),
        score: 5,
      },
    ]
    const result = matcher.scoreReleaseWithFormats('Movie.1080p.x265', formats)
    assert.equal(result.totalScore, 15)
    assert.equal(result.matches.length, 2)
  })

  test('does not include non-matching formats', ({ assert }) => {
    const formats = [
      {
        format: createFormat('1', 'x265', [
          { name: 'x265', implementation: 'codec', negate: false, required: true, value: 'x265' },
        ]),
        score: 10,
      },
    ]
    const result = matcher.scoreReleaseWithFormats('Movie.1080p.x264', formats)
    assert.equal(result.totalScore, 0)
    assert.isEmpty(result.matches)
  })

  test('rejects when total score is below -100', ({ assert }) => {
    const formats = [
      {
        format: createFormat('1', 'Bad CAM', [
          { name: 'CAM', implementation: 'source', negate: false, required: true, value: 'cam' },
        ]),
        score: -200,
      },
    ]
    const result = matcher.scoreReleaseWithFormats('Movie.CAM', formats)
    assert.isTrue(result.rejected)
    assert.equal(result.totalScore, -200)
  })

  test('does not reject when total score is above -100', ({ assert }) => {
    const formats = [
      {
        format: createFormat('1', 'Minor Penalty', [
          { name: 'XviD', implementation: 'codec', negate: false, required: true, value: 'xvid' },
        ]),
        score: -50,
      },
    ]
    const result = matcher.scoreReleaseWithFormats('Movie.XviD', formats)
    assert.isFalse(result.rejected)
    assert.equal(result.totalScore, -50)
  })
})
