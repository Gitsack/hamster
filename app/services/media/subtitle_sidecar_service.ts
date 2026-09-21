import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import logger from '@adonisjs/core/services/logger'
import AppSetting from '#models/app_setting'
import {
  checkFfmpegAvailable,
  getSubtitleExtractArgs,
  planSubtitleSidecars,
  probeFile,
  type MediaAnalysis,
  type SubtitleSidecar,
} from '#utils/ffmpeg_utils'

export const SUBTITLE_EXTRACTION_SETTING_KEY = 'subtitleExtraction'

export interface SubtitleExtractionOptions {
  enabled: boolean
}

/**
 * On by default, unlike pruning: this only ever adds files next to the video
 * and never touches the video itself, so there is nothing to undo beyond
 * deleting what it wrote.
 */
export const defaultSubtitleExtractionOptions: SubtitleExtractionOptions = {
  enabled: true,
}

export interface SubtitleExtractionResult {
  /** File names written into the video's directory, if any. */
  extracted: string[]
  /** Sidecars that were already on disk and left alone. */
  skipped: number
  /** Why it did or did not do anything — this is what ends up in the log. */
  reason: string
}

/**
 * Writes a video's embedded text subtitles out as sidecar files.
 *
 * A media server that finds `Episode.en.srt` beside `Episode.mkv` reads a few
 * kilobytes when someone turns subtitles on. Without it, the server demuxes the
 * track out of the container on first play instead — and because subtitle
 * packets are spread through the whole file, that means reading every byte of
 * it. On a NAS share at 50 MB/s a 6 GB episode takes two minutes, and the first
 * play of every new file stalls for exactly that long while it happens. Doing
 * the same read once at import, unattended, costs the same bytes and nobody
 * waits for it.
 *
 * Everything here is best-effort: a failure leaves the video untouched and the
 * import stands, because a missing sidecar is a slow first play, not a broken
 * library.
 */
export class SubtitleSidecarService {
  async getOptions(): Promise<SubtitleExtractionOptions> {
    const stored = await AppSetting.get<Partial<SubtitleExtractionOptions>>(
      SUBTITLE_EXTRACTION_SETTING_KEY
    )
    return { ...defaultSubtitleExtractionOptions, ...stored }
  }

  /**
   * Write sidecars for `videoPath`. Returns what happened; never throws.
   *
   * Pass `analysis` when the caller has already probed the file — an importer
   * always has — to save a round trip to the file.
   */
  async extract(
    videoPath: string,
    options: { analysis?: MediaAnalysis; ignoreSetting?: boolean } = {}
  ): Promise<SubtitleExtractionResult> {
    if (!options.ignoreSetting) {
      const settings = await this.getOptions()
      if (!settings.enabled) {
        return { extracted: [], skipped: 0, reason: 'subtitle extraction disabled' }
      }
    }

    const { ffmpeg, ffprobe } = await checkFfmpegAvailable()
    if (!ffmpeg || !ffprobe) {
      return { extracted: [], skipped: 0, reason: 'ffmpeg/ffprobe not available' }
    }

    let analysis = options.analysis
    if (!analysis) {
      try {
        analysis = await probeFile(videoPath)
      } catch (error) {
        return { extracted: [], skipped: 0, reason: `probe failed: ${describeError(error)}` }
      }
    }

    const directory = path.dirname(videoPath)
    const planned = planSubtitleSidecars(analysis.subtitleTracks, path.basename(videoPath))

    if (planned.length === 0) {
      return { extracted: [], skipped: 0, reason: 'no text subtitle tracks to extract' }
    }

    const missing: SubtitleSidecar[] = []
    for (const sidecar of planned) {
      if (!(await exists(path.join(directory, sidecar.fileName)))) {
        missing.push(sidecar)
      }
    }

    const skipped = planned.length - missing.length
    if (missing.length === 0) {
      return { extracted: [], skipped, reason: `all ${skipped} sidecar(s) already present` }
    }

    // Extract into a scratch directory first. ffmpeg writes each output as it
    // goes, so a run that dies partway through would otherwise leave truncated
    // subtitle files in the library that look complete to everything reading
    // them — and, worse, make the next run skip them.
    let scratch: string
    try {
      scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'hamster-subs-'))
    } catch (error) {
      return { extracted: [], skipped, reason: `no scratch dir: ${describeError(error)}` }
    }

    try {
      await runFfmpeg(getSubtitleExtractArgs(videoPath, missing, scratch))
    } catch (error) {
      await discard(scratch)
      return { extracted: [], skipped, reason: `extraction failed: ${describeError(error)}` }
    }

    const extracted: string[] = []
    for (const sidecar of missing) {
      const from = path.join(scratch, sidecar.fileName)
      const to = path.join(directory, sidecar.fileName)

      try {
        // An empty output means the track held no cues worth keeping. Placing
        // it would advertise a subtitle that turns out to be blank.
        const stats = await fs.stat(from)
        if (stats.size === 0) {
          continue
        }

        // The scratch dir is on the system disk and the library usually is not,
        // so rename is not an option. These are kilobytes; a copy costs nothing.
        await fs.copyFile(from, to)
        extracted.push(sidecar.fileName)
      } catch (error) {
        logger.warn(
          `Subtitle sidecar ${sidecar.fileName} could not be placed: ${describeError(error)}`
        )
      }
    }

    await discard(scratch)

    if (extracted.length > 0) {
      logger.info(
        `Subtitle sidecars: ${path.basename(videoPath)} -> ${extracted.length} file(s)` +
          (skipped > 0 ? ` (${skipped} already present)` : '')
      )
    }

    return {
      extracted,
      skipped,
      reason: `wrote ${extracted.length} of ${missing.length} missing sidecar(s)`,
    }
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args)
    let stderr = ''

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('error', (err) => reject(new Error(err.message)))
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().slice(0, 300)}`))
    })
  })
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath)
    return true
  } catch {
    return false
  }
}

async function discard(directory: string): Promise<void> {
  try {
    await fs.rm(directory, { recursive: true, force: true })
  } catch {
    // Nothing to clean up
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const subtitleSidecarService = new SubtitleSidecarService()
