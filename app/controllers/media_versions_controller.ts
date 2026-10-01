import path from 'node:path'
import type { HttpContext } from '@adonisjs/core/http'
import Episode from '#models/episode'
import EpisodeFile from '#models/episode_file'
import MediaVersion from '#models/media_version'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import VersionProfile, {
  VERSION_AUDIO_MODES,
  VERSION_MAX_HEIGHTS,
  VERSION_QUALITIES,
} from '#models/version_profile'
import { mediaVersionService } from '#services/media/media_version_service'
import { describeMediaInfo } from '#services/quality/file_quality_service'
import { accessWithTimeout } from '#utils/fs_utils'

/**
 * Version profiles (Settings → Media) and the versions made from them on movie
 * and show pages.
 */
export default class MediaVersionsController {
  // ---------------------------------------------------------------------------
  // Profiles
  // ---------------------------------------------------------------------------

  async profiles({ response }: HttpContext) {
    const [profiles, counts] = await Promise.all([
      VersionProfile.query().orderBy('created_at'),
      MediaVersion.query().select('label', 'status').count('* as total').groupBy('label', 'status'),
    ])

    const countsFor = (label: string) => {
      const out: Record<string, number> = {}
      for (const row of counts) {
        if (row.label === label) out[row.status] = Number(row.$extras.total)
      }
      return out
    }

    return response.json({
      profiles: profiles.map((profile) => ({
        ...serializeProfile(profile),
        counts: countsFor(profile.label),
      })),
    })
  }

  async storeProfile({ request, response }: HttpContext) {
    const parsed = parseProfile(request.all())
    if ('error' in parsed) return response.badRequest({ error: parsed.error })

    if (await VersionProfile.findBy('label', parsed.label)) {
      return response.conflict({ error: `A profile named "${parsed.label}" already exists` })
    }

    const profile = await VersionProfile.create(parsed)
    return response.created(serializeProfile(profile))
  }

  async updateProfile({ params, request, response }: HttpContext) {
    const profile = await VersionProfile.find(params.id)
    if (!profile) return response.notFound({ error: 'Profile not found' })

    const parsed = parseProfile(request.all())
    if ('error' in parsed) return response.badRequest({ error: parsed.error })

    // The label is in every file name made from this profile; renaming it would
    // strand those files under the old name, so it stays what it was.
    if (parsed.label !== profile.label) {
      return response.badRequest({
        error: 'The file label cannot change once versions may exist; create a new profile instead',
      })
    }

    profile.merge(parsed)
    await profile.save()
    return response.json(serializeProfile(profile))
  }

  async destroyProfile({ params, request, response }: HttpContext) {
    const profile = await VersionProfile.find(params.id)
    if (!profile) return response.notFound({ error: 'Profile not found' })

    // Queued work from a deleted profile has nothing left to follow. Finished
    // files stay unless asked for, since they may be what someone downloads.
    const deleteFiles = request.input('deleteFiles') === 'true'
    const versions = await MediaVersion.query().where('profileId', profile.id)
    for (const version of versions) {
      if (deleteFiles || version.status !== 'ready') {
        await mediaVersionService.remove(version)
      }
    }

    await profile.delete()
    return response.json({ id: profile.id, deleted: true })
  }

  /** Queue the profile for everything in its libraries that has no version from it. */
  async backfill({ params, response }: HttpContext) {
    const profile = await VersionProfile.find(params.id)
    if (!profile) return response.notFound({ error: 'Profile not found' })

    const queued = await mediaVersionService.backfill(profile)
    return response.json({ queued })
  }

  // ---------------------------------------------------------------------------
  // A movie's versions
  // ---------------------------------------------------------------------------

  async movieIndex({ params, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) return response.notFound({ error: 'Movie not found' })

    const [versions, profiles] = await Promise.all([
      MediaVersion.query().where('movieId', movie.id).orderBy('created_at'),
      VersionProfile.query().where('forMovies', true).orderBy('created_at'),
    ])

    return response.json({
      versions: versions.map((version) => serializeVersion(version)),
      profiles: profiles.map(serializeProfile),
    })
  }

  async movieStore({ params, request, response }: HttpContext) {
    const movie = await Movie.find(params.id)
    if (!movie) return response.notFound({ error: 'Movie not found' })

    const profile = await VersionProfile.find(request.input('profileId'))
    if (!profile) return response.badRequest({ error: 'Profile not found' })

    try {
      const result = await mediaVersionService.enqueue({ movieId: movie.id }, profile, {
        keepOnly: request.input('keepOnly') === true,
      })
      return response.json({
        ...serializeVersion(result.version),
        queued: result.queued,
        promoted: result.promoted === true,
      })
    } catch (error) {
      return response.badRequest({ error: error instanceof Error ? error.message : String(error) })
    }
  }

  // ---------------------------------------------------------------------------
  // A show's versions
  // ---------------------------------------------------------------------------

  /** Every episode version of a show, with the episode each belongs to. */
  async showIndex({ params, response }: HttpContext) {
    const show = await TvShow.find(params.id)
    if (!show) return response.notFound({ error: 'Show not found' })

    const [versions, profiles, episodesWithFiles] = await Promise.all([
      MediaVersion.query().where('tvShowId', show.id).preload('episode').orderBy('created_at'),
      VersionProfile.query().where('forTv', true).orderBy('created_at'),
      Episode.query().where('tvShowId', show.id).where('hasFile', true).count('* as total'),
    ])

    // What keeping only a version would free: the size of each episode's file.
    const episodeIds = versions.map((v) => v.episodeId).filter((id): id is string => Boolean(id))
    const originals = await EpisodeFile.query().whereIn('episodeId', episodeIds)
    const originalSize = new Map(originals.map((file) => [file.episodeId, Number(file.sizeBytes)]))

    return response.json({
      versions: versions
        .map((version) => ({
          ...serializeVersion(version),
          originalSize: version.episodeId ? (originalSize.get(version.episodeId) ?? null) : null,
        }))
        .sort(
          (a, b) =>
            (a.episode?.seasonNumber ?? 0) - (b.episode?.seasonNumber ?? 0) ||
            (a.episode?.episodeNumber ?? 0) - (b.episode?.episodeNumber ?? 0)
        ),
      profiles: profiles.map(serializeProfile),
      episodesWithFiles: Number(episodesWithFiles[0].$extras.total),
    })
  }

  /**
   * Queue a profile for a show: every episode with a file, one season of it,
   * or a single episode.
   */
  async showStore({ params, request, response }: HttpContext) {
    const show = await TvShow.find(params.id)
    if (!show) return response.notFound({ error: 'Show not found' })

    const profile = await VersionProfile.find(request.input('profileId'))
    if (!profile) return response.badRequest({ error: 'Profile not found' })

    const episodeId = request.input('episodeId')
    if (episodeId) {
      const episode = await Episode.query()
        .where('id', episodeId)
        .where('tvShowId', show.id)
        .first()
      if (!episode) return response.notFound({ error: 'Episode not found' })
      try {
        const result = await mediaVersionService.enqueue({ episodeId: episode.id }, profile, {
          keepOnly: request.input('keepOnly') === true,
        })
        return response.json({ queued: result.queued || result.promoted ? 1 : 0 })
      } catch (error) {
        return response.badRequest({
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const season = request.input('seasonNumber')
    const queued = await mediaVersionService.backfill(
      profile,
      {
        tvShowId: show.id,
        seasonNumber: season === undefined || season === null ? undefined : Number(season),
      },
      { keepOnly: request.input('keepOnly') === true }
    )
    return response.json({ queued })
  }

  /** Keep only one profile's versions across a show, or one season of it. */
  async showPromote({ params, request, response }: HttpContext) {
    const show = await TvShow.find(params.id)
    if (!show) return response.notFound({ error: 'Show not found' })

    const label = request.input('label')
    if (typeof label !== 'string' || !label) {
      return response.badRequest({ error: 'label is required' })
    }
    const season = request.input('seasonNumber')
    const result = await mediaVersionService.promoteShow(
      show.id,
      label,
      season === undefined || season === null ? undefined : Number(season)
    )
    return response.json(result)
  }

  // ---------------------------------------------------------------------------
  // Any version
  // ---------------------------------------------------------------------------

  async destroy({ params, response }: HttpContext) {
    const version = await MediaVersion.find(params.versionId)
    if (!version) return response.notFound({ error: 'Version not found' })

    await mediaVersionService.remove(version)
    return response.json({ id: version.id, deleted: true })
  }

  /** Delete the original and keep this version as the file. */
  async promote({ params, response }: HttpContext) {
    const version = await MediaVersion.find(params.versionId)
    if (!version) return response.notFound({ error: 'Version not found' })

    try {
      const { file, freedBytes } = await mediaVersionService.promote(version)
      return response.json({ fileId: file.id, path: file.relativePath, freedBytes })
    } catch (error) {
      return response.badRequest({ error: error instanceof Error ? error.message : String(error) })
    }
  }

  async download({ params, response }: HttpContext) {
    const version = await MediaVersion.find(params.versionId)
    if (!version?.relativePath || version.status !== 'ready') {
      return response.notFound({ error: 'Version not found' })
    }

    const absolutePath = await mediaVersionService.absolutePathOf(version)
    if (!absolutePath) return response.notFound({ error: 'Root folder not found' })
    try {
      await accessWithTimeout(absolutePath)
    } catch {
      return response.notFound({ error: 'File not found on disk' })
    }

    response.header('Content-Disposition', `attachment; filename="${path.basename(absolutePath)}"`)
    return response.download(absolutePath)
  }
}

function serializeProfile(profile: VersionProfile) {
  return {
    id: profile.id,
    name: profile.name,
    label: profile.label,
    maxHeight: profile.maxHeight,
    quality: profile.quality,
    audio: profile.audio,
    subtitles: profile.subtitles,
    auto: profile.auto,
    forMovies: profile.forMovies,
    forTv: profile.forTv,
  }
}

function serializeVersion(version: MediaVersion) {
  const episode = version.episodeId && version.$preloaded.episode ? version.episode : null
  return {
    id: version.id,
    profileId: version.profileId,
    label: version.label,
    status: version.status,
    path: version.relativePath,
    size: version.sizeBytes,
    summary: describeMediaInfo(version.mediaInfo),
    error: version.error,
    encoder: version.encoder,
    progress: mediaVersionService.getProgress(version.id),
    keepOnly: version.keepOnly,
    completedAt: version.completedAt?.toISO() ?? null,
    episode: episode
      ? {
          id: episode.id,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          title: episode.title,
        }
      : null,
    downloadUrl: version.status === 'ready' ? `/api/v1/versions/${version.id}/download` : null,
  }
}

type ParsedProfile = Pick<
  VersionProfile,
  | 'name'
  | 'label'
  | 'maxHeight'
  | 'quality'
  | 'audio'
  | 'subtitles'
  | 'auto'
  | 'forMovies'
  | 'forTv'
>

function parseProfile(body: Record<string, unknown>): ParsedProfile | { error: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 64) return { error: 'Name is required (up to 64 characters)' }

  // The label ends up in a file name on a share Windows or macOS may read.
  const label = (typeof body.label === 'string' && body.label.trim() ? body.label : name)
    .trim()
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\p{Cc}/gu, '')
    .slice(0, 64)
  if (!label) return { error: 'Label must contain at least one usable character' }

  const maxHeight = Number(body.maxHeight)
  if (!(VERSION_MAX_HEIGHTS as readonly number[]).includes(maxHeight)) {
    return { error: `maxHeight must be one of ${VERSION_MAX_HEIGHTS.join(', ')}` }
  }
  if (!(VERSION_QUALITIES as readonly unknown[]).includes(body.quality)) {
    return { error: `quality must be one of ${VERSION_QUALITIES.join(', ')}` }
  }
  if (!(VERSION_AUDIO_MODES as readonly unknown[]).includes(body.audio)) {
    return { error: `audio must be one of ${VERSION_AUDIO_MODES.join(', ')}` }
  }
  if (typeof body.subtitles !== 'boolean' || typeof body.auto !== 'boolean') {
    return { error: 'subtitles and auto must be booleans' }
  }
  // Older clients send neither; a profile is for both until told otherwise.
  const forMovies = body.forMovies === undefined ? true : body.forMovies
  const forTv = body.forTv === undefined ? true : body.forTv
  if (typeof forMovies !== 'boolean' || typeof forTv !== 'boolean') {
    return { error: 'forMovies and forTv must be booleans' }
  }
  if (!forMovies && !forTv) {
    return { error: 'A profile has to be for movies, TV shows or both' }
  }

  return {
    name,
    label,
    maxHeight,
    quality: body.quality as ParsedProfile['quality'],
    audio: body.audio as ParsedProfile['audio'],
    subtitles: body.subtitles,
    auto: body.auto,
    forMovies,
    forTv,
  }
}
