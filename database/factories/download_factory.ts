import Download from '#models/download'
import type { DownloadStatus, NzbInfo } from '#models/download'
import type { MediaType } from '#models/app_setting'

let counter = 0

export class DownloadFactory {
  static async create(
    overrides: Partial<{
      title: string
      status: DownloadStatus
      progress: number
      downloadClientId: string | null
      externalId: string | null
      sizeBytes: number | null
      remainingBytes: number | null
      etaSeconds: number | null
      mediaType: MediaType | null
      albumId: string | null
      releaseId: string | null
      movieId: string | null
      tvShowId: string | null
      episodeId: string | null
      bookId: string | null
      indexerId: string | null
      nzbInfo: NzbInfo
      outputPath: string | null
      errorMessage: string | null
    }> = {}
  ) {
    counter++
    return await Download.create({
      title: overrides.title ?? `Test Download ${counter}`,
      status: overrides.status ?? 'queued',
      progress: overrides.progress ?? 0,
      downloadClientId: overrides.downloadClientId ?? null,
      externalId: overrides.externalId ?? null,
      sizeBytes: overrides.sizeBytes ?? null,
      remainingBytes: overrides.remainingBytes ?? null,
      etaSeconds: overrides.etaSeconds ?? null,
      mediaType: overrides.mediaType ?? null,
      albumId: overrides.albumId ?? null,
      releaseId: overrides.releaseId ?? null,
      movieId: overrides.movieId ?? null,
      tvShowId: overrides.tvShowId ?? null,
      episodeId: overrides.episodeId ?? null,
      bookId: overrides.bookId ?? null,
      indexerId: overrides.indexerId ?? null,
      nzbInfo: overrides.nzbInfo ?? {},
      outputPath: overrides.outputPath ?? null,
      errorMessage: overrides.errorMessage ?? null,
    })
  }
}
