import { test } from '@japa/runner'

// Replicate private determineQuality from DownloadImportService
function determineQuality(mediaInfo: {
  codec?: string
  bitrate?: number
  bitDepth?: number
  sampleRate?: number
}): string {
  const codec = mediaInfo.codec?.toLowerCase() || ''

  if (['flac', 'alac', 'wav', 'ape', 'wv'].some((c) => codec.includes(c))) {
    if (
      (mediaInfo.bitDepth && mediaInfo.bitDepth > 16) ||
      (mediaInfo.sampleRate && mediaInfo.sampleRate > 48000)
    ) {
      return 'Hi-Res Lossless'
    }
    return 'Lossless'
  }

  if (mediaInfo.bitrate) {
    if (mediaInfo.bitrate >= 320000) return '320kbps'
    if (mediaInfo.bitrate >= 256000) return '256kbps'
    if (mediaInfo.bitrate >= 192000) return '192kbps'
    if (mediaInfo.bitrate >= 128000) return '128kbps'
    return 'Low Quality'
  }

  return 'Unknown'
}

test.group('DownloadImportService | determineQuality - lossless codecs', () => {
  test('FLAC is Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac' }), 'Lossless')
  })

  test('ALAC is Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'alac' }), 'Lossless')
  })

  test('WAV is Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'wav' }), 'Lossless')
  })

  test('APE is Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'ape' }), 'Lossless')
  })

  test('WavPack (wv) is Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'wv' }), 'Lossless')
  })

  test('mixed case FLAC is Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'FLAC' }), 'Lossless')
  })
})

test.group('DownloadImportService | determineQuality - hi-res lossless', () => {
  test('FLAC with 24-bit depth is Hi-Res Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', bitDepth: 24 }), 'Hi-Res Lossless')
  })

  test('FLAC with 32-bit depth is Hi-Res Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', bitDepth: 32 }), 'Hi-Res Lossless')
  })

  test('FLAC with 96kHz sample rate is Hi-Res Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', sampleRate: 96000 }), 'Hi-Res Lossless')
  })

  test('FLAC with 192kHz sample rate is Hi-Res Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', sampleRate: 192000 }), 'Hi-Res Lossless')
  })

  test('FLAC with 16-bit depth is standard Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', bitDepth: 16 }), 'Lossless')
  })

  test('FLAC with 44100Hz sample rate is standard Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', sampleRate: 44100 }), 'Lossless')
  })

  test('FLAC with 48000Hz sample rate is standard Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', sampleRate: 48000 }), 'Lossless')
  })

  test('ALAC with 24-bit and 96kHz is Hi-Res Lossless', ({ assert }) => {
    assert.equal(
      determineQuality({ codec: 'alac', bitDepth: 24, sampleRate: 96000 }),
      'Hi-Res Lossless'
    )
  })
})

test.group('DownloadImportService | determineQuality - bitrate tiers', () => {
  test('320kbps bitrate returns 320kbps', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 320000 }), '320kbps')
  })

  test('above 320kbps returns 320kbps', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'aac', bitrate: 350000 }), '320kbps')
  })

  test('256kbps bitrate returns 256kbps', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 256000 }), '256kbps')
  })

  test('192kbps bitrate returns 192kbps', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 192000 }), '192kbps')
  })

  test('128kbps bitrate returns 128kbps', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 128000 }), '128kbps')
  })

  test('below 128kbps returns Low Quality', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 96000 }), 'Low Quality')
  })

  test('very low bitrate returns Low Quality', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 32000 }), 'Low Quality')
  })
})

test.group('DownloadImportService | determineQuality - edge cases', () => {
  test('no codec and no bitrate returns Unknown', ({ assert }) => {
    assert.equal(determineQuality({}), 'Unknown')
  })

  test('undefined codec and no bitrate returns Unknown', ({ assert }) => {
    assert.equal(determineQuality({ codec: undefined }), 'Unknown')
  })

  test('non-lossless codec without bitrate returns Unknown', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3' }), 'Unknown')
  })

  test('lossless codec takes priority over bitrate', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', bitrate: 128000 }), 'Lossless')
  })
})
