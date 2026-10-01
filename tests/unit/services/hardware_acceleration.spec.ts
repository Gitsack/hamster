import { test } from '@japa/runner'
import {
  explainQsvFailure,
  explainVaapiFailure,
} from '../../../app/services/media/hardware_acceleration_service.js'

// What Ubuntu 24.04's ffmpeg prints when the Intel VPL GPU runtime is missing
const NO_RUNTIME = [
  'Device creation failed: -1313558101.',
  "Failed to set value 'qsv=qs@va' for option 'init_hw_device': Unknown error occurred",
  'Error parsing global options: Unknown error occurred',
].join('\n')

test.group('hardware acceleration | explaining failed test encodes', () => {
  test('a QSV device that cannot be created beside working VAAPI is the missing runtime', ({
    assert,
  }) => {
    assert.include(explainQsvFailure(NO_RUNTIME, true), 'libmfx-gen1.2')
  })

  test('a runtime whose driver lacks the rate control names the driver, not the encoder', ({
    assert,
  }) => {
    const stderr = [
      '[hevc_qsv @ 0x1] Selected ratecontrol mode is unsupported',
      '[hevc_qsv @ 0x1] some encoding parameters are not supported by the QSV runtime.',
      '[vost#0:0/hevc_qsv @ 0x2] Error while opening encoder',
    ].join('\n')
    const reason = explainQsvFailure(stderr, true)
    assert.include(reason, 'intel-media-va-driver-non-free')
    assert.notInclude(reason, 'built without')
  })

  test('without VAAPI the GPU itself is the problem, not the runtime', ({ assert }) => {
    assert.notInclude(explainQsvFailure(NO_RUNTIME, false), 'libmfx-gen1.2')
  })

  test('an ffmpeg without the encoder says so', ({ assert }) => {
    assert.include(explainQsvFailure("Unknown encoder 'hevc_qsv'", true), 'built without')
    assert.include(
      explainVaapiFailure("Unknown encoder 'hevc_vaapi'", '/dev/dri/x'),
      'built without'
    )
  })

  test('VAAPI permission and driver problems are named', ({ assert }) => {
    assert.include(
      explainVaapiFailure('Permission denied', '/dev/dri/renderD128'),
      'no permission to open /dev/dri/renderD128'
    )
    assert.include(explainVaapiFailure('vaInitialize failed with error code -1', '/x'), 'driver')
  })

  test('anything else falls back to ffmpeg’s last line', ({ assert }) => {
    assert.equal(explainVaapiFailure('first\nthe actual error\n', '/x'), 'the actual error')
  })
})
