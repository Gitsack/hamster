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
import ScheduledTask from '#models/scheduled_task'
import { healthState, mediaFolderLabel, type HealthLevel } from '#services/system/health_state'
import { countFailedDeliveries24h } from '#services/system/delivery_failures'

interface RecentItem {
  id: string
  title: string
  type: 'movie' | 'tvshow' | 'album' | 'book'
  imageUrl: string | null
  addedAt: string
  year: number | null
  subtitle: string | null
}

export interface DashboardHealth {
  level: HealthLevel
  checkedAt: string | null
  /** Admins get Fix links; everyone else sees the same facts without them. */
  canManage: boolean
  /** False when the dashboard's queries failed: clients and indexers are unknown, not absent. */
  configLoaded: boolean
  downloadClients: {
    id: string
    name: string
    type: string
    enabled: boolean
    /** `unknown` until the monitor has probed it (just booted, or just added). */
    status: 'ok' | 'error' | 'unknown'
    message: string | null
    since: string | null
  }[]
  indexers: { enabled: number; total: number }
  rootFolders: { total: number; problems: { label: string; status: string; message: string }[] }
  freeBytes: number | null
  /** Set only when the database check is not ok. */
  database: { status: string; message: string; since: string } | null
  failedTasks: { id: string; name: string; lastError: string | null; lastRunAt: string | null }[]
  backup: { lastRunAt: string | null; lastStatus: string | null } | null
  failedDeliveries: number
}

const EMPTY_HEALTH: DashboardHealth = {
  level: 'starting',
  checkedAt: null,
  canManage: false,
  configLoaded: false,
  downloadClients: [],
  indexers: { enabled: 0, total: 0 },
  rootFolders: { total: 0, problems: [] },
  freeBytes: null,
  database: null,
  failedTasks: [],
  backup: null,
  failedDeliveries: 0,
}

const EMPTY_PROPS = {
  stats: { movies: 0, tvShows: 0, episodes: 0, artists: 0, albums: 0, authors: 0, books: 0 },
  missing: { movies: 0, episodes: 0, albums: 0, books: 0 },
  activeDownloadCount: 0,
  stuck: { count: 0, titles: [] as string[] },
  recentAdditions: [] as RecentItem[],
  health: EMPTY_HEALTH,
}

export default class DashboardController {
  async index({ inertia, logger, auth }: HttpContext) {
    const canManage = Boolean(auth.user?.isAdmin)
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
        backupTask,
        failedDeliveries,
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
        ScheduledTask.query().where('type', 'backup').first(),
        canManage ? countFailedDeliveries24h() : Promise.resolve(0),
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
        health: this.health({
          canManage,
          configLoaded: true,
          downloadClients,
          indexers,
          backupTask,
          failedDeliveries,
        }),
      })
    } catch (error) {
      logger.error({ err: error }, 'Dashboard query failed')
      return inertia.render('dashboard', {
        ...EMPTY_PROPS,
        health: this.health({ canManage, configLoaded: false }),
      })
    }
  }

  /**
   * Services, from configuration plus the health monitor's cache. Reads memory
   * only: the page never waits on a live probe, so a download client that
   * hangs cannot hold up the dashboard.
   */
  private health({
    canManage,
    configLoaded,
    downloadClients = [],
    indexers = [],
    backupTask = null,
    failedDeliveries = 0,
  }: {
    canManage: boolean
    configLoaded: boolean
    downloadClients?: DownloadClient[]
    indexers?: Indexer[]
    backupTask?: ScheduledTask | null
    failedDeliveries?: number
  }): DashboardHealth {
    const cached = healthState.result
    const probed = new Map((cached?.downloadClients ?? []).map((c) => [c.id, c]))
    const database = cached?.checks.find((c) => c.name === 'database')
    const folders = cached?.rootFolders ?? []

    return {
      level: healthState.isStale() ? 'error' : healthState.level,
      checkedAt: cached?.checkedAt ?? null,
      canManage,
      configLoaded,
      downloadClients: downloadClients.map((dc) => {
        const probe = dc.enabled ? probed.get(dc.id) : undefined
        return {
          id: dc.id,
          name: dc.name,
          type: dc.type,
          enabled: dc.enabled,
          status: probe?.status ?? 'unknown',
          message: probe?.status === 'error' ? probe.message : null,
          since: probe?.since ?? null,
        }
      }),
      indexers: {
        enabled: indexers.filter((i) => i.enabled).length,
        total: indexers.length,
      },
      rootFolders: {
        total: folders.length,
        problems: folders
          .filter((f) => f.status !== 'ok')
          .map((f) => ({
            label: canManage ? f.path : mediaFolderLabel(f.mediaType),
            status: f.status,
            message: f.message,
          })),
      },
      freeBytes: cached?.freeBytes ?? null,
      database:
        database && database.status !== 'ok'
          ? { status: database.status, message: database.message, since: database.since }
          : null,
      failedTasks: canManage
        ? healthState.failedTasks.map((t) => ({
            id: t.id,
            name: t.name,
            lastError: t.lastError,
            lastRunAt: t.lastRunAt,
          }))
        : [],
      backup: backupTask
        ? { lastRunAt: backupTask.lastRunAt?.toISO() ?? null, lastStatus: backupTask.lastStatus }
        : null,
      failedDeliveries,
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
