import type { HttpContext } from '@adonisjs/core/http'
import { recommendationService } from '#services/metadata/recommendation_service'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'

export default class RecommendationsController {
  async movies({ request, response }: HttpContext) {
    const source = request.qs().source as string | undefined
    const lanes = await recommendationService.getMovieRecommendationLanes(source)

    // Collect all tmdbIds across lanes and batch-query library status
    const allTmdbIds = lanes.flatMap((lane) => lane.items.map((item) => String(item.tmdbId)))
    const uniqueTmdbIds = [...new Set(allTmdbIds)]

    const libraryMovies =
      uniqueTmdbIds.length > 0
        ? await Movie.query().whereIn('tmdbId', uniqueTmdbIds).select('tmdbId', 'hasFile')
        : []

    const libraryMap = new Map(libraryMovies.map((m) => [String(m.tmdbId), m.hasFile]))

    const enrichedLanes = lanes.map((lane) => ({
      ...lane,
      items: lane.items.map((item) => ({
        ...item,
        inLibrary: libraryMap.has(String(item.tmdbId)),
        hasFile: libraryMap.get(String(item.tmdbId)) ?? false,
      })),
    }))

    return response.json({ lanes: enrichedLanes })
  }

  async tv({ request, response }: HttpContext) {
    const source = request.qs().source as string | undefined
    const lanes = await recommendationService.getTvRecommendationLanes(source)

    // Collect all tmdbIds across lanes and batch-query library status
    const allTmdbIds = lanes.flatMap((lane) => lane.items.map((item) => String(item.tmdbId)))
    const uniqueTmdbIds = [...new Set(allTmdbIds)]

    const libraryShows =
      uniqueTmdbIds.length > 0
        ? await TvShow.query().whereIn('tmdbId', uniqueTmdbIds).select('tmdbId')
        : []

    const librarySet = new Set(libraryShows.map((s) => String(s.tmdbId)))

    const enrichedLanes = lanes.map((lane) => ({
      ...lane,
      items: lane.items.map((item) => ({
        ...item,
        inLibrary: librarySet.has(String(item.tmdbId)),
      })),
    }))

    return response.json({ lanes: enrichedLanes })
  }
}
