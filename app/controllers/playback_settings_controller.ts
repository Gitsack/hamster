import type { HttpContext } from '@adonisjs/core/http'
import AppSetting from '#models/app_setting'
import {
  updateTranscodingSettings,
  getTranscodingSettings,
  type TranscodingSettings,
} from '#services/media/video_transcoding_service'
import { execSync } from 'node:child_process'

interface PlaybackSettings {
  transcoding: TranscodingSettings
  availableHardwareAccel: string[]
}

export default class PlaybackSettingsController {
  /**
   * Get playback settings
   */
  async index({ response }: HttpContext) {
    // Load settings from database
    const storedSettings = await AppSetting.get<Partial<TranscodingSettings>>('transcodingSettings')

    // Apply stored settings if they exist
    if (storedSettings) {
      updateTranscodingSettings(storedSettings)
    }

    // Detect available hardware acceleration
    const availableHardwareAccel = await this.detectAvailableHwAccel()

    const settings: PlaybackSettings = {
      transcoding: getTranscodingSettings(),
      availableHardwareAccel,
    }

    return response.json(settings)
  }

  /**
   * Update playback settings
   */
  async update({ request, response }: HttpContext) {
    const { transcoding } = request.only(['transcoding'])

    if (transcoding) {
      // Validate hardware accel type
      const validTypes = ['auto', 'videotoolbox', 'cuda', 'qsv', 'vaapi', 'none']
      if (transcoding.hardwareAccelType && !validTypes.includes(transcoding.hardwareAccelType)) {
        return response.badRequest({ error: 'Invalid hardware acceleration type' })
      }

      // Update in-memory settings
      updateTranscodingSettings(transcoding)

      // Persist to database
      await AppSetting.set('transcodingSettings', getTranscodingSettings())
    }

    const availableHardwareAccel = await this.detectAvailableHwAccel()

    return response.json({
      transcoding: getTranscodingSettings(),
      availableHardwareAccel,
    })
  }

  /**
   * Detect available hardware acceleration methods
   */
  private async detectAvailableHwAccel(): Promise<string[]> {
    const available: string[] = []

    try {
      const output = execSync('ffmpeg -hide_banner -hwaccels', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const hwaccels = output.toLowerCase()

      if (hwaccels.includes('videotoolbox')) available.push('videotoolbox')
      if (hwaccels.includes('cuda')) available.push('cuda')
      if (hwaccels.includes('qsv')) available.push('qsv')
      if (hwaccels.includes('vaapi')) available.push('vaapi')
    } catch {
      // FFmpeg not available or error detecting
    }

    return available
  }
}
