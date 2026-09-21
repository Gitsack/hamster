import path from 'node:path'
import fs from 'node:fs/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import EpisodeFile from '#models/episode_file'
import MovieFile from '#models/movie_file'
import Movie from '#models/movie'
import RootFolder from '#models/root_folder'
import TvShow from '#models/tv_show'
import { subtitleSidecarService } from '#services/media/subtitle_sidecar_service'
import { checkFfmpegAvailable, planSubtitleSidecars, probeFile } from '#utils/ffmpeg_utils'

interface LibraryVideo {
  label: string
  absolutePath: string
}

/**
 * Writes sidecar subtitle files for everything already in the library.
 *
 * New imports get their sidecars as they land. This is for the files that
 * arrived before that existed — without it they keep paying the same two-minute
 * stall on first play that the importer now avoids.
 *
 * It reads every video in full, so on a network share it runs at the speed of
 * the share and is meant to be left alone overnight. Interrupting it is safe:
 * files that already have their sidecars are skipped on the next run, so it
 * picks up roughly where it stopped.
 */
export default class ExtractSubtitles extends BaseCommand {
  static commandName = 'subtitles:extract'
  static description = 'Write sidecar subtitle files for library videos that have none'

  static options: CommandOptions = {
    startApp: true,
    staysAlive: false,
  }

  @flags.boolean({
    description: 'Report what would be written without reading or writing anything',
  })
  declare dryRun: boolean

  @flags.string({
    description: 'Which library to walk: tv, movies, or all (default: all)',
  })
  declare media: string

  @flags.number({
    description: 'Stop after this many videos',
  })
  declare limit: number

  @flags.string({
    description: 'Only files whose library path contains this text (case-insensitive)',
  })
  declare match: string

  async run() {
    const { ffmpeg, ffprobe } = await checkFfmpegAvailable()
    if (!ffmpeg || !ffprobe) {
      this.logger.error('ffmpeg and ffprobe must both be on PATH')
      return
    }

    const media = (this.media || 'all').toLowerCase()
    if (!['all', 'tv', 'movies'].includes(media)) {
      this.logger.error(`--media must be one of: all, tv, movies (got "${this.media}")`)
      return
    }

    const videos: LibraryVideo[] = []
    if (media === 'all' || media === 'tv') {
      videos.push(...(await this.episodeVideos()))
    }
    if (media === 'all' || media === 'movies') {
      videos.push(...(await this.movieVideos()))
    }

    const needle = this.match?.toLowerCase()
    const matched = needle ? videos.filter((v) => v.label.toLowerCase().includes(needle)) : videos
    const selected =
      this.limit && this.limit > 0 ? matched.slice(0, Math.floor(this.limit)) : matched

    this.logger.info(
      `${selected.length} video(s) to check${selected.length < videos.length ? ` (of ${videos.length})` : ''}`
    )

    let written = 0
    let alreadyDone = 0
    let nothingToDo = 0
    let failed = 0
    let missing = 0
    let bytesRead = 0
    const startedAt = Date.now()

    for (const [order, video] of selected.entries()) {
      const position = `[${order + 1}/${selected.length}]`

      let size = 0
      try {
        const stats = await fs.stat(video.absolutePath)
        size = stats.size
      } catch {
        missing += 1
        this.logger.warning(`${position} ${video.label} — not on disk, skipped`)
        continue
      }

      if (this.dryRun) {
        const verdict = await this.preview(video)
        this.logger.info(`${position} ${video.label} — ${verdict}`)
        continue
      }

      const result = await subtitleSidecarService.extract(video.absolutePath, {
        ignoreSetting: true,
      })

      if (result.extracted.length > 0) {
        written += 1
        bytesRead += size
        this.logger.success(`${position} ${video.label} — ${result.extracted.join(', ')}`)
      } else if (result.reason.includes('already present')) {
        alreadyDone += 1
      } else if (result.reason.includes('no text subtitle tracks')) {
        nothingToDo += 1
      } else {
        failed += 1
        this.logger.warning(`${position} ${video.label} — ${result.reason}`)
      }
    }

    if (this.dryRun) {
      this.logger.info('Dry run — nothing was written')
      return
    }

    const elapsed = (Date.now() - startedAt) / 1000
    this.logger.info(
      `Done in ${formatDuration(elapsed)}: ${written} written, ${alreadyDone} already had sidecars, ` +
        `${nothingToDo} with no text subtitles, ${failed} failed, ${missing} missing on disk`
    )
    if (bytesRead > 0 && elapsed > 0) {
      const megabytes = bytesRead / 1024 / 1024
      this.logger.info(
        `Read ${Math.round(megabytes)} MB at ${(megabytes / elapsed).toFixed(1)} MB/s`
      )
    }
  }

  /**
   * What the real run would do, without reading the whole file — ffprobe only
   * touches the header, so a whole library previews in seconds.
   */
  private async preview(video: LibraryVideo): Promise<string> {
    let tracks
    try {
      const analysis = await probeFile(video.absolutePath)
      tracks = analysis.subtitleTracks
    } catch (error) {
      return `probe failed: ${error instanceof Error ? error.message : String(error)}`
    }

    const planned = planSubtitleSidecars(tracks, path.basename(video.absolutePath))
    if (planned.length === 0) {
      return `no text subtitle tracks (${tracks.length} subtitle track(s) in total)`
    }

    const directory = path.dirname(video.absolutePath)
    const missing: string[] = []
    for (const sidecar of planned) {
      try {
        await fs.stat(path.join(directory, sidecar.fileName))
      } catch {
        missing.push(sidecar.fileName)
      }
    }

    if (missing.length === 0) {
      return `all ${planned.length} sidecar(s) already present`
    }
    return `would write ${missing.join(', ')}`
  }

  private async episodeVideos(): Promise<LibraryVideo[]> {
    const [files, shows, rootFolders] = await Promise.all([
      EpisodeFile.query().orderBy('relative_path', 'asc'),
      TvShow.all(),
      RootFolder.all(),
    ])

    const showById = new Map(shows.map((show) => [show.id, show]))
    const rootById = new Map(rootFolders.map((root) => [root.id, root]))

    return this.resolve(files, (file) => {
      const show = showById.get(file.tvShowId)
      return show?.rootFolderId ? rootById.get(show.rootFolderId)?.path : undefined
    })
  }

  private async movieVideos(): Promise<LibraryVideo[]> {
    const [files, movies, rootFolders] = await Promise.all([
      MovieFile.query().orderBy('relative_path', 'asc'),
      Movie.all(),
      RootFolder.all(),
    ])

    const movieById = new Map(movies.map((movie) => [movie.id, movie]))
    const rootById = new Map(rootFolders.map((root) => [root.id, root]))

    return this.resolve(files, (file) => {
      const movie = movieById.get(file.movieId)
      return movie?.rootFolderId ? rootById.get(movie.rootFolderId)?.path : undefined
    })
  }

  private resolve<T extends { relativePath: string }>(
    files: T[],
    rootPathOf: (file: T) => string | undefined
  ): LibraryVideo[] {
    const videos: LibraryVideo[] = []

    for (const file of files) {
      const rootPath = rootPathOf(file)
      if (!rootPath) {
        // An orphaned row: the show, movie or root folder it points at is gone.
        continue
      }
      videos.push({
        label: file.relativePath,
        absolutePath: path.join(rootPath, file.relativePath),
      })
    }

    return videos
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ${Math.round(seconds % 60)}s`
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
