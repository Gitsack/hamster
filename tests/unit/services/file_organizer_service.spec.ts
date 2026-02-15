import { test } from '@japa/runner'
import { FileOrganizerService } from '../../../app/services/media/file_organizer_service.js'

// We test the private pure-logic method `determineQuality` by accessing it through
// the prototype. This method has no external dependencies - it's purely input-based.

function determineQuality(mediaInfo: {
  codec?: string
  bitrate?: number
  bitDepth?: number
  sampleRate?: number
}): string {
  const service = new FileOrganizerService()
  return (service as any).determineQuality(mediaInfo)
}

test.group('FileOrganizerService | determineQuality - Lossless formats', () => {
  test('FLAC is detected as Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac' }), 'Lossless')
  })

  test('ALAC is detected as Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'alac' }), 'Lossless')
  })

  test('WAV is detected as Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'wav' }), 'Lossless')
  })

  test('APE is detected as Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'ape' }), 'Lossless')
  })

  test('WavPack (wv) is detected as Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'wv' }), 'Lossless')
  })

  test('codec matching is case insensitive', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'FLAC' }), 'Lossless')
    assert.equal(determineQuality({ codec: 'Flac' }), 'Lossless')
  })
})

test.group('FileOrganizerService | determineQuality - Hi-Res Lossless', () => {
  test('FLAC with 24-bit depth is Hi-Res Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', bitDepth: 24 }), 'Hi-Res Lossless')
  })

  test('FLAC with 32-bit depth is Hi-Res Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', bitDepth: 32 }), 'Hi-Res Lossless')
  })

  test('FLAC with 16-bit depth is standard Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', bitDepth: 16 }), 'Lossless')
  })

  test('FLAC with high sample rate (96kHz) is Hi-Res Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', sampleRate: 96000 }), 'Hi-Res Lossless')
  })

  test('FLAC with 192kHz sample rate is Hi-Res Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', sampleRate: 192000 }), 'Hi-Res Lossless')
  })

  test('FLAC with standard 44100Hz sample rate is Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', sampleRate: 44100 }), 'Lossless')
  })

  test('FLAC with 48000Hz sample rate is Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'flac', sampleRate: 48000 }), 'Lossless')
  })

  test('ALAC with 24-bit depth is Hi-Res Lossless', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'alac', bitDepth: 24 }), 'Hi-Res Lossless')
  })
})

test.group('FileOrganizerService | determineQuality - Lossy bitrates', () => {
  test('320kbps bitrate', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 320000 }), '320kbps')
  })

  test('256kbps bitrate', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 256000 }), '256kbps')
  })

  test('192kbps bitrate', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'aac', bitrate: 192000 }), '192kbps')
  })

  test('128kbps bitrate', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'aac', bitrate: 128000 }), '128kbps')
  })

  test('below 128kbps is Low Quality', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 96000 }), 'Low Quality')
  })

  test('exactly at 320000 threshold', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 320000 }), '320kbps')
  })

  test('between 256000 and 320000 is 256kbps', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 280000 }), '256kbps')
  })

  test('between 192000 and 256000 is 192kbps', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 224000 }), '192kbps')
  })

  test('between 128000 and 192000 is 128kbps', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'aac', bitrate: 160000 }), '128kbps')
  })

  test('very high bitrate lossy is still 320kbps', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'mp3', bitrate: 500000 }), '320kbps')
  })
})

test.group('FileOrganizerService | determineQuality - Edge cases', () => {
  test('returns Unknown when no codec and no bitrate', ({ assert }) => {
    assert.equal(determineQuality({}), 'Unknown')
  })

  test('returns Unknown when codec is empty string', ({ assert }) => {
    assert.equal(determineQuality({ codec: '' }), 'Unknown')
  })

  test('returns Unknown for unknown codec without bitrate', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'opus' }), 'Unknown')
  })

  test('unknown codec with bitrate uses bitrate for quality', ({ assert }) => {
    assert.equal(determineQuality({ codec: 'opus', bitrate: 320000 }), '320kbps')
  })

  test('lossless codec ignores bitrate for quality classification', ({ assert }) => {
    // Even with a bitrate, FLAC is still Lossless (not a bitrate-based quality)
    assert.equal(determineQuality({ codec: 'flac', bitrate: 1000000 }), 'Lossless')
  })

  test('codec with partial match works (e.g. pcm_s16le contains wav-like)', ({ assert }) => {
    // 'wv' is checked via includes, so 'wavpack' would also match via 'wv' substring
    assert.equal(determineQuality({ codec: 'wavpack_wv' }), 'Lossless')
  })

  test('undefined codec returns Unknown', ({ assert }) => {
    assert.equal(determineQuality({ codec: undefined }), 'Unknown')
  })
})
