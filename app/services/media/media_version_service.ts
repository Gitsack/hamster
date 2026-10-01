import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AppSetting from '#models/app_setting'
import Episode from '#models/episode'
import EpisodeFile from '#models/episode_file'
import MediaVersion from '#models/media_version'
import Movie from '#models/movie'
import MovieFile from '#models/movie_file'
import VersionProfile from '#models/version_profile'
import { fileTransferService } from './file_transfer_service.js'
import { subtitlePruningService } from './subtitle_pruning_service.js'
import { analysisToMediaInfo } from '#services/quality/file_quality_service'
import { probeFile, type MediaAnalysis } from '#utils/ffmpeg_utils'
import {
  buildVersionEncodeArgs,
  encodeStoppedAtFlush,
  parseSidecarName,
  unsupportedSourceReason,
  type SubtitleSidecarInput,
  type VaapiRateControl,
  type VersionEncoder,
} from '#utils/version_encoding'

/** Kept under its first name so the stored GPU switch survives the rename. */
export const VERSIONS_SETTING_KEY = 'movieVersions'

export interface VersionOptions {
  /** Use the GPU when one is usable. Off forces x265 on the CPU. */
  hardwareEncoding: boolean
}

const DEFAULT_OPTIONS: VersionOptions = { hardwareEncoding: true }

/** Where import-time hardlinks go, beside the download they came from. */
export const STAGING_DIR_NAME = '.hamster-versions'

const POLL_INTERVAL = 30 * 1000
const HEARTBEAT_INTERVAL = 30 * 1000
/** An `encoding` row whose heartbeat is older than this lost its process. */
const STALE_AFTER_SECONDS = 180
/** A version must come out at least this much smaller than its source. */
const MAX_SIZE_RATIO = 0.9
const MAX_DURATION_DRIFT = 2

/** What a version belongs to: a movie or an episode, never both. */
export type VersionOwner = { movieId: string } | { episodeId: string }
export type VersionKind = 'movie' | 'episode'

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

/** The file a version is made from, wherever it lives. */
interface VersionSubject {
  kind: VersionKind
  /** For logs: "8 Mile" or "The Bear S02E03". */
  title: string
  rootPath: string
  mainFile: MovieFile | EpisodeFile
  tvShowId: string | null
}

export function ownerOf(version: Pick<MediaVersion, 'movieId' | 'episodeId'>): VersionOwner {
  return version.episodeId ? { episodeId: version.episodeId } : { movieId: version.movieId! }
}

function kindOf(owner: VersionOwner): VersionKind {
  return 'episodeId' in owner ? 'episode' : 'movie'
}

async function loadSubject(owner: VersionOwner): Promise<VersionSubject | null> {
  if ('episodeId' in owner) {
    const episode = await Episode.query()
      .where('id', owner.episodeId)
      .preload('episodeFile')
      .preload('tvShow', (query) => query.preload('rootFolder'))
      .first()
    if (!episode?.episodeFile || !episode.tvShow?.rootFolder) return null
    const code = `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`
    return {
      kind: 'episode',
      title: `${episode.tvShow.title} ${code}`,
      rootPath: episode.tvShow.rootFolder.path,
      mainFile: episode.episodeFile,
      tvShowId: episode.tvShowId,
    }
  }

  const movie = await Movie.query()
    .where('id', owner.movieId)
    .preload('rootFolder')
    .preload('movieFile')
    .first()
  if (!movie?.movieFile || !movie.rootFolder) return null
  return {
    kind: 'movie',
    title: movie.title,
    rootPath: movie.rootFolder.path,
    mainFile: movie.movieFile,
    tvShowId: null,
  }
}

function whereOwner<T extends { where: (column: string, value: string) => T }>(
  query: T,
  owner: VersionOwner
): T {
  return 'episodeId' in owner
    ? query.where('episodeId', owner.episodeId)
    : query.where('movieId', owner.movieId)
}

/** Profiles that run by themselves for this kind of media. */
function autoProfiles(kind: VersionKind) {
  return VersionProfile.query()
    .where('auto', true)
    .where(kind === 'movie' ? 'forMovies' : 'forTv', true)
}

/**
 * Makes and manages versions: smaller copies of a movie or an episode kept
 * beside its main file, e.g. a 1080p HEVC copy to download to a phone.
 *
 * Encodes run one at a time, in the order they were queued, whichever of the
 * GPU or CPU is doing them — two at once only halves the speed of each. The
 * queue lives in `media_versions`, so it survives a restart, and a row is
 * claimed with a conditional update before anything reads it: `npm run dev`
 * and the container share a database, and without the claim both would
 * encode the same file.
 *
 * At import the download is hardlinked beside itself on the local disk before
 * the original moves to the library. The link costs no space and no time, and
 * lets the encoder read the local copy instead of pulling the original back
 * off a NAS; only the finished, much smaller version crosses the network.
 */
export class MediaVersionService {
  private timer: NodeJS.Timeout | null = null
  private draining = false
  private current: RunningEncode | null = null
  private encoderProbe: Promise<VaapiRateControl | null> | null = null

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.kick(), POLL_INTERVAL)
    // A restart — a deploy, or the dev server reloading on a save — must not
    // leave ffmpeg running with nobody to collect its output. That orphan kept
    // writing while the next process encoded the same file again.
    app.terminating(() => this.shutdown())
    this.kick()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Stop the running encode and hand its row back to the queue. */
  private async shutdown(): Promise<void> {
    this.stop()
    const running = this.current
    if (!running) return
    running.cancelled = true
    running.proc?.kill('SIGKILL')
    await db
      .from('media_versions')
      .where('id', running.versionId)
      .where('status', 'encoding')
      .update({ status: 'queued', heartbeat_at: null, updated_at: db.raw('now()') })
      .catch(() => {})
  }

  async getOptions(): Promise<VersionOptions> {
    const stored = await AppSetting.get<Partial<VersionOptions>>(VERSIONS_SETTING_KEY)
    return { ...DEFAULT_OPTIONS, ...stored }
  }

  async setOptions(options: VersionOptions): Promise<void> {
    await AppSetting.set(VERSIONS_SETTING_KEY, options)
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
          logger.info(`Versions: GPU encoding available on ${this.vaapiDevice} (${mode})`)
          return mode
        } catch (error) {
          lastError = error
        }
      }
      logger.info(`Versions: no GPU encoding (${describeError(lastError)}), using x265`)
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

  /** Where a finished version lives on disk, or null when that cannot be told. */
  async absolutePathOf(version: MediaVersion): Promise<string | null> {
    if (!version.relativePath) return null
    const subject = await loadSubject(ownerOf(version))
    return subject ? path.join(subject.rootPath, version.relativePath) : null
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
  async stageForImport(
    kind: VersionKind,
    sourcePath: string,
    downloadPath: string
  ): Promise<string | null> {
    // Never the reason an import fails: at worst the version reads the library copy.
    const profiles = await autoProfiles(kind)
      .count('* as total')
      .catch(() => null)
    if (!profiles || Number(profiles[0].$extras.total) === 0) return null

    // Beside the download, never inside it: the import deletes that folder.
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
        `Versions: could not stage ${path.basename(sourcePath)} locally (${describeError(error)}); will encode from the library`
      )
      return null
    }
  }

  /**
   * A new main file just landed. Versions made from the file it replaced are
   * stale and go; every automatic profile for this kind is queued afresh.
   */
  async onMainFileImported(owner: VersionOwner, stagedSourcePath: string | null): Promise<void> {
    try {
      await this.removeAllFor(owner)

      const profiles = await autoProfiles(kindOf(owner))
      for (const profile of profiles) {
        await this.enqueue(owner, profile, { stagedSourcePath })
      }
    } finally {
      if (stagedSourcePath) await this.releaseStaged(stagedSourcePath)
    }
  }

  /** Drop a staged hardlink once no queued or running version needs it. */
  async releaseStaged(stagedSourcePath: string): Promise<void> {
    const pending = await MediaVersion.query()
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
   * Queue a version. An existing ready or pending version is left alone; a
   * failed one is retried.
   */
  async enqueue(
    owner: VersionOwner,
    profile: VersionProfile,
    options: { stagedSourcePath?: string | null } = {}
  ): Promise<{ version: MediaVersion; queued: boolean; reason?: string }> {
    const subject = await loadSubject(owner)
    if (!subject) {
      throw new Error('There is no file to make a version of')
    }
    if (subject.mainFile.versionLabel) {
      throw new Error(`The file is already the ${subject.mainFile.versionLabel} version`)
    }

    const existing = await whereOwner(MediaVersion.query(), owner)
      .where('label', profile.label)
      .first()
    if (existing && existing.status !== 'failed') {
      return { version: existing, queued: false, reason: `already ${existing.status}` }
    }

    const version = existing ?? new MediaVersion()
    version.merge({
      movieId: 'movieId' in owner ? owner.movieId : null,
      episodeId: 'episodeId' in owner ? owner.episodeId : null,
      tvShowId: subject.tvShowId,
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
   * Queue `profile` for everything with a file and no version from it yet:
   * the whole library (as far as the profile's movie and TV switches allow),
   * or one show or season of it, which is asked for by hand and so runs
   * whatever the TV switch says.
   */
  async backfill(
    profile: VersionProfile,
    scope: { tvShowId?: string; seasonNumber?: number } = {}
  ): Promise<number> {
    const owners: VersionOwner[] = []
    const pendingOrReady = (column: 'movie_id' | 'episode_id', outer: string) => (query: any) =>
      query
        .from('media_versions')
        .whereColumn(`media_versions.${column}`, outer)
        .where('media_versions.label', profile.label)
        .whereNot('media_versions.status', 'failed')

    if (profile.forMovies && !scope.tvShowId) {
      const rows = await db
        .from('movie_files')
        .whereNull('version_label')
        .whereNotExists(pendingOrReady('movie_id', 'movie_files.movie_id'))
        .distinct('movie_id')
      owners.push(...rows.map((row) => ({ movieId: row.movie_id as string })))
    }

    if (profile.forTv || scope.tvShowId) {
      const query = db
        .from('episode_files')
        .join('episodes', 'episodes.id', 'episode_files.episode_id')
        .whereNull('episode_files.version_label')
        .whereNotExists(pendingOrReady('episode_id', 'episode_files.episode_id'))
        .orderBy(['episodes.season_number', 'episodes.episode_number'])
        .select('episode_files.episode_id')
      if (scope.tvShowId) query.where('episode_files.tv_show_id', scope.tvShowId)
      if (scope.seasonNumber !== undefined)
        query.where('episodes.season_number', scope.seasonNumber)
      const rows = await query
      owners.push(...rows.map((row) => ({ episodeId: row.episode_id as string })))
    }

    let queued = 0
    for (const owner of owners) {
      const result = await this.enqueue(owner, profile).catch(() => null)
      if (result?.queued) queued++
    }
    return queued
  }

  /**
   * Delete a version: stop it if it is encoding, remove its file, drop the row.
   */
  async remove(version: MediaVersion): Promise<void> {
    if (this.current?.versionId === version.id) {
      this.current.cancelled = true
      this.current.proc?.kill('SIGKILL')
    }

    if (version.relativePath) {
      const subject = await loadSubject(ownerOf(version))
      if (subject) {
        await fs.unlink(path.join(subject.rootPath, version.relativePath)).catch(() => {})
      }
    }

    const staged = version.stagedSourcePath
    await MediaVersion.query().where('id', version.id).delete()
    if (staged) await this.releaseStaged(staged)
  }

  /** Delete every version of a movie or episode, e.g. because its file is going. */
  async removeAllFor(owner: VersionOwner): Promise<void> {
    const versions = await whereOwner(MediaVersion.query(), owner)
    for (const version of versions) {
      await this.remove(version)
    }
  }

  /**
   * Make a ready version the only file: the original is deleted and the
   * version takes its name, so the library, Jellyfin and any sidecar
   * subtitles all keep pointing at the right thing.
   */
  async promote(version: MediaVersion): Promise<MovieFile | EpisodeFile> {
    if (version.status !== 'ready' || !version.relativePath) {
      throw new Error('Only a finished version can replace the original')
    }

    const owner = ownerOf(version)
    const subject = await loadSubject(owner)
    if (!subject) {
      throw new Error('There is no file to replace')
    }
    const mainFile = subject.mainFile

    // Another version still reading the original from the library would lose
    // its source halfway through.
    const busy = await whereOwner(MediaVersion.query(), owner)
      .whereNot('id', version.id)
      .whereIn('status', ['queued', 'encoding'])
      .whereNull('stagedSourcePath')
      .first()
    if (busy) {
      throw new Error(`Wait for the ${busy.label} version to finish first`)
    }

    const originalPath = path.join(subject.rootPath, mainFile.relativePath)
    const versionPath = path.join(subject.rootPath, version.relativePath)
    const promotedRelative = mainFile.relativePath.replace(/\.[^./]+$/, '') + '.mkv'
    const promotedPath = path.join(subject.rootPath, promotedRelative)

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
    await MediaVersion.query().where('id', version.id).delete()

    logger.info(`Versions: ${subject.title} now keeps only its ${version.label} version`)
    return mainFile
  }

  // ---------------------------------------------------------------------------
  // Worker
  // ---------------------------------------------------------------------------

  kick(): void {
    if (this.draining) return
    this.draining = true
    this.drain()
      .catch((error) => logger.error({ err: error }, 'Versions: queue failed'))
      .finally(() => {
        this.draining = false
      })
  }

  private async drain(): Promise<void> {
    await this.requeueStale()
    while (this.timer) {
      const version = await this.claimNext()
      if (!version) return
      await this.process(version)
    }
  }

  /** Put back rows whose encoding process died without finishing. */
  private async requeueStale(): Promise<void> {
    await db.rawQuery(
      `UPDATE media_versions SET status = 'queued', heartbeat_at = NULL, updated_at = now()
       WHERE status = 'encoding'
         AND (heartbeat_at IS NULL OR heartbeat_at < now() - make_interval(secs => ?))`,
      [STALE_AFTER_SECONDS]
    )
  }

  private async claimNext(): Promise<MediaVersion | null> {
    const result = await db.rawQuery(
      `UPDATE media_versions SET status = 'encoding', heartbeat_at = now(), updated_at = now()
       WHERE id = (
         SELECT id FROM media_versions WHERE status = 'queued'
         ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
       )
       RETURNING id`
    )
    const id = result.rows?.[0]?.id
    return id ? MediaVersion.find(id) : null
  }

  private async process(version: MediaVersion): Promise<void> {
    const running: RunningEncode = {
      versionId: version.id,
      proc: null,
      progress: { percent: 0, fps: null, eta: null },
      cancelled: false,
    }
    this.current = running
    const heartbeat = setInterval(() => {
      db.from('media_versions')
        .where('id', version.id)
        .update({ heartbeat_at: db.raw('now()') })
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
        `Versions: ${result.relativePath} ready (${formatGb(result.sizeBytes)}, ${result.encoder})`
      )
    } catch (error) {
      if (running.cancelled) return
      logger.warn(`Versions: ${version.label} for ${version.id} failed: ${describeError(error)}`)
      await MediaVersion.query()
        .where('id', version.id)
        .update({ status: 'failed', error: describeError(error), heartbeatAt: null })
        .catch(() => {})
    } finally {
      clearInterval(heartbeat)
      this.current = null
      if (tempPath) await fs.unlink(tempPath).catch(() => {})
      // A cancelled row was deleted or handed back to the queue; either way the
      // staged link may still be wanted, and releaseStaged checks for that.
      const staged = version.stagedSourcePath
      if (staged && !running.cancelled) {
        // The staged link has done its job either way; a retry reads the library copy.
        await MediaVersion.query()
          .where('id', version.id)
          .update({ stagedSourcePath: null })
          .catch(() => {})
      }
      if (staged) await this.releaseStaged(staged)
    }
  }

  private async encode(
    version: MediaVersion,
    running: RunningEncode,
    onTempPath: (tempPath: string) => void
  ): Promise<{
    relativePath: string
    sizeBytes: number
    analysis: MediaAnalysis
    encoder: VersionEncoder
  }> {
    const subject = await loadSubject(ownerOf(version))
    if (!subject) {
      throw new Error('There is no file to make a version of')
    }
    if (subject.mainFile.versionLabel) {
      throw new Error(`The file is already the ${subject.mainFile.versionLabel} version`)
    }
    const profile = version.profileId ? await VersionProfile.find(version.profileId) : null
    if (!profile) {
      throw new Error('Its profile was deleted')
    }

    const libraryPath = path.join(subject.rootPath, subject.mainFile.relativePath)
    const staged = version.stagedSourcePath && (await exists(version.stagedSourcePath))
    const sourcePath = staged ? version.stagedSourcePath! : libraryPath

    if (!(await exists(sourcePath))) {
      throw new Error(`The file is not on disk: ${subject.mainFile.relativePath}`)
    }
    const analysis = await probeFile(sourcePath)
    const unsupported = unsupportedSourceReason(analysis)
    if (unsupported) throw new Error(unsupported)

    const relativePath = versionRelativePath(subject.mainFile.relativePath, profile.label)

    // Write next to the staged source when there is one — the same local
    // disk — and into the app's tmp folder otherwise. Never straight into the
    // library: a half-written file there is a version Jellyfin would list.
    // The pid keeps a second process (dev server and container share the
    // queue) from ever writing into the same file.
    const workDir = staged ? path.dirname(sourcePath) : app.makePath('tmp', 'versions')
    await fs.mkdir(workDir, { recursive: true })
    const tempPath = path.join(workDir, `${version.id}-${process.pid}.mkv`)
    onTempPath(tempPath)

    const subtitleIndices = profile.subtitles
      ? await subtitlePruningService.tracksToKeep(analysis)
      : []
    // Text tracks the import moved out into sidecar files are only beside the
    // library copy; a staged download still has them embedded.
    const sidecars = profile.subtitles && !staged ? await findSidecars(libraryPath) : []

    // Only a failed encode moves on to the next encoder. Anything after it —
    // probing, verifying, copying into the library — would fail the same way
    // on every encoder, and retrying it meant encoding the whole film again.
    const failures: string[] = []
    let used: VersionEncoder | null = null
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
        used = encoder
        break
      } catch (error) {
        if (running.cancelled) throw error
        failures.push(`${encoder}: ${describeError(error)}`)
        logger.warn(`Versions: ${encoder} failed for ${subject.title}: ${describeError(error)}`)
        await fs.unlink(tempPath).catch(() => {})
      }
    }
    if (!used) {
      throw new Error(failures.join(' | ') || 'No encoder available')
    }

    const result = await probeFile(tempPath).catch((error) => {
      throw new Error(`the result could not be read: ${describeError(error)}`)
    })
    const problem = await verifyVersion(sourcePath, tempPath, analysis, result)
    if (problem) throw new Error(problem)

    const destination = path.join(subject.rootPath, relativePath)
    await fileTransferService.move(tempPath, destination).catch((error) => {
      throw new Error(`could not copy it into the library: ${describeError(error)}`)
    })
    const stats = await fs.stat(destination)
    return { relativePath, sizeBytes: stats.size, analysis: result, encoder: used }
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
        if (encodeStoppedAtFlush(stderr, running.progress.percent)) {
          logger.info('Versions: GPU scaler stopped at the very end; checking the result')
          return resolve()
        }
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().slice(-300)}`))
      })
    })
  }
}

/**
 * Checks before a version is allowed into the library. Returns the first
 * problem, or null when it passes.
 */
async function verifyVersion(
  sourcePath: string,
  resultPath: string,
  source: MediaAnalysis,
  result: MediaAnalysis
): Promise<string | null> {
  if (!result.videoCodec) {
    return 'the result has no video stream'
  }
  const drift = Math.abs(result.duration - source.duration)
  if (source.duration > 0 && drift > Math.max(MAX_DURATION_DRIFT, source.duration * 0.005)) {
    return `the result is ${drift.toFixed(1)}s shorter or longer than the source`
  }
  const [sourceStats, resultStats] = await Promise.all([fs.stat(sourcePath), fs.stat(resultPath)])
  if (resultStats.size > sourceStats.size * MAX_SIZE_RATIO) {
    return `the result (${formatGb(resultStats.size)}) is not meaningfully smaller than the original (${formatGb(sourceStats.size)})`
  }
  return null
}

/**
 * `Movie (2020)/Movie (2020).mkv` → `Movie (2020)/Movie (2020) - Mobile.mkv`,
 * and `Show/Season 01/Show - S01E01 - Pilot.mkv` → `… - Pilot - Mobile.mkv`.
 * Jellyfin groups such files as versions: movies by the folder name the file
 * starts with, episodes by the same SxxEyy in the same season folder.
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

export const mediaVersionService = new MediaVersionService()
