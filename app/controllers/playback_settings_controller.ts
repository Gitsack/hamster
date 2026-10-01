import fs from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import {
  hardwareAccelerationService,
  ENCODER_PRESETS,
  HARDWARE_ACCEL_TYPES,
  type HardwareAccelerationSettings,
} from '#services/media/hardware_acceleration_service'

/**
 * Settings → Media → Hardware acceleration: the one GPU setting that playback
 * and versions share. Kept at /settings/playback, where it started.
 */
export default class PlaybackSettingsController {
  async index({ response }: HttpContext) {
    return response.json(await this.describe(await hardwareAccelerationService.get()))
  }

  async update({ request, response }: HttpContext) {
    const { transcoding } = request.only(['transcoding'])
    if (!transcoding || typeof transcoding !== 'object') {
      return response.badRequest({ error: 'transcoding is required' })
    }

    const patch: Partial<HardwareAccelerationSettings> = {}
    if (transcoding.hardwareAccelType !== undefined) {
      if (!HARDWARE_ACCEL_TYPES.includes(transcoding.hardwareAccelType)) {
        return response.badRequest({ error: 'Invalid hardware acceleration type' })
      }
      patch.hardwareAccelType = transcoding.hardwareAccelType
    }
    if (transcoding.vaapiDevice !== undefined) {
      const device = String(transcoding.vaapiDevice).trim()
      if (!/^\/dev\/\S+$/.test(device)) {
        return response.badRequest({ error: 'The device must be a path under /dev' })
      }
      patch.vaapiDevice = device
    }
    if (transcoding.encoderPreset !== undefined) {
      if (!ENCODER_PRESETS.includes(transcoding.encoderPreset)) {
        return response.badRequest({ error: 'Invalid encoder preset' })
      }
      patch.encoderPreset = transcoding.encoderPreset
    }
    for (const key of ['useHardwareAcceleration', 'useForVersions'] as const) {
      if (transcoding[key] !== undefined) {
        if (typeof transcoding[key] !== 'boolean') {
          return response.badRequest({ error: `${key} must be a boolean` })
        }
        patch[key] = transcoding[key]
      }
    }

    return response.json(await this.describe(await hardwareAccelerationService.set(patch)))
  }

  /** Run the GPU test encodes again, e.g. after installing a runtime. */
  async retest({ response }: HttpContext) {
    hardwareAccelerationService.retest()
    return response.json(await this.describe(await hardwareAccelerationService.get()))
  }

  private async describe(settings: HardwareAccelerationSettings) {
    const gpu = await hardwareAccelerationService.capabilities(settings.vaapiDevice)
    return {
      transcoding: settings,
      availableHardwareAccel: gpu.hwaccels,
      // What passed a test encode, as opposed to what ffmpeg lists
      gpu: {
        qsv: gpu.qsv,
        vaapi: gpu.vaapi,
        qsvReason: gpu.qsvReason,
        vaapiReason: gpu.vaapiReason,
      },
      devices: await renderNodes(),
    }
  }
}

/** The GPU render nodes this process can see, e.g. /dev/dri/renderD128. */
async function renderNodes(): Promise<string[]> {
  try {
    const entries = await fs.readdir('/dev/dri')
    return entries
      .filter((name) => name.startsWith('renderD'))
      .sort()
      .map((name) => `/dev/dri/${name}`)
  } catch {
    return []
  }
}
