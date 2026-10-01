import { describeGpu, describeGpuFailures, methodWarning } from './hardware-section'
import type { PlaybackSettings } from './library_catalog'

function settings(overrides: Partial<PlaybackSettings> = {}): PlaybackSettings {
  return {
    transcoding: {
      useHardwareAcceleration: false,
      hardwareAccelType: 'qsv',
      vaapiDevice: '/dev/dri/renderD128',
      useForVersions: true,
    },
    availableHardwareAccel: ['vaapi', 'qsv'],
    gpu: {
      qsv: false,
      vaapi: 'CQP',
      qsvReason: "Intel's VPL GPU runtime is missing (on Ubuntu or Debian: libmfx-gen1.2)",
      vaapiReason: null,
    },
    ...overrides,
  }
}

describe('hardware acceleration wording', () => {
  it('says why a method is missing instead of leaving it out', () => {
    const data = settings()
    expect(describeGpu(data)).toBe('VAAPI (CQP)')
    expect(describeGpuFailures(data)).toEqual([
      "Quick Sync: Intel's VPL GPU runtime is missing (on Ubuntu or Debian: libmfx-gen1.2)",
      'VAAPI: no constant-quality mode with this driver, so files come out larger (intel-media-va-driver-non-free adds it)',
    ])
  })

  it('warns when the chosen method does not work here', () => {
    expect(methodWarning(settings())).toBe(
      "Quick Sync doesn't work on this machine, so VAAPI is used instead."
    )
  })

  it('has nothing to warn about when the method works', () => {
    const data = settings({ gpu: { qsv: true, vaapi: 'ICQ' } })
    expect(methodWarning(data)).toBeNull()
    expect(describeGpu(data)).toBe('Quick Sync · VAAPI (ICQ)')
    expect(describeGpuFailures(data)).toEqual([])
  })
})
