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
  stuck: { count: 0, titles: [] as string[] },
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
        stuck,
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
        this.stuckTitles(),
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
        stuck,
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
   * Titles that are stuck: a download or import failed in the last day, the
   * title is still wanted and still not on disk, and nothing new is
   * downloading for it. Failed attempts on their own are routine — a release
   * missing articles is blacklisted and the next one grabbed — so they are not
   * counted; only a failure nothing has recovered from is worth a look.
   */
  private async stuckTitles(): Promise<{ count: number; titles: string[] }> {
    const { rows } = await db.rawQuery(`
      WITH failed AS (
        SELECT DISTINCT movie_id, episode_id, album_id, book_id
        FROM history
        WHERE event_type IN ('download_failed', 'import_failed')
          AND created_at > now() - interval '24 hours'
      ),
      active AS (
        SELECT movie_id, episode_id, album_id, book_id
        FROM downloads
        WHERE status IN ('queued', 'downloading', 'paused', 'importing')
      )
      SELECT m.title FROM failed f JOIN movies m ON m.id = f.movie_id
        WHERE m.has_file = false AND m.monitored = true
          AND NOT EXISTS (SELECT 1 FROM active a WHERE a.movie_id = m.id)
      UNION
      SELECT s.title || ' S' || lpad(e.season_number::text, 2, '0') || 'E' || lpad(e.episode_number::text, 2, '0')
        FROM failed f JOIN episodes e ON e.id = f.episode_id JOIN tv_shows s ON s.id = e.tv_show_id
        WHERE e.has_file = false AND e.requested = true
          AND NOT EXISTS (SELECT 1 FROM active a WHERE a.episode_id = e.id)
      UNION
      SELECT ar.name || ' – ' || al.title
        FROM failed f JOIN albums al ON al.id = f.album_id JOIN artists ar ON ar.id = al.artist_id
        WHERE al.requested = true
          AND NOT EXISTS (SELECT 1 FROM track_files t WHERE t.album_id = al.id)
          AND NOT EXISTS (SELECT 1 FROM active a WHERE a.album_id = al.id)
      UNION
      SELECT b.title FROM failed f JOIN books b ON b.id = f.book_id
        WHERE b.has_file = false AND b.requested = true
          AND NOT EXISTS (SELECT 1 FROM active a WHERE a.book_id = b.id)
    `)
    const titles = (rows as { title: string }[]).map((r) => r.title).sort()
    return { count: titles.length, titles: titles.slice(0, 3) }
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
