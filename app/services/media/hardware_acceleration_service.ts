import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import logger from '@adonisjs/core/services/logger'
import AppSetting from '#models/app_setting'
import {
  updateTranscodingSettings,
  type TranscodingSettings,
} from '#services/media/video_transcoding_service'
import type { VaapiRateControl } from '#utils/version_encoding'

/** Stored under the playback setting's original key, which it grew out of. */
const SETTING_KEY = 'transcodingSettings'
/** Where the versions' own GPU switch lived before this setting covered it. */
const LEGACY_VERSIONS_KEY = 'movieVersions'

export type HardwareAccelType = TranscodingSettings['hardwareAccelType']

export const HARDWARE_ACCEL_TYPES: HardwareAccelType[] = [
  'auto',
  'videotoolbox',
  'cuda',
  'qsv',
  'vaapi',
  'none',
]

/**
 * One GPU setting for everything Hamster encodes or decodes, the way Jellyfin
 * has one: a method and a device, and which jobs may use them.
 */
export interface HardwareAccelerationSettings {
  /** The method. `auto` picks the best one that passed a test encode here. */
  hardwareAccelType: HardwareAccelType
  /** Render node for VAAPI and Quick Sync. */
  vaapiDevice: string
  /** Decode on the GPU while streaming. Experimental, so off by default. */
  useHardwareAcceleration: boolean
  /** Encode versions on the GPU. */
  useForVersions: boolean
}

/** What actually works on this machine, from test encodes. */
export interface GpuCapabilities {
  qsv: boolean
  /** VAAPI's best rate control here, or null when VAAPI cannot encode. */
  vaapi: VaapiRateControl | null
  /** ffmpeg's own list (`-hwaccels`): what it can decode with, not proof it works. */
  hwaccels: string[]
  /** Why Quick Sync failed its test, in words someone can act on. */
  qsvReason: string | null
  /** Why VAAPI failed its test. */
  vaapiReason: string | null
}

function defaults(): HardwareAccelerationSettings {
  return {
    hardwareAccelType: 'auto',
    vaapiDevice: process.env.VAAPI_DEVICE || '/dev/dri/renderD128',
    useHardwareAcceleration: false,
    useForVersions: true,
  }
}

export class HardwareAccelerationService {
  private probe: { device: string; result: Promise<GpuCapabilities> } | null = null

  async get(): Promise<HardwareAccelerationSettings> {
    const [stored, legacy] = await Promise.all([
      AppSetting.get<Partial<HardwareAccelerationSettings>>(SETTING_KEY),
      AppSetting.get<{ hardwareEncoding?: boolean }>(LEGACY_VERSIONS_KEY),
    ])
    const settings = { ...defaults(), ...stored }
    if (stored?.useForVersions === undefined && typeof legacy?.hardwareEncoding === 'boolean') {
      settings.useForVersions = legacy.hardwareEncoding
    }
    return settings
  }

  async set(patch: Partial<HardwareAccelerationSettings>): Promise<HardwareAccelerationSettings> {
    const next = { ...(await this.get()), ...patch }
    await AppSetting.set(SETTING_KEY, next)
    this.apply(next)
    return next
  }

  /** Load the stored settings into the stream transcoder; called at boot. */
  async load(): Promise<void> {
    this.apply(await this.get())
  }

  private apply(settings: HardwareAccelerationSettings): void {
    updateTranscodingSettings({
      useHardwareAcceleration: settings.useHardwareAcceleration,
      hardwareAccelType: settings.hardwareAccelType,
      vaapiDevice: settings.vaapiDevice,
    })
  }

  /**
   * What the GPU can do on `device`: Quick Sync, and VAAPI with which rate
   * control. Probed once per device, with a one-second test encode each: the
   * device node existing says nothing about whether the driver and runtime
   * inside this container can use it. Quick Sync needs Intel's VPL GPU
   * runtime (jellyfin-ffmpeg bundles it; Ubuntu has it as libmfx-gen1.2),
   * and older VAAPI drivers turn down ICQ.
   */
  /** Forget the last test, e.g. after installing a driver or runtime. */
  retest(): void {
    this.probe = null
  }

  capabilities(device: string): Promise<GpuCapabilities> {
    if (this.probe?.device !== device) {
      this.probe = { device, result: probeGpu(device) }
    }
    return this.probe.result
  }
}

async function probeGpu(device: string): Promise<GpuCapabilities> {
  const hwaccels = await listHwaccels()
  try {
    await fs.access(device)
  } catch (error) {
    const reason =
      (error as NodeJS.ErrnoException)?.code === 'EACCES'
        ? `no permission to open ${device}`
        : `there is no GPU at ${device}; a container needs /dev/dri passed through`
    return { qsv: false, vaapi: null, hwaccels, qsvReason: reason, vaapiReason: reason }
  }

  const testInput = ['-f', 'lavfi', '-i', 'testsrc2=s=640x360:d=1']
  const testOutput = ['-f', 'hevc', 'pipe:1']
  const base = ['-hide_banner', '-nostdin', '-loglevel', 'error']
  let qsvError = ''
  let vaapiError = ''

  let qsv = false
  try {
    await runFfmpeg([
      ...base,
      '-init_hw_device',
      `vaapi=va:${device}`,
      '-init_hw_device',
      'qsv=qs@va',
      '-filter_hw_device',
      'qs',
      ...testInput,
      '-vf',
      'format=nv12,hwupload=extra_hw_frames=16',
      '-c:v',
      'hevc_qsv',
      '-global_quality',
      '25',
      '-look_ahead_depth',
      '40',
      '-extbrc',
      '1',
      ...testOutput,
    ])
    qsv = true
  } catch (error) {
    qsvError = describeError(error)
  }

  let vaapi: VaapiRateControl | null = null
  for (const mode of ['ICQ', 'CQP'] as const) {
    try {
      await runFfmpeg([
        ...base,
        '-init_hw_device',
        `vaapi=va:${device}`,
        '-filter_hw_device',
        'va',
        ...testInput,
        '-vf',
        'format=nv12,hwupload',
        '-c:v',
        'hevc_vaapi',
        ...(mode === 'ICQ'
          ? ['-rc_mode', 'ICQ', '-global_quality', '23']
          : ['-rc_mode', 'CQP', '-qp', '25']),
        ...testOutput,
      ])
      vaapi = mode
      break
    } catch (error) {
      vaapiError = describeError(error)
    }
  }

  if (qsv || vaapi) {
    logger.info(
      `Hardware acceleration: ${device}: Quick Sync ${qsv ? 'yes' : 'no'}, VAAPI ${vaapi ?? 'no'}`
    )
  } else {
    logger.info(`Hardware acceleration: no GPU encoding on ${device}`)
  }
  return {
    qsv,
    vaapi,
    hwaccels,
    qsvReason: qsv ? null : explainQsvFailure(qsvError, vaapi !== null),
    vaapiReason: vaapi ? null : explainVaapiFailure(vaapiError, device),
  }
}

/**
 * Turn ffmpeg's Quick Sync failure into the likely cause. When VAAPI works on
 * the same device, the GPU and its driver are fine, and a QSV device that
 * cannot be created means Intel's VPL GPU runtime is missing — the case on a
 * stock Ubuntu ffmpeg.
 */
export function explainQsvFailure(stderr: string, vaapiWorks: boolean): string {
  if (/Unknown encoder|Encoder not found/i.test(stderr)) {
    return 'this ffmpeg was built without Quick Sync'
  }
  if (vaapiWorks && /Device creation failed|MFX session/i.test(stderr)) {
    return "Intel's VPL GPU runtime is missing (on Ubuntu or Debian: libmfx-gen1.2)"
  }
  // The runtime is there but the driver under it cannot do HEVC at a
  // constant quality: Ubuntu's free intel-media-va-driver leaves that out.
  if (
    /ratecontrol mode is unsupported|Low power mode is unsupported|not supported by the QSV runtime/i.test(
      stderr
    )
  ) {
    return "the Intel media driver here can't encode HEVC this way (on Ubuntu or Debian: intel-media-va-driver-non-free)"
  }
  if (!vaapiWorks) return 'the GPU could not be opened (see VAAPI)'
  return lastLine(stderr) || 'the test encode failed'
}

/** Turn ffmpeg's VAAPI failure into the likely cause. */
export function explainVaapiFailure(stderr: string, device: string): string {
  if (/Permission denied/i.test(stderr)) return `no permission to open ${device}`
  if (/vaInitialize failed|Failed to initialise VAAPI|libva: .*failed/i.test(stderr)) {
    return 'no VAAPI driver for this GPU (Intel: intel-media-va-driver-non-free)'
  }
  if (/Unknown encoder|Encoder not found/i.test(stderr)) {
    return 'this ffmpeg was built without VAAPI'
  }
  return lastLine(stderr) || 'the test encode failed'
}

function lastLine(stderr: string): string {
  return (
    stderr
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .pop() ?? ''
  )
}

function listHwaccels(): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-hwaccels'])
    let out = ''
    proc.stdout.on('data', (chunk) => (out += chunk.toString()))
    proc.on('error', () => resolve([]))
    proc.on('close', () => {
      const known = ['videotoolbox', 'cuda', 'qsv', 'vaapi']
      const listed = out.toLowerCase().split(/\s+/)
      resolve(known.filter((name) => listed.includes(name)))
    })
  })
}

/**
 * Run a short ffmpeg command that writes to stdout, and fail unless it
 * produced output. Exit code 0 is not enough: with a driver that cannot encode
 * (Ubuntu's free intel-media-va-driver, for one) ffmpeg opens the encoder,
 * receives no packets, and still exits 0.
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { env: { ...process.env, LIBVA_MESSAGING_LEVEL: '0' } })
    let stderr = ''
    let bytes = 0
    proc.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length
    })
    proc.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-4000)
    })
    proc.on('error', (error) => reject(error))
    proc.on('close', (code) => {
      if (code === 0 && bytes > 0) return resolve()
      reject(new Error(stderr.trim() || `exit ${code}, ${bytes} bytes`))
    })
  })
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const hardwareAccelerationService = new HardwareAccelerationService()
