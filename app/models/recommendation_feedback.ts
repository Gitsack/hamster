import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type FeedbackMediaType = 'movie' | 'tv' | 'album' | 'book'
export type FeedbackAction = 'requested' | 'skipped'

export default class RecommendationFeedback extends BaseModel {
  static table = 'recommendation_feedback'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare mediaType: FeedbackMediaType

  /** TMDB id for movies and shows; our own row id for albums and books. */
  @column()
  declare externalId: string

  @column()
  declare action: FeedbackAction

  @column()
  declare title: string | null

  @column()
  declare genres: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
