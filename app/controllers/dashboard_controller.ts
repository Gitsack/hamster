import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Artist from '#models/artist'
import Author from '#models/author'
import Book from '#models/book'
import Download from '#models/download'
import DownloadClient from '#models/download_client'
import Indexer from '#models/indexer'
import History from '#models/history'

interface RecentItem {
  id: string
  title: string
  type: 'movie' | 'tvshow' | 'album' | 'book'
  imageUrl: string | null
  addedAt: string
  year: number | null
  subtitle: string | null
}

const EMPTY_PROPS = {
  stats: { movies: 0, tvShows: 0, episodes: 0, artists: 0, albums: 0, authors: 0, books: 0 },
  missing: { movies: 0, episodes: 0, albums: 0, books: 0 },
  activeDownloadCount: 0,
  failedLastDay: 0,
  recentAdditions: [] as RecentItem[],
  health: { downloadClients: [], indexers: [] },
}

export default class DashboardController {
  async index({ inertia, logger }: HttpContext) {
    try {
      const count = (result: { $extras: Record<string, unknown> }[]) =>
        Number(result[0].$extras.total)

      const [
        movieCount,
        tvShowCount,
        episodeCount,
        artistCount,
        albumCount,
        authorCount,
        bookCount,
        missingMovies,
        missingEpisodes,
        missingAlbums,
        missingBooks,
        activeDownloads,
        failedLastDay,
        downloadClients,
        indexers,
        recentImports,
      ] = await Promise.all([
        // The library is what is on disk. Albums and books also exist as rows
        // for everything an artist or author has released, so counting rows
        // reported a whole discography (21k "albums") as owned.
        Movie.query().where('hasFile', true).count('* as total'),
        TvShow.query().count('* as total'),
        Episode.query().where('hasFile', true).count('* as total'),
        Artist.query().count('* as total'),
        db
          .from('albums')
          .whereExists((q) =>
            q.from('track_files').whereColumn('track_files.album_id', 'albums.id')
          )
          .count('* as total'),
        Author.query().count('* as total'),
        Book.query().where('hasFile', true).count('* as total'),
        // Missing: wanted but not on disk
        Movie.query().where('monitored', true).where('hasFile', false).count('* as total'),
        Episode.query()
          .where('requested', true)
          .where('hasFile', false)
          .where((q) =>
            q.whereNull('airDate').orWhere('airDate', '<=', DateTime.now().toSQLDate()!)
          )
          .count('* as total'),
        db
          .from('albums')
          .where('requested', true)
          .whereNotExists((q) =>
            q.from('track_files').whereColumn('track_files.album_id', 'albums.id')
          )
          .count('* as total'),
        Book.query().where('requested', true).where('hasFile', false).count('* as total'),
        Download.query()
          .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
          .count('* as total'),
        History.query()
          .whereIn('eventType', ['download_failed', 'import_failed'])
          .where('createdAt', '>=', DateTime.now().minus({ hours: 24 }).toSQL()!)
          .count('* as total'),
        DownloadClient.query().select('id', 'name', 'type', 'enabled'),
        Indexer.query().select('id', 'name', 'type', 'enabled'),
        History.query()
          .where('eventType', 'import_completed')
          .orderBy('createdAt', 'desc')
          .limit(60)
          .preload('movie')
          .preload('tvShow')
          .preload('album', (q) => q.preload('artist'))
          .preload('book', (q) => q.preload('author')),
      ])

      return inertia.render('dashboard', {
        stats: {
          movies: count(movieCount),
          tvShows: count(tvShowCount),
          episodes: count(episodeCount),
          artists: count(artistCount),
          albums: Number(albumCount[0].total),
          authors: count(authorCount),
          books: count(bookCount),
        },
        missing: {
          movies: count(missingMovies),
          episodes: count(missingEpisodes),
          albums: Number(missingAlbums[0].total),
          books: count(missingBooks),
        },
        activeDownloadCount: count(activeDownloads),
        failedLastDay: count(failedLastDay),
        recentAdditions: this.recentFromImports(recentImports),
        health: {
          downloadClients: downloadClients.map((dc) => ({
            id: dc.id,
            name: dc.name,
            type: dc.type,
            enabled: dc.enabled,
          })),
          indexers: indexers.map((idx) => ({
            id: idx.id,
            name: idx.name,
            type: idx.type,
            enabled: idx.enabled,
          })),
        },
      })
    } catch (error) {
      logger.error({ err: error }, 'Dashboard query failed')
      return inertia.render('dashboard', EMPTY_PROPS)
    }
  }

  /**
   * The last things that actually landed on disk, one entry per title: a
   * season's worth of episode imports is one show, not twelve rows.
   */
  private recentFromImports(imports: History[]): RecentItem[] {
    const seen = new Set<string>()
    const items: RecentItem[] = []
    const push = (item: RecentItem) => {
      const key = `${item.type}:${item.id}`
      if (seen.has(key)) return
      seen.add(key)
      items.push(item)
    }

    for (const h of imports) {
      const addedAt = h.createdAt.toISO()!
      if (h.movie) {
        push({
          id: h.movie.id,
          title: h.movie.title,
          type: 'movie',
          imageUrl: h.movie.posterUrl,
          addedAt,
          year: h.movie.year,
          subtitle: null,
        })
      } else if (h.tvShow) {
        push({
          id: h.tvShow.id,
          title: h.tvShow.title,
          type: 'tvshow',
          imageUrl: h.tvShow.posterUrl,
          addedAt,
          year: h.tvShow.year,
          subtitle: h.tvShow.network,
        })
      } else if (h.album) {
        push({
          id: h.album.id,
          title: h.album.title,
          type: 'album',
          imageUrl: h.album.imageUrl,
          addedAt,
          year: h.album.releaseDate?.year ?? null,
          subtitle: h.album.artist?.name ?? null,
        })
      } else if (h.book) {
        push({
          id: h.book.id,
          title: h.book.title,
          type: 'book',
          imageUrl: h.book.coverUrl,
          addedAt,
          year: h.book.releaseDate?.year ?? null,
          subtitle: h.book.author?.name ?? null,
        })
      }
      if (items.length >= 12) break
    }
    return items
  }
}
