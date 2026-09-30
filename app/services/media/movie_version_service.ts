import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AppSetting from '#models/app_setting'
import Movie from '#models/movie'
import MovieFile from '#models/movie_file'
import MovieVersion from '#models/movie_version'
import VersionProfile from '#models/version_profile'
import { fileTransferService } from './file_transfer_service.js'
import { subtitlePruningService } from './subtitle_pruning_service.js'
import { analysisToMediaInfo } from '#services/quality/file_quality_service'
import { probeFile, type MediaAnalysis } from '#utils/ffmpeg_utils'
import {
  buildVersionEncodeArgs,
  parseSidecarName,
  unsupportedSourceReason,
  type SubtitleSidecarInput,
  type VaapiRateControl,
  type VersionEncoder,
} from '#utils/version_encoding'

export const MOVIE_VERSIONS_SETTING_KEY = 'movieVersions'

export interface MovieVersionOptions {
  /** Use the GPU when one is usable. Off forces x265 on the CPU. */
  hardwareEncoding: boolean
}

const DEFAULT_OPTIONS: MovieVersionOptions = { hardwareEncoding: true }

/** Where import-time hardlinks go, beside the download they came from. */
export const STAGING_DIR_NAME = '.hamster-versions'

const POLL_INTERVAL = 30 * 1000
const HEARTBEAT_INTERVAL = 30 * 1000
/** An `encoding` row whose heartbeat is older than this lost its process. */
const STALE_AFTER_SECONDS = 180
/** A version must come out at least this much smaller than its source. */
const MAX_SIZE_RATIO = 0.9
const MAX_DURATION_DRIFT = 2

export interface VersionProgress {
  percent: number
  fps: number | null
  /** Seconds left at the current speed. */
  eta: number | null
}

interface RunningEncode {
  versionId: string
  proc: ChildProcess | null
  progress: VersionProgress
  cancelled: boolean
}

/**
 * Makes and manages versions: smaller copies of a movie kept beside its main
 * file, e.g. a 1080p HEVC copy to download to a phone.
 *
 * Encodes run one at a time, in the order they were queued, whichever of the
 * GPU or CPU is doing them — two at once only halves the speed of each. The
 * queue lives in `movie_versions`, so it survives a restart, and a row is
 * claimed with a conditional update before anything reads it: `npm run dev`
 * and the container share a database, and without the claim both would
 * encode the same film.
 *
 * At import the download is hardlinked beside itself on the local disk before
 * the original moves to the library. The link costs no space and no time, and
 * lets the encoder read the local copy instead of pulling tens of gigabytes
 * back off a NAS; only the finished, much smaller version crosses the network.
 */
export class MovieVersionService {
  private timer: NodeJS.Timeout | null = null
  private draining = false
  private current: RunningEncode | null = null
  private encoderProbe: Promise<VaapiRateControl | null> | null = null

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.kick(), POLL_INTERVAL)
    this.kick()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async getOptions(): Promise<MovieVersionOptions> {
    const stored = await AppSetting.get<Partial<MovieVersionOptions>>(MOVIE_VERSIONS_SETTING_KEY)
    return { ...DEFAULT_OPTIONS, ...stored }
  }

  async setOptions(options: MovieVersionOptions): Promise<void> {
    await AppSetting.set(MOVIE_VERSIONS_SETTING_KEY, options)
  }

  get vaapiDevice(): string {
    return process.env.VAAPI_DEVICE || '/dev/dri/renderD128'
  }

  /**
   * Whether the GPU can encode HEVC here, and with which rate control. Probed
   * once, with a one-second test encode per mode: the device node existing
   * says nothing about whether the driver inside this container can use it,
   * and older drivers turn down ICQ.
   */
  hardwareAvailable(): Promise<boolean> {
    return this.probeHardware().then((mode) => mode !== null)
  }

  private probeHardware(): Promise<VaapiRateControl | null> {
    this.encoderProbe ??= (async () => {
      try {
        await fs.access(this.vaapiDevice)
      } catch {
        return null
      }
      let lastError: unknown = null
      for (const mode of ['ICQ', 'CQP'] as const) {
        try {
          await runFfmpeg([
            '-hide_banner',
            '-nostdin',
            '-loglevel',
            'error',
            '-init_hw_device',
            `vaapi=va:${this.vaapiDevice}`,
            '-filter_hw_device',
            'va',
            '-f',
            'lavfi',
            '-i',
            'testsrc2=s=640x360:d=1',
            '-vf',
            'format=nv12,hwupload',
            '-c:v',
            'hevc_vaapi',
            ...(mode === 'ICQ'
              ? ['-rc_mode', 'ICQ', '-global_quality', '23']
              : ['-rc_mode', 'CQP', '-qp', '25']),
            '-f',
            'hevc',
            'pipe:1',
          ])
          logger.info(`Movie versions: GPU encoding available on ${this.vaapiDevice} (${mode})`)
          return mode
        } catch (error) {
          lastError = error
        }
      }
      logger.info(`Movie versions: no GPU encoding (${describeError(lastError)}), using x265`)
      return null
    })()
    return this.encoderProbe
  }

  /** Encoders to try, best first. A later one runs only if the one before fails. */
  private async encoderChain(): Promise<VersionEncoder[]> {
    const { hardwareEncoding } = await this.getOptions()
    if (hardwareEncoding && (await this.hardwareAvailable())) {
      return ['vaapi', 'vaapi-upload', 'x265']
    }
    return ['x265']
  }

  async encoderSummary(): Promise<{ hardwareAvailable: boolean; active: 'gpu' | 'cpu' }> {
    const hardwareAvailable = await this.hardwareAvailable()
    const { hardwareEncoding } = await this.getOptions()
    return { hardwareAvailable, active: hardwareAvailable && hardwareEncoding ? 'gpu' : 'cpu' }
  }

  getProgress(versionId: string): VersionProgress | null {
    return this.current?.versionId === versionId ? { ...this.current.progress } : null
  }

  // ---------------------------------------------------------------------------
  // Import hooks
  // ---------------------------------------------------------------------------

  /**
   * Hardlink a download that is about to be imported, when an automatic
   * profile will want to encode it. Returns the link, or null when no profile
   * is automatic or the filesystem cannot link (a network share, another
   * mount) — then the encoder reads the library copy instead.
   */
  async stageForImport(sourcePath: string, downloadPath: string): Promise<string | null> {
    // Never the reason an import fails: at worst the version reads the library copy.
    const autoProfiles = await VersionProfile.query()
      .where('auto', true)
      .count('* as total')
      .catch(() => null)
    if (!autoProfiles || Number(autoProfiles[0].$extras.total) === 0) return null

    const stagingDir = path.join(path.dirname(downloadPath), STAGING_DIR_NAME)
    const staged = path.join(
      stagingDir,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(sourcePath)}`
    )
    try {
      await fs.mkdir(stagingDir, { recursive: true })
      await fs.link(sourcePath, staged)
      return staged
    } catch (error) {
      logger.info(
        `Movie versions: could not stage ${path.basename(sourcePath)} locally (${describeError(error)}); will encode from the library`
      )
      return null
    }
  }

  /**
   * A new main file just landed for a movie. Versions made from the file it
   * replaced are stale and go; every automatic profile is queued afresh.
   */
  async onMainFileImported(movieId: string, stagedSourcePath: string | null): Promise<void> {
    try {
      await this.removeAllForMovie(movieId)

      const profiles = await VersionProfile.query().where('auto', true)
      for (const profile of profiles) {
        await this.enqueue(movieId, profile, { stagedSourcePath })
      }
    } finally {
      if (stagedSourcePath) await this.releaseStaged(stagedSourcePath)
    }
  }

  /** Drop a staged hardlink once no queued or running version needs it. */
  async releaseStaged(stagedSourcePath: string): Promise<void> {
    const pending = await MovieVersion.query()
      .where('stagedSourcePath', stagedSourcePath)
      .whereIn('status', ['queued', 'encoding'])
      .first()
    if (pending) return
    await fs.unlink(stagedSourcePath).catch(() => {})
    await fs.rmdir(path.dirname(stagedSourcePath)).catch(() => {})
  }

  // ---------------------------------------------------------------------------
  // Queue management
  // ---------------------------------------------------------------------------

  /**
   * Queue a version of a movie. An existing ready version is left alone; a
   * failed one is retried.
   */
  async enqueue(
    movieId: string,
    profile: VersionProfile,
    options: { stagedSourcePath?: string | null } = {}
  ): Promise<{ version: MovieVersion; queued: boolean; reason?: string }> {
    const mainFile = await MovieFile.query().where('movieId', movieId).first()
    const existing = await MovieVersion.query()
      .where('movieId', movieId)
      .where('label', profile.label)
      .first()

    if (!mainFile) {
      throw new Error('Movie has no file to make a version of')
    }
    if (mainFile.versionLabel) {
      throw new Error(`The file is already the ${mainFile.versionLabel} version`)
    }

    if (existing && existing.status !== 'failed') {
      return { version: existing, queued: false, reason: `already ${existing.status}` }
    }

    const version = existing ?? new MovieVersion()
    version.merge({
      movieId,
      profileId: profile.id,
      label: profile.label,
      status: 'queued',
      error: null,
      relativePath: null,
      sizeBytes: null,
      mediaInfo: null,
      encoder: null,
      heartbeatAt: null,
      completedAt: null,
      stagedSourcePath: options.stagedSourcePath ?? null,
    })
    // A retry goes to the back of the queue like anything else.
    version.createdAt = DateTime.now()
    await version.save()
    this.kick()
    return { version, queued: true }
  }

  /**
   * Queue `profile` for every movie with a file and no version from it.
   */
  async backfill(profile: VersionProfile): Promise<number> {
    const movieIds = await db
      .from('movie_files')
      .whereNull('version_label')
      .whereNotExists((query) => {
        query
          .from('movie_versions')
          .whereColumn('movie_versions.movie_id', 'movie_files.movie_id')
          .where('movie_versions.label', profile.label)
          .whereNot('movie_versions.status', 'failed')
      })
      .distinct('movie_id')

    let queued = 0
    for (const row of movieIds) {
      const result = await this.enqueue(row.movie_id, profile).catch(() => null)
      if (result?.queued) queued++
    }
    return queued
  }

  /**
   * Delete a version: stop it if it is encoding, remove its file, drop the row.
   */
  async remove(version: MovieVersion): Promise<void> {
    if (this.current?.versionId === version.id) {
      this.current.cancelled = true
      this.current.proc?.kill('SIGKILL')
    }

    if (version.relativePath) {
      const movie = await Movie.query().where('id', version.movieId).preload('rootFolder').first()
      if (movie?.rootFolder) {
        await fs.unlink(path.join(movie.rootFolder.path, version.relativePath)).catch(() => {})
      }
    }

    const staged = version.stagedSourcePath
    await MovieVersion.query().where('id', version.id).delete()
    if (staged) await this.releaseStaged(staged)
  }

  /** Delete every version of a movie, e.g. because its main file is going. */
  async removeAllForMovie(movieId: string): Promise<void> {
    const versions = await MovieVersion.query().where('movieId', movieId)
    for (const version of versions) {
      await this.remove(version)
    }
  }

  /**
   * Make a ready version the movie's only file: the original is deleted and
   * the version takes its name, so the library, Jellyfin and any sidecar
   * subtitles all keep pointing at the right thing.
   */
  async promote(version: MovieVersion): Promise<MovieFile> {
    if (version.status !== 'ready' || !version.relativePath) {
      throw new Error('Only a finished version can replace the original')
    }

    const movie = await Movie.query()
      .where('id', version.movieId)
      .preload('rootFolder')
      .preload('movieFile')
      .firstOrFail()
    const mainFile = movie.movieFile
    if (!mainFile || !movie.rootFolder) {
      throw new Error('Movie has no file')
    }

    // Another version still reading the original from the library would lose
    // its source halfway through.
    const busy = await MovieVersion.query()
      .where('movieId', movie.id)
      .whereNot('id', version.id)
      .whereIn('status', ['queued', 'encoding'])
      .whereNull('stagedSourcePath')
      .first()
    if (busy) {
      throw new Error(`Wait for the ${busy.label} version to finish first`)
    }

    const root = movie.rootFolder.path
    const originalPath = path.join(root, mainFile.relativePath)
    const versionPath = path.join(root, version.relativePath)
    const promotedRelative = mainFile.relativePath.replace(/\.[^./]+$/, '') + '.mkv'
    const promotedPath = path.join(root, promotedRelative)

    await fs.access(versionPath)
    await fs.unlink(originalPath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error
    })
    await fs.rename(versionPath, promotedPath)

    const stats = await fs.stat(promotedPath)
    mainFile.merge({
      relativePath: promotedRelative,
      sizeBytes: stats.size,
      mediaInfo: version.mediaInfo,
      quality:
        resolutionLabel(version.mediaInfo?.width, version.mediaInfo?.height) ?? mainFile.quality,
      versionLabel: version.label,
    })
    await mainFile.save()
    await MovieVersion.query().where('id', version.id).delete()

    logger.info(`Movie versions: ${movie.title} now keeps only its ${version.label} version`)
    return mainFile
  }

  // ---------------------------------------------------------------------------
  // Worker
  // ---------------------------------------------------------------------------

  kick(): void {
    if (this.draining) return
    this.draining = true
    this.drain()
      .catch((error) => logger.error({ err: error }, 'Movie versions: queue failed'))
      .finally(() => {
        this.draining = false
      })
  }

  private async drain(): Promise<void> {
    await this.requeueStale()
    while (true) {
      const version = await this.claimNext()
      if (!version) return
      await this.process(version)
    }
  }

  /** Put back rows whose encoding process died without finishing. */
  private async requeueStale(): Promise<void> {
    await db.rawQuery(
      `UPDATE movie_versions SET status = 'queued', heartbeat_at = NULL, updated_at = now()
       WHERE status = 'encoding'
         AND (heartbeat_at IS NULL OR heartbeat_at < now() - make_interval(secs => ?))`,
      [STALE_AFTER_SECONDS]
    )
  }

  private async claimNext(): Promise<MovieVersion | null> {
    const result = await db.rawQuery(
      `UPDATE movie_versions SET status = 'encoding', heartbeat_at = now(), updated_at = now()
       WHERE id = (
         SELECT id FROM movie_versions WHERE status = 'queued'
         ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
       )
       RETURNING id`
    )
    const id = result.rows?.[0]?.id
    return id ? MovieVersion.find(id) : null
  }

  private async process(version: MovieVersion): Promise<void> {
    const running: RunningEncode = {
      versionId: version.id,
      proc: null,
      progress: { percent: 0, fps: null, eta: null },
      cancelled: false,
    }
    this.current = running
    const heartbeat = setInterval(() => {
      MovieVersion.query()
        .where('id', version.id)
        .update({ heartbeatAt: DateTime.now().toSQL() })
        .catch(() => {})
    }, HEARTBEAT_INTERVAL)

    let tempPath: string | null = null
    try {
      const result = await this.encode(version, running, (p) => (tempPath = p))
      if (running.cancelled) return
      version.merge({
        status: 'ready',
        relativePath: result.relativePath,
        sizeBytes: result.sizeBytes,
        mediaInfo: analysisToMediaInfo(result.analysis),
        encoder: result.encoder,
        error: null,
        completedAt: DateTime.now(),
        heartbeatAt: null,
      })
      await version.save()
      logger.info(
        `Movie versions: ${result.relativePath} ready (${formatGb(result.sizeBytes)}, ${result.encoder})`
      )
    } catch (error) {
      if (running.cancelled) return
      logger.warn(
        `Movie versions: ${version.label} for ${version.movieId} failed: ${describeError(error)}`
      )
      await MovieVersion.query()
        .where('id', version.id)
        .update({ status: 'failed', error: describeError(error), heartbeatAt: null })
        .catch(() => {})
    } finally {
      clearInterval(heartbeat)
      this.current = null
      if (tempPath) await fs.unlink(tempPath).catch(() => {})
      const staged = version.stagedSourcePath
      if (staged) {
        // The staged link has done its job either way; a retry reads the library copy.
        await MovieVersion.query()
          .where('id', version.id)
          .update({ stagedSourcePath: null })
          .catch(() => {})
        await this.releaseStaged(staged)
      }
    }
  }

  private async encode(
    version: MovieVersion,
    running: RunningEncode,
    onTempPath: (tempPath: string) => void
  ): Promise<{
    relativePath: string
    sizeBytes: number
    analysis: MediaAnalysis
    encoder: VersionEncoder
  }> {
    const movie = await Movie.query()
      .where('id', version.movieId)
      .preload('rootFolder')
      .preload('movieFile')
      .first()
    if (!movie?.movieFile || !movie.rootFolder) {
      throw new Error('Movie has no file')
    }
    if (movie.movieFile.versionLabel) {
      throw new Error(`The file is already the ${movie.movieFile.versionLabel} version`)
    }
    const profile = version.profileId ? await VersionProfile.find(version.profileId) : null
    if (!profile) {
      throw new Error('Its profile was deleted')
    }

    const libraryPath = path.join(movie.rootFolder.path, movie.movieFile.relativePath)
    const staged = version.stagedSourcePath && (await exists(version.stagedSourcePath))
    const sourcePath = staged ? version.stagedSourcePath! : libraryPath

    const analysis = await probeFile(sourcePath)
    const unsupported = unsupportedSourceReason(analysis)
    if (unsupported) throw new Error(unsupported)

    const relativePath = versionRelativePath(movie.movieFile.relativePath, profile.label)

    // Write next to the staged source when there is one — the same local
    // disk — and into the app's tmp folder otherwise. Never straight into the
    // library: a half-written file there is a version Jellyfin would list.
    const workDir = staged ? path.dirname(sourcePath) : app.makePath('tmp', 'versions')
    await fs.mkdir(workDir, { recursive: true })
    const tempPath = path.join(workDir, `${version.id}.mkv`)
    onTempPath(tempPath)

    const subtitleIndices = profile.subtitles
      ? await subtitlePruningService.tracksToKeep(analysis)
      : []
    // Text tracks the import moved out into sidecar files are only beside the
    // library copy; a staged download still has them embedded.
    const sidecars = profile.subtitles && !staged ? await findSidecars(libraryPath) : []

    let lastError: unknown = null
    for (const encoder of await this.encoderChain()) {
      if (running.cancelled) throw new Error('cancelled')
      try {
        await version.merge({ encoder }).save()
        await this.runEncode(
          buildVersionEncodeArgs({
            sourcePath,
            outputPath: tempPath,
            analysis,
            profile,
            encoder,
            subtitleIndices,
            sidecars,
            vaapiDevice: this.vaapiDevice,
            vaapiRateControl: (await this.probeHardware()) ?? undefined,
          }),
          analysis.duration,
          running
        )
        lastError = null

        const result = await probeFile(tempPath)
        const problem = await verifyVersion(sourcePath, tempPath, analysis, result)
        if (problem) throw problem

        const destination = path.join(movie.rootFolder.path, relativePath)
        await fileTransferService.move(tempPath, destination)
        const stats = await fs.stat(destination)
        return { relativePath, sizeBytes: stats.size, analysis: result, encoder }
      } catch (error) {
        if (running.cancelled) throw error
        lastError = error
        // A result that fails verification will not get better on another
        // encoder, except when the failure was the encoder itself.
        if (error instanceof VerificationError) throw error
        logger.info(`Movie versions: ${encoder} failed for ${movie.title}: ${describeError(error)}`)
        await fs.unlink(tempPath).catch(() => {})
      }
    }
    throw lastError ?? new Error('No encoder available')
  }

  private runEncode(args: string[], duration: number, running: RunningEncode): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, {
        env: { ...process.env, LIBVA_MESSAGING_LEVEL: '0' },
      })
      running.proc = proc
      running.progress = { percent: 0, fps: null, eta: null }
      // Below the web server and the importers: an encode can take hours and
      // should never be why a page is slow.
      if (proc.pid) {
        try {
          os.setPriority(proc.pid, 15)
        } catch {
          // Not permitted here; run at normal priority.
        }
      }

      let stderr = ''
      let buffer = ''
      proc.stdout.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const [key, value] = line.split('=')
          if (key === 'out_time_us' && duration > 0) {
            const seconds = Number(value) / 1e6
            if (Number.isFinite(seconds) && seconds >= 0) {
              running.progress.percent = Math.min(99.9, (seconds / duration) * 100)
            }
          } else if (key === 'fps') {
            running.progress.fps = Number(value) || null
          } else if (key === 'speed') {
            const speed = Number.parseFloat(value)
            const done = (running.progress.percent / 100) * duration
            running.progress.eta = speed > 0 ? Math.round((duration - done) / speed) : null
          }
        }
      })
      proc.stderr.on('data', (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-2000)
      })
      proc.on('error', (error) => reject(error))
      proc.on('close', (code) => {
        running.proc = null
        if (running.cancelled) return reject(new Error('cancelled'))
        if (code === 0) return resolve()
        // ffmpeg 6.1 (Alpine's) runs the GPU scaler out of surfaces while the
        // decoder flushes the last frames of a Dolby Vision profile 7 file,
        // and gives up with the film done bar its final second of credits.
        // ffmpeg 7 does not. The file it leaves is finalised and plays; the
        // duration check after this is what decides whether it is complete
        // enough to keep, so let it through to that check.
        if (running.progress.percent > 98 && /Error while filtering: Out of memory/.test(stderr)) {
          logger.info('Movie versions: GPU scaler ran out at the very end; checking the result')
          return resolve()
        }
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().slice(-300)}`))
      })
    })
  }
}

class VerificationError extends Error {}

/**
 * Checks before a version is allowed into the library. Returns the first
 * problem, or null when it passes.
 */
async function verifyVersion(
  sourcePath: string,
  resultPath: string,
  source: MediaAnalysis,
  result: MediaAnalysis
): Promise<VerificationError | null> {
  if (!result.videoCodec) {
    return new VerificationError('the result has no video stream')
  }
  const drift = Math.abs(result.duration - source.duration)
  if (source.duration > 0 && drift > Math.max(MAX_DURATION_DRIFT, source.duration * 0.005)) {
    return new VerificationError(
      `the result is ${drift.toFixed(1)}s shorter or longer than the source`
    )
  }
  const [sourceStats, resultStats] = await Promise.all([fs.stat(sourcePath), fs.stat(resultPath)])
  if (resultStats.size > sourceStats.size * MAX_SIZE_RATIO) {
    return new VerificationError(
      `the result (${formatGb(resultStats.size)}) is not meaningfully smaller than the original (${formatGb(sourceStats.size)})`
    )
  }
  return null
}

/**
 * `Movie (2020)/Movie (2020).mkv` → `Movie (2020)/Movie (2020) - Mobile.mkv`.
 * Jellyfin groups files in one folder as versions of the same film when each
 * name starts with the folder name, and shows the part after " - " as the
 * version's name.
 */
export function versionRelativePath(mainRelativePath: string, label: string): string {
  const dir = path.dirname(mainRelativePath)
  const base = path.basename(mainRelativePath).replace(/\.[^.]+$/, '')
  const name = `${base} - ${label}.mkv`
  return dir === '.' ? name : path.join(dir, name)
}

/**
 * Subtitle files the import wrote beside the video, as encoder inputs.
 */
async function findSidecars(videoPath: string): Promise<SubtitleSidecarInput[]> {
  const dir = path.dirname(videoPath)
  const base = path.basename(videoPath).replace(/\.[^.]+$/, '')
  try {
    const entries = await fs.readdir(dir)
    return entries
      .sort()
      .map((name) => {
        const parsed = parseSidecarName(name, base)
        return parsed ? { path: path.join(dir, name), ...parsed } : null
      })
      .filter((sidecar): sidecar is SubtitleSidecarInput => sidecar !== null)
  } catch {
    return []
  }
}

function resolutionLabel(width?: number, height?: number): string | null {
  if (!width || !height) return null
  if (width >= 3200 || height >= 1800) return '2160p'
  if (width >= 1800 || height >= 1000) return '1080p'
  if (width >= 1200 || height >= 700) return '720p'
  return '480p'
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
      stderr = (stderr + chunk.toString()).slice(-1000)
    })
    proc.on('error', (error) => reject(error))
    proc.on('close', (code) => {
      if (code === 0 && bytes > 0) return resolve()
      reject(new Error(stderr.trim().split('\n').pop() || `exit ${code}, ${bytes} bytes`))
    })
  })
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function formatGb(bytes: number): string {
  return `${(bytes / 1e9).toFixed(2)} GB`
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const movieVersionService = new MovieVersionService()
