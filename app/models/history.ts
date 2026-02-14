import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Album from './album.js'
import Artist from './artist.js'
import TrackFile from './track_file.js'
import Download from './download.js'
import Movie from './movie.js'
import TvShow from './tv_show.js'
import Episode from './episode.js'
import Book from './book.js'
import MovieFile from './movie_file.js'
import EpisodeFile from './episode_file.js'
import BookFile from './book_file.js'

export type HistoryEventType =
  | 'grabbed'
  | 'download_completed'
  | 'import_completed'
  | 'import_failed'
  | 'deleted'
  | 'renamed'

export default class History extends BaseModel {
  static table = 'history'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare eventType: HistoryEventType

  @column()
  declare sourceTitle: string | null

  @column()
  declare albumId: string | null

  @column()
  declare artistId: string | null

  @column()
  declare trackFileId: string | null

  @column()
  declare downloadId: string | null

  @column()
  declare movieId: string | null

  @column()
  declare tvShowId: string | null

  @column()
  declare episodeId: string | null

  @column()
  declare bookId: string | null

  @column()
  declare movieFileId: string | null

  @column()
  declare episodeFileId: string | null

  @column()
  declare bookFileId: string | null

  @column()
  declare quality: string | null

  @column()
  declare data: Record<string, unknown>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Album)
  declare album: BelongsTo<typeof Album>

  @belongsTo(() => Artist)
  declare artist: BelongsTo<typeof Artist>

  @belongsTo(() => TrackFile)
  declare trackFile: BelongsTo<typeof TrackFile>

  @belongsTo(() => Download)
  declare download: BelongsTo<typeof Download>

  @belongsTo(() => Movie)
  declare movie: BelongsTo<typeof Movie>

  @belongsTo(() => TvShow)
  declare tvShow: BelongsTo<typeof TvShow>

  @belongsTo(() => Episode)
  declare episode: BelongsTo<typeof Episode>

  @belongsTo(() => Book)
  declare book: BelongsTo<typeof Book>

  @belongsTo(() => MovieFile)
  declare movieFile: BelongsTo<typeof MovieFile>

  @belongsTo(() => EpisodeFile)
  declare episodeFile: BelongsTo<typeof EpisodeFile>

  @belongsTo(() => BookFile)
  declare bookFile: BelongsTo<typeof BookFile>
}
