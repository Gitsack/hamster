import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import logger from '@adonisjs/core/services/logger'
import AppSetting from '#models/app_setting'
import {
  checkFfmpegAvailable,
  defaultSubtitlePruningOptions,
  getSubtitlePruneArgs,
  probeFile,
  selectSubtitleTracksToKeep,
  type MediaAnalysis,
  type SubtitlePruningOptions,
} from '#utils/ffmpeg_utils'

export const SUBTITLE_PRUNING_SETTING_KEY = 'subtitlePruning'

/** A rewrite must not lose more than this fraction of the original bytes. */
const MIN_SIZE_RATIO = 0.5

/** Tolerated difference between source and result duration, in seconds. */
const MAX_DURATION_DRIFT = 2

export interface SubtitlePruneResult {
  /** True only when the file on disk was actually replaced. */
  pruned: boolean
  /** Why it was or was not touched — this is what ends up in the log. */
  reason: string
  tracksBefore?: number
  tracksAfter?: number
  /** Fresh probe of the rewritten file, so callers can store accurate media info. */
  analysis?: MediaAnalysis
}

/**
 * Trims a release down to the subtitle tracks worth keeping.
 *
 * Some scene releases ship thirty-odd subtitle tracks. Embedded, they cost
 * nothing; but a media server that transcodes has to offer each one separately,
 * and at least one popular client (Infuse) stops after twenty and abandons the
 * playback entirely. Direct play works, transcoding dies, and the server logs
 * look perfectly healthy throughout — nothing fails, the client simply stops
 * asking. Trimming at import is what keeps that off the library.
 *
 * Everything here is best-effort. A failure leaves the imported file exactly as
 * it was: the import has already succeeded by this point, and a subtitle policy
 * is never worth failing it over.
 */
export class SubtitlePruningService {
  async getOptions(): Promise<SubtitlePruningOptions> {
    const stored = await AppSetting.get<Partial<SubtitlePruningOptions>>(
      SUBTITLE_PRUNING_SETTING_KEY
    )
    return { ...defaultSubtitlePruningOptions, ...stored }
  }

  /**
   * Rewrite `filePath` in place, keeping only the subtitle tracks the policy
   * allows. Returns what happened; never throws.
   */
  async pruneFile(filePath: string): Promise<SubtitlePruneResult> {
    const options = await this.getOptions()
    if (!options.enabled) {
      return { pruned: false, reason: 'pruning disabled' }
    }

    const { ffmpeg, ffprobe } = await checkFfmpegAvailable()
    if (!ffmpeg || !ffprobe) {
      return { pruned: false, reason: 'ffmpeg/ffprobe not available' }
    }

    let source: MediaAnalysis
    try {
      source = await probeFile(filePath)
    } catch (error) {
      return { pruned: false, reason: `probe failed: ${describeError(error)}` }
    }

    const selection = selectSubtitleTracksToKeep(source.subtitleTracks, options)
    if (selection.unchanged) {
      return {
        pruned: false,
        reason: selection.reason,
        tracksBefore: source.subtitleTracks.length,
        tracksAfter: source.subtitleTracks.length,
        analysis: source,
      }
    }

    const extension = path.extname(filePath)
    const tempPath = `${filePath}.hamster-prune${extension || '.mkv'}`

    try {
      await runFfmpeg(getSubtitlePruneArgs(filePath, tempPath, selection.keep))
    } catch (error) {
      await discard(tempPath)
      return { pruned: false, reason: `remux failed: ${describeError(error)}` }
    }

    // Verify before replacing anything. A rewrite that silently truncated the
    // file is worse than the track count it was meant to fix.
    let rewritten: MediaAnalysis
    try {
      rewritten = await probeFile(tempPath)
    } catch (error) {
      await discard(tempPath)
      return { pruned: false, reason: `result could not be probed: ${describeError(error)}` }
    }

    const problem = await verifyRewrite(
      filePath,
      tempPath,
      source,
      rewritten,
      selection.keep.length
    )
    if (problem) {
      await discard(tempPath)
      return { pruned: false, reason: `verification failed: ${problem}` }
    }

    try {
      await fs.rename(tempPath, filePath)
    } catch (error) {
      await discard(tempPath)
      return { pruned: false, reason: `could not replace original: ${describeError(error)}` }
    }

    logger.info(
      `Subtitle prune: ${path.basename(filePath)} ${source.subtitleTracks.length} -> ${rewritten.subtitleTracks.length} track(s) (${selection.reason})`
    )

    return {
      pruned: true,
      reason: selection.reason,
      tracksBefore: source.subtitleTracks.length,
      tracksAfter: rewritten.subtitleTracks.length,
      analysis: rewritten,
    }
  }
}

/**
 * The checks that decide whether the rewritten file is allowed to replace the
 * original. Returns a description of the first failure, or null when it passes.
 */
async function verifyRewrite(
  originalPath: string,
  rewrittenPath: string,
  source: MediaAnalysis,
  rewritten: MediaAnalysis,
  expectedSubtitleCount: number
): Promise<string | null> {
  if (!rewritten.videoCodec) {
    return 'result has no video stream'
  }

  const drift = Math.abs(rewritten.duration - source.duration)
  if (source.duration > 0 && drift > MAX_DURATION_DRIFT) {
    return `duration drifted by ${drift.toFixed(1)}s`
  }

  if (rewritten.subtitleTracks.length !== expectedSubtitleCount) {
    return `expected ${expectedSubtitleCount} subtitle track(s), got ${rewritten.subtitleTracks.length}`
  }

  if (rewritten.audioTracks.length !== source.audioTracks.length) {
    return `audio track count changed (${source.audioTracks.length} -> ${rewritten.audioTracks.length})`
  }

  const [originalStats, rewrittenStats] = await Promise.all([
    fs.stat(originalPath),
    fs.stat(rewrittenPath),
  ])
  if (rewrittenStats.size < originalStats.size * MIN_SIZE_RATIO) {
    return `result is only ${Math.round((rewrittenStats.size / originalStats.size) * 100)}% of the original size`
  }

  return null
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

async function discard(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // Nothing to clean up
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const subtitlePruningService = new SubtitlePruningService()
